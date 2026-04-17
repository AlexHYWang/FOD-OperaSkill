/**
 * 看板整体数据概览
 * GET /api/dashboard/overview?onlyManual=true
 *
 * 返回：每个团队在每个端到端流程下的任务完成情况统计
 * 数据源：Table1（流程节点映射）× Table2（Skill实战记录）
 */
import { NextRequest, NextResponse } from "next/server";
import { getAllRecords } from "@/lib/feishu";
import { feishuLabelIsPureManual, PRESET_TEAMS } from "@/lib/constants";

export interface TeamProcessStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
}

export interface OverviewResponse {
  teams: string[];
  stats: Record<string, Record<string, TeamProcessStats>>;
  // 管理员下钻数据：process → node → tasks[]
  drillDown: Record<
    string,
    Record<
      string,
      Array<{
        team: string;
        taskName: string;
        label: string;
        nodeId: string;
        section: string;
      }>
    >
  >;
}

const PROCESS_IDS = ["all", "ptp", "otc", "rtr", "pic", "tax"] as const;

// shortName 到 id 的映射
const SHORT_NAME_TO_ID: Record<string, string> = {
  PTP: "ptp",
  OTC: "otc",
  RTR: "rtr",
  PIC: "pic",
  税务: "tax",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const onlyManual = searchParams.get("onlyManual") === "true";

  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const table1Id = process.env.FEISHU_TABLE1_ID;
  const table2Id = process.env.FEISHU_TABLE2_ID;

  if (!appToken || !table1Id || !table2Id) {
    return NextResponse.json(
      { error: "多维表格未配置，请先运行 /api/bitable/init" },
      { status: 500 }
    );
  }

  try {
    // 并行拉取全量 Table1 和 Table2
    const [table1Records, table2Records] = await Promise.all([
      getAllRecords(appToken, table1Id),
      getAllRecords(appToken, table2Id),
    ]);

    // 过滤纯线下
    const filteredTable1 = onlyManual
      ? table1Records.filter((r) =>
          feishuLabelIsPureManual(r.fields["标签"] as string | undefined)
        )
      : table1Records;

    // 构建 Table2 任务索引：key = "team::taskName" → 最高步骤 & 是否有step4已完成
    const taskStatusMap = new Map<
      string,
      { maxStep: number; step4Done: boolean }
    >();

    for (const r of table2Records) {
      const team = r.fields["团队名称"] as string;
      const taskName = r.fields["关联任务"] as string;
      const step = Number(r.fields["步骤编号"] ?? 0);
      const status = r.fields["步骤状态"] as string;

      if (!team || !taskName) continue;
      const key = `${team}::${taskName}`;
      const existing = taskStatusMap.get(key);
      const step4Done =
        (existing?.step4Done ?? false) || (step === 4 && status === "已完成");
      const maxStep = Math.max(existing?.maxStep ?? 0, step);
      taskStatusMap.set(key, { maxStep, step4Done });
    }

    // 收集有数据的团队，与 PRESET_TEAMS 合并，确保所有预设团队都出现
    const teamsSet = new Set<string>([...PRESET_TEAMS]);
    for (const r of filteredTable1) {
      const team = r.fields["团队名称"] as string;
      if (team) teamsSet.add(team);
    }
    const teams = Array.from(teamsSet).sort((a, b) => a.localeCompare(b, "zh"));

    // 初始化统计结构（所有团队默认为 0）
    const stats: Record<string, Record<string, TeamProcessStats>> = {};
    for (const team of teams) {
      stats[team] = {};
      for (const pid of PROCESS_IDS) {
        stats[team][pid] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          notStarted: 0,
          completionRate: 0,
        };
      }
    }

    // 管理员下钻结构：processId → sectionName → tasks[]
    const drillDown: OverviewResponse["drillDown"] = {};
    for (const pid of PROCESS_IDS.filter((p) => p !== "all")) {
      drillDown[pid] = {};
    }

    // 聚合每条 Table1 记录
    for (const r of filteredTable1) {
      const team = r.fields["团队名称"] as string;
      const taskName = r.fields["任务名称"] as string;
      const e2eRaw = r.fields["端到端流程"] as string | undefined;
      const section = r.fields["流程环节"] as string;
      const nodeName = r.fields["流程节点"] as string;
      const label = r.fields["标签"] as string;

      if (!team || !taskName) continue;

      const processId = e2eRaw ? (SHORT_NAME_TO_ID[e2eRaw] ?? "all") : "all";

      // 判断任务状态
      const key = `${team}::${taskName}`;
      const taskInfo = taskStatusMap.get(key);
      let statusType: "completed" | "inProgress" | "notStarted";
      if (!taskInfo) {
        statusType = "notStarted";
      } else if (taskInfo.step4Done) {
        statusType = "completed";
      } else {
        statusType = "inProgress";
      }

      // 更新 all 和具体 process 的统计
      if (stats[team]) {
        stats[team]["all"].total++;
        stats[team]["all"][statusType]++;
        if (processId !== "all" && stats[team][processId]) {
          stats[team][processId].total++;
          stats[team][processId][statusType]++;
        }
      }

      // 下钻数据（不限 team，给管理员用）
      if (processId !== "all") {
        if (!drillDown[processId][section]) {
          drillDown[processId][section] = [];
        }
        drillDown[processId][section].push({
          team,
          taskName,
          label: label ?? "",
          nodeId: nodeName ?? "",
          section: section ?? "",
        });
      }
    }

    // 计算完成率
    for (const team of teams) {
      for (const pid of PROCESS_IDS) {
        const s = stats[team][pid];
        s.completionRate =
          s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      }
    }

    return NextResponse.json({
      success: true,
      data: { teams, stats, drillDown } satisfies OverviewResponse,
    });
  } catch (err) {
    console.error("概览数据聚合失败:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
