/**
 * GET /api/scene/counts
 *
 * 返回当前团队在 Table1（流程节点映射）中各端到端流程的场景数量：
 * {
 *   success: true,
 *   counts: {
 *     ptp:  { total: 12, manual: 5 },
 *     otc:  { total: 8,  manual: 3 },
 *     ...
 *   }
 * }
 *
 * manual = 标签包含 "纯线下" 的场景数量
 */
import { NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/user-profile";
import { E2E_PROCESSES, normalizeE2EProcessShortName } from "@/lib/constants";

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v))
    return v
      .map((x) => (x && typeof x === "object" && "text" in x ? (x as { text?: string }).text || "" : typeof x === "string" ? x : ""))
      .filter(Boolean)
      .join("");
  if (v && typeof v === "object" && "text" in (v as object))
    return ((v as { text?: string }).text || "");
  return "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamParam = searchParams.get("team");

  const session = await getSession();
  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ success: false, error: "未登录" }, { status: 401 });
  }

  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table1Id = process.env.FEISHU_TABLE1_ID;

  if (!appToken || !table1Id) {
    return NextResponse.json({ success: false, error: "Bitable 未初始化" }, { status: 500 });
  }

  try {
    const profile = await getUserProfile(session.user.open_id, session.user.name);
    const team = teamParam || profile.team;

    if (!team) {
      const empty = Object.fromEntries(E2E_PROCESSES.map((p) => [p.id, { total: 0, manual: 0 }]));
      return NextResponse.json({ success: true, counts: empty });
    }

    const teamFilter = `CurrentValue.[团队名称]="${team}"`;
    const records = await getAllRecords(appToken, table1Id, teamFilter);

    const counts: Record<string, { total: number; manual: number }> = {};
    for (const proc of E2E_PROCESSES) {
      counts[proc.id] = { total: 0, manual: 0 };
    }

    for (const rec of records) {
      const taskName = asString(rec.fields["场景名称"]) || asString(rec.fields["任务名称"]);
      if (!taskName) continue;

      const e2eRaw = asString(rec.fields["端到端流程"]);
      const shortName = normalizeE2EProcessShortName(e2eRaw);
      const proc = E2E_PROCESSES.find((p) => p.shortName === shortName);
      if (!proc) continue;

      const labelRaw = asString(rec.fields["标签"]);
      const isManual = labelRaw.includes("纯线下");

      counts[proc.id].total += 1;
      if (isManual) counts[proc.id].manual += 1;
    }

    return NextResponse.json({ success: true, counts });
  } catch (err) {
    console.error("[scene/counts]", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
