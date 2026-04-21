"use client";

import { ReactNode } from "react";
import { RoleChip } from "@/components/RoleChip";
import type { FODRole } from "@/lib/roles";

interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  ownerRole?: FODRole;
  /** 顶部右侧操作区，如按钮/切换等 */
  actions?: ReactNode;
  /** 页面是否处于「Mock 演示态」 —— 显示灰色徽章，用于 IT 侧 */
  isMock?: boolean;
  /** 额外角标（右上），例如"输入 / 产出物"的 tag */
  badges?: ReactNode;
}

export function PageHeader({
  icon,
  title,
  subtitle,
  ownerRole,
  actions,
  isMock,
  badges,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 flex-wrap pb-4 border-b mb-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {ownerRole && <RoleChip role={ownerRole} compact />}
          {isMock && (
            <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
              演示态 · 非真实数据
            </span>
          )}
          {badges}
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
          {icon && <span className="text-gray-500">{icon}</span>}
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
