"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutGrid,
  Zap,
  ArrowRight,
  ChevronRight,
  LogIn,
  BookOpen,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const { user, isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      console.error("登录失败:", params.get("error"));
    }
  }, []);

  // 登录后检测管理员身份
  useEffect(() => {
    if (!isLoggedIn) return;
    fetch("/api/dashboard/admin-check")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.isAdmin ?? false))
      .catch(() => setIsAdmin(false));
  }, [isLoggedIn]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            FOD OperaSkill
          </div>
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">你好，{user?.name}</span>
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={11} />
                    管理员
                  </span>
                )}
              </div>
              <Button
                onClick={() => router.push("/dashboard")}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 gap-1"
              >
                <BarChart3 size={14} /> 进度看板
              </Button>
              <Button onClick={() => router.push("/section1")} size="sm" variant="outline">
                作业平台 <ArrowRight size={14} className="ml-1" />
              </Button>
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

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          财务部 FOD 部门 · PTP / OTC / RTR / PIC / 税务 · AI 技能作业
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          FOD OperaSkill
          <span className="text-blue-600"> 作业收集平台</span>
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
          覆盖 PTP、OTC、RTR、PIC、税务五大端到端流程，为各团队日常任务打标签、生成并验证 AI Skill。
        </p>

        {isLoggedIn ? (
          <div className="space-y-4">
            {/* 管理员身份提示 */}
            {isAdmin ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
                <ShieldCheck size={16} />
                你好，管理员！可查看所有团队汇总数据、下钻分析及合并潜力
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                <Users size={16} />
                进度看板可查看本团队任务进度、产出物及登记卡点
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 justify-center flex-wrap">
              {/* 看板入口 — 最醒目 */}
              <Button
                size="lg"
                onClick={() => router.push("/dashboard")}
                className={`gap-2 ${isAdmin ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 shadow-md" : "bg-emerald-600 hover:bg-emerald-700"}`}
              >
                <BarChart3 size={18} />
                {isAdmin ? "管理员看板" : "AI进展看板"}
              </Button>
              <Button
                size="lg"
                onClick={() => router.push("/section1")}
                className="gap-2"
              >
                <LayoutGrid size={18} />
                任务一：节点映射
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => router.push("/section2")}
                className="gap-2"
              >
                <Zap size={18} />
                任务二：Skill 实战
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={() => (window.location.href = "/api/auth/feishu")}
            className="bg-[#0F6FEB] hover:bg-[#0d5ec7] gap-2 text-base px-8"
          >
            <LogIn size={18} />
            用飞书账号登录，开始提交
          </Button>
        )}
      </section>

      {/* 功能卡片 */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        {/* 看板入口卡片 — 横通栏 */}
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
              <BarChart3 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-gray-900">AI 进展汇总看板</h3>
                {isLoggedIn && isAdmin && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <ShieldCheck size={10} /> 管理员专属功能已解锁
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {isLoggedIn && isAdmin
                  ? "查看全部团队任务进度、流程节点下钻分析（含合并潜力高亮）、产出物对比、准确率热力图、卡点优先级排序"
                  : "查看本团队任务进度、产出物提交情况、测试准确率，并可登记今日卡点与明日目标"}
              </p>
              {/* 管理员 vs 普通用户权限对比 */}
              {isLoggedIn && (
                <div className="flex flex-wrap gap-3 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {isAdmin ? "全团队汇总统计" : "本团队任务统计"}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {isAdmin ? "流程节点下钻 + 合并潜力分析" : "产出物 & 准确率记录"}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    {isAdmin ? "卡点跨团队汇总与优先级排序" : "登记卡点 & 明日目标"}
                  </div>
                </div>
              )}
            </div>
          </div>
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <BarChart3 size={15} />
              {isAdmin ? "进入管理员看板" : "进入看板"}
              <ArrowRight size={14} />
            </Link>
          ) : (
            <button
              onClick={() => (window.location.href = "/api/auth/feishu")}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-emerald-700 bg-emerald-100 border border-emerald-200 hover:bg-emerald-50 transition-colors"
            >
              <LogIn size={14} /> 登录后查看
            </button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <FeatureCard
            number="01"
            icon={<LayoutGrid size={24} />}
            title="Skill↔流程节点映射"
            description="覆盖 PTP、OTC、RTR、PIC、税务五大端到端流程，横向看板展示各环节节点，为日常任务打上标签：纯线下 ★、跨系统 ◆、不建议AI ✕，支持批量导入。"
            href="/section1"
            color="blue"
            items={["PTP / OTC / RTR / PIC / 税务 五大流程", "二维看板，展示任务进度（X/4步）", "支持批量粘贴导入，仅显示★纯线下切换"]}
            isLoggedIn={isLoggedIn}
          />
          <FeatureCard
            number="02"
            icon={<Zap size={24} />}
            title="各团队日常任务 Skill 实战"
            description="四步顺序工作流，从生成子Skill1到调优子Skill3，每步上传对应文件和准确率。第二步准确率须达到100%，方可继续。"
            href="/section2"
            color="purple"
            items={["第一步：知识库（多文件）+ 子Skill1 + 初步验证", "第二步：子Skill2（准确率须达到100%）", "第三步：上传对比分析报告（.md）", "第四步：优化知识库 → 子Skill3"]}
            isLoggedIn={isLoggedIn}
          />
        </div>

        {/* 流程说明 */}
        <div className="bg-white rounded-2xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpen size={20} className="text-blue-600" />
            作业提交流程
          </h2>
          <div className="flex flex-col md:flex-row gap-3">
            {[
              { step: "1", text: "飞书登录", sub: "获取身份认证" },
              { step: "2", text: "选择团队", sub: "加载历史数据" },
              { step: "3", text: "完成任务一", sub: "节点映射打标" },
              { step: "4", text: "完成任务二", sub: "四步Skill实战（准确率100%）" },
              { step: "5", text: "数据同步", sub: "自动写入飞书多维表格" },
            ].map((item, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="text-sm font-medium text-gray-800 mt-1 text-center">
                    {item.text}
                  </div>
                  <div className="text-xs text-gray-400 text-center">{item.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight
                    size={16}
                    className="text-gray-300 flex-shrink-0 hidden md:block"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  number,
  icon,
  title,
  description,
  href,
  color,
  items,
  isLoggedIn,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  color: "blue" | "purple";
  items: string[];
  isLoggedIn: boolean;
}) {
  const colorMap = {
    blue: {
      bg: "bg-blue-600",
      light: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      hover: "hover:border-blue-300",
    },
    purple: {
      bg: "bg-purple-600",
      light: "bg-purple-50",
      text: "text-purple-600",
      border: "border-purple-200",
      hover: "hover:border-purple-300",
    },
  };
  const c = colorMap[color];

  return (
    <div
      className={`bg-white rounded-2xl border ${c.border} ${c.hover} p-6 hover:shadow-md transition-all`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${c.light} ${c.text}`}>{icon}</div>
        <span className={`text-3xl font-black ${c.text} opacity-20`}>
          {number}
        </span>
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed">{description}</p>
      <ul className="space-y-1.5 mb-5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
            <div className={`w-1.5 h-1.5 rounded-full ${c.bg} flex-shrink-0`} />
            {item}
          </li>
        ))}
      </ul>
      {isLoggedIn ? (
        <Link
          href={href}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-white ${c.bg} hover:opacity-90 transition-opacity`}
        >
          进入 {title.split("：")[0]} <ArrowRight size={14} />
        </Link>
      ) : (
        <button
          onClick={() => (window.location.href = "/api/auth/feishu")}
          className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium ${c.text} ${c.light} border ${c.border} hover:opacity-80 transition-opacity`}
        >
          <TrendingUp size={14} /> 登录后查看
        </button>
      )}
    </div>
  );
}
