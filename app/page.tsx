"use client";

import Link from "next/link";
import { LogIn, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/components/AuthProvider";
import { HomeKpiStrip } from "@/components/home/HomeKpiStrip";
import { HomeStepCards } from "@/components/home/HomeStepCards";
import { MyActivityPanel } from "@/components/home/MyActivityPanel";

export default function HomePage() {
  const { user, isLoggedIn, loading, team, setTeam, effectiveRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <UnauthenticatedLanding />;
  }

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <HomeKpiStrip role={effectiveRole} />
        <HomeStepCards />
        <MyActivityPanel />
      </div>
    </AppLayout>
  );
}

function UnauthenticatedLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            FOD · Skill 工作台
          </div>
          <Button
            onClick={() => (window.location.href = "/api/auth/feishu")}
            size="sm"
            className="bg-[#0F6FEB] hover:bg-[#0d5ec7]"
          >
            <LogIn size={14} className="mr-1" /> 飞书登录
          </Button>
        </div>
      </header>
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-6">
          <Sparkles size={12} />
          财务部 FOD · AI Skill 全生命周期管理
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4 tracking-tight leading-tight">
          从流程梳理到 Skill 落地 ·
          <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            一个工作台串起整条链路
          </span>
        </h1>
        <p className="text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
          主链路四步：STEP1 梳理场景 · STEP2 知识库管理 · STEP3 评测集管理 · STEP4
          场景化 Skill 生产。日常执行见 Skill 作业中心（与主链路并列的作业面）。
        </p>
        <div className="mt-8">
          <Button
            size="lg"
            onClick={() => (window.location.href = "/api/auth/feishu")}
            className="bg-[#0F6FEB] hover:bg-[#0d5ec7] gap-2 text-base px-8 shadow-lg shadow-blue-200"
          >
            <LogIn size={18} />
            用飞书账号登录查看全流程
          </Button>
        </div>
        <div className="mt-6">
          <Link
            href="/workflow"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            也可先查看只读的全景流程图 →
          </Link>
        </div>
      </section>
      <footer className="max-w-6xl mx-auto px-6 pb-10 text-center text-xs text-gray-400">
        财务部 FOD · Skill 工作台 · 覆盖 PTP/OTC/RTR/PIC/税务 五大端到端流程
      </footer>
    </div>
  );
}
