"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { AppLayout } from "@/components/AppLayout";
import { OverviewSection } from "@/components/dashboard/OverviewSection";
import { OutputsAccuracySection } from "@/components/dashboard/OutputsAccuracySection";
import { BlockersGoalsSection } from "@/components/dashboard/BlockersGoalsSection";
import { cn } from "@/lib/utils";
import { BarChart3, FileText, AlertTriangle, Target } from "lucide-react";

type TabId = "overview" | "outputs" | "blockers" | "goals";

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "整体数据概览", icon: <BarChart3 size={15} /> },
  { id: "outputs", label: "产出物 & 准确率", icon: <FileText size={15} /> },
  { id: "blockers", label: "主要卡点", icon: <AlertTriangle size={15} /> },
  { id: "goals", label: "明日关键目标", icon: <Target size={15} /> },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, team, setTeam, loading: isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [today, setToday] = useState("");

  // 动态日期（浏览器本地时间）
  useEffect(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setToday(`${y}.${m}.${day}`);
  }, []);

  // 鉴权 + 管理员校验
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/dashboard/admin-check")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => setIsAdmin(false));
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 space-y-4">
        {/* 页面标题 */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {today && (
                <span className="text-emerald-600 mr-1">{today}</span>
              )}
              各财务团队AI进展汇总
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  管理员视图 · 可查看全团队数据及下钻分析
                </span>
              ) : (
                <span>当前团队：{team || "未选择"}</span>
              )}
            </p>
          </div>
        </div>

        {/* 横向 Tab 导航 */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all",
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab 内容区 */}
        <div>
          {activeTab === "overview" && (
            <OverviewSection team={team} isAdmin={isAdmin} user={user} />
          )}
          {activeTab === "outputs" && (
            <OutputsAccuracySection team={team} isAdmin={isAdmin} />
          )}
          {activeTab === "blockers" && (
            <BlockersGoalsSection
              team={team}
              isAdmin={isAdmin}
              user={user}
              mode="blockers"
            />
          )}
          {activeTab === "goals" && (
            <BlockersGoalsSection
              team={team}
              isAdmin={isAdmin}
              user={user}
              mode="goals"
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
