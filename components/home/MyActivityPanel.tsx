"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Activity,
  Timer,
  Users,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/AuthProvider";

interface SummaryResp {
  success?: boolean;
  loggedIn?: boolean;
  recent7dMine?: {
    section1Count: number;
    section2StepCount: number;
  };
  inProgress?: Array<{
    taskName: string;
    lastStep: number;
    submittedAt: number;
  }>;
  teamThisWeek?: {
    stepCount: number;
    unresolvedBlockers: number;
    team: string;
  };
}

const DEMO_RESP: SummaryResp = {
  success: true,
  loggedIn: true,
  recent7dMine: { section1Count: 12, section2StepCount: 28 },
  inProgress: [
    { taskName: "AP · 月结凭证校验", lastStep: 3, submittedAt: Date.now() - 3.6e6 },
    { taskName: "AR · 收入核对", lastStep: 2, submittedAt: Date.now() - 18e6 },
    { taskName: "Tax · 进项勾选", lastStep: 1, submittedAt: Date.now() - 1.2e8 },
  ],
  teamThisWeek: { stepCount: 43, unresolvedBlockers: 5, team: "AP" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const hours = Math.floor(diff / 3.6e6);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export function MyActivityPanel() {
  const { demoMode } = useAuth();
  const [data, setData] = useState<SummaryResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (demoMode) {
      setData(DEMO_RESP);
      setLoading(false);
      return;
    }
    fetch("/api/home/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: SummaryResp) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [demoMode]);

  const r7 = data?.recent7dMine;
  const ip = data?.inProgress || [];
  const tw = data?.teamThisWeek;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900">我的动态</h2>
        {loading && (
          <span className="text-[11px] text-gray-400 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> 加载中
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 卡 1：最近 7 天提交 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Activity size={14} />
            </span>
            <span className="text-sm font-semibold text-gray-900">
              最近 7 天提交
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <div className="text-2xl font-black text-gray-900">
              {r7?.section1Count ?? 0}
            </div>
            <div className="text-xs text-gray-500">条流程梳理</div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <div className="text-xl font-bold text-gray-700">
              {r7?.section2StepCount ?? 0}
            </div>
            <div className="text-xs text-gray-500">个训练步骤</div>
          </div>
          <Link
            href="/section1"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            进入流程梳理 <ArrowRight size={12} />
          </Link>
        </div>

        {/* 卡 2：进行中任务 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Timer size={14} />
            </span>
            <span className="text-sm font-semibold text-gray-900">进行中</span>
          </div>
          {ip.length === 0 ? (
            <div className="mt-3 text-xs text-gray-400">暂无进行中的 Skill 训练任务</div>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {ip.map((it) => (
                <li
                  key={it.taskName}
                  className="flex items-center gap-2 text-xs text-gray-600"
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="truncate flex-1">{it.taskName}</span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px]"
                    )}
                  >
                    Step {it.lastStep}/4
                  </span>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {timeAgo(it.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/skill-forge"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700"
          >
            继续打磨 Skill <ArrowRight size={12} />
          </Link>
        </div>

        {/* 卡 3：本周团队动态 */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users size={14} />
            </span>
            <span className="text-sm font-semibold text-gray-900">
              本周团队{tw?.team ? ` · ${tw.team}` : ""}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-3">
            <div className="text-2xl font-black text-gray-900">
              {tw?.stepCount ?? 0}
            </div>
            <div className="text-xs text-gray-500">个训练步骤</div>
          </div>
          {(tw?.unresolvedBlockers ?? 0) > 0 ? (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} />
              {tw?.unresolvedBlockers} 个阻塞待处理
            </div>
          ) : (
            <div className="mt-2 text-xs text-gray-400">本周暂无阻塞</div>
          )}
          <Link
            href="/dashboard"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            打开全链路看板 <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </section>
  );
}
