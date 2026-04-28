/**
 * 首页「我的动态」聚合接口（只读）
 *
 * GET /api/home/summary
 *
 * 返回：{
 *   recent7dMine: { section1Count, skillSubmitCount },
 *   inProgress:   [{ taskName, submittedAt }],  // 已上传SKILL但评测未达标
 *   teamThisWeek: { skillSubmitCount, unresolvedBlockers, team }
 * }
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";

interface InProgressItem {
  taskName: string;
  submittedAt: number;
}

function mondayOfWeek(now = new Date()): number {
  const d = new Date(now);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function extractOpenIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((p) => {
      if (typeof p === "string") return p;
      if (p && typeof p === "object") {
        const o = p as Record<string, unknown>;
        return (o.id as string) || (o.open_id as string) || "";
      }
      return "";
    })
    .filter(Boolean);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((x) => {
        if (typeof x === "string") return x;
        if (x && typeof x === "object" && "text" in x)
          return ((x as { text?: string }).text || "");
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (v && typeof v === "object" && "text" in (v as object))
    return ((v as { text?: string }).text || "");
  return "";
}

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({
      success: true,
      loggedIn: false,
      recent7dMine: { section1Count: 0, skillSubmitCount: 0 },
      inProgress: [],
      teamThisWeek: { skillSubmitCount: 0, unresolvedBlockers: 0, team: "" },
    });
  }

  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table1Id = process.env.FEISHU_TABLE1_ID;
  const table2Id = process.env.FEISHU_TABLE2_ID;
  const table5Id = process.env.FEISHU_TABLE5_ID;
  const table11Id = process.env.FEISHU_TABLE11_ID;

  if (!appToken || !table1Id || !table2Id) {
    return NextResponse.json({
      success: false,
      error: "Bitable 未初始化，无法聚合首页数据",
    });
  }

  try {
    const openId = session.user.open_id;
    const profile = await getUserProfile(openId, session.user.name);
    const team = profile.team;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const weekStart = mondayOfWeek(new Date(now));

    const teamFilter = team ? `CurrentValue.[团队名称]="${team}"` : undefined;

    const [t1All, t2All, t5All, t11All] = await Promise.all([
      teamFilter ? getAllRecords(appToken, table1Id, teamFilter) : Promise.resolve([]),
      teamFilter ? getAllRecords(appToken, table2Id, teamFilter) : Promise.resolve([]),
      table5Id && teamFilter
        ? getAllRecords(appToken, table5Id, teamFilter)
        : Promise.resolve([]),
      table11Id && teamFilter
        ? getAllRecords(appToken, table11Id, teamFilter)
        : Promise.resolve([]),
    ]);

    // Table1：本人最近7天新增场景数
    let section1Count = 0;
    for (const r of t1All) {
      const submitter = extractOpenIds(r.fields["提交者"]);
      const ts = asNumber(r.fields["提交时间"]);
      if (submitter.includes(openId) && ts >= sevenDaysAgo) section1Count += 1;
    }

    // Table2：SKILL提交记录（步骤状态=已完成）
    // - 统计本人7天内提交次数
    // - 统计本人有提交的场景（用于进行中判断）
    // - 统计团队本周提交次数
    let skillSubmitCount = 0;
    let teamThisWeekSkillSubmits = 0;
    const mySkillScenesMap = new Map<string, number>(); // taskName -> latest submittedAt

    for (const r of t2All) {
      const status = asString(r.fields["步骤状态"]);
      if (status !== "已完成") continue;

      const ts = asNumber(r.fields["提交时间"]);
      const submitter = extractOpenIds(r.fields["提交者"]);
      const taskName = asString(r.fields["所属场景"]);

      if (ts >= weekStart) teamThisWeekSkillSubmits += 1;

      if (!submitter.includes(openId)) continue;
      if (ts >= sevenDaysAgo) skillSubmitCount += 1;

      if (taskName) {
        const prev = mySkillScenesMap.get(taskName);
        if (!prev || ts > prev) mySkillScenesMap.set(taskName, ts);
      }
    }

    // Table11：找出已达到100%准确率的场景
    const completedScenes = new Set<string>();
    for (const r of t11All) {
      const accuracy = asNumber(r.fields["准确率(%)"]);
      if (accuracy >= 100) {
        const taskName = asString(r.fields["关联场景名"]);
        if (taskName) completedScenes.add(taskName.trim());
      }
    }

    // 进行中：有SKILL提交 但评测还未达标
    const inProgress: InProgressItem[] = Array.from(mySkillScenesMap.entries())
      .filter(([taskName]) => !completedScenes.has(taskName.trim()))
      .map(([taskName, submittedAt]) => ({ taskName, submittedAt }))
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, 3);

    // Table5：未解决卡点
    let unresolvedBlockers = 0;
    for (const r of t5All) {
      const status = asString(r.fields["状态"]);
      if (status !== "已解决") unresolvedBlockers += 1;
    }

    return NextResponse.json({
      success: true,
      loggedIn: true,
      recent7dMine: { section1Count, skillSubmitCount },
      inProgress,
      teamThisWeek: {
        skillSubmitCount: teamThisWeekSkillSubmits,
        unresolvedBlockers,
        team,
      },
    });
  } catch (err) {
    console.error("[home/summary] 聚合失败:", err);
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    );
  }
}
