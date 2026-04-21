"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_THEME, type FODRole } from "@/lib/roles";
import { ROLE_WORKBENCH } from "@/lib/role-workbench";
import { useAuth } from "@/components/AuthProvider";

interface NodeStat {
  primary: number | string;
  primaryLabel: string;
  secondary?: string;
}

/**
 * 首页顶部"我的角色 + 3 KPI"精简条（h-20 左右）。
 * 数据源复用 /api/workflow/overview（demo=1 → Mock）。
 */
export function HomeKpiStrip({ role }: { role: FODRole | "" }) {
  const { demoMode, user } = useAuth();
  const [stats, setStats] = useState<Record<string, NodeStat>>({});
  const [loading, setLoading] = useState(true);

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

  if (!role) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-500">
        当前账号暂未分配角色。请联系 FOD 综管在 Skill 注册中心 · 成员管理 完成分配。
      </div>
    );
  }

  const cfg = ROLE_WORKBENCH[role];
  const theme = ROLE_THEME[role];

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white px-4 py-3 md:px-5 md:py-3.5",
        theme.border
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div className="flex items-center gap-2.5 min-w-0 md:w-64">
          <span className={cn("w-2.5 h-2.5 rounded-full", theme.dot)} />
          <div className="min-w-0">
            <div className="text-[11px] text-gray-500 leading-tight">
              我的角色
            </div>
            <div className={cn("text-sm font-bold leading-tight", theme.text)}>
              {role}
              {user?.name ? (
                <span className="ml-1.5 text-gray-500 font-normal">
                  · {user.name}
                </span>
              ) : null}
            </div>
            <div className="text-[10.5px] text-gray-500 truncate">
              {cfg.tagline}
            </div>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-3 gap-2 md:gap-3">
          {cfg.kpis.map((k, i) => {
            const s = k.statKey ? stats[k.statKey] : undefined;
            const primary = s?.primary ?? (loading ? "-" : k.fallback ?? "0");
            return (
              <Link
                key={i}
                href={k.href || "#"}
                className="group rounded-lg border border-gray-100 bg-gray-50/60 hover:bg-white hover:border-gray-200 px-2.5 py-1.5 transition-colors"
              >
                <div className="flex items-baseline gap-1">
                  <div className="text-lg md:text-xl font-black text-gray-900 leading-tight">
                    {primary}
                  </div>
                  {loading && (
                    <Loader2 size={10} className="animate-spin text-gray-400" />
                  )}
                </div>
                <div className="text-[11px] font-medium text-gray-700 truncate">
                  {k.label}
                </div>
                {k.caption && (
                  <div className="text-[10px] text-gray-400 truncate">
                    {k.caption}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
