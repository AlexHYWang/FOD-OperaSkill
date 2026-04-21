/**
 * Badcase 反馈（Table11）CRUD
 *   GET   /api/badcase?team=XXX&status=待分析
 *   POST  /api/badcase   一线操作提交 Badcase（状态=待分析）
 *   PATCH /api/badcase   { recordId, action, knowledgeRecordId? }
 *      action:
 *        · recycle-to-knowledge  → 状态=已入知识库，记录回流条目 ID，同时在 Table7 新建条目
 *        · fix                   → 状态=已修复
 *        · reject                → 状态=不受理
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { addRecord, getAllRecords, updateRecord } from "@/lib/feishu";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((x) =>
        typeof x === "string"
          ? x
          : x && typeof x === "object" && "text" in x
          ? (x as { text?: string }).text || ""
          : ""
      )
      .filter(Boolean)
      .join("");
  if (v && typeof v === "object" && "text" in (v as object))
    return (v as { text?: string }).text || "";
  return "";
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function extractPersonNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) =>
      typeof p === "string"
        ? p
        : p && typeof p === "object"
        ? ((p as { name?: string }).name || "")
        : ""
    )
    .filter(Boolean);
}

function getT11() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE11_ID;
  if (!appToken || !tableId) {
    throw new Error("FEISHU_TABLE11_ID 未配置，请先执行 migrate-v4");
  }
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getT11();
    const team = req.nextUrl.searchParams.get("team") || "";
    const status = req.nextUrl.searchParams.get("status") || "";

    const filters: string[] = [];
    if (team) filters.push(`CurrentValue.[团队名称]="${team}"`);
    if (status) filters.push(`CurrentValue.[状态]="${status}"`);
    const filter = filters.length
      ? filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`
      : undefined;

    const all = await getAllRecords(appToken, tableId, filter);
    const items = all
      .map((r) => ({
        recordId: r.record_id,
        title: asString(r.fields["Badcase标题"]),
        skillName: asString(r.fields["关联Skill"]),
        team: asString(r.fields["团队名称"]),
        caseDesc: asString(r.fields["用例描述"]),
        expected: asString(r.fields["期望结果"]),
        actual: asString(r.fields["实际结果"]),
        reporterNames: extractPersonNames(r.fields["反馈人"]),
        reportedAt: asNumber(r.fields["反馈时间"]),
        status: asString(r.fields["状态"]) || "待分析",
        knowledgeRef: asString(r.fields["回流知识库条目"]),
        handlerNames: extractPersonNames(r.fields["处理人"]),
        handledAt: asNumber(r.fields["处理时间"]),
        remark: asString(r.fields["备注"]),
      }))
      .sort((a, b) => b.reportedAt - a.reportedAt);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[badcase] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getT11();
    const body = await req.json();
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "Badcase 标题不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      Badcase标题: title,
      关联Skill: String(body?.skillName || ""),
      团队名称: String(body?.team || ""),
      用例描述: String(body?.caseDesc || ""),
      期望结果: String(body?.expected || ""),
      实际结果: String(body?.actual || ""),
      反馈人: [{ id: session.user.open_id }],
      反馈时间: now,
      状态: "待分析",
      备注: String(body?.remark || ""),
    };
    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[badcase] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getT11();
    const table7Id = process.env.FEISHU_TABLE7_ID;
    const body = await req.json();
    const recordId =
      typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const action = String(body?.action || "");
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId 不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      处理人: [{ id: session.user.open_id }],
      处理时间: now,
    };
    let knowledgeRecordId: string | undefined;

    switch (action) {
      case "recycle-to-knowledge": {
        fields["状态"] = "已入知识库";
        // 如果传了 knowledgeRecordId 就直接引用，否则自动在 Table7 新建条目
        if (typeof body?.knowledgeRecordId === "string" && body.knowledgeRecordId) {
          knowledgeRecordId = body.knowledgeRecordId;
        } else if (table7Id) {
          // 自动在 Table7 新建一条"来自 Badcase 回流"的条目
          const title = String(body?.title || "来自 Badcase 回流");
          const created = await addRecord(appToken, table7Id, {
            条目标题: `[Badcase回流] ${title}`,
            团队名称: String(body?.team || ""),
            关联场景名: String(body?.skillName || ""),
            提取人: [{ id: session.user.open_id }],
            状态: "已提取",
            版本号: "v1.0",
            提取时间: now,
            更新时间: now,
            备注: `回流自 Badcase 记录 ${recordId}`,
          });
          knowledgeRecordId = created.record_id;
        }
        if (knowledgeRecordId) {
          fields["回流知识库条目"] = knowledgeRecordId;
        }
        break;
      }
      case "fix":
        fields["状态"] = "已修复";
        break;
      case "reject":
        fields["状态"] = "不受理";
        break;
      default:
        return NextResponse.json(
          { error: `未知 action: ${action}` },
          { status: 400 }
        );
    }

    await updateRecord(appToken, tableId, recordId, fields);
    return NextResponse.json({
      success: true,
      knowledgeRecordId,
    });
  } catch (err) {
    console.error("[badcase] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
