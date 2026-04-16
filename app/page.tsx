"use client";

import { useEffect } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";

export default function HomePage() {
  const { user, isLoggedIn, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 检查 URL 错误参数
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      console.error("登录失败:", params.get("error"));
    }
  }, []);

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
              <span className="text-sm text-gray-600">你好，{user?.name}</span>
              <Button onClick={() => router.push("/section1")} size="sm">
                进入作业平台 <ArrowRight size={14} className="ml-1" />
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
          <div className="flex gap-3 justify-center">
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
