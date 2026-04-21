/**
 * 评测集（Table9）CRUD
 *   GET  /api/evaluation/datasets?team=XXX
 *   POST /api/evaluation/datasets  新增评测集
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { addRecord, getAllRecords } from "@/lib/feishu";

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

function getT9() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE9_ID;
  if (!appToken || !tableId) {
    throw new Error("FEISHU_TABLE9_ID 未配置，请先执行 migrate-v4");
  }
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getT9();
    const team = req.nextUrl.searchParams.get("team") || "";
    const filter = team ? `CurrentValue.[团队名称]="${team}"` : undefined;
    const all = await getAllRecords(appToken, tableId, filter);
    const items = all
      .map((r) => ({
        recordId: r.record_id,
        name: asString(r.fields["评测集名称"]),
        team: asString(r.fields["团队名称"]),
        skillName: asString(r.fields["关联Skill"]),
        itemCount: asNumber(r.fields["题目数"]),
        fileUrl:
          asString(r.fields["文件链接"]) ||
          (typeof r.fields["文件链接"] === "object" && r.fields["文件链接"] !== null
            ? ((r.fields["文件链接"] as { link?: string }).link || "")
            : ""),
        uploaderNames: extractPersonNames(r.fields["上传人"]),
        uploadedAt: asNumber(r.fields["上传时间"]),
        version: asString(r.fields["版本"]),
        status: asString(r.fields["状态"]) || "草稿",
        remark: asString(r.fields["备注"]),
      }))
      .sort((a, b) => b.uploadedAt - a.uploadedAt);
    return NextResponse.json({ success: true, items });
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
    const { appToken, tableId } = getT9();
    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "评测集名称不能为空" }, { status: 400 });
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      评测集名称: name,
      团队名称: String(body?.team || ""),
      关联Skill: String(body?.skillName || ""),
      题目数: Number(body?.itemCount) || 0,
      上传人: [{ id: session.user.open_id }],
      上传时间: now,
      版本: String(body?.version || "v1.0"),
      状态: "可用",
      备注: String(body?.remark || ""),
    };
    const fileUrl =
      typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (fileUrl) fields["文件链接"] = { link: fileUrl, text: fileUrl };

    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[evaluation/datasets] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
