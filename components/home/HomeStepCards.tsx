"use client";

import Link from "next/link";
import { BookOpen, FlaskConical, Wand2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepDef {
  label: string;
  num: string;
  title: string;
  subtitle: string;
  desc: string;
  href: string;
  tone: "blue" | "emerald" | "purple" | "amber";
  icon: React.ReactNode;
}

const TONE_MAP: Record<StepDef["tone"], { ring: string; chip: string; btn: string }> = {
  blue: {
    ring: "from-blue-500/10 to-blue-500/0 border-blue-100",
    chip: "bg-blue-600 text-white",
    btn: "bg-blue-600 hover:bg-blue-700 text-white",
  },
  emerald: {
    ring: "from-emerald-500/10 to-emerald-500/0 border-emerald-100",
    chip: "bg-emerald-600 text-white",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
  },
  purple: {
    ring: "from-purple-500/10 to-purple-500/0 border-purple-100",
    chip: "bg-purple-600 text-white",
    btn: "bg-purple-600 hover:bg-purple-700 text-white",
  },
  amber: {
    ring: "from-amber-500/10 to-amber-500/0 border-amber-100",
    chip: "bg-amber-600 text-white",
    btn: "bg-amber-600 hover:bg-amber-700 text-white",
  },
};

const STEPS: StepDef[] = [
  {
    num: "STEP 1",
    label: "资料沉淀",
    title: "知识库管理",
    subtitle: "提交 · 审核 · 发布 · 版本",
    desc: "一线录入 SOP / 审核标准 / 场景素材，主管审核发布，综管统筹版本。",
    href: "/knowledge",
    tone: "blue",
    icon: <BookOpen size={18} />,
  },
  {
    num: "STEP 2",
    label: "质量标杆",
    title: "评测集管理",
    subtitle: "评测数据源 + 人工标准答案",
    desc: "线上 MCP（演示）与离线上传固定输入与返回，多位同学维护标准答案用于评测打分。",
    href: "/evaluation",
    tone: "emerald",
    icon: <FlaskConical size={18} />,
  },
  {
    num: "STEP 3",
    label: "打磨生成",
    title: "打磨 Skill 平台",
    subtitle: "场景选择 · 多步向导",
    desc: "按场景生成与调优子 Skill，对比与知识库沉淀（演示态）。",
    href: "/skill-forge",
    tone: "purple",
    icon: <Wand2 size={18} />,
  },
];

export function HomeStepCards() {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900">Skill 全链路工作台入口</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {STEPS.map((s) => (
          <StepCard key={s.href} s={s} />
        ))}
      </div>
    </section>
  );
}

function StepCard({ s }: { s: StepDef }) {
  const tone = TONE_MAP[s.tone];
  return (
    <Link
      href={s.href}
      className={cn(
        "group relative rounded-2xl border bg-gradient-to-br bg-white p-4 transition-all",
        "hover:shadow-lg hover:-translate-y-0.5",
        tone.ring
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
            tone.chip
          )}
        >
          {s.icon}
          {s.num}
        </span>
        <span className="text-[11px] text-gray-500">{s.label}</span>
      </div>
      <div className="text-base font-bold text-gray-900">{s.title}</div>
      <div className="text-[12px] text-gray-500 mt-0.5">{s.subtitle}</div>
      <p className="text-[12px] text-gray-600 mt-2 leading-relaxed">{s.desc}</p>
      <div
        className={cn(
          "mt-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all group-hover:translate-x-0.5",
          tone.btn
        )}
      >
        进入 <ArrowRight size={12} />
      </div>
    </Link>
  );
}
