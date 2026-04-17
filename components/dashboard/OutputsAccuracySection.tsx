"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, BarChart2, ExternalLink } from "lucide-react";
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

// 每个流程的颜色主题
const PROC_THEME: Record<
  string,
  {
    tabActive: string;
    procHeader: string;
    sectionBg: string;
    nodeBg: string;
    nodeBorder: string;
    stepBorder: string;
  }
> = {
  ptp: {
    tabActive: "bg-blue-600 text-white border-blue-600",
    procHeader: "bg-blue-600 text-white",
    sectionBg: "bg-blue-50 text-blue-800",
    nodeBg: "bg-blue-50/50 text-blue-700",
    nodeBorder: "border-l-blue-300",
    stepBorder: "border-l-blue-100",
  },
  otc: {
    tabActive: "bg-green-600 text-white border-green-600",
    procHeader: "bg-green-600 text-white",
    sectionBg: "bg-green-50 text-green-800",
    nodeBg: "bg-green-50/50 text-green-700",
    nodeBorder: "border-l-green-300",
    stepBorder: "border-l-green-100",
  },
  rtr: {
    tabActive: "bg-purple-600 text-white border-purple-600",
    procHeader: "bg-purple-600 text-white",
    sectionBg: "bg-purple-50 text-purple-800",
    nodeBg: "bg-purple-50/50 text-purple-700",
    nodeBorder: "border-l-purple-300",
    stepBorder: "border-l-purple-100",
  },
  pic: {
    tabActive: "bg-orange-500 text-white border-orange-500",
    procHeader: "bg-orange-500 text-white",
    sectionBg: "bg-orange-50 text-orange-800",
    nodeBg: "bg-orange-50/50 text-orange-700",
    nodeBorder: "border-l-orange-300",
    stepBorder: "border-l-orange-100",
  },
  tax: {
    tabActive: "bg-rose-600 text-white border-rose-600",
    procHeader: "bg-rose-600 text-white",
    sectionBg: "bg-rose-50 text-rose-800",
    nodeBg: "bg-rose-50/50 text-rose-700",
    nodeBorder: "border-l-rose-300",
    stepBorder: "border-l-rose-100",
  },
  all: {
    tabActive: "bg-gray-700 text-white border-gray-700",
    procHeader: "bg-gray-700 text-white",
    sectionBg: "bg-gray-100 text-gray-700",
    nodeBg: "bg-gray-50 text-gray-600",
    nodeBorder: "border-l-gray-300",
    stepBorder: "border-l-gray-100",
  },
};

function getTheme(processId: string) {
  return PROC_THEME[processId] ?? PROC_THEME.all;
}

/** 飞书 URL 字段返回 {link, text} 对象，需安全提取 */
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

// processId → sectionName → nodeName → step → team → entries[]
type HierarchyData = Record<
  string,
  Record<string, Record<string, Record<number, Record<string, TaskEntry[]>>>>
>;

export function OutputsAccuracySection({ team, isAdmin }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("outputs");
  const [processTab, setProcessTab] = useState<ProcessTab>("all");
  const [table1Records, setTable1Records] = useState<SkillRecord[]>([]);
  const [table2Records, setTable2Records] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  // 从 Table1 构建任务上下文映射：
  // key = "团队::任务名" → { processId, sectionName, nodeName }
  const taskInfoMap = new Map<
    string,
    { processId: string; sectionName: string; nodeName: string }
  >();
  for (const rec of table1Records) {
    const teamName = rec.fields["团队名称"] as string;
    const taskName = rec.fields["任务名称"] as string;
    const e2eRaw = rec.fields["端到端流程"] as string | undefined;
    const sectionName = (rec.fields["流程环节"] as string) || "其他";
    const nodeName = (rec.fields["流程节点"] as string) || "其他";
    if (!teamName || !taskName) continue;
    const processId = e2eRaw ? (SHORT_NAME_TO_ID[e2eRaw] ?? "all") : "all";
    taskInfoMap.set(`${teamName}::${taskName}`, {
      processId,
      sectionName,
      nodeName,
    });
  }

  // 从 Table2 join Table1，构建层级数据结构
  const hierarchy: HierarchyData = {};
  const allTeamsSet = new Set<string>();

  for (const rec of table2Records) {
    const t = rec.fields["团队名称"] as string;
    const taskName = rec.fields["关联任务"] as string;
    const step = Number(rec.fields["步骤编号"] ?? 0);
    const fileName = (rec.fields["文件名称"] as string) || "";
    const fileLink = extractFileLink(rec.fields["文件链接"]);
    const accuracy =
      rec.fields["准确率(%)"] != null
        ? Number(rec.fields["准确率(%)"])
        : null;

    if (!t || !taskName || !STEPS.includes(step)) continue;
    allTeamsSet.add(t);

    const info = taskInfoMap.get(`${t}::${taskName}`);
    const pid = info?.processId ?? "all";
    const sName = info?.sectionName ?? "未分类";
    const nName = info?.nodeName ?? "未分类";

    if (!hierarchy[pid]) hierarchy[pid] = {};
    if (!hierarchy[pid][sName]) hierarchy[pid][sName] = {};
    if (!hierarchy[pid][sName][nName]) hierarchy[pid][sName][nName] = {};
    if (!hierarchy[pid][sName][nName][step])
      hierarchy[pid][sName][nName][step] = {};
    if (!hierarchy[pid][sName][nName][step][t])
      hierarchy[pid][sName][nName][step][t] = [];
    hierarchy[pid][sName][nName][step][t].push({
      taskName,
      fileName,
      fileLink,
      accuracy,
    });
  }

  const allTeams = Array.from(allTeamsSet).sort((a, b) =>
    a.localeCompare(b, "zh")
  );
  const hasAnyData = allTeams.length > 0;

  const targetProcesses =
    processTab === "all"
      ? E2E_PROCESSES
      : E2E_PROCESSES.filter((p) => p.id === processTab);

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
      ) : !hasAnyData ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          {team ? `${team} 暂无提交记录` : "暂无提交记录"}
        </div>
      ) : (
        <HierarchicalTable
          subTab={subTab}
          targetProcesses={targetProcesses}
          hierarchy={hierarchy}
          allTeams={allTeams}
          showProcessHeader={processTab === "all"}
        />
      )}
    </div>
  );
}

// ─── 层级表格组件 ───────────────────────────────────────────────
function HierarchicalTable({
  subTab,
  targetProcesses,
  hierarchy,
  allTeams,
  showProcessHeader,
}: {
  subTab: SubTab;
  targetProcesses: typeof E2E_PROCESSES;
  hierarchy: HierarchyData;
  allTeams: string[];
  showProcessHeader: boolean;
}) {
  const getBestAccuracy = (entries: TaskEntry[]): number | null => {
    const vals = entries
      .map((e) => e.accuracy)
      .filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.max(...vals) : null;
  };

  const accuracyColor = (v: number | null): string => {
    if (v === null) return "text-gray-300 bg-transparent";
    if (v >= 100) return "text-green-700 bg-green-50 font-semibold";
    if (v >= 80) return "text-yellow-700 bg-yellow-50 font-semibold";
    return "text-red-700 bg-red-50 font-semibold";
  };

  const colCount = allTeams.length + 1;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-500 border-r border-gray-200 min-w-[110px] whitespace-nowrap text-xs">
                步骤
              </th>
              {allTeams.map((t) => (
                <th
                  key={t}
                  className="px-3 py-3 text-center font-semibold text-gray-700 whitespace-nowrap min-w-[130px] border-l border-gray-100 text-xs"
                >
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {targetProcesses.map((proc) => {
              const procData = hierarchy[proc.id] ?? {};
              const theme = getTheme(proc.id);

              const procHasData = proc.sections.some((sec) =>
                sec.nodes.some((node) => procData[sec.name]?.[node.name])
              );
              if (!procHasData) return null;

              return (
                <React.Fragment key={proc.id}>
                  {/* 流程大标题行（仅"全部"tab下显示） */}
                  {showProcessHeader && (
                    <tr>
                      <td
                        colSpan={colCount}
                        className={cn(
                          "px-4 py-2 font-bold text-xs tracking-wide border-b border-t",
                          theme.procHeader
                        )}
                      >
                        {proc.name}
                      </td>
                    </tr>
                  )}

                  {proc.sections.map((sec) => {
                    const sectionData = procData[sec.name] ?? {};
                    const sectionHasData = sec.nodes.some(
                      (node) => sectionData[node.name]
                    );
                    if (!sectionHasData) return null;

                    return (
                      <React.Fragment key={sec.id}>
                        {/* 环节标题行 */}
                        <tr>
                          <td
                            colSpan={colCount}
                            className={cn(
                              "px-4 py-2 font-semibold text-xs border-b",
                              showProcessHeader ? "pl-5" : "",
                              theme.sectionBg
                            )}
                          >
                            📁 {sec.name}
                          </td>
                        </tr>

                        {sec.nodes.map((node) => {
                          const nodeData = sectionData[node.name] ?? {};
                          const nodeHasData = STEPS.some(
                            (s) =>
                              nodeData[s] &&
                              Object.keys(nodeData[s]).length > 0
                          );
                          if (!nodeHasData) return null;

                          return (
                            <React.Fragment key={node.id}>
                              {/* 节点标题行 */}
                              <tr>
                                <td
                                  colSpan={colCount}
                                  className={cn(
                                    "py-1.5 text-xs font-medium border-b border-l-2",
                                    "px-4",
                                    showProcessHeader ? "pl-8" : "pl-6",
                                    theme.nodeBg,
                                    theme.nodeBorder
                                  )}
                                >
                                  ↳ {node.name}
                                </td>
                              </tr>

                              {/* 步骤数据行 */}
                              {STEPS.map((step, stepIdx) => {
                                const hasStepData = allTeams.some(
                                  (t) =>
                                    (nodeData[step]?.[t] ?? []).length > 0
                                );
                                // 始终展示 4 步，即使某步全空也显示占位行
                                return (
                                  <tr
                                    key={step}
                                    className={cn(
                                      "border-b border-gray-50",
                                      stepIdx % 2 === 0
                                        ? "bg-white"
                                        : "bg-gray-50/20",
                                      !hasStepData && "opacity-40"
                                    )}
                                  >
                                    {/* 步骤列（sticky） */}
                                    <td
                                      className={cn(
                                        "sticky left-0 z-10 py-2 text-xs text-gray-500 whitespace-nowrap",
                                        "border-r border-gray-100 border-l-4",
                                        showProcessHeader ? "pl-10" : "pl-8",
                                        theme.stepBorder,
                                        stepIdx % 2 === 0
                                          ? "bg-white"
                                          : "bg-gray-50/20"
                                      )}
                                    >
                                      {STEP_LABELS[step]}
                                    </td>

                                    {/* 各团队列 */}
                                    {allTeams.map((t) => {
                                      const entries =
                                        nodeData[step]?.[t] ?? [];

                                      if (subTab === "outputs") {
                                        return (
                                          <td
                                            key={t}
                                            className="px-2 py-2 align-top border-l border-gray-50"
                                          >
                                            {entries.length === 0 ? (
                                              <span className="text-gray-200 text-xs select-none">
                                                —
                                              </span>
                                            ) : (
                                              <div className="flex flex-col gap-1">
                                                {entries.map((e, i) => (
                                                  <div
                                                    key={i}
                                                    className="group flex flex-col gap-0"
                                                  >
                                                    {/* 日常任务名（小灰字） */}
                                                    {e.taskName && (
                                                      <span
                                                        className="text-[10px] text-gray-400 truncate max-w-[110px] leading-tight"
                                                        title={e.taskName}
                                                      >
                                                        {e.taskName}
                                                      </span>
                                                    )}
                                                    {/* 文件名 + 外链图标 */}
                                                    <div className="flex items-center gap-1">
                                                      <span
                                                        className="text-xs text-gray-700 truncate max-w-[95px]"
                                                        title={
                                                          e.fileName ||
                                                          e.taskName
                                                        }
                                                      >
                                                        {e.fileName ||
                                                          (e.fileLink
                                                            ? "附件"
                                                            : "—")}
                                                      </span>
                                                      {e.fileLink ? (
                                                        <a
                                                          href={e.fileLink}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="shrink-0 text-blue-400 hover:text-blue-600 opacity-60 group-hover:opacity-100 transition-opacity"
                                                        >
                                                          <ExternalLink
                                                            size={10}
                                                          />
                                                        </a>
                                                      ) : null}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </td>
                                        );
                                      } else {
                                        // 准确率
                                        const best = getBestAccuracy(entries);
                                        return (
                                          <td
                                            key={t}
                                            className="px-2 py-2 text-center border-l border-gray-50"
                                          >
                                            {best === null ? (
                                              <span className="text-gray-200 text-xs select-none">
                                                —
                                              </span>
                                            ) : (
                                              <span
                                                className={cn(
                                                  "text-xs px-2 py-0.5 rounded-full inline-block",
                                                  accuracyColor(best)
                                                )}
                                              >
                                                {best}%
                                              </span>
                                            )}
                                          </td>
                                        );
                                      }
                                    })}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 图例 */}
      {subTab === "accuracy" && (
        <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 bg-gray-50/50 flex-wrap">
          <span className="text-[11px] text-gray-400">准确率图例：</span>
          <span className="text-[11px] text-green-700 font-semibold">
            100% 已达标
          </span>
          <span className="text-[11px] text-yellow-700 font-semibold">
            80-99% 待优化
          </span>
          <span className="text-[11px] text-red-700 font-semibold">
            &lt;80% 需改进
          </span>
          <span className="text-[11px] text-gray-300">— 未提交</span>
        </div>
      )}
    </div>
  );
}
