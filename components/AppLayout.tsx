"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Zap,
  LogOut,
  User,
  ChevronRight,
  Menu,
  X,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamSelector } from "@/components/TeamSelector";

interface UserInfo {
  open_id: string;
  name: string;
  avatar_url?: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  team: string;
  onTeamChange: (team: string) => void;
  user: UserInfo | null;
}

const NAV_ITEMS = [
  {
    href: "/dashboard",
    icon: <BarChart3 size={18} />,
    label: "AI进展看板",
    sublabel: "各团队场景进展汇总",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    href: "/section1",
    icon: <LayoutGrid size={18} />,
    label: "场景梳理",
    sublabel: "把团队日常工作列成清单",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/section2",
    icon: <Zap size={18} />,
    label: "Skill创建",
    sublabel: "把场景做成可复用的 AI Skill",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
];

export function AppLayout({
  children,
  team,
  onTeamChange,
  user,
}: AppLayoutProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-gray-900 flex-shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="hidden sm:block">FOD OperaSkill</span>
          </Link>

          {/* 面包屑 */}
          {pathname !== "/" && (
            <div className="hidden md:flex items-center gap-1 text-sm text-gray-500">
              <ChevronRight size={14} />
              {NAV_ITEMS.find((n) => n.href === pathname)?.sublabel ||
                "作业平台"}
            </div>
          )}

          <div className="flex-1" />

          {/* 团队选择器 */}
          {user && (
            <TeamSelector
              value={team}
              onChange={onTeamChange}
            />
          )}

          {/* 用户信息 */}
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar_url}
                    alt={user.name}
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                    <User size={14} className="text-blue-600" />
                  </div>
                )}
                <span>{user.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1.5 rounded hover:bg-red-50"
              >
                <LogOut size={14} />
                <span className="hidden sm:block">退出</span>
              </button>
            </div>
          )}

          {/* 移动端菜单 */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full">
        {/* 左侧导航 */}
        <aside
          className={cn(
            "w-64 flex-shrink-0 bg-white border-r",
            "hidden md:flex flex-col"
          )}
        >
          <div className="p-4 space-y-1">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
              端到端流程 Skill 作业
            </div>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                    isActive
                      ? `${item.bg} ${item.color} font-medium`
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <div
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      isActive ? item.bg : "bg-gray-100 group-hover:bg-gray-200",
                      item.color
                    )}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm">{item.label}</div>
                    <div className="text-xs text-gray-400 group-hover:text-gray-500">
                      {item.sublabel}
                    </div>
                  </div>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current" />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto p-4 border-t">
            <div className="text-xs text-gray-400 text-center">
              财务部 FOD 部门
              <br />
              AI 技能作业平台 · 五大端到端流程
            </div>
          </div>
        </aside>

        {/* 移动端侧边栏 */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-14 bottom-0 z-30 w-64 bg-white border-r shadow-xl md:hidden">
              <div className="p-4 space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all",
                        isActive
                          ? `${item.bg} ${item.color} font-medium`
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      <div
                        className={cn(
                          "p-1.5 rounded-md",
                          isActive ? item.bg : "bg-gray-100",
                          item.color
                        )}
                      >
                        {item.icon}
                      </div>
                      <div>
                        <div className="text-sm">{item.label}</div>
                        <div className="text-xs text-gray-400">
                          {item.sublabel}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </aside>
          </>
        )}

        {/* 主内容区 */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
