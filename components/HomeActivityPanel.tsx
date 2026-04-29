"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Clock,
  Zap,
  Users,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

export interface InProgressItem {
  taskName: string;
  submittedAt: number;
}

export interface HomeSummary {
  loggedIn: boolean;
  recent7dMine: { section1Count: number; skillSubmitCount: number };
  inProgress: InProgressItem[];
  teamThisWeek: { skillSubmitCount: number; unresolvedBlockers: number; team: string };
}

/**
 * 首页与「作业中心 · 我的工作台」共用的「我的动态」区块：同一接口、同一展示逻辑。
 */
export type HomeActivityRouter = { push: (href: string) => void };

export function HomeActivityPanel({
  team,
  router,
}: {
  team: string;
  router: HomeActivityRouter;
}) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setLoadingSummary(true);
    fetch("/api/home/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSummary(d.success ? (d as HomeSummary) : null))
      .catch(() => setSummary(null))
      .finally(() => setLoadingSummary(false));
  }, [refreshKey]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">我的动态</h3>
          {team && (
            <span className="text-xs text-gray-400">
              · 团队 <b className="text-gray-600">{team}</b>
            </span>
          )}
        </div>
        <button
          onClick={() => setRefreshKey((v) => v + 1)}
          disabled={loadingSummary}
          className="text-xs text-gray-500 hover:text-blue-600 inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loadingSummary ? "animate-spin" : ""} />
          刷新
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
              <Clock size={16} />
            </div>
            <div className="text-sm font-semibold text-gray-700">最近 7 天提交</div>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> 统计中…
            </div>
          ) : !summary?.recent7dMine ? (
            <div className="flex flex-col items-center justify-center py-4 text-gray-300">
              <div className="text-3xl mb-1">📋</div>
              <div className="text-xs text-gray-400">暂无提交记录</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600">
                  {summary.recent7dMine.section1Count}
                </span>
                <span className="text-xs text-gray-500">条场景梳理</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600">
                  {summary.recent7dMine.skillSubmitCount}
                </span>
                <span className="text-xs text-gray-500">次 SKILL 提交</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Zap size={16} />
            </div>
            <div className="text-sm font-semibold text-gray-700">进行中</div>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> 查询中…
            </div>
          ) : (summary?.inProgress ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-xs text-gray-400 leading-relaxed">暂无进行中的场景</div>
              <button
                type="button"
                onClick={() => router.push("/section2")}
                className="mt-2 inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium text-xs"
              >
                前往 SKILL 生产 <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(summary!.inProgress).map((it) => (
                <button
                  key={it.taskName}
                  type="button"
                  onClick={() => router.push("/section2")}
                  className="w-full text-left rounded-lg border border-purple-100 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-200 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 text-xs font-medium text-purple-900 truncate">
                      {it.taskName}
                    </div>
                    <span className="text-[11px] bg-white text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                      评测待达标
                    </span>
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => router.push("/evaluation/test")}
                className="text-xs text-purple-600 hover:text-purple-800 inline-flex items-center gap-1 font-medium"
              >
                前往评测集测试 <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
              <Users size={16} />
            </div>
            <div className="text-sm font-semibold text-gray-700">本周团队动态</div>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
              <Loader2 size={14} className="animate-spin" /> 统计中…
            </div>
          ) : !summary?.teamThisWeek ? (
            <div className="flex flex-col items-center justify-center py-4 text-gray-300">
              <div className="text-3xl mb-1">🏢</div>
              <div className="text-xs text-gray-400">暂无团队数据</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600">
                  {summary.teamThisWeek.skillSubmitCount}
                </span>
                <span className="text-xs text-gray-500">次 SKILL 提交</span>
              </div>
              <div
                className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 ${
                  summary.teamThisWeek.unresolvedBlockers > 0
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-gray-50 text-gray-500 border border-gray-200"
                }`}
              >
                <AlertTriangle
                  size={12}
                  className={
                    summary.teamThisWeek.unresolvedBlockers > 0 ? "text-amber-600" : "text-gray-400"
                  }
                />
                {summary.teamThisWeek.unresolvedBlockers > 0 ? (
                  <>
                    <b className="font-semibold">{summary.teamThisWeek.unresolvedBlockers}</b>{" "}
                    个卡点待处理
                  </>
                ) : (
                  "无待处理卡点"
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-xs text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1 font-medium"
              >
                打开全链路看板 <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
