"use client";

import { AlertTriangle, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

/**
 * 演示模式顶部条
 * 仅在 demoMode=true 时显示；所在页面全局置顶，提醒「当前展示的是 Mock 数据」。
 */
export function DemoModeBanner() {
  const { demoMode, setDemoMode, demoRole } = useAuth();
  if (!demoMode) return null;

  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 text-amber-900">
      <div className="max-w-screen-xl mx-auto px-4 py-1.5 flex items-center gap-2 text-xs">
        <AlertTriangle size={13} className="flex-shrink-0" />
        <span className="font-semibold">演示模式</span>
        <span className="opacity-80">
          · 当前数字 / 列表均为 Mock 数据，仅用于给领导/IT评审演示流程
        </span>
        {demoRole && (
          <span className="ml-1 px-1.5 py-0.5 bg-amber-200 rounded text-[11px] font-medium">
            正以「{demoRole}」视角查看
          </span>
        )}
        <button
          onClick={() => setDemoMode(false)}
          className="ml-auto flex items-center gap-0.5 hover:text-amber-950 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors"
        >
          <X size={12} /> 退出演示
        </button>
      </div>
    </div>
  );
}
