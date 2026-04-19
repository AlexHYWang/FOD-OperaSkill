"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  BarChart2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Users,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { E2E_PROCESSES } from "@/lib/constants";

interface SkillRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface Props {
  team: string;
  isAdmin: boolean;
}

type SubTab = "outputs" | "accuracy";
type ProcessTab = "all" | "ptp" | "otc" | "rtr" | "pic" | "tax";

const STEPS = [1, 2, 3, 4];
const STEP_LABELS: Record<number, string> = {
  1: "步骤一",
  2: "步骤二",
  3: "步骤三",
  4: "步骤四",
};

const PROCESS_TABS: Array<{ id: ProcessTab; label: string }> = [
  { id: "all", label: "全部流程" },
  { id: "ptp", label: "PTP" },
  { id: "otc", label: "OTC" },
  { id: "rtr", label: "RTR" },
  { id: "pic", label: "PIC" },
  { id: "tax", label: "税务" },
];

const SHORT_NAME_TO_ID: Record<string, string> = {
  PTP: "ptp",
  OTC: "otc",
  RTR: "rtr",
  PIC: "pic",
  税务: "tax",
};

// ───────────────── 流程配色主题 ─────────────────
interface Theme {
  tabActive: string;
  tag: string;
  groupHeaderBg: string;
  groupHeaderText: string;
  groupLeftBorder: string;
  cardHoverBorder: string;
  progressFill: string;
}

const PROC_THEME: Record<string, Theme> = {
  ptp: {
    tabActive: "bg-blue-600 text-white border-blue-600",
    tag: "bg-blue-100 text-blue-700 border-blue-200",
    groupHeaderBg: "bg-blue-50",
    groupHeaderText: "text-blue-800",
    groupLeftBorder: "border-l-blue-500",
    cardHoverBorder: "hover:border-blue-300",
    progressFill: "bg-blue-500",
  },
  otc: {
    tabActive: "bg-green-600 text-white border-green-600",
    tag: "bg-green-100 text-green-700 border-green-200",
    groupHeaderBg: "bg-green-50",
    groupHeaderText: "text-green-800",
    groupLeftBorder: "border-l-green-500",
    cardHoverBorder: "hover:border-green-300",
    progressFill: "bg-green-500",
  },
  rtr: {
    tabActive: "bg-purple-600 text-white border-purple-600",
    tag: "bg-purple-100 text-purple-700 border-purple-200",
    groupHeaderBg: "bg-purple-50",
    groupHeaderText: "text-purple-800",
    groupLeftBorder: "border-l-purple-500",
    cardHoverBorder: "hover:border-purple-300",
    progressFill: "bg-purple-500",
  },
  pic: {
    tabActive: "bg-orange-500 text-white border-orange-500",
    tag: "bg-orange-100 text-orange-700 border-orange-200",
    groupHeaderBg: "bg-orange-50",
    groupHeaderText: "text-orange-800",
    groupLeftBorder: "border-l-orange-500",
    cardHoverBorder: "hover:border-orange-300",
    progressFill: "bg-orange-500",
  },
  tax: {
    tabActive: "bg-rose-600 text-white border-rose-600",
    tag: "bg-rose-100 text-rose-700 border-rose-200",
    groupHeaderBg: "bg-rose-50",
    groupHeaderText: "text-rose-800",
    groupLeftBorder: "border-l-rose-500",
    cardHoverBorder: "hover:border-rose-300",
    progressFill: "bg-rose-500",
  },
  all: {
    tabActive: "bg-gray-700 text-white border-gray-700",
    tag: "bg-gray-100 text-gray-700 border-gray-200",
    groupHeaderBg: "bg-gray-50",
    groupHeaderText: "text-gray-700",
    groupLeftBorder: "border-l-gray-400",
    cardHoverBorder: "hover:border-gray-300",
    progressFill: "bg-gray-500",
  },
};

const getTheme = (processId: string): Theme =>
  PROC_THEME[processId] ?? PROC_THEME.all;

/** 飞书 URL 字段为 {link,text} 对象，安全提取 */
function extractFileLink(raw: unknown): string {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.link === "string") return obj.link;
    if (typeof obj.url === "string") return obj.url;
  }
  return "";
}

interface TaskEntry {
  taskName: string;
  fileName: string;
  fileLink: string;
  accuracy: number | null;
}

// 扁平场景项：每个场景一条（同一场景被多团队做时也只有一条，团队数据内嵌在 byTeam）
interface TaskItem {
  taskKey: string; // processId::sectionName::nodeName::taskName
  processId: string;
  processName: string;
  sectionName: string;
  nodeName: string;
  taskName: string;
  byTeam: Record<string, Record<number, TaskEntry[]>>; // team → step → entries
  submittedSteps: number; // 该场景跨所有相关团队最多被提交了几个步骤（仅当前视图团队）
  viewTeams: string[]; // 本视图下涉及该场景的团队列表
}

// ───────────────── 主组件 ─────────────────
export function OutputsAccuracySection({ team, isAdmin }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("outputs");
  const [processTab, setProcessTab] = useState<ProcessTab>("all");
  const [table1Records, setTable1Records] = useState<SkillRecord[]>([]);
  const [table2Records, setTable2Records] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    setLoading(true);
    const teamParam =
      !isAdmin && team ? `&team=${encodeURIComponent(team)}` : "";
    Promise.all([
      fetch(`/api/bitable/records?table=1${teamParam}`).then((r) => r.json()),
      fetch(`/api/bitable/records?table=2${teamParam}`).then((r) => r.json()),
    ])
      .then(([d1, d2]) => {
        if (d1.success && Array.isArray(d1.records))
          setTable1Records(d1.records);
        if (d2.success && Array.isArray(d2.records))
          setTable2Records(d2.records);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [team, isAdmin]);

  // 从 Table1 构建场景上下文：key = "团队::场景名" → 场景结构信息
  const taskInfoMap = useMemo(() => {
    const m = new Map<
      string,
      {
        processId: string;
        processName: string;
        sectionName: string;
        nodeName: string;
      }
    >();
    for (const rec of table1Records) {
      const teamName = rec.fields["团队名称"] as string;
      const taskName = (rec.fields["场景名称"] ||
        rec.fields["任务名称"]) as string;
      const e2eRaw = rec.fields["端到端流程"] as string | undefined;
      const sectionName = (rec.fields["流程环节"] as string) || "未分类";
      const nodeName = (rec.fields["流程节点"] as string) || "未分类";
      if (!teamName || !taskName) continue;
      const processId = e2eRaw ? (SHORT_NAME_TO_ID[e2eRaw] ?? "all") : "all";
      const proc = E2E_PROCESSES.find((p) => p.id === processId);
      const processName = proc?.name ?? "未分类流程";
      m.set(`${teamName}::${taskName}`, {
        processId,
        processName,
        sectionName,
        nodeName,
      });
    }
    return m;
  }, [table1Records]);

  // 构建扁平场景列表
  const allTasks = useMemo((): TaskItem[] => {
    const taskMap = new Map<string, TaskItem>();

    for (const rec of table2Records) {
      const t = rec.fields["团队名称"] as string;
      const taskName = (rec.fields["所属场景"] ||
        rec.fields["关联任务"]) as string;
      const step = Number(rec.fields["步骤编号"] ?? 0);
      const fileName = (rec.fields["文件名称"] as string) || "";
      const fileLink = extractFileLink(rec.fields["文件链接"]);
      const accuracy =
        rec.fields["准确率(%)"] != null
          ? Number(rec.fields["准确率(%)"])
          : null;

      if (!t || !taskName || !STEPS.includes(step)) continue;

      const info = taskInfoMap.get(`${t}::${taskName}`);
      const processId = info?.processId ?? "all";
      const processName = info?.processName ?? "未分类流程";
      const sectionName = info?.sectionName ?? "未分类";
      const nodeName = info?.nodeName ?? "未分类";

      const taskKey = `${processId}::${sectionName}::${nodeName}::${taskName}`;
      if (!taskMap.has(taskKey)) {
        taskMap.set(taskKey, {
          taskKey,
          processId,
          processName,
          sectionName,
          nodeName,
          taskName,
          byTeam: {},
          submittedSteps: 0,
          viewTeams: [],
        });
      }
      const item = taskMap.get(taskKey)!;
      if (!item.byTeam[t]) item.byTeam[t] = {};
      if (!item.byTeam[t][step]) item.byTeam[t][step] = [];
      item.byTeam[t][step].push({ taskName, fileName, fileLink, accuracy });
    }

    // 计算 submittedSteps / viewTeams
    const items = Array.from(taskMap.values());
    for (const it of items) {
      it.viewTeams = Object.keys(it.byTeam).sort((a, b) =>
        a.localeCompare(b, "zh")
      );
      const submittedStepSet = new Set<number>();
      for (const teamData of Object.values(it.byTeam)) {
        for (const s of Object.keys(teamData)) {
          submittedStepSet.add(Number(s));
        }
      }
      it.submittedSteps = submittedStepSet.size;
    }

    // 排序：按流程 id → 环节 → 节点 → 场景名
    items.sort((a, b) => {
      if (a.processId !== b.processId)
        return a.processId.localeCompare(b.processId);
      if (a.sectionName !== b.sectionName)
        return a.sectionName.localeCompare(b.sectionName, "zh");
      if (a.nodeName !== b.nodeName)
        return a.nodeName.localeCompare(b.nodeName, "zh");
      return a.taskName.localeCompare(b.taskName, "zh");
    });

    return items;
  }, [table2Records, taskInfoMap]);

  // 按当前流程 tab 过滤
  const filteredTasks = useMemo(() => {
    if (processTab === "all") return allTasks;
    return allTasks.filter((t) => t.processId === processTab);
  }, [allTasks, processTab]);

  // 按流程分组
  const grouped = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const item of filteredTasks) {
      if (!map.has(item.processId)) map.set(item.processId, []);
      map.get(item.processId)!.push(item);
    }
    return map;
  }, [filteredTasks]);

  // smart 默认折叠策略：场景总数 ≥ 8 时自动折叠除第一个组之外的所有组
  // 仅当 processTab 为 all 且首次加载数据时计算
  useEffect(() => {
    if (processTab !== "all") return;
    if (filteredTasks.length < 8) {
      setCollapsedGroups(new Set());
      return;
    }
    const groups = Array.from(grouped.keys());
    if (groups.length <= 1) return;
    setCollapsedGroups(new Set(groups.slice(1)));
    // 注意：这里故意仅依赖 filteredTasks.length 和 processTab，避免切换 tab 时重置用户手动状态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks.length, processTab]);

  const toggleGroup = (pid: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  // 顶部统计（当前筛选下）
  const stats = useMemo(() => {
    let totalSlots = 0; // 场景数 × 4
    let submittedSlots = 0;
    for (const t of filteredTasks) {
      // 一个场景有 4 个步骤"槽位"；若有多团队则每个团队各 4 个
      const teamCount = Math.max(1, t.viewTeams.length);
      totalSlots += teamCount * 4;
      for (const teamData of Object.values(t.byTeam)) {
        submittedSlots += Object.keys(teamData).length;
      }
    }
    return {
      taskCount: filteredTasks.length,
      totalSlots,
      submittedSlots,
      pendingSlots: totalSlots - submittedSlots,
      completionPct:
        totalSlots > 0
          ? Math.round((submittedSlots / totalSlots) * 100)
          : 0,
    };
  }, [filteredTasks]);

  return (
    <div className="space-y-4">
      {/* 流程页签 */}
      <div className="flex gap-1.5 flex-wrap">
        {PROCESS_TABS.map((tab) => {
          const theme = getTheme(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => setProcessTab(tab.id as ProcessTab)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                processTab === tab.id
                  ? theme.tabActive
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 产出物 / 准确率 子页签 */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubTab("outputs")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
            subTab === "outputs"
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
          )}
        >
          <FileText size={14} />
          产出物统计
        </button>
        <button
          onClick={() => setSubTab("accuracy")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all border",
            subTab === "accuracy"
              ? "bg-purple-50 border-purple-200 text-purple-700"
              : "bg-white border-gray-200 text-gray-500 hover:text-gray-700"
          )}
        >
          <BarChart2 size={14} />
          测试准确率
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          加载中...
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState team={team} processTab={processTab} />
      ) : (
        <>
          <StatsBar stats={stats} subTab={subTab} />

          <div className="space-y-4">
            {Array.from(grouped.entries()).map(([pid, items]) => (
              <ProcessGroup
                key={pid}
                processId={pid}
                items={items}
                subTab={subTab}
                isAdmin={isAdmin}
                collapsed={
                  processTab === "all" ? collapsedGroups.has(pid) : false
                }
                onToggle={() => toggleGroup(pid)}
                showHeader={processTab === "all"}
              />
            ))}
          </div>

          {subTab === "accuracy" && <AccuracyLegend />}
        </>
      )}
    </div>
  );
}

// ───────────────── 顶部统计条 ─────────────────
function StatsBar({
  stats,
  subTab,
}: {
  stats: {
    taskCount: number;
    totalSlots: number;
    submittedSlots: number;
    pendingSlots: number;
    completionPct: number;
  };
  subTab: SubTab;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-4 flex items-center gap-6 flex-wrap">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-gray-900">
          {stats.taskCount}
        </span>
        <span className="text-xs text-gray-500">个场景</span>
      </div>
      <div className="h-8 w-px bg-gray-200" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-emerald-600">
          {stats.submittedSlots}
        </span>
        <span className="text-xs text-gray-500">
          / {stats.totalSlots} 步骤已提交
        </span>
      </div>
      <div className="h-8 w-px bg-gray-200" />
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-gray-400">
          {stats.pendingSlots}
        </span>
        <span className="text-xs text-gray-500">步骤未开始</span>
      </div>

      {/* 完成度进度条 */}
      <div className="flex-1 min-w-[180px]">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-gray-400 uppercase tracking-wide">
            {subTab === "outputs" ? "提交进度" : "提交覆盖"}
          </span>
          <span className="text-xs font-bold text-emerald-700">
            {stats.completionPct}%
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500"
            style={{ width: `${stats.completionPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ───────────────── 流程分组（Accordion） ─────────────────
function ProcessGroup({
  processId,
  items,
  subTab,
  isAdmin,
  collapsed,
  onToggle,
  showHeader,
}: {
  processId: string;
  items: TaskItem[];
  subTab: SubTab;
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
  showHeader: boolean;
}) {
  const theme = getTheme(processId);
  const processName = items[0]?.processName ?? processId.toUpperCase();

  return (
    <div className="space-y-3">
      {showHeader && (
        <button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-left border-l-4 transition-all hover:brightness-95",
            theme.groupHeaderBg,
            theme.groupHeaderText,
            theme.groupLeftBorder
          )}
        >
          {collapsed ? (
            <ChevronRight size={16} />
          ) : (
            <ChevronDown size={16} />
          )}
          <span className="font-bold text-sm">{processName}</span>
          <span className="text-xs font-semibold bg-white/70 px-2 py-0.5 rounded-full">
            {items.length} 个场景
          </span>
        </button>
      )}

      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((t) => {
            // 多团队卡占 2 列（管理员视图下）
            const spanClass =
              isAdmin && t.viewTeams.length > 1
                ? "md:col-span-2 xl:col-span-2"
                : "";
            return (
              <div key={t.taskKey} className={spanClass}>
                <TaskCard task={t} subTab={subTab} isAdmin={isAdmin} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────── 场景卡片 ─────────────────
function TaskCard({
  task,
  subTab,
  isAdmin,
}: {
  task: TaskItem;
  subTab: SubTab;
  isAdmin: boolean;
}) {
  const theme = getTheme(task.processId);
  const showTeamSubrows = isAdmin && task.viewTeams.length > 1;
  const proc = E2E_PROCESSES.find((p) => p.id === task.processId);
  const shortName = proc?.shortName ?? task.processId.toUpperCase();

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 shadow-sm transition-all",
        "hover:shadow-md",
        theme.cardHoverBorder
      )}
    >
      {/* 卡片头部 */}
      <div className="p-3 border-b border-gray-100">
        <Breadcrumb
          processTag={shortName}
          theme={theme}
          section={task.sectionName}
          node={task.nodeName}
        />
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <h4
            className="font-semibold text-gray-900 text-sm truncate flex-1"
            title={task.taskName}
          >
            {task.taskName}
          </h4>
          {!showTeamSubrows && (
            <ProgressDots
              submittedSteps={getSubmittedStepsForTeam(
                task,
                task.viewTeams[0] ?? ""
              )}
              theme={theme}
            />
          )}
        </div>
      </div>

      {/* 卡片主体 */}
      {showTeamSubrows ? (
        <div className="divide-y divide-gray-100">
          {task.viewTeams.map((teamName) => (
            <div
              key={teamName}
              className="px-3 py-2.5 flex items-start gap-3"
            >
              <div className="shrink-0 w-28 pt-2">
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-700">
                  <Users size={11} className="text-gray-400" />
                  <span className="truncate" title={teamName}>
                    {teamName}
                  </span>
                </div>
                <ProgressDots
                  submittedSteps={getSubmittedStepsForTeam(task, teamName)}
                  theme={theme}
                  className="mt-1"
                />
              </div>
              <div className="flex-1 grid grid-cols-4 divide-x divide-gray-100 rounded-lg border border-gray-100 overflow-hidden">
                {STEPS.map((step) => (
                  <StepBlock
                    key={step}
                    step={step}
                    entries={task.byTeam[teamName]?.[step] ?? []}
                    subTab={subTab}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 divide-x divide-gray-100">
          {STEPS.map((step) => {
            const teamName = task.viewTeams[0];
            const entries = teamName
              ? (task.byTeam[teamName]?.[step] ?? [])
              : [];
            return (
              <StepBlock
                key={step}
                step={step}
                entries={entries}
                subTab={subTab}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────── 面包屑 ─────────────────
function Breadcrumb({
  processTag,
  theme,
  section,
  node,
}: {
  processTag: string;
  theme: Theme;
  section: string;
  node: string;
}) {
  return (
    <div className="flex items-center gap-1 text-[11px] text-gray-500 flex-wrap">
      <span
        className={cn(
          "px-1.5 py-0.5 rounded font-semibold border text-[10px] leading-none",
          theme.tag
        )}
      >
        {processTag}
      </span>
      <ChevronRight size={10} className="text-gray-300" />
      <span className="truncate max-w-[120px]" title={section}>
        {section}
      </span>
      <ChevronRight size={10} className="text-gray-300" />
      <span className="truncate max-w-[160px] text-gray-600" title={node}>
        {node}
      </span>
    </div>
  );
}

// ───────────────── 进度点 ─────────────────
function ProgressDots({
  submittedSteps,
  theme,
  className,
}: {
  submittedSteps: Set<number>;
  theme: Theme;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {STEPS.map((s) => (
        <span
          key={s}
          className={cn(
            "w-1.5 h-1.5 rounded-full transition-colors",
            submittedSteps.has(s) ? theme.progressFill : "bg-gray-200"
          )}
          title={`${STEP_LABELS[s]} ${submittedSteps.has(s) ? "已提交" : "未提交"}`}
        />
      ))}
      <span className="ml-1 text-[10px] text-gray-400 font-mono">
        {submittedSteps.size}/4
      </span>
    </div>
  );
}

function getSubmittedStepsForTeam(task: TaskItem, teamName: string): Set<number> {
  const s = new Set<number>();
  const data = task.byTeam[teamName];
  if (!data) return s;
  for (const step of Object.keys(data)) s.add(Number(step));
  return s;
}

// ───────────────── 步骤方块 ─────────────────
function StepBlock({
  step,
  entries,
  subTab,
}: {
  step: number;
  entries: TaskEntry[];
  subTab: SubTab;
}) {
  const hasData = entries.length > 0;

  return (
    <div
      className={cn(
        "p-2.5 min-h-[70px] flex flex-col gap-1 transition-colors",
        hasData ? "bg-white" : "bg-gray-50/40"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {STEP_LABELS[step]}
        </span>
        {hasData ? (
          <CheckCircle2 size={10} className="text-emerald-500" />
        ) : (
          <Circle size={10} className="text-gray-200" />
        )}
      </div>

      {subTab === "outputs" ? (
        <OutputContent entries={entries} />
      ) : (
        <AccuracyContent entries={entries} />
      )}
    </div>
  );
}

function OutputContent({ entries }: { entries: TaskEntry[] }) {
  if (entries.length === 0) {
    return <span className="text-gray-300 text-xs select-none mt-1">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {entries.map((e, i) => (
        <div key={i} className="flex items-center gap-1 group">
          <span
            className="text-xs text-gray-700 truncate flex-1"
            title={e.fileName || "附件"}
          >
            {e.fileName || "附件"}
          </span>
          {e.fileLink && (
            <a
              href={e.fileLink}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-blue-500 hover:text-blue-700 opacity-70 group-hover:opacity-100 transition-opacity"
              title="打开链接"
            >
              <ExternalLink size={10} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function AccuracyContent({ entries }: { entries: TaskEntry[] }) {
  const vals = entries
    .map((e) => e.accuracy)
    .filter((v): v is number => v !== null);
  const best = vals.length > 0 ? Math.max(...vals) : null;

  if (best === null) {
    return <span className="text-gray-300 text-xs select-none mt-1">—</span>;
  }

  const colorCls =
    best >= 100
      ? "text-green-600"
      : best >= 80
        ? "text-yellow-600"
        : "text-red-600";

  // 找到对应的文件链接（取最高准确率那条）
  const bestEntry = entries.find((e) => e.accuracy === best);
  const link = bestEntry?.fileLink;

  return (
    <div className="flex items-end justify-between gap-1 mt-auto">
      <span className={cn("text-lg font-bold leading-none", colorCls)}>
        {best}
        <span className="text-xs font-normal">%</span>
      </span>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="text-gray-300 hover:text-blue-500 transition-colors"
          title="打开对应文件"
        >
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

// ───────────────── 准确率图例 ─────────────────
function AccuracyLegend() {
  return (
    <div className="rounded-lg border border-gray-100 px-4 py-2 flex items-center gap-4 bg-gray-50/50 flex-wrap">
      <span className="text-[11px] text-gray-400">准确率图例：</span>
      <span className="text-[11px] text-green-600 font-semibold">
        100% 已达标
      </span>
      <span className="text-[11px] text-yellow-600 font-semibold">
        80-99% 待优化
      </span>
      <span className="text-[11px] text-red-600 font-semibold">
        &lt;80% 需改进
      </span>
      <span className="text-[11px] text-gray-300">— 未提交</span>
    </div>
  );
}

// ───────────────── 空状态 ─────────────────
function EmptyState({
  team,
  processTab,
}: {
  team: string;
  processTab: ProcessTab;
}) {
  const processLabel =
    PROCESS_TABS.find((t) => t.id === processTab)?.label ?? "";
  return (
    <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed border-gray-200 bg-gray-50/30 gap-2">
      <FileText size={24} className="text-gray-300" />
      <div className="text-sm text-gray-400">
        {processTab === "all"
          ? team
            ? `${team} 暂无提交记录`
            : "暂无提交记录"
          : `${processLabel} 流程下暂无提交记录`}
      </div>
      <div className="text-xs text-gray-300">
        请先到【打磨 Skill】中提交步骤文件
      </div>
    </div>
  );
}
