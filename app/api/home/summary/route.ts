/**
 * 首页「我的动态」聚合接口（只读）
 *
 * GET /api/home/summary
 *
 * 返回：{
 *   recent7dMine: { section1Count, section2StepCount },
 *   inProgress:   [{ taskName, lastStep, submittedAt }],
 *   teamThisWeek: { stepCount, unresolvedBlockers, team }
 * }
 *
 * 依赖 session 拿 open_id 与归属团队（profile.team）。
 * 未登录或未选团队时返回空壳，不报错。
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";

interface InProgressItem {
  taskName: string;
  lastStep: number;
  submittedAt: number;
}

function mondayOfWeek(now = new Date()): number {
  const d = new Date(now);
  const day = d.getDay();
  const diff = (day + 6) % 7; // 周一 = 0
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
      recent7dMine: { section1Count: 0, section2StepCount: 0 },
      inProgress: [],
      teamThisWeek: { stepCount: 0, unresolvedBlockers: 0, team: "" },
    });
  }

  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table1Id = process.env.FEISHU_TABLE1_ID;
  const table2Id = process.env.FEISHU_TABLE2_ID;
  const table5Id = process.env.FEISHU_TABLE5_ID;

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

    const [t1All, t2All, t5All] = await Promise.all([
      teamFilter ? getAllRecords(appToken, table1Id, teamFilter) : Promise.resolve([]),
      teamFilter ? getAllRecords(appToken, table2Id, teamFilter) : Promise.resolve([]),
      table5Id && teamFilter
        ? getAllRecords(appToken, table5Id, teamFilter)
        : Promise.resolve([]),
    ]);

    let section1Count = 0;
    for (const r of t1All) {
      const submitter = extractOpenIds(r.fields["提交者"]);
      const ts = asNumber(r.fields["提交时间"]);
      if (submitter.includes(openId) && ts >= sevenDaysAgo) section1Count += 1;
    }

    let section2StepCount = 0;
    const inProgressMap: Map<string, InProgressItem> = new Map();
    let teamThisWeekSteps = 0;

    for (const r of t2All) {
      const submitter = extractOpenIds(r.fields["提交者"]);
      const ts = asNumber(r.fields["提交时间"]);
      const step = asNumber(r.fields["步骤编号"]);
      const taskName = asString(r.fields["关联任务"]);

      if (ts >= weekStart) teamThisWeekSteps += 1;

      if (!submitter.includes(openId)) continue;
      if (ts >= sevenDaysAgo) section2StepCount += 1;

      if (taskName && step > 0) {
        const prev = inProgressMap.get(taskName);
        if (!prev || step > prev.lastStep || (step === prev.lastStep && ts > prev.submittedAt)) {
          inProgressMap.set(taskName, { taskName, lastStep: step, submittedAt: ts });
        }
      }
    }

    const inProgress: InProgressItem[] = Array.from(inProgressMap.values())
      .filter((x) => x.lastStep < 4)
      .sort((a, b) => b.submittedAt - a.submittedAt)
      .slice(0, 3);

    let unresolvedBlockers = 0;
    for (const r of t5All) {
      const status = asString(r.fields["状态"]);
      if (status !== "已解决") unresolvedBlockers += 1;
    }

    return NextResponse.json({
      success: true,
      loggedIn: true,
      recent7dMine: { section1Count, section2StepCount },
      inProgress,
      teamThisWeek: {
        stepCount: teamThisWeekSteps,
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
