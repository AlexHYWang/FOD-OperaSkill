import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { asNumber, asString, extractPersonNames, extractUrl, makeBitableFilter } from "@/lib/record-utils";

function config() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE11_ID;
  if (!appToken || !tableId) throw new Error("FEISHU_TABLE11_ID 未配置，请先执行 migrate-lifecycle");
  return { appToken, tableId };
}

function mapRecord(record: { record_id: string; fields: Record<string, unknown> }) {
  const f = record.fields;
  return {
    id: record.record_id,
    team: asString(f["团队名称"]),
    scene: asString(f["关联场景名"] || f["所属场景"]),
    datasetId: asString(f["评测集ID"]),
    skillRecordId: asString(f["SKILL记录ID"]),
    knowledgeVersion: asString(f["知识库版本"]),
    skillVersion: asString(f["SKILL版本"]),
    outputFileName: asString(f["机器输出C结果文件名"]),
    outputFileUrl: extractUrl(f["机器输出C结果链接"]),
    reportFileName: asString(f["对比分析报告文件名"]),
    reportFileUrl: extractUrl(f["对比分析报告链接"]),
    accuracy: asNumber(f["准确率(%)"]),
    tool: asString(f["测试工具"]),
    testers: extractPersonNames(f["测试人"]),
    testedAt: asNumber(f["测试时间"]),
    submittedAt: asNumber(f["提交时间"]),
    remark: asString(f["备注"]),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = config();
    const sp = req.nextUrl.searchParams;
    const team = sp.get("team") || "";
    const scene = sp.get("scene") || "";
    const datasetId = sp.get("datasetId") || "";
    const filter = makeBitableFilter([
      team ? `CurrentValue.[团队名称]="${team}"` : undefined,
      scene ? `(CurrentValue.[关联场景名]="${scene}" OR CurrentValue.[所属场景]="${scene}")` : undefined,
      datasetId ? `CurrentValue.[评测集ID]="${datasetId}"` : undefined,
    ]);
    const records = await getAllRecords(appToken, tableId, filter);
    return NextResponse.json({
      success: true,
      items: records.map(mapRecord).sort((a, b) => b.submittedAt - a.submittedAt),
    });
  } catch (err) {
    console.error("[evaluation/runs] GET 失败:", err);
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
    const scene = asString(body.scene);
    const accuracy = asNumber(body.accuracy);
    if (!datasetId || !scene) {
      return NextResponse.json({ error: "评测集和场景不能为空" }, { status: 400 });
    }
    if (accuracy < 0 || accuracy > 100) {
      return NextResponse.json({ error: "准确率必须在 0-100 之间" }, { status: 400 });
    }
    const outputUrl = asString(body.outputFileUrl);
    const reportUrl = asString(body.reportFileUrl);
    const outputName = asString(body.outputFileName) || outputUrl;
    const reportName = asString(body.reportFileName) || reportUrl;
    const record = await addRecord(appToken, tableId, {
      团队名称: asString(body.team),
      关联场景名: scene,
      评测集ID: datasetId,
      SKILL记录ID: asString(body.skillRecordId),
      知识库版本: asString(body.knowledgeVersion),
      SKILL版本: asString(body.skillVersion),
      机器输出C结果文件名: outputName,
      机器输出C结果链接: outputUrl ? { link: outputUrl, text: outputName || outputUrl } : undefined,
      对比分析报告文件名: reportName,
      对比分析报告链接: reportUrl ? { link: reportUrl, text: reportName || reportUrl } : undefined,
      "准确率(%)": accuracy,
      测试工具: asString(body.tool) || "财多多",
      测试人: [{ id: session.user.open_id }],
      测试时间: Number(body.testedAt) || Date.now(),
      备注: asString(body.remark),
      提交者: [{ id: session.user.open_id }],
      提交时间: Date.now(),
    });
    return NextResponse.json({ success: true, id: record.record_id });
  } catch (err) {
    console.error("[evaluation/runs] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
