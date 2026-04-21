"use client";

import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOD_ROLES, ROLE_THEME, type FODRole } from "@/lib/roles";
import { useAuth } from "@/components/AuthProvider";
import { ROLE_WORKBENCH } from "@/lib/role-workbench";

/**
 * 演示模式下，综管/IT 首次进来看到的"选角色"屏。
 * 选好后把 demoRole 写入 localStorage（通过 AuthProvider），然后自动进入对应工作台。
 */
export function RoleSelectScreen() {
  const { setDemoRole, profile, user, setDemoMode } = useAuth();

  return (
    <div className="min-h-[calc(100vh-48px)] bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold mb-3">
            <Sparkles size={12} />
            演示模式 · Role Preview
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight">
            选择一个角色视角，查看对应的工作台
          </h1>
          <p className="text-sm text-gray-500 max-w-xl mx-auto">
            你当前真实角色为
            <span className="mx-1 font-semibold text-gray-700">
              {profile.roleV4 || "未分配"}
            </span>
            ；演示模式下可切换到任意视角，用于产品评审 / 领导汇报。
            随时可在顶部关闭演示模式，回到真实视角。
          </p>
          {user && (
            <div className="text-[11px] text-gray-400 mt-1.5">
              {user.name}
              {profile.team && ` · ${profile.team}`}
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FOD_ROLES.map((r) => (
            <RoleCard
              key={r}
              role={r}
              onPick={() => setDemoRole(r)}
              isMyRole={profile.roleV4 === r}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setDemoMode(false)}
            className="text-xs text-gray-500 hover:text-gray-800 underline-offset-2 hover:underline"
          >
            ← 关闭演示模式，使用真实角色进入
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  role,
  onPick,
  isMyRole,
}: {
  role: FODRole;
  onPick: () => void;
  isMyRole: boolean;
}) {
  const theme = ROLE_THEME[role];
  const cfg = ROLE_WORKBENCH[role];

  return (
    <button
      onClick={onPick}
      className={cn(
        "group text-left rounded-2xl border-2 bg-white p-5 transition-all hover:shadow-lg hover:-translate-y-0.5",
        theme.border,
        "hover:border-gray-400"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold",
            theme.bg,
            theme.text
          )}
        >
          <span className={cn("w-2 h-2 rounded-full", theme.dot)} />
          {role}
        </div>
        {isMyRole && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
            <Zap size={9} />
            我的真实角色
          </span>
        )}
      </div>

      <div className={cn("text-lg font-bold mb-1", theme.text)}>
        {cfg.title}
      </div>
      <div className="text-xs text-gray-600 leading-relaxed mb-3 min-h-[32px]">
        {cfg.tagline}
      </div>

      <ul className="space-y-1 mb-3">
        {cfg.steps.slice(0, 4).map((s, i) => (
          <li
            key={s.href}
            className="text-[11px] text-gray-500 flex items-center gap-1.5"
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold",
                theme.bg,
                theme.text
              )}
            >
              {i + 1}
            </span>
            {s.label}
          </li>
        ))}
      </ul>

      <div
        className={cn(
          "mt-auto flex items-center justify-between pt-3 border-t text-sm font-semibold",
          theme.text
        )}
      >
        进入这个视角
        <ArrowRight
          size={14}
          className="group-hover:translate-x-1 transition-transform"
        />
      </div>
    </button>
  );
}
