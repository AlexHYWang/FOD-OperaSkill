/**
 * 首页流程总览聚合接口
 *
 *   GET /api/workflow/overview?demo=1
 *   → 返回每个流程节点的徽章数字（真实：读多维表；demo=1：返回 Mock）
 *
 * 节点 key 与前端流程图一致：
 *   section1      · 流程梳理（Table1 场景数）
 *   kb_extract    · 知识库提取（Table7 已提取）
 *   kb_govern     · 知识库治理（Table7 治理中）
 *   kb_consolidate· 知识库整合（Table7 已整合）
 *   skill_train   · Skill 训练（Table2 步骤条数）
 *   eval_dataset  · 评测集（Table9 数量）
 *   eval_run      · 评测执行（Table10 最新准确率均值）
 *   prod_debug    · 生产级调试（演示态）
 *   prod_release  · 生产级发布（Table8 已发布）
 *   op_console    · Skill 操作中心（Table8 已发布可用）
 *   op_badcase    · Badcase 反馈（Table11 待分析）
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";

interface NodeStat {
  primary: number | string;
  primaryLabel: string;
  secondary?: string;
}

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

const DEMO_STATS: Record<string, NodeStat> = {
  section1: { primary: 187, primaryLabel: "条场景", secondary: "本周 +23" },
  kb_extract: { primary: 42, primaryLabel: "条已提取", secondary: "待治理 14" },
  kb_govern: { primary: 11, primaryLabel: "条治理中", secondary: "待整合 8" },
  kb_consolidate: { primary: 24, primaryLabel: "条已整合", secondary: "v1.0" },
  skill_train: { primary: 9, primaryLabel: "个训练中", secondary: "均 92%" },
  eval_dataset: { primary: 6, primaryLabel: "个评测集", secondary: "v1.2" },
  eval_run: { primary: "94.3%", primaryLabel: "近期准确率", secondary: "12 次评测" },
  prod_debug: { primary: 3, primaryLabel: "个调试中", secondary: "演示态" },
  prod_release: { primary: 5, primaryLabel: "个已发布", secondary: "v2.0" },
  op_console: { primary: 8, primaryLabel: "个可用 Skill", secondary: "本周 42 次调用" },
  op_badcase: { primary: 7, primaryLabel: "条待分析", secondary: "2 已回流" },
};

async function getRealStats(): Promise<Record<string, NodeStat>> {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const t1 = process.env.FEISHU_TABLE1_ID;
  const t2 = process.env.FEISHU_TABLE2_ID;
  const t7 = process.env.FEISHU_TABLE7_ID;
  const t8 = process.env.FEISHU_TABLE8_ID;
  const t9 = process.env.FEISHU_TABLE9_ID;
  const t10 = process.env.FEISHU_TABLE10_ID;
  const t11 = process.env.FEISHU_TABLE11_ID;

  const stats: Record<string, NodeStat> = {
    section1: { primary: 0, primaryLabel: "条场景" },
    kb_extract: { primary: 0, primaryLabel: "条已提取" },
    kb_govern: { primary: 0, primaryLabel: "条治理中" },
    kb_consolidate: { primary: 0, primaryLabel: "条已整合" },
    skill_train: { primary: 0, primaryLabel: "个训练中" },
    eval_dataset: { primary: 0, primaryLabel: "个评测集" },
    eval_run: { primary: "-", primaryLabel: "近期准确率" },
    prod_debug: { primary: 0, primaryLabel: "个调试中", secondary: "演示态" },
    prod_release: { primary: 0, primaryLabel: "个已发布" },
    op_console: { primary: 0, primaryLabel: "个可用 Skill" },
    op_badcase: { primary: 0, primaryLabel: "条待分析" },
  };

  if (!appToken) return stats;

  try {
    if (t1) {
      const all = await getAllRecords(appToken, t1);
      stats.section1.primary = all.length;
    }
  } catch {}
  try {
    if (t2) {
      const all = await getAllRecords(appToken, t2);
      stats.skill_train.primary = all.length;
    }
  } catch {}
  try {
    if (t7) {
      const all = await getAllRecords(appToken, t7);
      let a = 0;
      let b = 0;
      let c = 0;
      for (const r of all) {
        const status = asString(r.fields["状态"]);
        if (status === "已提取") a += 1;
        else if (status === "治理中") b += 1;
        else if (status === "已整合") c += 1;
      }
      stats.kb_extract.primary = a;
      stats.kb_govern.primary = b;
      stats.kb_consolidate.primary = c;
    }
  } catch {}
  try {
    if (t8) {
      const all = await getAllRecords(appToken, t8);
      let released = 0;
      let debug = 0;
      for (const r of all) {
        const status = asString(r.fields["状态"]);
        if (status === "已发布") released += 1;
        else if (status === "生产调试中") debug += 1;
      }
      stats.prod_debug.primary = debug;
      stats.prod_release.primary = released;
      stats.op_console.primary = released;
    }
  } catch {}
  try {
    if (t9) {
      const all = await getAllRecords(appToken, t9);
      stats.eval_dataset.primary = all.length;
    }
  } catch {}
  try {
    if (t10) {
      const all = await getAllRecords(appToken, t10);
      if (all.length > 0) {
        const sum = all.reduce(
          (s, r) => s + asNumber(r.fields["准确率(%)"]),
          0
        );
        const avg = sum / all.length;
        stats.eval_run.primary = `${avg.toFixed(1)}%`;
        stats.eval_run.secondary = `${all.length} 次评测`;
      }
    }
  } catch {}
  try {
    if (t11) {
      const all = await getAllRecords(appToken, t11);
      let pending = 0;
      let recycled = 0;
      for (const r of all) {
        const status = asString(r.fields["状态"]);
        if (status === "待分析") pending += 1;
        else if (status === "已入知识库") recycled += 1;
      }
      stats.op_badcase.primary = pending;
      stats.op_badcase.secondary =
        recycled > 0 ? `${recycled} 已回流` : undefined;
    }
  } catch {}

  return stats;
}

export async function GET(req: NextRequest) {
  const isDemo = req.nextUrl.searchParams.get("demo") === "1";
  if (isDemo) {
    return NextResponse.json({
      success: true,
      demo: true,
      stats: DEMO_STATS,
    });
  }
  try {
    const stats = await getRealStats();
    return NextResponse.json({ success: true, demo: false, stats });
  } catch (err) {
    console.error("[workflow/overview] 聚合失败:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
