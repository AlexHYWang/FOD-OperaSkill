import { NextRequest, NextResponse } from "next/server";
import { addRecord, getAllRecords, listFields } from "@/lib/feishu";
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
    const normalizeFiles = (value: unknown): Array<{ file_name: string; url: string; file_token: string }> => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => {
          const obj = item as Record<string, unknown>;
          const file_name = asString(obj.file_name);
          const url = asString(obj.url);
          const file_token = asString(obj.file_token);
          if (!url) return null;
          return { file_name, url, file_token };
        })
        .filter((x): x is { file_name: string; url: string; file_token: string } => !!x);
    };

    const outputFiles = normalizeFiles(body.outputFiles);
    const reportFiles = normalizeFiles(body.reportFiles);

    // 兼容旧前端单文件字段
    if (outputFiles.length === 0) {
      const outputUrl = asString(body.outputFileUrl);
      if (outputUrl) {
        outputFiles.push({
          file_name: asString(body.outputFileName) || outputUrl,
          url: outputUrl,
          file_token: asString(body.outputFileToken),
        });
      }
    }
    if (reportFiles.length === 0) {
      const reportUrl = asString(body.reportFileUrl);
      if (reportUrl) {
        reportFiles.push({
          file_name: asString(body.reportFileName) || reportUrl,
          url: reportUrl,
          file_token: asString(body.reportFileToken),
        });
      }
    }

    if (outputFiles.length === 0 || reportFiles.length === 0) {
      return NextResponse.json(
        { error: "机器输出C结果与对比分析报告均至少上传 1 个文件" },
        { status: 400 }
      );
    }

    const tableFields = await listFields(appToken, tableId);
    const fieldNames = new Set(tableFields.map((f) => f.field_name));
    const hasOutputTokenField = fieldNames.has("机器输出C结果文件Token");
    const hasReportTokenField = fieldNames.has("对比分析报告文件Token");

    const recordCount = Math.max(outputFiles.length, reportFiles.length);
    const ids: string[] = [];
    for (let i = 0; i < recordCount; i += 1) {
      const output = outputFiles[Math.min(i, outputFiles.length - 1)];
      const report = reportFiles[Math.min(i, reportFiles.length - 1)];
      const outputName = output.file_name || output.url;
      const reportName = report.file_name || report.url;
      const fields: Record<string, unknown> = {
        团队名称: asString(body.team),
        关联场景名: scene,
        评测集ID: datasetId,
        SKILL记录ID: asString(body.skillRecordId),
        知识库版本: asString(body.knowledgeVersion),
        SKILL版本: asString(body.skillVersion),
        机器输出C结果文件名: outputName,
        机器输出C结果链接: output.url
          ? { link: output.url, text: outputName || output.url }
          : undefined,
        对比分析报告文件名: reportName,
        对比分析报告链接: report.url
          ? { link: report.url, text: reportName || report.url }
          : undefined,
        "准确率(%)": accuracy,
        测试工具: asString(body.tool) || "财多多",
        测试人: [{ id: session.user.open_id }],
        测试时间: Number(body.testedAt) || Date.now(),
        备注: asString(body.remark),
        提交者: [{ id: session.user.open_id }],
        提交时间: Date.now(),
      };
      if (hasOutputTokenField && output.file_token) {
        fields["机器输出C结果文件Token"] = output.file_token;
      }
      if (hasReportTokenField && report.file_token) {
        fields["对比分析报告文件Token"] = report.file_token;
      }
      const record = await addRecord(appToken, tableId, fields);
      ids.push(record.record_id);
    }
    return NextResponse.json({ success: true, ids, count: ids.length });
  } catch (err) {
    console.error("[evaluation/runs] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
