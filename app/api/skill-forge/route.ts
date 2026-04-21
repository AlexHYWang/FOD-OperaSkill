/**
 * 打磨 Skill 平台 · 数据持久化
 *   GET  /api/skill-forge?kind=sub-skill|report&parent=XXX
 *   POST /api/skill-forge  { kind, ...fields }
 *
 * Table12 = 子Skill 注册表（FEISHU_TABLE12_ID）
 * Table13 = 对比分析报告（FEISHU_TABLE13_ID）
 *
 * 软兼容：如对应 tableId 未配置（migrate-v5 未执行），走内存 Mock。
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

export interface SubSkillItem {
  recordId: string;
  name: string;
  parent: string;
  team: string;
  process: string;
  section: string;
  node: string;
  scene: string;
  stage: string;
  version: string;
  relatedKnowledge: string;
  relatedSnapshot: string;
  outputUrl: string;
  accuracy: number;
  passed: boolean;
  config: string;
  creatorNames: string[];
  createdAt: number;
  updatedAt: number;
  remark: string;
}

export interface ReportItem {
  recordId: string;
  title: string;
  type: string;
  parent: string;
  team: string;
  sourceSubSkill: string;
  targetSubSkill: string;
  point1: string;
  point2: string;
  point3: string;
  sourceAccuracy: number;
  targetAccuracy: number;
  body: string;
  reportFileUrl: string;
  creatorNames: string[];
  createdAt: number;
  remark: string;
}

declare global {
  var __prd_mock_skill_forge__:
    | {
        subSkills: SubSkillItem[];
        reports: ReportItem[];
      }
    | undefined;
}
function mockStore() {
  if (!global.__prd_mock_skill_forge__) {
    global.__prd_mock_skill_forge__ = { subSkills: [], reports: [] };
  }
  return global.__prd_mock_skill_forge__;
}

function getT12() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE12_ID;
  if (!appToken || !tableId) return null;
  return { appToken, tableId };
}
function getT13() {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_TABLE13_ID;
  if (!appToken || !tableId) return null;
  return { appToken, tableId };
}

function mapSubSkill(r: {
  record_id: string;
  fields: Record<string, unknown>;
}): SubSkillItem {
  const f = r.fields;
  return {
    recordId: r.record_id,
    name: asString(f["子Skill名称"]),
    parent: asString(f["父Skill"]),
    team: asString(f["团队名称"]),
    process: asString(f["端到端流程"]),
    section: asString(f["环节"]),
    node: asString(f["节点"]),
    scene: asString(f["关联场景名"]),
    stage: asString(f["阶段"]),
    version: asString(f["Skill版本号"]),
    relatedKnowledge: asString(f["关联知识库条目"]),
    relatedSnapshot: asString(f["关联数据快照"]),
    outputUrl:
      asString(f["输出结果链接"]) ||
      (typeof f["输出结果链接"] === "object" && f["输出结果链接"] !== null
        ? ((f["输出结果链接"] as { link?: string }).link || "")
        : ""),
    accuracy: asNumber(f["自评准确率(%)"]),
    passed:
      f["是否达标"] === true || f["是否达标"] === 1 || f["是否达标"] === "true",
    config: asString(f["Skill配置JSON"]),
    creatorNames: extractPersonNames(f["创建人"]),
    createdAt: asNumber(f["创建时间"]),
    updatedAt: asNumber(f["更新时间"]),
    remark: asString(f["备注"]),
  };
}
function mapReport(r: {
  record_id: string;
  fields: Record<string, unknown>;
}): ReportItem {
  const f = r.fields;
  return {
    recordId: r.record_id,
    title: asString(f["报告标题"]),
    type: asString(f["报告类型"]),
    parent: asString(f["父Skill"]),
    team: asString(f["团队名称"]),
    sourceSubSkill: asString(f["源子Skill"]),
    targetSubSkill: asString(f["目标子Skill"]),
    point1: asString(f["分析点1 · 结构一致性"]),
    point2: asString(f["分析点2 · 配置差异"]),
    point3: asString(f["分析点3 · 准确率归因"]),
    sourceAccuracy: asNumber(f["源准确率(%)"]),
    targetAccuracy: asNumber(f["目标准确率(%)"]),
    body: asString(f["报告全文"]),
    reportFileUrl:
      asString(f["报告文件链接"]) ||
      (typeof f["报告文件链接"] === "object" && f["报告文件链接"] !== null
        ? ((f["报告文件链接"] as { link?: string }).link || "")
        : ""),
    creatorNames: extractPersonNames(f["生成人"]),
    createdAt: asNumber(f["生成时间"]),
    remark: asString(f["备注"]),
  };
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") || "sub-skill";
  const parent = req.nextUrl.searchParams.get("parent") || "";
  try {
    if (kind === "report") {
      const t13 = getT13();
      if (!t13) {
        const store = mockStore();
        const items = parent
          ? store.reports.filter((r) => r.parent === parent)
          : store.reports;
        return NextResponse.json({
          success: true,
          items: [...items].sort((a, b) => b.createdAt - a.createdAt),
          usingMock: true,
        });
      }
      const filter = parent ? `CurrentValue.[父Skill]="${parent}"` : undefined;
      const all = await getAllRecords(t13.appToken, t13.tableId, filter);
      return NextResponse.json({
        success: true,
        items: all.map(mapReport).sort((a, b) => b.createdAt - a.createdAt),
      });
    }
    // default: sub-skill
    const t12 = getT12();
    if (!t12) {
      const store = mockStore();
      const items = parent
        ? store.subSkills.filter((s) => s.parent === parent)
        : store.subSkills;
      return NextResponse.json({
        success: true,
        items: [...items].sort((a, b) => b.createdAt - a.createdAt),
        usingMock: true,
      });
    }
    const filter = parent ? `CurrentValue.[父Skill]="${parent}"` : undefined;
    const all = await getAllRecords(t12.appToken, t12.tableId, filter);
    return NextResponse.json({
      success: true,
      items: all.map(mapSubSkill).sort((a, b) => b.createdAt - a.createdAt),
    });
  } catch (err) {
    console.error("[skill-forge] GET 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const kind = String(body?.kind || "sub-skill");
    const now = Date.now();

    if (kind === "report") {
      const t13 = getT13();
      if (!t13) {
        const store = mockStore();
        const rec: ReportItem = {
          recordId: `mock-report-${now}`,
          title: String(body?.title || ""),
          type: String(body?.type || "Skill1vs2"),
          parent: String(body?.parent || ""),
          team: String(body?.team || ""),
          sourceSubSkill: String(body?.sourceSubSkill || ""),
          targetSubSkill: String(body?.targetSubSkill || ""),
          point1: String(body?.point1 || ""),
          point2: String(body?.point2 || ""),
          point3: String(body?.point3 || ""),
          sourceAccuracy: Number(body?.sourceAccuracy) || 0,
          targetAccuracy: Number(body?.targetAccuracy) || 0,
          body: String(body?.body || ""),
          reportFileUrl: String(body?.reportFileUrl || ""),
          creatorNames: [session.user.name || "当前用户"],
          createdAt: now,
          remark: String(body?.remark || ""),
        };
        store.reports.unshift(rec);
        return NextResponse.json({
          success: true,
          recordId: rec.recordId,
          usingMock: true,
        });
      }
      const fields: Record<string, unknown> = {
        报告标题: String(body?.title || ""),
        报告类型: String(body?.type || "Skill1vs2"),
        父Skill: String(body?.parent || ""),
        团队名称: String(body?.team || ""),
        源子Skill: String(body?.sourceSubSkill || ""),
        目标子Skill: String(body?.targetSubSkill || ""),
        "分析点1 · 结构一致性": String(body?.point1 || ""),
        "分析点2 · 配置差异": String(body?.point2 || ""),
        "分析点3 · 准确率归因": String(body?.point3 || ""),
        "源准确率(%)": Number(body?.sourceAccuracy) || 0,
        "目标准确率(%)": Number(body?.targetAccuracy) || 0,
        报告全文: String(body?.body || ""),
        生成人: [{ id: session.user.open_id }],
        生成时间: now,
        备注: String(body?.remark || ""),
      };
      if (body?.reportFileUrl) {
        fields["报告文件链接"] = {
          link: String(body.reportFileUrl),
          text: String(body.reportFileUrl),
        };
      }
      const rec = await addRecord(t13.appToken, t13.tableId, fields);
      return NextResponse.json({ success: true, recordId: rec.record_id });
    }

    // sub-skill
    const t12 = getT12();
    if (!t12) {
      const store = mockStore();
      const rec: SubSkillItem = {
        recordId: `mock-sub-${now}`,
        name: String(body?.name || ""),
        parent: String(body?.parent || ""),
        team: String(body?.team || ""),
        process: String(body?.process || ""),
        section: String(body?.section || ""),
        node: String(body?.node || ""),
        scene: String(body?.scene || ""),
        stage: String(body?.stage || "Step1 初稿"),
        version: String(body?.version || "v1.0"),
        relatedKnowledge: String(body?.relatedKnowledge || ""),
        relatedSnapshot: String(body?.relatedSnapshot || ""),
        outputUrl: String(body?.outputUrl || ""),
        accuracy: Number(body?.accuracy) || 0,
        passed: !!body?.passed,
        config: String(body?.config || ""),
        creatorNames: [session.user.name || "当前用户"],
        createdAt: now,
        updatedAt: now,
        remark: String(body?.remark || ""),
      };
      store.subSkills.unshift(rec);
      return NextResponse.json({
        success: true,
        recordId: rec.recordId,
        usingMock: true,
      });
    }

    const fields: Record<string, unknown> = {
      子Skill名称: String(body?.name || ""),
      父Skill: String(body?.parent || ""),
      团队名称: String(body?.team || ""),
      端到端流程: String(body?.process || ""),
      环节: String(body?.section || ""),
      节点: String(body?.node || ""),
      关联场景名: String(body?.scene || ""),
      阶段: String(body?.stage || "Step1 初稿"),
      Skill版本号: String(body?.version || "v1.0"),
      关联知识库条目: String(body?.relatedKnowledge || ""),
      关联数据快照: String(body?.relatedSnapshot || ""),
      "自评准确率(%)": Number(body?.accuracy) || 0,
      是否达标: !!body?.passed,
      Skill配置JSON: String(body?.config || ""),
      创建人: [{ id: session.user.open_id }],
      创建时间: now,
      更新时间: now,
      备注: String(body?.remark || ""),
    };
    if (body?.outputUrl) {
      fields["输出结果链接"] = {
        link: String(body.outputUrl),
        text: String(body.outputUrl),
      };
    }
    const rec = await addRecord(t12.appToken, t12.tableId, fields);
    return NextResponse.json({ success: true, recordId: rec.record_id });
  } catch (err) {
    console.error("[skill-forge] POST 失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
