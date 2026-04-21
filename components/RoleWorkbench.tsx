"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Loader2,
  Map,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_THEME, type FODRole } from "@/lib/roles";
import { ROLE_WORKBENCH } from "@/lib/role-workbench";
import { useAuth } from "@/components/AuthProvider";

interface NodeStat {
  primary: number | string;
  primaryLabel: string;
  secondary?: string;
}

export function RoleWorkbench({ role }: { role: FODRole }) {
  const { demoMode, profile, user } = useAuth();
  const cfg = ROLE_WORKBENCH[role];
  const theme = ROLE_THEME[role];
  const [stats, setStats] = useState<Record<string, NodeStat>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/workflow/overview${demoMode ? "?demo=1" : ""}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setStats(d.stats || {});
      })
      .catch(() => setStats({}))
      .finally(() => setLoading(false));
  }, [demoMode]);

  return (
    <div className="space-y-5">
      {/* 顶部：角色头 */}
      <header
        className={cn(
          "rounded-2xl border p-5",
          theme.bg,
          theme.border
        )}
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-white",
                  theme.text,
                  theme.border
                )}
              >
                <span
                  className={cn("inline-block w-1.5 h-1.5 rounded-full", theme.dot)}
                />
                {role}
              </span>
              {demoMode && (
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-100 text-amber-700 border border-amber-200">
                  演示模式
                </span>
              )}
              {user && (
                <span className="text-[11px] text-gray-500">
                  {user.name}
                  {profile.team && <> · {profile.team}</>}
                </span>
              )}
            </div>
            <h1 className={cn("text-xl md:text-2xl font-bold", theme.text)}>
              {cfg.title}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{cfg.tagline}</p>
          </div>

          <Link
            href={cfg.primaryCTA.href}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5",
              role === "FOD综管" && "bg-indigo-600 hover:bg-indigo-700",
              role === "FOD一线AI管理" && "bg-teal-600 hover:bg-teal-700",
              role === "FOD一线操作" && "bg-blue-600 hover:bg-blue-700"
            )}
          >
            <Sparkles size={14} />
            {cfg.primaryCTA.label}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      {/* KPI 横栏 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cfg.kpis.map((k, i) => {
          const stat = k.statKey ? stats[k.statKey] : undefined;
          return (
            <KPICard
              key={i}
              label={k.label}
              caption={k.caption}
              stat={stat}
              fallback={k.fallback}
              href={k.href}
              loading={loading}
              accentDot={theme.dot}
            />
          );
        })}
      </section>

      {/* 我的工作流 */}
      <section>
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-sm font-bold text-gray-800">我的工作流</h2>
          <span className="text-[11px] text-gray-400">
            · 共 {cfg.steps.length} 步
          </span>
          <div className="flex-1" />
          <Link
            href="/workflow"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
          >
            <Map size={12} />
            查看全景流程图
            <ChevronRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {cfg.steps.map((s, i) => (
            <StepCard key={s.href} step={s} index={i + 1} roleTheme={theme} />
          ))}
        </div>
      </section>

      {/* 次要入口 */}
      {cfg.secondaryCTAs.length > 0 && (
        <section>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
            常用入口
          </div>
          <div className="flex flex-wrap gap-2">
            {cfg.secondaryCTAs.map((c) => (
              <Link
                key={c.href + c.label}
                href={c.href}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border bg-white text-xs text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                {c.label}
                <ChevronRight size={11} className="opacity-60" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
function KPICard({
  label,
  caption,
  stat,
  fallback,
  href,
  loading,
  accentDot,
}: {
  label: string;
  caption?: string;
  stat?: NodeStat;
  fallback?: string;
  href?: string;
  loading: boolean;
  accentDot: string;
}) {
  const primary = stat?.primary ?? fallback ?? "—";
  const primaryLabel = stat?.primaryLabel || "";
  const secondary = stat?.secondary;

  const Inner = (
    <div
      className={cn(
        "rounded-xl border bg-white p-4 transition-all h-full",
        href && "hover:border-gray-300 hover:shadow-sm cursor-pointer"
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("w-1.5 h-1.5 rounded-full", accentDot)} />
        <span className="text-[11px] font-medium text-gray-600">{label}</span>
        {href && <ChevronRight size={11} className="text-gray-300 ml-auto" />}
      </div>
      <div className="flex items-baseline gap-1">
        {loading ? (
          <Loader2 size={18} className="animate-spin text-gray-300 my-1" />
        ) : (
          <>
            <span className="text-3xl font-black text-gray-900 tabular-nums">
              {primary}
            </span>
            {primaryLabel && (
              <span className="text-[11px] text-gray-500">{primaryLabel}</span>
            )}
          </>
        )}
      </div>
      {(secondary || caption) && (
        <div className="text-[11px] text-gray-400 mt-1 truncate">
          {secondary || caption}
        </div>
      )}
    </div>
  );

  if (href) return <Link href={href}>{Inner}</Link>;
  return Inner;
}

// ──────────────────────────────────────────────
function StepCard({
  step,
  index,
  roleTheme,
}: {
  step: { label: string; subtitle: string; href: string; isMock?: boolean };
  index: number;
  roleTheme: { text: string; bg: string; dot: string; border: string };
}) {
  return (
    <Link
      href={step.href}
      className="group rounded-xl border bg-white p-3.5 hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-bold",
            roleTheme.bg,
            roleTheme.text
          )}
        >
          {index}
        </span>
        {step.isMock && (
          <span className="inline-block px-1.5 py-0.5 text-[9px] font-bold text-gray-500 bg-gray-100 border border-gray-200 rounded">
            演示态
          </span>
        )}
        <ArrowRight
          size={13}
          className="text-gray-300 ml-auto group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all"
        />
      </div>
      <div className="text-sm font-semibold text-gray-900 leading-tight">
        {step.label}
      </div>
      <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
        {step.subtitle}
      </div>
      <div className="flex-1" />
      <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
        <CheckCircle2 size={10} />
        点击进入
      </div>
    </Link>
  );
}
