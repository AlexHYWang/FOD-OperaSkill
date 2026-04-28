"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  Zap,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  AlertTriangle,
  Loader2,
  RefreshCw,
  BookOpen,
  FlaskConical,
  UploadCloud,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";

interface InProgressItem {
  taskName: string;
  submittedAt: number;
}

interface HomeSummary {
  loggedIn: boolean;
  recent7dMine: { section1Count: number; skillSubmitCount: number };
  inProgress: InProgressItem[];
  teamThisWeek: { skillSubmitCount: number; unresolvedBlockers: number; team: string };
}

const STEPS = [
  {
    step: "1",
    title: "场景梳理",
    desc: "PTP/OTC 等 · 任务场景与标签",
    href: "/section1",
    icon: <LayoutGrid size={18} />,
    tone: "blue",
  },
  {
    step: "2",
    title: "知识库管理",
    desc: "提交 · 审核 · 发布 · 版本",
    href: "/knowledge",
    icon: <BookOpen size={18} />,
    tone: "indigo",
  },
  {
    step: "3",
    title: "评测集上传",
    desc: "数据集 / 资料 / 评测运行",
    href: "/evaluation",
    icon: <FlaskConical size={18} />,
    tone: "teal",
  },
  {
    step: "4",
    title: "财多多线下测试",
    desc: "下载测试包 · 回传结果",
    href: "/evaluation/test",
    icon: <Zap size={18} />,
    tone: "amber",
  },
  {
    step: "5",
    title: "场景化 Skill 生产",
    desc: "上传训练好的 SKILL",
    href: "/section2",
    icon: <UploadCloud size={18} />,
    tone: "purple",
  },
  {
    step: "6",
    title: "AI进展看板",
    desc: "场景资产 · 准确率纵览",
    href: "/dashboard",
    icon: <BarChart3 size={18} />,
    tone: "emerald",
  },
];

const TONE_CLASS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100",
  teal: "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100",
  amber: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
  purple: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
};

export default function WorkbenchPage() {
  const { user, isLoggedIn, loading, team, setTeam, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  if (loading || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {/* 欢迎行 */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            你好，{user.name}
            {profile.team && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                · {profile.team}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Skill 全链路工作台 · 快速进入任意步骤
          </p>
        </div>

        {/* 全链路入口卡片 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center">
              <Zap size={11} className="text-white" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">Skill 全链路工作台入口</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {STEPS.map((s) => (
              <Link
                key={s.step}
                href={s.href}
                className={`group block rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${TONE_CLASS[s.tone]}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
                      {s.icon}
                    </div>
                    <span className="text-xs font-bold opacity-70">STEP {s.step}</span>
                  </div>
                  <ArrowRight size={16} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="font-bold text-sm mb-1">{s.title}</div>
                <div className="text-xs opacity-75 leading-relaxed">{s.desc}</div>
              </Link>
            ))}
          </div>
        </section>

        {/* 我的动态 */}
        {profile.isBootstrapped && (
          <section>
            <ActivityPanel team={team} router={router} />
          </section>
        )}
      </div>
    </AppLayout>
  );
}

function ActivityPanel({
  team,
  router,
}: {
  team: string;
  router: ReturnType<typeof useRouter>;
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
          {team && <span className="text-xs text-gray-400">· 团队 <b className="text-gray-600">{team}</b></span>}
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
        {/* 最近 7 天 */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white">
              <Clock size={16} />
            </div>
            <div className="text-sm font-semibold text-gray-700">最近 7 天提交</div>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2"><Loader2 size={14} className="animate-spin" /> 统计中…</div>
          ) : !summary?.recent7dMine ? (
            <div className="flex flex-col items-center justify-center py-4 text-gray-300">
              <div className="text-3xl mb-1">📋</div>
              <div className="text-xs text-gray-400">暂无提交记录</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-blue-600">{summary.recent7dMine.section1Count}</span>
                <span className="text-xs text-gray-500">条场景梳理</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-purple-600">{summary.recent7dMine.skillSubmitCount}</span>
                <span className="text-xs text-gray-500">次 SKILL 提交</span>
              </div>
            </div>
          )}
        </div>

        {/* 进行中 */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white">
              <Zap size={16} />
            </div>
            <div className="text-sm font-semibold text-gray-700">进行中</div>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2"><Loader2 size={14} className="animate-spin" /> 查询中…</div>
          ) : (summary?.inProgress ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-2 text-center">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-xs text-gray-400 leading-relaxed">暂无进行中的场景</div>
              <button onClick={() => router.push("/section2")} className="mt-2 inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-medium text-xs">
                前往 SKILL 生产 <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(summary!.inProgress).map((it) => (
                <button
                  key={it.taskName}
                  onClick={() => router.push(`/section2`)}
                  className="w-full text-left rounded-lg border border-purple-100 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-200 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 text-xs font-medium text-purple-900 truncate">{it.taskName}</div>
                    <span className="text-[11px] bg-white text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap">
                      评测待达标
                    </span>
                  </div>
                </button>
              ))}
              <button onClick={() => router.push("/evaluation/test")} className="text-xs text-purple-600 hover:text-purple-800 inline-flex items-center gap-1 font-medium">
                前往评测集测试 <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 本周团队动态 */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm min-h-[140px]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
              <Users size={16} />
            </div>
            <div className="text-sm font-semibold text-gray-700">本周团队动态</div>
          </div>
          {loadingSummary ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-2"><Loader2 size={14} className="animate-spin" /> 统计中…</div>
          ) : !summary?.teamThisWeek ? (
            <div className="flex flex-col items-center justify-center py-4 text-gray-300">
              <div className="text-3xl mb-1">🏢</div>
              <div className="text-xs text-gray-400">暂无团队数据</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-600">{summary.teamThisWeek.skillSubmitCount}</span>
                <span className="text-xs text-gray-500">次 SKILL 提交</span>
              </div>
              <div className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 ${summary.teamThisWeek.unresolvedBlockers > 0 ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                <AlertTriangle size={12} className={summary.teamThisWeek.unresolvedBlockers > 0 ? "text-amber-600" : "text-gray-400"} />
                {summary.teamThisWeek.unresolvedBlockers > 0
                  ? <><b className="font-semibold">{summary.teamThisWeek.unresolvedBlockers}</b> 个卡点待处理</>
                  : "无待处理卡点"}
              </div>
              <button onClick={() => router.push("/dashboard")} className="text-xs text-emerald-600 hover:text-emerald-800 inline-flex items-center gap-1 font-medium">
                打开全链路看板 <ArrowRight size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
