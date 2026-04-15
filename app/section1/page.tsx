"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Info } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { NodeMappingGrid } from "@/components/NodeMappingGrid";
import { useAuth } from "@/components/AuthProvider";

export default function Section1Page() {
  const { user, isLoggedIn, loading, team, setTeam } = useAuth();
  const router = useRouter();

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

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <LayoutGrid size={20} />
            <span className="text-sm font-medium">任务一</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Skill↔流程节点映射
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            基于 PTP（Purchase to Payment）七大环节，明确每个流程节点涉及哪些日常任务，并为其打上对应的 Skill 应用标签。
          </p>
        </div>

        {/* 须知 */}
        {!team ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <Info size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">请先在顶部选择您的团队</div>
              系统将自动加载该团队的历史填写记录，方便团队成员共同完善，避免重复填写。
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
            <Info size={18} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">填写说明</div>
              <ol className="list-decimal ml-4 space-y-1 text-xs">
                <li>在每个流程节点下点击「添加任务」，输入该节点涉及的日常任务名称</li>
                <li>为每个任务选择一个标签：
                  <strong> ★ 纯手工</strong>（优先完成）、
                  <strong> ◆ 跨系统</strong>、
                  <strong> ✕ 不建议AI</strong>
                </li>
                <li>填写完毕后点击「保存到飞书」，数据将同步到飞书多维表格</li>
                <li>灰色「已同步」标签表示该任务已保存，不可重复提交</li>
              </ol>
            </div>
          </div>
        )}

        {/* 主内容 */}
        {team ? (
          <NodeMappingGrid team={team} userName={user.name} />
        ) : (
          <div className="text-center py-16 text-gray-400">
            <LayoutGrid size={48} className="mx-auto mb-4 opacity-20" />
            <div className="text-lg font-medium">选择团队后开始填写</div>
            <div className="text-sm mt-1">在顶部下拉菜单中选择您所在的团队</div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
