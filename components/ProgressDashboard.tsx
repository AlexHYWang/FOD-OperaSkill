"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface TaskProgress {
  taskName: string;
  step1: boolean;
  step2: boolean;
  step3: boolean;
  step4: boolean;
  completedSteps: number;
}

interface ProgressDashboardProps {
  team: string;
}

const STEP_LABELS = ["知识库+子Skill1", "子Skill2调优", "对比报告", "子Skill3完成"];

export function ProgressDashboard({ team }: ProgressDashboardProps) {
  const [tasks, setTasks] = useState<TaskProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadProgress = async () => {
    if (!team) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/bitable/records?table=2&team=${encodeURIComponent(team)}`
      );
      const data = await res.json();
      if (!data.success) return;

      // 按任务名称聚合步骤
      const taskMap: Record<
        string,
        { step1: boolean; step2: boolean; step3: boolean; step4: boolean }
      > = {};

      for (const record of data.records) {
        const taskName = record.fields["关联任务"] as string;
        const step = record.fields["步骤编号"] as number;
        const status = record.fields["步骤状态"] as string;

        if (!taskName) continue;
        if (!taskMap[taskName]) {
          taskMap[taskName] = {
            step1: false,
            step2: false,
            step3: false,
            step4: false,
          };
        }

        if (status === "已完成") {
          if (step === 1) taskMap[taskName].step1 = true;
          if (step === 2) taskMap[taskName].step2 = true;
          if (step === 3) taskMap[taskName].step3 = true;
          if (step === 4) taskMap[taskName].step4 = true;
        }
      }

      const result: TaskProgress[] = Object.entries(taskMap).map(
        ([name, steps]) => ({
          taskName: name,
          ...steps,
          completedSteps: [steps.step1, steps.step2, steps.step3, steps.step4].filter(Boolean).length,
        })
      );

      setTasks(result);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("加载进度失败:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completedSteps === 4).length;
  const overallProgress =
    totalTasks === 0
      ? 0
      : Math.round(
          (tasks.reduce((sum, t) => sum + t.completedSteps, 0) /
            (totalTasks * 4)) *
            100
        );

  if (tasks.length === 0 && !loading) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
        {team ? `${team} 暂无 Skill 实战记录` : "请先选择团队"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 总体进度 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-semibold text-gray-700">
              {team} 整体进度
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {completedTasks}/{totalTasks} 个任务全部完成
            </div>
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {overallProgress}%
          </div>
        </div>
        <Progress value={overallProgress} className="h-2.5" />
      </div>

      {/* 刷新按钮 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {lastUpdated
            ? `上次更新：${lastUpdated.toLocaleTimeString("zh-CN")}`
            : ""}
        </span>
        <button
          onClick={loadProgress}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          刷新进度
        </button>
      </div>

      {/* 任务进度列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2" />
          <span className="text-sm text-gray-500">加载中...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.taskName}
              className="bg-white border rounded-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="font-medium text-sm text-gray-800 flex-1 mr-2">
                  {task.taskName}
                </div>
                <StatusBadge completed={task.completedSteps} total={4} />
              </div>

              {/* 步骤进度条 */}
              <div className="grid grid-cols-4 gap-1.5">
                {STEP_LABELS.map((label, i) => {
                  const stepKey = `step${i + 1}` as keyof typeof task;
                  const done = task[stepKey] as boolean;
                  const isCurrent =
                    !done && task.completedSteps === i;

                  return (
                    <div key={i} className="text-center">
                      <div
                        className={cn(
                          "h-1.5 rounded-full mb-1 transition-all",
                          done
                            ? "bg-green-500"
                            : isCurrent
                            ? "bg-blue-400 animate-pulse"
                            : "bg-gray-200"
                        )}
                      />
                      <div
                        className={cn(
                          "text-xs",
                          done
                            ? "text-green-600"
                            : isCurrent
                            ? "text-blue-500"
                            : "text-gray-400"
                        )}
                      >
                        {done ? (
                          <CheckCircle2 size={12} className="mx-auto" />
                        ) : isCurrent ? (
                          <Clock size={12} className="mx-auto" />
                        ) : (
                          <AlertCircle size={12} className="mx-auto opacity-30" />
                        )}
                        <div className="mt-0.5 leading-tight">{label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  if (completed === total) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 flex-shrink-0">
        <CheckCircle2 size={11} /> 已完成
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex-shrink-0">
      第 {completed + 1} 步进行中
    </span>
  );
}
