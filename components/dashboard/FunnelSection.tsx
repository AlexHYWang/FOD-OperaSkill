"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, TrendingDown, ArrowDown } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { RoleChip } from "@/components/RoleChip";
import type { FODRole } from "@/lib/roles";

interface NodeStat {
  primary: number | string;
  primaryLabel: string;
  secondary?: string;
}

// 漏斗各级——从上到下严格单向流转
const FUNNEL_STAGES: Array<{
  key: string;
  label: string;
  sub: string;
  owner: FODRole;
}> = [
  {
    key: "section1",
    label: "流程梳理",
    sub: "任务级流程已录入（Table1）",
    owner: "FOD一线操作",
  },
  {
    key: "kb_extract",
    label: "知识提取",
    sub: "把任务经验写入知识库（Table7 已提取）",
    owner: "FOD一线操作",
  },
  {
    key: "kb_govern",
    label: "知识治理",
    sub: "对知识条目进行质量审核（Table7 治理中）",
    owner: "FOD一线AI管理",
  },
  {
    key: "kb_consolidate",
    label: "知识整合",
    sub: "整合为可用 Skill 素材（Table7 已整合）",
    owner: "FOD一线AI管理",
  },
  {
    key: "skill_train",
    label: "Skill 训练",
    sub: "财务部训练平台（Table2）",
    owner: "FOD一线AI管理",
  },
  {
    key: "eval_run",
    label: "评测执行",
    sub: "评测集上跑分（Table10）",
    owner: "FOD一线AI管理",
  },
  {
    key: "prod_debug",
    label: "生产级调试",
    sub: "IT 侧对接真实数据链路（Mock 展示）",
    owner: "IT研发",
  },
  {
    key: "prod_release",
    label: "Skill 发布",
    sub: "正式上线到 FOD 工作台（Table8 已发布）",
    owner: "IT产品",
  },
  {
    key: "op_console",
    label: "Skill 使用",
    sub: "一线员工日常使用（Table8 可用 Skill）",
    owner: "FOD一线操作",
  },
  {
    key: "op_badcase",
    label: "Badcase 回流",
    sub: "发现问题反馈并回流到知识库（Table11）",
    owner: "FOD一线操作",
  },
];

interface FunnelSectionProps {
  team?: string;
}

export function FunnelSection(_props: FunnelSectionProps) {
  const { demoMode } = useAuth();
  const [stats, setStats] = useState<Record<string, NodeStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/workflow/overview${demoMode ? "?demo=1" : ""}`
        );
        const d = await r.json();
        setStats(d?.stats || {});
      } catch {
        setStats({});
      } finally {
        setLoading(false);
      }
    })();
  }, [demoMode]);

  // 漏斗需要数字；把字符串形式（例如"94.3%"）的指标转为 0 或 1（用于视觉宽度）
  const numeric = useMemo(() => {
    const out: Record<string, number> = {};
    for (const stage of FUNNEL_STAGES) {
      const s = stats[stage.key];
      if (!s) {
        out[stage.key] = 0;
        continue;
      }
      const v = typeof s.primary === "number" ? s.primary : 0;
      out[stage.key] = v;
    }
    return out;
  }, [stats]);

  const maxVal = Math.max(...Object.values(numeric), 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-gray-400 text-sm">
        <Loader2 size={14} className="animate-spin" /> 加载中
      </div>
    );
  }

  // 计算整体转化率（从第一步到最后一步）
  const firstVal = numeric["section1"] || 0;
  const lastVal = numeric["prod_release"] || 0;
  const overallRate = firstVal > 0 ? (lastVal / firstVal) * 100 : 0;

  return (
    <div>
      <div className="grid md:grid-cols-3 gap-3 mb-5">
        <MetricCard
          label="漏斗起点"
          value={firstVal}
          unit="条场景"
          hint="已录入到 Table1 的任务级流程"
        />
        <MetricCard
          label="漏斗终点"
          value={lastVal}
          unit="个 Skill"
          hint="生产级发布 · 真正跑在工作台上"
        />
        <MetricCard
          label="端到端转化率"
          value={overallRate > 0 ? overallRate.toFixed(1) : "—"}
          unit={overallRate > 0 ? "%" : ""}
          hint="场景 → 发布 Skill 的精炼率"
          accent={
            overallRate >= 10
              ? "emerald"
              : overallRate >= 3
              ? "amber"
              : "gray"
          }
        />
      </div>

      <div className="rounded-xl border bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={16} className="text-orange-500" />
          <h2 className="text-sm font-bold text-gray-800">
            Skill 全链路流转漏斗
          </h2>
          <span className="text-[11px] text-gray-400">
            {demoMode ? "演示数据" : "真实数据"} · 自上而下查看每个阶段的沉淀数量
          </span>
        </div>

        <div className="space-y-1.5">
          {FUNNEL_STAGES.map((stage, i) => {
            const cur = numeric[stage.key] || 0;
            const widthPct = (cur / maxVal) * 100;
            const prev = i === 0 ? cur : numeric[FUNNEL_STAGES[i - 1].key] || 0;
            const conv =
              prev > 0 && i > 0 ? (cur / prev) * 100 : i === 0 ? 100 : 0;
            const stat = stats[stage.key];
            return (
              <div key={stage.key}>
                <FunnelRow
                  index={i}
                  stage={stage}
                  cur={cur}
                  widthPct={widthPct}
                  conv={conv}
                  stat={stat}
                  isFirst={i === 0}
                />
                {i < FUNNEL_STAGES.length - 1 && (
                  <div className="flex items-center justify-center py-0.5 text-gray-300">
                    <ArrowDown size={11} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-[11px] text-gray-400 leading-relaxed">
          说明：每一步的横条宽度按"该步数量 / 漏斗最宽步数量"缩放；转化率
          =「本步数量 / 上一步数量」。Skill 发布后的「使用」和「Badcase 回流」并非漏斗的"终点产出"，而是持续运营反馈环。
        </div>
      </div>
    </div>
  );
}

function FunnelRow({
  index,
  stage,
  cur,
  widthPct,
  conv,
  stat,
  isFirst,
}: {
  index: number;
  stage: (typeof FUNNEL_STAGES)[number];
  cur: number;
  widthPct: number;
  conv: number;
  stat?: NodeStat;
  isFirst: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* 左侧索引 */}
      <div className="w-6 text-[11px] text-gray-400 text-right">{index + 1}</div>

      {/* 中间条形图 */}
      <div className="flex-1 relative">
        <div className="h-11 bg-gray-50 rounded-lg overflow-hidden">
          <div
            className={cn(
              "h-full rounded-lg transition-all duration-500",
              cur > 0
                ? "bg-gradient-to-r from-orange-400 to-orange-600"
                : "bg-gray-100"
            )}
            style={{ width: `${Math.max(widthPct, cur > 0 ? 8 : 4)}%` }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-between px-3">
          <div className="flex items-center gap-2 min-w-0">
            <RoleChip role={stage.owner} compact />
            <div className="min-w-0">
              <div
                className={cn(
                  "text-[13px] font-semibold truncate",
                  cur > 0 ? "text-white drop-shadow-sm" : "text-gray-500"
                )}
              >
                {stage.label}
              </div>
              <div
                className={cn(
                  "text-[10px] truncate",
                  cur > 0 ? "text-white/85" : "text-gray-400"
                )}
              >
                {stage.sub}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0 ml-2">
            <div
              className={cn(
                "text-sm font-bold tabular-nums",
                cur > 0 ? "text-white drop-shadow-sm" : "text-gray-400"
              )}
            >
              {stat?.primary ?? 0}
              <span className="text-[10px] font-normal ml-0.5">
                {stat?.primaryLabel || ""}
              </span>
            </div>
            {stat?.secondary && (
              <div
                className={cn(
                  "text-[10px]",
                  cur > 0 ? "text-white/80" : "text-gray-400"
                )}
              >
                {stat.secondary}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧转化率 */}
      <div className="w-16 text-right">
        {isFirst ? (
          <div className="text-[10px] text-gray-300">起点</div>
        ) : (
          <div
            className={cn(
              "text-xs font-bold tabular-nums",
              conv >= 60
                ? "text-emerald-600"
                : conv >= 20
                ? "text-amber-600"
                : "text-gray-400"
            )}
          >
            {conv > 0 ? `${conv.toFixed(0)}%` : "—"}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  hint,
  accent = "gray",
}: {
  label: string;
  value: number | string;
  unit?: string;
  hint?: string;
  accent?: "emerald" | "amber" | "gray";
}) {
  const accentMap: Record<string, string> = {
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    gray: "text-gray-700",
  };
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="text-[11px] text-gray-500 mb-1">{label}</div>
      <div
        className={cn("text-2xl font-bold tabular-nums", accentMap[accent])}
      >
        {value}
        {unit && (
          <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>
        )}
      </div>
      {hint && <div className="text-[11px] text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}
