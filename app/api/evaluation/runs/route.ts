/**
 * 评测记录（Table10）CRUD
 *   GET  /api/evaluation/runs?team=XXX
 *   POST /api/evaluation/runs  新增评测记录（一次评测结果）
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

function getT10() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE10_ID;
  if (!appToken || !tableId) {
    throw new Error("FEISHU_TABLE10_ID 未配置，请先执行 migrate-v4");
  }
  return { appToken, tableId };
}

export async function GET(req: NextRequest) {
  try {
    const { appToken, tableId } = getT10();
    const team = req.nextUrl.searchParams.get("team") || "";
    const filter = team ? `CurrentValue.[团队名称]="${team}"` : undefined;
    const all = await getAllRecords(appToken, tableId, filter);
    const items = all
      .map((r) => ({
        recordId: r.record_id,
        skillName: asString(r.fields["关联Skill"]),
        datasetName: asString(r.fields["关联评测集"]),
        team: asString(r.fields["团队名称"]),
        accuracy: asNumber(r.fields["准确率(%)"]),
        correct: asNumber(r.fields["正确数"]),
        wrong: asNumber(r.fields["错误数"]),
        stage: asString(r.fields["评测阶段"]),
        evaluatorNames: extractPersonNames(r.fields["评测人"]),
        evaluatedAt: asNumber(r.fields["评测时间"]),
        reportUrl:
          asString(r.fields["报告链接"]) ||
          (typeof r.fields["报告链接"] === "object" && r.fields["报告链接"] !== null
            ? ((r.fields["报告链接"] as { link?: string }).link || "")
            : ""),
        remark: asString(r.fields["备注"]),
      }))
      .sort((a, b) => b.evaluatedAt - a.evaluatedAt);
    return NextResponse.json({ success: true, items });
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
    const { appToken, tableId } = getT10();
    const body = await req.json();
    const skillName =
      typeof body?.skillName === "string" ? body.skillName.trim() : "";
    const datasetName =
      typeof body?.datasetName === "string" ? body.datasetName.trim() : "";
    const correct = Math.max(0, Math.floor(Number(body?.correct) || 0));
    const wrong = Math.max(0, Math.floor(Number(body?.wrong) || 0));
    const total = correct + wrong;
    if (!skillName || !datasetName) {
      return NextResponse.json(
        { error: "关联 Skill 和评测集均不能为空" },
        { status: 400 }
      );
    }
    if (total <= 0) {
      return NextResponse.json(
        { error: "正确数 + 错误数 至少要有 1 题" },
        { status: 400 }
      );
    }
    const accuracy =
      typeof body?.accuracy === "number" && Number.isFinite(body.accuracy)
        ? Math.max(0, Math.min(100, Number(body.accuracy)))
        : Math.round((correct / total) * 1000) / 10;

    const now = Date.now();
    const fields: Record<string, unknown> = {
      关联Skill: skillName,
      关联评测集: datasetName,
      团队名称: String(body?.team || ""),
      "准确率(%)": accuracy,
      正确数: correct,
      错误数: wrong,
      评测阶段: String(body?.stage || "财务训练"),
      评测人: [{ id: session.user.open_id }],
      评测时间: now,
      备注: String(body?.remark || ""),
    };
    const reportUrl =
      typeof body?.reportUrl === "string" ? body.reportUrl.trim() : "";
    if (reportUrl) fields["报告链接"] = { link: reportUrl, text: reportUrl };

    const rec = await addRecord(appToken, tableId, fields);
    return NextResponse.json({
      success: true,
      recordId: rec.record_id,
      accuracy,
    });
  } catch (err) {
    console.error("[evaluation/runs] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
