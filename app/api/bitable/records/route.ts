/**
 * Bitable 记录 CRUD
 * GET   /api/bitable/records?table=1&team=xxx
 * POST  /api/bitable/records  { table, fields }   — 新增记录
 * PATCH /api/bitable/records  { table, recordId, fields } — 更新记录
 */
import { NextRequest, NextResponse } from "next/server";
import { addRecord, updateRecord, getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";

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
      filter = `AND(CurrentValue.[团队名称]="${team}",CurrentValue.[关联任务]="${taskName}")`;
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
