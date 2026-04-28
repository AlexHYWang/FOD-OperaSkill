import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords, updateRecord } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { asString, makeBitableFilter } from "@/lib/record-utils";
import { normalizeE2EProcessShortName } from "@/lib/constants";

function config() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE8_ID;
  const table1Id = process.env.FEISHU_TABLE1_ID;
  if (!appToken || !tableId || !table1Id) throw new Error("FEISHU_TABLE8_ID / FEISHU_TABLE1_ID 未配置，请先执行 migrate-lifecycle");
  return { appToken, tableId, table1Id };
}

function mapRecord(record: { record_id: string; fields: Record<string, unknown> }) {
  const f = record.fields;
  return {
    id: record.record_id,
    name: asString(f["评测集名称"]),
    team: asString(f["团队名称"]),
    scene: asString(f["关联场景名"] || f["所属场景"]),
    coverage: asString(f["覆盖范围说明"]),
    process: normalizeE2EProcessShortName(asString(f["端到端流程"])),
    section: asString(f["流程环节"] || f["环节"]),
    node: asString(f["流程节点"] || f["节点"]),
    status: asString(f["状态"]),
    createdAt: Number(f["创建时间"] || f["提交时间"] || 0),
    remark: asString(f["备注"]),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = config();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const scene = sp.get("scene") || "";
    const filter = makeBitableFilter([
      team ? `CurrentValue.[团队名称]="${team}"` : undefined,
      scene ? `(CurrentValue.[关联场景名]="${scene}" OR CurrentValue.[所属场景]="${scene}")` : undefined,
    ]);
    const records = await getAllRecords(appToken, tableId, filter);
    return NextResponse.json({
      success: true,
      items: records.map(mapRecord).sort((a, b) => b.createdAt - a.createdAt),
    });
  } catch (err) {
    console.error("[evaluation/datasets] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId, table1Id } = config();
    const body = await req.json();
    const team = asString(body.team);
    const scene = asString(body.scene);
    const coverage = asString(body.coverage);
    if (!team || !scene || !coverage) {
      return NextResponse.json({ error: "团队、场景、覆盖范围说明均不能为空" }, { status: 400 });
    }

    // 后端强制按流程节点映射表回填，避免前端传值偏差
    const mappings = await getAllRecords(
      appToken,
      table1Id,
      makeBitableFilter([
        `CurrentValue.[团队名称]="${team}"`,
        `CurrentValue.[场景名称]="${scene}"`,
      ])
    );
    const fallbackMappings =
      mappings.length > 0
        ? mappings
        : await getAllRecords(
            appToken,
            table1Id,
            makeBitableFilter([
              `CurrentValue.[团队名称]="${team}"`,
              `CurrentValue.[任务名称]="${scene}"`,
            ])
          );
    const first = fallbackMappings[0];
    if (!first) {
      return NextResponse.json({ error: "未在流程节点映射表找到该团队场景，请先完成场景梳理" }, { status: 400 });
    }

    const process = normalizeE2EProcessShortName(asString(first.fields["端到端流程"]));
    const section = asString(first.fields["流程环节"]);
    const node = asString(first.fields["流程节点"]);

    const now = Date.now();
    const record = await addRecord(appToken, tableId, {
      评测集名称: asString(body.name) || `${scene} · ${new Date(now).toLocaleDateString("zh-CN")}`,
      团队名称: team,
      关联场景名: scene,
      覆盖范围说明: coverage,
      端到端流程: process,
      流程环节: section,
      流程节点: node,
      状态: "可用",
      创建人: [{ id: session.user.open_id }],
      创建时间: now,
      备注: asString(body.remark),
    });
    return NextResponse.json({ success: true, id: record.record_id });
  } catch (err) {
    console.error("[evaluation/datasets] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = config();
    const body = await req.json();
    const recordId = asString(body.recordId);
    if (!recordId) return NextResponse.json({ error: "recordId 不能为空" }, { status: 400 });
    await updateRecord(appToken, tableId, recordId, {
      状态: asString(body.status) || "可用",
      备注: asString(body.remark),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[evaluation/datasets] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
