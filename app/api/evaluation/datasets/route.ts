/**
 * 评测数据源（评测集 · Table9）CRUD · prd_mock v2
 *   GET  /api/evaluation/datasets?team=XXX&skillName=XXX&scene=XXX
 *   POST /api/evaluation/datasets  新增评测数据源
 *
 * prd_mock v2：评测集 = 「评测数据源」+「人工标准答案」
 *   - 本 API 管理数据源记录（输入载荷/返回结果等；飞书列名仍含「快照」等历史字段）
 *   - 「人工标准答案」见 /api/evaluation/answers（支持 1 数据源对 N 答案）
 *
 * 扩展字段（Table9 软兼容：未建字段时仍能 GET / POST，只是该字段为空）：
 *   - 来源类型         single_select（MCP线上抽样 / 离线上传）
 *   - 来源系统         text
 *   - 来源说明         text
 *   - 截图链接         URL
 *   - 输入载荷         text （JSON 字符串）
 *   - 返回结果         text （JSON 字符串）
 *   - 关联场景名       text
 *   - 快照时间戳       number
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

function asUrl(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "link" in (v as object)) {
    return (v as { link?: string }).link || "";
  }
  return "";
}

function getT9() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE9_ID;
  if (!appToken || !tableId) {
    throw new Error("FEISHU_TABLE9_ID 未配置，请先执行 migrate-v4");
  }
  return { appToken, tableId };
}

export interface SnapshotItem {
  recordId: string;
  name: string;
  team: string;
  skillName: string;
  scene: string;
  itemCount: number;
  source: "MCP线上抽样" | "离线上传" | "";
  systemName: string;
  systemDesc: string;
  screenshotUrl: string;
  inputPayload: string;
  outputPayload: string;
  fileUrl: string;
  uploaderNames: string[];
  uploadedAt: number;
  snapshotAt: number;
  version: string;
  status: string;
  remark: string;
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getT9();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const skillName = sp.get("skillName") || "";
    const scene = sp.get("scene") || "";
    const filters: string[] = [];
    if (team) filters.push(`CurrentValue.[团队名称]="${team}"`);
    if (skillName) filters.push(`CurrentValue.[关联Skill]="${skillName}"`);
    if (scene) filters.push(`CurrentValue.[关联场景名]="${scene}"`);
    const filter = filters.length
      ? filters.length === 1
        ? filters[0]
        : `AND(${filters.join(",")})`
      : undefined;

    const all = await getAllRecords(appToken, tableId, filter);
    const items: SnapshotItem[] = all
      .map((r) => ({
        recordId: r.record_id,
        name: asString(r.fields["评测集名称"]),
        team: asString(r.fields["团队名称"]),
        skillName: asString(r.fields["关联Skill"]),
        scene: asString(r.fields["关联场景名"]),
        itemCount: asNumber(r.fields["题目数"]),
        source: (asString(r.fields["来源类型"]) || "") as SnapshotItem["source"],
        systemName: asString(r.fields["来源系统"]),
        systemDesc: asString(r.fields["来源说明"]),
        screenshotUrl: asUrl(r.fields["截图链接"]),
        inputPayload: asString(r.fields["输入载荷"]),
        outputPayload: asString(r.fields["返回结果"]),
        fileUrl: asUrl(r.fields["文件链接"]),
        uploaderNames: extractPersonNames(r.fields["上传人"]),
        uploadedAt: asNumber(r.fields["上传时间"]),
        snapshotAt: asNumber(r.fields["快照时间戳"]),
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
      return NextResponse.json(
        { error: "数据源名称不能为空" },
        { status: 400 }
      );
    }
    const now = Date.now();
    const fields: Record<string, unknown> = {
      评测集名称: name,
      团队名称: String(body?.team || ""),
      关联Skill: String(body?.skillName || ""),
      关联场景名: String(body?.scene || ""),
      题目数: Number(body?.itemCount) || 0,
      上传人: [{ id: session.user.open_id }],
      上传时间: now,
      版本: String(body?.version || "v1.0"),
      状态: "可用",
      备注: String(body?.remark || ""),
    };
    if (typeof body?.source === "string" && body.source) {
      fields["来源类型"] = body.source;
    }
    if (typeof body?.systemName === "string" && body.systemName)
      fields["来源系统"] = body.systemName;
    if (typeof body?.systemDesc === "string" && body.systemDesc)
      fields["来源说明"] = body.systemDesc;
    if (typeof body?.inputPayload === "string" && body.inputPayload)
      fields["输入载荷"] = body.inputPayload;
    if (typeof body?.outputPayload === "string" && body.outputPayload)
      fields["返回结果"] = body.outputPayload;
    if (typeof body?.snapshotAt === "number") fields["快照时间戳"] = body.snapshotAt;

    const fileUrl =
      typeof body?.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (fileUrl) fields["文件链接"] = { link: fileUrl, text: fileUrl };
    const screenshotUrl =
      typeof body?.screenshotUrl === "string" ? body.screenshotUrl.trim() : "";
    if (screenshotUrl)
      fields["截图链接"] = { link: screenshotUrl, text: screenshotUrl };

    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
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
    const { appToken, tableId } = getT9();
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
    const fields: Record<string, unknown> = {};
    if (action === "archive") fields["状态"] = "已归档";
    else if (action === "enable") fields["状态"] = "可用";
    else
      return NextResponse.json(
        { error: `未知 action: ${action}` },
        { status: 400 }
      );
    await updateRecord(appToken, tableId, recordId, fields);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[evaluation/datasets] PATCH 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
