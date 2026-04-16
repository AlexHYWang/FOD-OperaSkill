"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Info, Filter } from "lucide-react";
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

export default function Section1Page() {
  const { user, isLoggedIn, loading, team, setTeam } = useAuth();
  const router = useRouter();
  const [activeProcess, setActiveProcess] = useState(E2E_PROCESSES[0].id);
  const [onlyManual, setOnlyManual] = useState(false);
  const [onlyHasTasks, setOnlyHasTasks] = useState(false);

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push("/");
    }
  }, [loading, isLoggedIn, router]);

  if (loading || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const currentProcess = E2E_PROCESSES.find((p) => p.id === activeProcess)!;

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="flex flex-col h-full">
        {/* 页面标题行 */}
        <div className="px-6 pt-5 pb-3 border-b bg-white">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 text-blue-600 mb-0.5">
                <LayoutGrid size={18} />
                <span className="text-sm font-medium">任务一</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Skill↔流程节点映射</h1>
              <p className="text-gray-500 text-xs mt-0.5">
                选择端到端流程，为各流程节点下的日常任务打标签，并在任务二中生成对应 Skill。
              </p>
            </div>

            {/* 筛选按钮组 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOnlyHasTasks((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  onlyHasTasks
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
                )}
              >
                <Filter size={12} />
                {onlyHasTasks ? "仅有任务（已开启）" : "仅显示有任务"}
              </button>
              <button
                onClick={() => setOnlyManual((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                  onlyManual
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600"
                )}
              >
                <Filter size={12} />
                {onlyManual ? "★ 仅纯线下（已开启）" : "★ 仅显示纯线下"}
              </button>
            </div>
          </div>

          {/* 须知 */}
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
