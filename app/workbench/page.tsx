"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  Zap,
  ArrowRight,
  BarChart3,
  BookOpen,
  FlaskConical,
  UploadCloud,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { HomeActivityPanel } from "@/components/HomeActivityPanel";

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
  const { user, isLoggedIn, loading, team, setTeam, profile, profileLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isLoggedIn) router.push("/");
  }, [loading, isLoggedIn, router]);

  /** 进入工作台且尚未有查看团队时，与 Auth 一致默认落到人员权限表中的归属团队 */
  useEffect(() => {
    if (profileLoading || !profile.team) return;
    if (team) return;
    setTeam(profile.team);
  }, [profileLoading, profile.team, team, setTeam]);

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
            <HomeActivityPanel team={team} router={router} />
          </section>
        )}
      </div>
    </AppLayout>
  );
}
