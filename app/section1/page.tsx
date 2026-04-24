"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid,
  Info,
  SlidersHorizontal,
  X as XIcon,
  Sparkles,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { NodeMappingGrid } from "@/components/NodeMappingGrid";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const PROCESS_COLORS: Record<string, { tab: string; active: string }> = {
  ptp: { tab: "hover:text-blue-600 hover:border-blue-400", active: "text-blue-700 border-blue-600 bg-blue-50" },
  otc: { tab: "hover:text-green-600 hover:border-green-400", active: "text-green-700 border-green-600 bg-green-50" },
  rtr: { tab: "hover:text-purple-600 hover:border-purple-400", active: "text-purple-700 border-purple-600 bg-purple-50" },
  pic: { tab: "hover:text-orange-600 hover:border-orange-400", active: "text-orange-700 border-orange-600 bg-orange-50" },
  tax: { tab: "hover:text-red-600 hover:border-red-400", active: "text-red-700 border-red-600 bg-red-50" },
};

const FILTER_HINT_KEY = "fod-filter-hint-section1-seen";

export default function Section1Page() {
  const { user, isLoggedIn, loading, team, setTeam, canEdit, profile } = useAuth();
  const router = useRouter();
  const [activeProcess, setActiveProcess] = useState(E2E_PROCESSES[0].id);
  const [onlyManual, setOnlyManual] = useState(true);
  const [onlyHasTasks, setOnlyHasTasks] = useState(false);
  const [stats, setStats] = useState({
    totalTasks: 0,
    totalNodes: 0,
    visibleTasks: 0,
    visibleNodes: 0,
  });

  const [showHint, setShowHint] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLoggedIn) return;
    const seen = localStorage.getItem(FILTER_HINT_KEY);
    if (!seen) {
      setShowHint(true);
      const timer = setTimeout(() => {
        setShowHint(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn]);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    try {
      localStorage.setItem(FILTER_HINT_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const handleStatsChange = useCallback(
    (s: typeof stats) => setStats(s),
    []
  );

  if (loading || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const currentProcess = E2E_PROCESSES.find((p) => p.id === activeProcess)!;
  const filtersActive = onlyManual || onlyHasTasks;

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="flex flex-col h-full">
        {/* 页面标题行 */}
        <div className="px-6 pt-5 pb-3 border-b bg-white">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-0.5">
                <LayoutGrid size={18} />
                <span className="text-sm font-medium">场景梳理</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">场景梳理 · 把团队日常工作列成清单</h1>
              <p className="text-gray-500 text-xs mt-0.5">
                挑一个端到端流程 → 在对应节点下点「+ 添加场景」→ 选标签与至少一项「归属范式」→ 保存
              </p>
              {!canEdit && team && profile.team && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  正在查看 <b>{team}</b> 团队数据（只读）· 你的归属团队是 <b>{profile.team}</b>
                </div>
              )}
              {canEdit &&
                profile.role === "管理员" &&
                team &&
                team !== profile.team && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-50 border border-violet-200 text-xs text-violet-800">
                    管理员：当前正在编辑 <b>{team}</b> 团队数据（可写；不限于你的归属团队{" "}
                    <b>{profile.team}</b>）
                  </div>
                )}
            </div>
          </div>

          {!team && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Info size={14} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">请先在顶部选择您的团队</span>
                ——系统将自动加载该团队已有记录。
              </div>
            </div>
          )}
        </div>

        {/* 筛选状态条（独立一行） */}
        <div className="bg-white border-b px-6 py-2 relative">
          <div
            ref={filterBarRef}
            className={cn(
              "relative rounded-xl border bg-blue-50/70 border-blue-200 px-4 py-2.5 flex items-center flex-wrap gap-3",
              showHint && "ring-2 ring-blue-400 animate-pulse"
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
                "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                onlyManual
                  ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                  : "bg-white text-gray-700 border-gray-300 hover:border-orange-400 hover:text-orange-600"
              )}
              title="「Skill创建」侧重点是★纯线下场景"
            >
              <span>★ 仅纯线下</span>
              {onlyManual && (
                <span
                  className="opacity-80 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOnlyManual(false);
                    dismissHint();
                  }}
                >
                  <XIcon size={10} />
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setOnlyHasTasks((v) => !v);
                dismissHint();
              }}
              className={cn(
                "group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                onlyHasTasks
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              )}
            >
              <span>仅有场景</span>
              {onlyHasTasks && (
                <span
                  className="opacity-80 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOnlyHasTasks(false);
                    dismissHint();
                  }}
                >
                  <XIcon size={10} />
                </span>
              )}
            </button>

            {filtersActive && (
              <button
                onClick={() => {
                  setOnlyManual(false);
                  setOnlyHasTasks(false);
                  dismissHint();
                }}
                className="text-xs text-gray-500 hover:text-red-500 ml-1 flex items-center gap-1"
                title="清除全部筛选"
              >
                <XIcon size={12} /> 清除筛选
              </button>
            )}

            <div className="flex-1" />

            <div className="text-xs text-gray-600 shrink-0 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                <b className="text-gray-900">{stats.visibleTasks}</b>
                <span className="text-gray-500">个场景</span>
              </span>
              <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5">
                <b className="text-gray-900">{stats.visibleNodes}</b>
                <span className="text-gray-500">个节点</span>
              </span>
              {filtersActive && stats.totalTasks > 0 && (
                <span className="text-gray-400">
                  （总 {stats.totalTasks} 个 / {stats.totalNodes} 节点）
                </span>
              )}
            </div>

            {showHint && (
              <div className="absolute -top-3 right-3 translate-y-[-100%] bg-blue-600 text-white rounded-lg px-3 py-2 text-xs shadow-lg flex items-start gap-2 max-w-xs">
                <Sparkles size={12} className="mt-0.5 shrink-0" />
                <div className="leading-relaxed">
                  信息太多？用上方筛选器缩小范围；
                  <br />
                  看完点右边「✕ 清除筛选」恢复
                </div>
                <button
                  onClick={dismissHint}
                  className="shrink-0 text-white/70 hover:text-white"
                  title="我知道了"
                >
                  <XIcon size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 横向流程页签 */}
        <div className="bg-white border-b px-6 overflow-x-auto">
          <div className="flex items-end gap-0 min-w-max">
            {E2E_PROCESSES.map((proc) => {
              const isActive = proc.id === activeProcess;
              const colors = PROCESS_COLORS[proc.id];
              return (
                <button
                  key={proc.id}
                  onClick={() => setActiveProcess(proc.id)}
                  className={cn(
                    "relative px-5 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap",
                    isActive
                      ? `${colors.active} border-b-2`
                      : `text-gray-500 border-transparent ${colors.tab}`
                  )}
                >
                  <span className="font-bold mr-1">{proc.shortName}</span>
                  {proc.id !== proc.shortName.toLowerCase() && (
                    <span className="text-xs opacity-70 hidden lg:inline">
                      {proc.name.replace(proc.shortName, "").trim()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 看板内容区 */}
        <div className="flex-1 overflow-auto">
          {team ? (
            <NodeMappingGrid
              team={team}
              userName={user.name}
              process={currentProcess}
              onlyManual={onlyManual}
              onlyHasTasks={onlyHasTasks}
              readOnly={!canEdit}
              onStatsChange={handleStatsChange}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <LayoutGrid size={48} className="mb-4 opacity-20" />
              <div className="text-lg font-medium">选择团队后开始填写</div>
              <div className="text-sm mt-1">在顶部下拉菜单中选择您所在的团队</div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
