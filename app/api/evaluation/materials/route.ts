import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords, getTenantAccessToken } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { asString, extractUrl, makeBitableFilter } from "@/lib/record-utils";

function config() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE9_ID;
  if (!appToken || !tableId) throw new Error("FEISHU_TABLE9_ID 未配置，请先执行 migrate-lifecycle");
  return { appToken, tableId };
}

function mapRecord(record: { record_id: string; fields: Record<string, unknown> }) {
  const f = record.fields;
  return {
    id: record.record_id,
    datasetId: asString(f["评测集ID"]),
    team: asString(f["团队名称"]),
    scene: asString(f["关联场景名"] || f["所属场景"]),
    panel: asString(f["资料板块"]),
    source: asString(f["资料来源"]),
    fileName: asString(f["文件名称"]),
    fileUrl: extractUrl(f["文件链接"]),
    fileToken: asString(f["文件Token"]),
    remark: asString(f["备注"]),
    submittedAt: Number(f["提交时间"] || 0),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = config();
    const sp = req.nextUrl.searchParams;
    const datasetId = sp.get("datasetId") || "";
    const team = sp.get("team") || "";
    const scene = sp.get("scene") || "";
    const filter = makeBitableFilter([
      datasetId ? `CurrentValue.[评测集ID]="${datasetId}"` : undefined,
      team ? `CurrentValue.[团队名称]="${team}"` : undefined,
      scene ? `(CurrentValue.[关联场景名]="${scene}" OR CurrentValue.[所属场景]="${scene}")` : undefined,
    ]);
    const records = await getAllRecords(appToken, tableId, filter);
    return NextResponse.json({ success: true, items: records.map(mapRecord) });
  } catch (err) {
    console.error("[evaluation/materials] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const { appToken, tableId } = config();
    const body = await req.json();
    const datasetId = asString(body.datasetId);
    const panel = asString(body.panel);
    if (!datasetId || !["输入A样本", "人工输出C结果"].includes(panel)) {
      return NextResponse.json({ error: "评测集ID和资料板块不能为空" }, { status: 400 });
    }
    const files = Array.isArray(body.files) ? body.files : [body];
    const ids: string[] = [];
    for (const file of files) {
      const fileUrl = asString(file.fileUrl || file.url);
      const fileName = asString(file.fileName || file.file_name || fileUrl);
      const rec = await addRecord(appToken, tableId, {
        评测集ID: datasetId,
        团队名称: asString(body.team),
        关联场景名: asString(body.scene),
        资料板块: panel,
        资料来源: asString(file.source || body.source) || (fileUrl ? "飞书云文档" : "本地文件"),
        文件名称: fileName,
        文件链接: fileUrl ? { link: fileUrl, text: fileName || fileUrl } : undefined,
        文件Token: asString(file.fileToken || file.file_token),
        备注: asString(file.remark || body.remark),
        提交者: [{ id: session.user.open_id }],
        提交时间: Date.now(),
      });
      ids.push(rec.record_id);
    }
    return NextResponse.json({ success: true, ids });
  } catch (err) {
    console.error("[evaluation/materials] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const { appToken, tableId } = config();
    const recordId = req.nextUrl.searchParams.get("recordId") || "";
    if (!recordId) return NextResponse.json({ error: "recordId 不能为空" }, { status: 400 });
    const token = await getTenantAccessToken();
    const res = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (data.code !== 0) return NextResponse.json({ error: data.msg }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
