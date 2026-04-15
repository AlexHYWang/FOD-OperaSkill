"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Info, BarChart2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SkillStepWizard } from "@/components/SkillStepWizard";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

type TabType = "wizard" | "progress";

export default function Section2Page() {
  const { user, isLoggedIn, loading, team, setTeam } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("wizard");

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
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div>
          <div className="flex items-center gap-2 text-purple-600 mb-1">
            <Zap size={20} />
            <span className="text-sm font-medium">任务二</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            各团队日常任务 Skill 实战生成
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            针对任务一中归类好的日常任务，依次完成四步 Skill 实战：组建知识库 → 生成子Skill1 → 调优子Skill2（≥90%）→ 输出对比报告 → 优化至子Skill3。
          </p>
        </div>

        {/* 须知 */}
        {!team ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Info size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">请先在顶部选择您的团队</div>
              系统会加载该团队在任务一中记录的日常任务列表，供您选择进行 Skill 实战。
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm text-purple-800">
            <Info size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">操作说明</div>
              <ol className="list-decimal ml-4 space-y-1 text-xs">
                <li>先下载「母Skill框架」和「Skill Creator」工具</li>
                <li>从任务一的日常任务列表中选择要实战的任务</li>
                <li>按顺序完成四步上传，每步完成后才能解锁下一步</li>
                <li>第二步准确率须达到 90% 以上才可提交</li>
                <li>第三、四步的对比分析报告须上传 .md 格式，AI 会自动校验内容完整性</li>
              </ol>
            </div>
          </div>
        )}

        {/* 标签切换 */}
        <div className="flex border-b">
          {(
            [
              { key: "wizard", label: "提交作业", icon: <Zap size={15} /> },
              { key: "progress", label: "团队进度", icon: <BarChart2 size={15} /> },
            ] as { key: TabType; label: string; icon: React.ReactNode }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === tab.key
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* 内容区 */}
        {activeTab === "wizard" ? (
          <SkillStepWizard team={team} userName={user.name} />
        ) : (
          <ProgressDashboard team={team} />
        )}
      </div>
    </AppLayout>
  );
}
