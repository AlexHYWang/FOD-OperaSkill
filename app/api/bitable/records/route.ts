/**
 * Bitable 记录 CRUD
 * GET   /api/bitable/records?table=1&team=xxx
 * POST  /api/bitable/records  { table, fields }   — 新增记录
 * PATCH /api/bitable/records  { table, recordId, fields } — 更新记录
 */
import { NextRequest, NextResponse } from "next/server";
import {
  addRecord,
  updateRecord,
  getAllRecords,
  deleteRecord,
} from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { isAdminUser } from "@/lib/user-profile";

const TABLE_ENV_MAP: Record<string, string> = {
  "1": "FEISHU_TABLE1_ID",
  "2": "FEISHU_TABLE2_ID",
  "3": "FEISHU_TABLE3_ID",
  "4": "FEISHU_TABLE4_ID",
  "5": "FEISHU_TABLE5_ID",
  "6": "FEISHU_TABLE6_ID",
};

function getTableConfig(tableNum: string) {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  if (!appToken)
    throw new Error("FEISHU_BITABLE_APP_TOKEN 未配置，请先运行 /api/bitable/init");

  const envKey = TABLE_ENV_MAP[tableNum];
  if (!envKey) throw new Error(`不支持的 table 编号: ${tableNum}`);

  const tableId = process.env[envKey];
  if (!tableId)
    throw new Error(`${envKey} 未配置，请先运行 /api/bitable/init-dashboard`);

  return { appToken, tableId };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tableNum = searchParams.get("table") || "1";
  const team = searchParams.get("team");
  const taskName = searchParams.get("task");

  try {
    const { appToken, tableId } = getTableConfig(tableNum);

    let filter: string | undefined;
    if (team && tableNum === "1") {
      filter = `CurrentValue.[团队名称]="${team}"`;
    } else if (team && taskName && tableNum === "2") {
      filter = `AND(CurrentValue.[团队名称]="${team}",CurrentValue.[所属场景]="${taskName}")`;
    } else if (team && tableNum === "2") {
      filter = `CurrentValue.[团队名称]="${team}"`;
    } else if (team && ["4", "5", "6"].includes(tableNum)) {
      // 看板表按团队名称过滤
      filter = `CurrentValue.[团队名称]="${team}"`;
    }

    const records = await getAllRecords(appToken, tableId, filter);

    return NextResponse.json({
      success: true,
      records: records.map((r) => ({ id: r.record_id, fields: r.fields })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { table, fields } = body as {
      table: string;
      fields: Record<string, unknown>;
    };

    const { appToken, tableId } = getTableConfig(table);

    // 注入提交者信息
    const enrichedFields = {
      ...fields,
      提交者: [{ id: session.user.open_id }],
      提交时间: Date.now(),
    };

    const record = await addRecord(appToken, tableId, enrichedFields);
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { table, recordId, fields } = body as {
      table: string;
      recordId: string;
      fields: Record<string, unknown>;
    };

    if (!recordId) {
      return NextResponse.json({ error: "recordId 不能为空" }, { status: 400 });
    }

    const { appToken, tableId } = getTableConfig(table);
    const record = await updateRecord(appToken, tableId, recordId, fields);
    return NextResponse.json({ success: true, record });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/bitable/records?table=1&recordId=xxx&force=1
 *
 * 目前仅开放 Table1（流程节点映射）的单条删除。
 * 默认行为：
 *   - 若该任务在 Table2 中已有提交（任意步骤），普通用户禁止删除，必须管理员且显式传 force=1 才放行。
 *   - 同名任务的 Table2 历史记录不做级联删除，由运维手工清理。
 */
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const tableNum = searchParams.get("table") || "1";
    const recordId = searchParams.get("recordId") || "";
    const force = searchParams.get("force") === "1";

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId 不能为空" },
        { status: 400 }
      );
    }
    if (tableNum !== "1") {
      return NextResponse.json(
        { error: "当前仅支持通过此接口删除 Table1（流程节点映射）记录" },
        { status: 400 }
      );
    }

    const { appToken, tableId } = getTableConfig(tableNum);

    // 读取当前记录，拿到 场景名称 + 团队
    const allT1 = await getAllRecords(appToken, tableId);
    const target = allT1.find((r) => r.record_id === recordId);
    if (!target) {
      return NextResponse.json(
        { error: "记录不存在或已被删除" },
        { status: 404 }
      );
    }
    const taskName = String(
      target.fields["场景名称"] || target.fields["任务名称"] || ""
    ).trim();
    const team = String(target.fields["团队名称"] || "").trim();

    // 检查该场景是否已有 Skill 创建（Table2）相关提交
    let hasSubmissions = false;
    if (taskName && team) {
      const table2Id = process.env.FEISHU_TABLE2_ID;
      if (table2Id) {
        const filter = `AND(CurrentValue.[团队名称]="${team}",CurrentValue.[所属场景]="${taskName}")`;
        const t2Records = await getAllRecords(appToken, table2Id, filter);
        hasSubmissions = t2Records.length > 0;
      }
    }

    if (hasSubmissions) {
      const admin = await isAdminUser(session.user.open_id);
      if (!admin) {
        return NextResponse.json(
          {
            error: "该任务已有任务二提交，仅管理员可删除",
            code: "NEED_ADMIN",
          },
          { status: 403 }
        );
      }
      if (!force) {
        return NextResponse.json(
          {
            error: "该任务已有任务二提交，请带 force=1 参数以确认删除",
            code: "NEED_FORCE",
          },
          { status: 409 }
        );
      }
    }

    await deleteRecord(appToken, tableId, recordId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[records] DELETE 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
