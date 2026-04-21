/**
 * 知识库条目 CRUD（Table7）
 *   GET  /api/knowledge?status=已提取&team=XXX
 *   POST /api/knowledge         → 一线操作 创建条目（状态=已提取）
 *   PATCH /api/knowledge { recordId, fields, action } →
 *      治理/整合对条目状态的推进：
 *        action=govern      → 角色 FOD一线AI管理，状态 已提取 → 治理中
 *        action=consolidate → 角色 FOD综管，状态 治理中 → 已整合
 *        action=archive     → 角色 FOD综管，状态 任意 → 已归档
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getAllRecords,
  addRecord,
  updateRecord,
} from "@/lib/feishu";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object" && "text" in x)
          return (x as { text?: string }).text || "";
        return "";
      })
      .filter(Boolean)
      .join("");
  }
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
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        return (o.name as string) || "";
      }
      return "";
    })
    .filter(Boolean);
}

export interface KnowledgeItem {
  recordId: string;
  title: string;
  team: string;
  process: string;
  section: string;
  node: string;
  scene: string;
  fileUrl: string;
  extractorNames: string[];
  governorNames: string[];
  consolidatorNames: string[];
  status: "已提取" | "治理中" | "已整合" | "已归档" | "";
  version: string;
  extractedAt: number;
  governedAt: number;
  consolidatedAt: number;
  updatedAt: number;
  remark: string;
}

function mapRecord(r: { record_id: string; fields: Record<string, unknown> }): KnowledgeItem {
  const f = r.fields;
  return {
    recordId: r.record_id,
    title: asString(f["条目标题"]),
    team: asString(f["团队名称"]),
    process: asString(f["端到端流程"]),
    section: asString(f["环节"]),
    node: asString(f["节点"]),
    scene: asString(f["关联场景名"]),
    fileUrl:
      asString(f["文件链接"]) ||
      (typeof f["文件链接"] === "object" && f["文件链接"] !== null
        ? ((f["文件链接"] as { link?: string }).link || "")
        : ""),
    extractorNames: extractPersonNames(f["提取人"]),
    governorNames: extractPersonNames(f["治理人"]),
    consolidatorNames: extractPersonNames(f["整合人"]),
    status: (asString(f["状态"]) || "") as KnowledgeItem["status"],
    version: asString(f["版本号"]),
    extractedAt: asNumber(f["提取时间"]),
    governedAt: asNumber(f["治理时间"]),
    consolidatedAt: asNumber(f["整合时间"]),
    updatedAt: asNumber(f["更新时间"]),
    remark: asString(f["备注"]),
  };
}

function getTable7() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE7_ID;
  if (!appToken || !tableId) {
    throw new Error(
      "FEISHU_TABLE7_ID 未配置，请先执行 POST /api/bitable/migrate-v4 并把返回的 tableId 写入 .env.local"
    );
  }
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getTable7();
    const status = req.nextUrl.searchParams.get("status") || "";
    const team = req.nextUrl.searchParams.get("team") || "";

    const filters: string[] = [];
    if (status) filters.push(`CurrentValue.[状态]="${status}"`);
    if (team) filters.push(`CurrentValue.[团队名称]="${team}"`);
    const filter = filters.length
      ? filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`
      : undefined;

    const all = await getAllRecords(appToken, tableId, filter);
    const items = all
      .map(mapRecord)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("[knowledge] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getTable7();
    const body = await req.json();
    const title =
      typeof body?.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "条目标题不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      条目标题: title,
      团队名称: String(body?.team || ""),
      端到端流程: String(body?.process || ""),
      环节: String(body?.section || ""),
      节点: String(body?.node || ""),
      关联场景名: String(body?.scene || ""),
      提取人: [{ id: session.user.open_id }],
      状态: "已提取",
      版本号: String(body?.version || "v1.0"),
      提取时间: now,
      更新时间: now,
      备注: String(body?.remark || ""),
    };
    const fileUrl =
      typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (fileUrl) {
      fields["文件链接"] = { link: fileUrl, text: fileUrl };
    }
    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[knowledge] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = getTable7();
    const body = await req.json();
    const recordId =
      typeof body?.recordId === "string" ? body.recordId.trim() : "";
    const action = String(body?.action || "");
    const remark = typeof body?.remark === "string" ? body.remark : undefined;
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId 不能为空" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const fields: Record<string, unknown> = { 更新时间: now };
    if (remark !== undefined) fields["备注"] = remark;

    switch (action) {
      case "govern":
        fields["状态"] = "治理中";
        fields["治理人"] = [{ id: session.user.open_id }];
        fields["治理时间"] = now;
        break;
      case "consolidate":
        fields["状态"] = "已整合";
        fields["整合人"] = [{ id: session.user.open_id }];
        fields["整合时间"] = now;
        break;
      case "archive":
        fields["状态"] = "已归档";
        fields["整合人"] = [{ id: session.user.open_id }];
        break;
      case "revert-to-extracted":
        fields["状态"] = "已提取";
        break;
      default:
        return NextResponse.json(
          { error: `未知 action: ${action}` },
          { status: 400 }
        );
    }

    await updateRecord(appToken, tableId, recordId, fields);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[knowledge] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
