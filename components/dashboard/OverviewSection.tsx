"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { PRESET_TEAMS, E2E_PROCESSES } from "@/lib/constants";

const FILTER_HINT_KEY = "fod-filter-hint-dashboard-seen";

interface UserInfo {
  open_id: string;
  name: string;
  avatar_url?: string;
  email?: string;
}

interface TeamProcessStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  completionRate: number;
}

interface DrillTask {
  team: string;
  taskName: string;
  label: string;
  nodeId: string;
  section: string;
}

interface OverviewData {
  teams: string[];
  stats: Record<string, Record<string, TeamProcessStats>>;
  drillDown: Record<string, Record<string, DrillTask[]>>;
}

interface CompletionDates {
  [team: string]: string;
}

interface Props {
  team: string;
  isAdmin: boolean;
  user: UserInfo | null;
}

const PROCESS_TABS = [
  { id: "all", label: "所有流程" },
  { id: "ptp", label: "PTP" },
  { id: "otc", label: "OTC" },
  { id: "rtr", label: "RTR" },
  { id: "pic", label: "PIC" },
  { id: "tax", label: "税务" },
];

const METRIC_COLS = [
  { key: "total", label: "总场景数", color: "text-gray-700" },
  { key: "completed", label: "已完成", color: "text-green-600" },
  { key: "inProgress", label: "进行中", color: "text-yellow-600" },
  { key: "notStarted", label: "未开始", color: "text-gray-400" },
  { key: "completionRate", label: "完成率", color: "text-blue-600", isRate: true },
];

export function OverviewSection({ team, isAdmin, user }: Props) {
  const [activeProcess, setActiveProcess] = useState("all");
  const [onlyManual, setOnlyManual] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completionDates, setCompletionDates] = useState<CompletionDates>({});
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingTeam, setSavingTeam] = useState<string | null>(null);
  const [drillExpanded, setDrillExpanded] = useState(false);
  const [showFilterHint, setShowFilterHint] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(FILTER_HINT_KEY);
    if (!seen) {
      setShowFilterHint(true);
      const timer = setTimeout(() => setShowFilterHint(false), 6000);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismissHint = useCallback(() => {
    setShowFilterHint(false);
    try {
      localStorage.setItem(FILTER_HINT_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/overview?onlyManual=${onlyManual}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [onlyManual]);

  useEffect(() => {
    fetch("/api/bitable/records?table=4")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.records)) {
          const map: CompletionDates = {};
          for (const rec of d.records) {
            const t = rec.fields["团队名称"] as string;
            const v = rec.fields["预计完成时间"] as string;
            if (t && v) map[t] = v;
          }
          setCompletionDates(map);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (editingTeam && editRef.current) editRef.current.focus();
  }, [editingTeam]);

  const startEdit = (t: string) => {
    setEditingTeam(t);
    setEditValue(completionDates[t] ?? "");
  };
  const cancelEdit = () => { setEditingTeam(null); setEditValue(""); };
  const saveEdit = async (t: string) => {
    if (!editValue.trim()) return cancelEdit();
    setSavingTeam(t);
    try {
      await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "4", fields: { 团队名称: t, 预计完成时间: editValue.trim() } }),
      });
      setCompletionDates((prev) => ({ ...prev, [t]: editValue.trim() }));
    } catch (e) { console.error("保存失败", e); }
    finally { setSavingTeam(null); setEditingTeam(null); }
  };

  // 行列顺序：管理员看全部 PRESET_TEAMS；普通用户仅看自己
  const displayTeams: string[] = isAdmin
    ? PRESET_TEAMS
    : team
    ? [team]
    : [];

  const currentStats = data?.stats ?? {};
  const currentDrillDown = data?.drillDown ?? {};

  return (
    <div className="space-y-4">
      {/* 流程 Tab */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {PROCESS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveProcess(tab.id); setDrillExpanded(false); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                activeProcess === tab.id
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 筛选状态条 */}
      <div
        className={cn(
          "relative rounded-xl border bg-blue-50/70 border-blue-200 px-4 py-2.5 flex items-center flex-wrap gap-3",
          showFilterHint && "ring-2 ring-blue-400 animate-pulse"
        )}
      >
        <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold shrink-0">
          <SlidersHorizontal size={14} />
          当前视图
        </div>

        <button
          onClick={() => {
            setOnlyManual((v) => !v);
            dismissHint();
          }}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
            onlyManual
              ? "bg-orange-500 text-white border-orange-500 shadow-sm"
              : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600"
          )}
          title="只统计 ★纯线下 场景的进度；想看整体时再关掉"
        >
          <span>★ 仅展示纯线下</span>
          {onlyManual && (
            <span
              className="opacity-80 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                setOnlyManual(false);
                dismissHint();
              }}
            >
              <X size={10} />
            </span>
          )}
        </button>

        {isAdmin && activeProcess !== "all" && (
          <button
            onClick={() => {
              setDrillExpanded((v) => !v);
              dismissHint();
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              drillExpanded
                ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:border-emerald-400 hover:text-emerald-600"
            )}
          >
            {drillExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            全团队场景下钻
          </button>
        )}

        {onlyManual && (
          <button
            onClick={() => {
              setOnlyManual(false);
              dismissHint();
            }}
            className="text-xs text-gray-500 hover:text-red-500 ml-1 flex items-center gap-1"
            title="清除筛选"
          >
            <X size={12} /> 清除筛选
          </button>
        )}

        <div className="flex-1" />

        <div className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
          {onlyManual
            ? "已切换到 ★纯线下视图，数据仅统计该标签场景"
            : "默认全部场景视图，点左侧可切换筛选"}
        </div>

        {showFilterHint && (
          <div className="absolute -top-3 right-3 translate-y-[-100%] bg-blue-600 text-white rounded-lg px-3 py-2 text-xs shadow-lg flex items-start gap-2 max-w-xs z-10">
            <Sparkles size={12} className="mt-0.5 shrink-0" />
            <div className="leading-relaxed">
              想只看 ★纯线下 场景？
              <br />
              点「仅展示纯线下」切换，再点一次关闭
            </div>
            <button
              onClick={dismissHint}
              className="shrink-0 text-white/70 hover:text-white"
              title="我知道了"
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      {/* 统计表：行=团队，列=指标 */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold text-gray-600 border-r border-gray-200 min-w-[140px] whitespace-nowrap">
                    团队名称
                  </th>
                  {METRIC_COLS.map((col) => (
                    <th key={col.key} className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap min-w-[80px]">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold text-emerald-600 whitespace-nowrap min-w-[120px]">
                    预计完成时间
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayTeams.map((t, rowIdx) => {
                  const s = currentStats[t]?.[activeProcess];
                  const dateVal = completionDates[t] ?? "待定";
                  const isEditing = editingTeam === t;
                  const isSaving = savingTeam === t;
                  return (
                    <tr
                      key={t}
                      className={cn(
                        "border-b border-gray-100 hover:bg-gray-50/60 transition-colors",
                        rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      )}
                    >
                      {/* 团队名（sticky） */}
                      <td className={cn(
                        "sticky left-0 z-10 px-4 py-3 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap",
                        rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      )}>
                        {t}
                      </td>

                      {/* 各指标 */}
                      {METRIC_COLS.map((col) => {
                        const val = col.isRate
                          ? `${s?.completionRate ?? 0}%`
                          : String(s?.[col.key as keyof TeamProcessStats] ?? 0);
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "px-4 py-3 text-center font-medium",
                              col.isRate
                                ? (s?.completionRate ?? 0) >= 80
                                  ? "text-green-600"
                                  : (s?.completionRate ?? 0) >= 40
                                  ? "text-yellow-600"
                                  : "text-gray-500"
                                : col.color
                            )}
                          >
                            {val}
                          </td>
                        );
                      })}

                      {/* 预计完成时间（inline edit） */}
                      <td className="px-3 py-2 text-center">
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-center">
                            <input
                              ref={editRef}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(t);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="w-20 text-xs border border-emerald-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                              placeholder="如 6.30"
                            />
                            <button onClick={() => saveEdit(t)} disabled={isSaving} className="p-1 text-emerald-600 hover:text-emerald-800">
                              <Check size={13} />
                            </button>
                            <button onClick={cancelEdit} className="p-1 text-gray-400 hover:text-gray-600">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(t)}
                            className={cn(
                              "group flex items-center gap-1 mx-auto text-xs rounded px-2 py-1 transition-all",
                              dateVal === "待定"
                                ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                : "text-emerald-700 font-medium hover:bg-emerald-50"
                            )}
                          >
                            {dateVal}
                            <Pencil size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 管理员下钻二维网格 */}
      {isAdmin && drillExpanded && activeProcess !== "all" && (
        <DrillDownGrid
          processId={activeProcess}
          drillDown={currentDrillDown}
          onlyManual={onlyManual}
        />
      )}
    </div>
  );
}

// ─── 下钻二维网格 ────────────────────────────────────────────────
function DrillDownGrid({
  processId,
  drillDown,
  onlyManual,
}: {
  processId: string;
  drillDown: OverviewData["drillDown"];
  onlyManual: boolean;
}) {
  const process = E2E_PROCESSES.find((p) => p.id === processId);
  if (!process) return null;

  const sectionDrillData = drillDown[processId] ?? {};

  // 构建每个节点的场景索引：nodeName → team → taskName[]
  // drillDown 中 section → DrillTask[]，DrillTask.nodeId 是流程节点名
  const nodeTaskMap: Record<string, Record<string, { taskName: string; label: string }[]>> = {};

  for (const tasks of Object.values(sectionDrillData)) {
    for (const task of tasks) {
      if (!nodeTaskMap[task.nodeId]) nodeTaskMap[task.nodeId] = {};
      if (!nodeTaskMap[task.nodeId][task.team]) nodeTaskMap[task.nodeId][task.team] = [];
      nodeTaskMap[task.nodeId][task.team].push({ taskName: task.taskName, label: task.label });
    }
  }

  // 决定哪些 node 要显示：纯线下模式时仅显示有纯线下场景的节点
  const isNodeVisible = (nodeName: string): boolean => {
    if (!onlyManual) return true;
    const teams = nodeTaskMap[nodeName] ?? {};
    return Object.values(teams).some((tasks) =>
      tasks.some((t) => t.label.includes("纯线下") || t.label.includes("纯手工"))
    );
  };

  // 计算每个节点有多少团队有场景（用于高亮合并潜力）
  const nodeTeamCount = (nodeName: string): number => {
    return Object.keys(nodeTaskMap[nodeName] ?? {}).length;
  };

  // 过滤后可见的 section+node 列表
  const visibleSections = process.sections
    .map((sec) => ({
      ...sec,
      nodes: sec.nodes.filter((n) => isNodeVisible(n.name)),
    }))
    .filter((sec) => sec.nodes.length > 0);

  if (visibleSections.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">
        {onlyManual ? "纯线下筛选后无场景数据" : "该流程暂无场景数据"}
      </div>
    );
  }

  const totalNodeCols = visibleSections.reduce((s, sec) => s + sec.nodes.length, 0);

  return (
    <div className="rounded-xl border border-emerald-200 bg-white shadow-sm overflow-hidden">
      {/* 标题栏 */}
      <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
        <span className="text-sm font-semibold text-emerald-700">
          {process.name} · 全团队场景下钻
        </span>
        {onlyManual && (
          <span className="text-xs text-orange-600 font-normal ml-1">（仅纯线下）</span>
        )}
        <span className="text-xs text-gray-400 ml-auto">
          橙色列头 = ≥2个团队共有（合并潜力）
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-xs">
          {/* 第一层表头：section 分组 */}
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th
                className="sticky left-0 z-20 bg-gray-50 px-3 py-2.5 text-left font-semibold text-gray-600 border-r border-gray-200 min-w-[120px]"
                rowSpan={2}
              >
                团队
              </th>
              {visibleSections.map((sec) => (
                <th
                  key={sec.id}
                  colSpan={sec.nodes.length}
                  className="px-2 py-2 text-center font-semibold text-gray-600 border-l border-gray-200 bg-gray-50/80 whitespace-nowrap"
                >
                  {sec.name}
                </th>
              ))}
            </tr>
            {/* 第二层表头：node 子列 */}
            <tr className="border-b border-gray-200">
              {visibleSections.map((sec) =>
                sec.nodes.map((node) => {
                  const count = nodeTeamCount(node.name);
                  const isHot = count >= 2;
                  return (
                    <th
                      key={node.id}
                      className={cn(
                        "px-2 py-2 text-center font-medium border-l border-gray-100 whitespace-nowrap min-w-[80px]",
                        isHot
                          ? "bg-orange-50 text-orange-700"
                          : "bg-white text-gray-500"
                      )}
                    >
                      <div>{node.name}</div>
                      {isHot && (
                        <div className="text-[10px] text-orange-500 font-normal">
                          {count}个团队
                        </div>
                      )}
                    </th>
                  );
                })
              )}
            </tr>
          </thead>

          <tbody>
            {PRESET_TEAMS.map((teamName, rowIdx) => (
              <tr
                key={teamName}
                className={cn(
                  "border-b border-gray-100",
                  rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                )}
              >
                {/* 团队名（sticky） */}
                <td
                  className={cn(
                    "sticky left-0 z-10 px-3 py-2.5 font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap",
                    rowIdx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                  )}
                >
                  {teamName}
                </td>

                {/* 各节点单元格 */}
                {visibleSections.map((sec) =>
                  sec.nodes.map((node) => {
                    const tasks = (nodeTaskMap[node.name]?.[teamName] ?? []).filter(
                      (t) =>
                        !onlyManual ||
                        t.label.includes("纯线下") ||
                        t.label.includes("纯手工")
                    );
                    const isHot = nodeTeamCount(node.name) >= 2;
                    return (
                      <td
                        key={node.id}
                        className={cn(
                          "px-2 py-2 border-l border-gray-100 align-top min-w-[80px]",
                          isHot && tasks.length > 0 ? "bg-orange-50/30" : ""
                        )}
                      >
                        {tasks.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {tasks.map((t) => (
                              <span
                                key={t.taskName}
                                className={cn(
                                  "inline-block text-[11px] px-1.5 py-0.5 rounded leading-tight",
                                  t.label.includes("纯线下") || t.label.includes("纯手工")
                                    ? "bg-orange-50 text-orange-700 border border-orange-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-100"
                                )}
                              >
                                {t.taskName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-200 select-none">—</span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 图例 */}
      <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-4 bg-gray-50/50">
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-50 border border-orange-200 inline-block" />
          纯线下场景
        </span>
        <span className="flex items-center gap-1 text-[11px] text-gray-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-50 border border-blue-100 inline-block" />
          其他场景
        </span>
        <span className="flex items-center gap-1 text-[11px] text-orange-500">
          <span className="w-2.5 h-2.5 rounded-sm bg-orange-50 border border-orange-300 inline-block" />
          橙色列头：多团队共有，可分析合并潜力
        </span>
      </div>
    </div>
  );
}
