"use client";

import { cn } from "@/lib/utils";
import { ROLE_THEME, type FODRole } from "@/lib/roles";

interface RoleChipProps {
  role: FODRole | "";
  size?: "sm" | "md";
  /** 仅显示色点 + 简称，不显示"负责：" */
  compact?: boolean;
  className?: string;
}

/** 小体量 Chip，用于页面顶部/卡片角标展示"本环节负责角色" */
export function RoleChip({ role, size = "sm", compact, className }: RoleChipProps) {
  if (!role) return null;
  const theme = ROLE_THEME[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap",
        theme.bg,
        theme.text,
        theme.border,
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        className
      )}
      title={theme.description}
    >
      <span className={cn("inline-block rounded-full w-1.5 h-1.5", theme.dot)} />
      {compact ? role : <>负责 · {role}</>}
    </span>
  );
}

/** 仅色点，用于流程图节点角标（极小占位） */
export function RoleDot({ role, className }: { role: FODRole; className?: string }) {
  const theme = ROLE_THEME[role];
  return (
    <span
      className={cn("inline-block rounded-full w-2 h-2", theme.dot, className)}
      title={role}
    />
  );
}
