"use client";

import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { WorkflowOverview } from "@/components/WorkflowOverview";
import { PageHeader } from "@/components/PageHeader";

export default function WorkflowPage() {
  const { user, team, setTeam, isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        请先登录查看全景流程图
      </div>
    );
  }

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader
          title="全景流程图"
          subtitle="Step 1 调试 → Step 2 使用 · 三条泳道一屏看完。勾选右上角「仅高亮我的环节」可聚焦当前角色。"
        />
        <WorkflowOverview />
      </div>
    </AppLayout>
  );
}
