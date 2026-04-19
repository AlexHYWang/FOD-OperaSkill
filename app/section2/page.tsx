"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Zap, Info, Lock, Users } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SkillStepWizard } from "@/components/SkillStepWizard";
import { useAuth } from "@/components/AuthProvider";

export default function Section2Page() {
  const { user, isLoggedIn, loading, team, setTeam, canEdit, profile } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTask = searchParams?.get("task") || null;

  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.push("/");
    }
  }, [loading, isLoggedIn, router]);

  if (loading || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-5xl mx-auto space-y-5">
        {/* 页面标题（精简） */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Zap size={18} />
              <span className="text-sm font-medium">任务二</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {preselectedTask ? preselectedTask : "选一个日常任务 · 做 Skill 实战"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {preselectedTask
                ? "按 4 步走：生成子Skill1 → 调优到子Skill2（准确率 100%）→ 对比报告 → 优化到子Skill3"
                : "下方是你团队标记为 ★纯线下 的任务。点一个卡片开始，四步搞定 Skill 打磨。"}
            </p>
          </div>
          {!canEdit && team && profile.team && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <Lock size={12} />
              正在查看 <b>{team}</b> 团队（只读）
            </div>
          )}
        </div>

        {/* 团队未选 */}
        {!team ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Users size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">请先在顶部选择一个团队</div>
              <span className="text-xs opacity-80">
                选完后下方会按「环节」「节点」展开该团队的日常任务清单。
              </span>
            </div>
          </div>
        ) : null}

        {/* 首次进入提示（仅在未带 task 参数且未选中具体任务时显示，简短版） */}
        {team && !preselectedTask && (
          <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <b>先选一个任务再往下做。</b> 没看到想做的任务？先回
              <button
                onClick={() => router.push("/section1")}
                className="underline font-medium hover:text-blue-900 ml-0.5"
              >
                任务一
              </button>
              ，把它打上 ★纯线下 标签。
            </div>
          </div>
        )}

        {/* 统一进度视图 */}
        {team && (
          <SkillStepWizard
            team={team}
            userName={user.name}
            readOnly={!canEdit}
          />
        )}
      </div>
    </AppLayout>
  );
}
