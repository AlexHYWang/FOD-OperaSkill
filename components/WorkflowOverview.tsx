"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  BookOpen,
  GitMerge,
  ScrollText,
  Hammer,
  FlaskConical,
  PlayCircle,
  Cog,
  Rocket,
  Sparkles,
  Flag,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_THEME, type FODRole } from "@/lib/roles";
import { useAuth } from "@/components/AuthProvider";

interface NodeStat {
  primary: number | string;
  primaryLabel: string;
  secondary?: string;
}

interface NodeDef {
  key: string;
  seq: number;
  title: string;
  subtitle: string;
  href: string;
  role: FODRole;
  icon: React.ReactNode;
  isMock?: boolean;
}

/** 三条水平泳道：生产流程 · 训练评测 · 使用流程 */
type LaneKey = "prod" | "train" | "use";

interface LaneDef {
  key: LaneKey;
  label: string;
  num: number;
  accent: string;
  ring: string;
  nodes: NodeDef[];
}

const LANES: LaneDef[] = [
  {
    key: "prod",
    label: "生产流程（资料沉淀）",
    num: 1,
    accent: "bg-blue-600 text-white",
    ring: "border-blue-100 bg-blue-50/40",
    nodes: [
      {
        key: "section1",
        seq: 1,
        title: "流程梳理",
        subtitle: "任务级场景清单",
        href: "/section1",
        role: "FOD一线操作",
        icon: <LayoutGrid size={14} />,
      },
      {
        key: "kb_extract",
        seq: 2,
        title: "知识库 · 提取",
        subtitle: "上传素材",
        href: "/knowledge/extract",
        role: "FOD一线操作",
        icon: <BookOpen size={14} />,
      },
      {
        key: "kb_govern",
        seq: 3,
        title: "知识库 · 治理",
        subtitle: "审核整理",
        href: "/knowledge/govern",
        role: "FOD一线AI管理",
        icon: <GitMerge size={14} />,
      },
      {
        key: "kb_consolidate",
        seq: 4,
        title: "知识库 · 整合",
        subtitle: "归档下发",
        href: "/knowledge/consolidate",
        role: "FOD综管",
        icon: <ScrollText size={14} />,
      },
    ],
  },
  {
    key: "train",
    label: "训练 · 评测 · 发布",
    num: 2,
    accent: "bg-indigo-600 text-white",
    ring: "border-indigo-100 bg-indigo-50/40",
    nodes: [
      {
        key: "skill_train",
        seq: 5,
        title: "Skill 训练",
        subtitle: "4 步打磨",
        href: "/section2",
        role: "FOD一线操作",
        icon: <Hammer size={14} />,
      },
      {
        key: "eval_dataset",
        seq: 6,
        title: "评测集管理",
        subtitle: "题库上传",
        href: "/evaluation/dataset",
        role: "FOD一线操作",
        icon: <FlaskConical size={14} />,
      },
      {
        key: "eval_run",
        seq: 7,
        title: "评测执行",
        subtitle: "批跑准确率",
        href: "/evaluation/run",
        role: "FOD一线操作",
        icon: <PlayCircle size={14} />,
      },
      {
        key: "prod_debug",
        seq: 8,
        title: "生产级调试",
        subtitle: "IT 研发调试",
        href: "/production/debug",
        role: "IT研发",
        icon: <Cog size={14} />,
        isMock: true,
      },
      {
        key: "prod_release",
        seq: 9,
        title: "生产级发布",
        subtitle: "版本上线",
        href: "/production/release",
        role: "IT研发",
        icon: <Rocket size={14} />,
        isMock: true,
      },
    ],
  },
  {
    key: "use",
    label: "使用流程（日常作业）",
    num: 3,
    accent: "bg-emerald-600 text-white",
    ring: "border-emerald-100 bg-emerald-50/40",
    nodes: [
      {
        key: "op_console",
        seq: 10,
        title: "Skill 操作中心",
        subtitle: "一线员工执行",
        href: "/operate/console",
        role: "FOD一线操作",
        icon: <Sparkles size={14} />,
      },
      {
        key: "op_badcase",
        seq: 11,
        title: "Badcase 反馈",
        subtitle: "回流知识库",
        href: "/operate/badcase",
        role: "FOD一线操作",
        icon: <Flag size={14} />,
      },
    ],
  },
];

export function WorkflowOverview() {
  const { demoMode, effectiveRole } = useAuth();
  const [stats, setStats] = useState<Record<string, NodeStat>>({});
  const [loading, setLoading] = useState(true);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/workflow/overview${demoMode ? "?demo=1" : ""}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setStats(d.stats || {});
      })
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, [demoMode]);

  return (
    <div className="space-y-3">
      {/* 顶部工具条：图例 + 仅看本角色 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500">
          <span className="font-medium text-gray-700">角色色点：</span>
          {(
            [
              "FOD综管",
              "FOD一线AI管理",
              "FOD一线操作",
              "IT产品",
              "IT研发",
            ] as FODRole[]
          ).map((r) => {
            const t = ROLE_THEME[r];
            return (
              <span key={r} className="inline-flex items-center gap-1">
                <span
                  className={cn("inline-block w-2 h-2 rounded-full", t.dot)}
                />
                <span className="text-gray-600">{r}</span>
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          {loading && (
            <span className="flex items-center gap-1 text-gray-400 text-xs">
              <Loader2 size={12} className="animate-spin" /> 加载中
            </span>
          )}
          {effectiveRole && (
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="rounded accent-blue-600"
              />
              仅高亮「{effectiveRole}」负责的环节
            </label>
          )}
        </div>
      </div>

      {/* 三条水平泳道 */}
      <div className="space-y-3">
        {LANES.map((lane) => (
          <SwimLane
            key={lane.key}
            lane={lane}
            stats={stats}
            effectiveRole={effectiveRole}
            onlyMine={onlyMine}
          />
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
function SwimLane({
  lane,
  stats,
  effectiveRole,
  onlyMine,
}: {
  lane: LaneDef;
  stats: Record<string, NodeStat>;
  effectiveRole: FODRole | "";
  onlyMine: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border p-3 md:p-4", lane.ring)}>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
            lane.accent
          )}
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25">
            {lane.num}
          </span>
          {lane.label}
        </span>
        <span className="text-[11px] text-gray-400">
          · {lane.nodes.length} 个环节
        </span>
      </div>
      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {lane.nodes.map((n) => {
          const isMine = !!effectiveRole && n.role === effectiveRole;
          const dimmed = onlyMine && !isMine;
          return (
            <NodeCard
              key={n.key}
              node={n}
              stat={stats[n.key]}
              highlighted={isMine}
              dimmed={dimmed}
            />
          );
        })}
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────
function NodeCard({
  node,
  stat,
  highlighted,
  dimmed,
}: {
  node: NodeDef;
  stat?: NodeStat;
  highlighted: boolean;
  dimmed: boolean;
}) {
  const theme = ROLE_THEME[node.role];
  return (
    <Link
      href={node.href}
      className={cn(
        "group relative rounded-xl border bg-white p-2.5 transition-all",
        "hover:-translate-y-0.5 hover:shadow-md",
        highlighted
          ? cn(theme.border, "border-2 shadow-sm")
          : "border-gray-200 hover:border-gray-300",
        dimmed && "opacity-35 hover:opacity-70"
      )}
    >
      {node.isMock && (
        <span className="absolute top-1.5 right-1.5 px-1 text-[9px] font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded">
          演示态
        </span>
      )}

      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold",
            theme.bg,
            theme.text
          )}
        >
          {node.seq}
        </span>
        <span className={cn("p-0.5 rounded", theme.bg, theme.text)}>
          {node.icon}
        </span>
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full ml-auto mr-4",
            theme.dot
          )}
          title={node.role}
        />
      </div>
      <div className="text-[13px] font-semibold text-gray-900 leading-tight">
        {node.title}
      </div>
      <div className="text-[10.5px] text-gray-500 mt-0.5 truncate">
        {node.subtitle}
      </div>
      {stat && (
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-base font-black text-gray-900">
            {stat.primary}
          </span>
          <span className="text-[10px] text-gray-500 truncate">
            {stat.primaryLabel}
          </span>
        </div>
      )}
      {stat?.secondary && (
        <div className="text-[10px] text-gray-400 truncate">
          {stat.secondary}
        </div>
      )}
    </Link>
  );
}
