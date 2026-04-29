"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  Zap,
  ArrowRight,
  LogIn,
  LogOut,
  BarChart3,
  ShieldCheck,
  Sparkles,
  BookOpen,
  FlaskConical,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { HomeActivityPanel } from "@/components/HomeActivityPanel";

export default function HomePage() {
  const { user, isLoggedIn, loading, profile } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      console.error("登录失败:", params.get("error"));
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/dashboard/admin-check")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => setIsAdmin(false));
  }, [isLoggedIn]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            FOD OperaSkill
          </div>
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-sm text-gray-600">{user?.name}</span>
                {profile.team && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {profile.team}
                  </span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={11} />
                    管理员
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-gray-500 hover:text-red-600 px-2 py-1.5 rounded hover:bg-red-50 flex items-center gap-1"
              >
                <LogOut size={12} /> 退出
              </button>
            </div>
          ) : (
            <Button
              onClick={() => (window.location.href = "/api/auth/feishu")}
              size="sm"
              className="bg-[#0F6FEB] hover:bg-[#0d5ec7]"
            >
              <LogIn size={14} className="mr-1" /> 飞书登录
            </Button>
          )}
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-6">
          <Sparkles size={12} />
          财务部 FOD · AI 技能作业门户
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-gray-900 mb-5 tracking-tight leading-tight">
          让 AI 接手{" "}
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            重复的财务工作
          </span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
          覆盖 PTP / OTC / RTR / PIC / 税务 五大端到端流程，
          <br className="hidden sm:block" />
          帮各团队把日常工作场景沉淀成可复用的 AI Skill。
        </p>

        {!isLoggedIn && (
          <div className="mt-8">
            <Button
              size="lg"
              onClick={() => (window.location.href = "/api/auth/feishu")}
              className="bg-[#0F6FEB] hover:bg-[#0d5ec7] gap-2 text-base px-8 shadow-lg shadow-blue-200"
            >
              <LogIn size={18} />
              用飞书账号登录开始
            </Button>
          </div>
        )}
      </section>

      <section className="max-w-6xl mx-auto px-6 mb-10">
        <div className="bg-white rounded-2xl border shadow-sm p-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-5">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                !
              </span>
              Skill 全链路工作台入口
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {[
              {
                step: "1",
                title: "场景梳理",
                desc: "把你团队的日常工作场景列成清单，每条打一个标签",
                href: "/section1",
                icon: <LayoutGrid size={18} />,
                tone: "blue",
              },
              {
                step: "2",
                title: "知识库管理",
                desc: "提交规则、字典和模版，主管审核后发布当前版本",
                href: "/knowledge",
                icon: <BookOpen size={18} />,
                tone: "indigo",
              },
              {
                step: "3",
                title: "SKILL上传",
                desc: "为纯线下场景上传训练好的 SKILL ZIP 包",
                href: "/section2",
                icon: <UploadCloud size={18} />,
                tone: "purple",
              },
              {
                step: "4",
                title: "评测集上传",
                desc: "沉淀输入A样本和人工输出C结果，并说明覆盖范围",
                href: "/evaluation",
                icon: <FlaskConical size={18} />,
                tone: "teal",
              },
              {
                step: "5",
                title: "财多多线下测试",
                desc: "下载测试包，线下跑完后回传准确率和对比报告",
                href: "/evaluation/test",
                icon: <Zap size={18} />,
                tone: "amber",
              },
              {
                step: "6",
                title: "AI进展看板",
                desc: "查看知识库、SKILL、评测集和评测记录资产",
                href: "/dashboard",
                icon: <BarChart3 size={18} />,
                tone: "emerald",
              },
            ].map((s) => {
              const toneMap: Record<string, string> = {
                blue: "bg-blue-50 text-blue-700 border-blue-200",
                indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
                purple: "bg-purple-50 text-purple-700 border-purple-200",
                teal: "bg-teal-50 text-teal-700 border-teal-200",
                amber: "bg-amber-50 text-amber-700 border-amber-200",
                emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
              };
              return (
                <Link
                  href={isLoggedIn ? s.href : "#"}
                  key={s.step}
                  onClick={(e) => {
                    if (!isLoggedIn) {
                      e.preventDefault();
                      window.location.href = "/api/auth/feishu";
                    }
                  }}
                  className={`group block rounded-xl border p-4 transition-all hover:shadow-md hover:-translate-y-0.5 ${toneMap[s.tone]}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
                        {s.icon}
                      </div>
                      <div className="text-xs font-bold opacity-70">
                        STEP {s.step}
                      </div>
                    </div>
                    <ArrowRight
                      size={16}
                      className="opacity-50 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                  <div className="font-bold text-sm mb-1">{s.title}</div>
                  <div className="text-xs opacity-75 leading-relaxed">
                    {s.desc}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {isLoggedIn && profile.isBootstrapped && (
        <section className="max-w-6xl mx-auto px-6 pb-16">
          <HomeActivityPanel team={profile.team} router={router} />
        </section>
      )}

      <footer className="max-w-6xl mx-auto px-6 pb-10 text-center text-xs text-gray-400">
        财务部 FOD · AI 技能作业平台 · 五大端到端流程
      </footer>
    </div>
  );
}
