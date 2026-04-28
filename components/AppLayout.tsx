"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Zap,
  LogOut,
  User,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
  BarChart3,
  Home,
  BookOpen,
  FlaskConical,
  UploadCloud,
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

const NAV_GROUPS = [
  {
    title: "概览",
    items: [
      { href: "/workbench", icon: <Home size={18} />, label: "我的工作台", sublabel: "动态与待办", color: "text-slate-600", bg: "bg-slate-50" },
      { href: "/dashboard", icon: <BarChart3 size={18} />, label: "AI进展看板", sublabel: "场景资产与准确率", color: "text-emerald-600", bg: "bg-emerald-50" },
    ],
  },
  {
    title: "梳理场景",
    items: [
      { href: "/section1", icon: <LayoutGrid size={18} />, label: "场景梳理", sublabel: "流程节点与场景卡", color: "text-blue-600", bg: "bg-blue-50" },
    ],
  },
  {
    title: "知识管理",
    items: [
      { href: "/knowledge", icon: <BookOpen size={18} />, label: "知识库管理中心", sublabel: "提交 · 审核 · 发布", color: "text-indigo-600", bg: "bg-indigo-50" },
    ],
  },
  {
    title: "评测集管理",
    items: [
      { href: "/evaluation", icon: <FlaskConical size={18} />, label: "评测集管理中心", sublabel: "数据集 / 资料 / 评测运行", color: "text-teal-600", bg: "bg-teal-50" },
      { href: "/evaluation/test", icon: <Zap size={18} />, label: "评测集测试", sublabel: "财多多线下回传", color: "text-amber-600", bg: "bg-amber-50" },
    ],
  },
  {
    title: "场景化 SKILL 生产",
    items: [
      { href: "/section2", icon: <UploadCloud size={18} />, label: "场景化 Skill 生产", sublabel: "选场景 · 多步向导", color: "text-purple-600", bg: "bg-purple-50" },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const SIDEBAR_KEY = "fod-sidebar-collapsed";
const GROUPS_KEY = "fod-nav-groups-collapsed";

export function AppLayout({ children, team, onTeamChange, user }: AppLayoutProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [groupsCollapsed, setGroupsCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const sc = localStorage.getItem(SIDEBAR_KEY);
      if (sc) setSidebarCollapsed(JSON.parse(sc));
      const gc = localStorage.getItem(GROUPS_KEY);
      if (gc) setGroupsCollapsed(JSON.parse(gc));
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const toggleGroup = (title: string) => {
    setGroupsCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem(GROUPS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部 Header */}
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className={cn("hidden sm:block transition-all", sidebarCollapsed ? "" : "")}>FOD · Skill 工作台</span>
          </Link>

          {pathname !== "/" && (
            <div className="hidden md:flex items-center gap-1 text-sm text-gray-500">
              <ChevronRight size={14} />
              {NAV_ITEMS.find((n) => n.href === pathname || (n.href !== "/" && pathname.startsWith(n.href)))?.label || "作业平台"}
            </div>
          )}

          <div className="flex-1" />

          {user && <TeamSelector value={team} onChange={onTeamChange} />}

          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.name} className="w-7 h-7 rounded-full" />
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

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full">
        {/* 左侧导航（桌面） */}
        <aside
          className={cn(
            "hidden md:flex flex-col flex-shrink-0 bg-white border-r transition-all duration-200",
            sidebarCollapsed ? "w-[52px]" : "w-64"
          )}
        >
          {/* 折叠/展开按钮 */}
          <div className={cn("flex items-center border-b px-2 py-2", sidebarCollapsed ? "justify-center" : "justify-end")}>
            <button
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "展开导航" : "收起导航"}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          <div className={cn("flex-1 overflow-y-auto", sidebarCollapsed ? "px-1 py-2" : "p-3")}>
            {!sidebarCollapsed && (
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                端到端流程 Skill 作业
              </div>
            )}

            {NAV_GROUPS.map((group) => {
              const isGroupCollapsed = groupsCollapsed[group.title] ?? false;
              return (
                <div key={group.title} className={cn("mb-1", sidebarCollapsed ? "" : "")}>
                  {/* 分组标题（仅展开时可见） */}
                  {!sidebarCollapsed && (
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center gap-1 px-2 pt-3 pb-1 text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <ChevronDown
                        size={12}
                        className={cn("transition-transform", isGroupCollapsed ? "-rotate-90" : "")}
                      />
                      {group.title}
                    </button>
                  )}

                  {/* 分组条目 */}
                  {(!isGroupCollapsed || sidebarCollapsed) && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/" && pathname.startsWith(item.href));
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={sidebarCollapsed ? item.label : undefined}
                            className={cn(
                              "flex items-center gap-3 rounded-lg transition-all group",
                              sidebarCollapsed ? "px-1.5 py-2 justify-center" : "px-2 py-2",
                              isActive
                                ? `${item.bg} ${item.color} font-medium`
                                : "text-gray-600 hover:bg-gray-100"
                            )}
                          >
                            <div
                              className={cn(
                                "p-1.5 rounded-md transition-colors flex-shrink-0",
                                isActive ? item.bg : "bg-gray-100 group-hover:bg-gray-200",
                                item.color
                              )}
                            >
                              {item.icon}
                            </div>
                            {!sidebarCollapsed && (
                              <div className="min-w-0 flex-1">
                                <div className="text-sm truncate">{item.label}</div>
                                <div className="text-xs text-gray-400 group-hover:text-gray-500 truncate">
                                  {item.sublabel}
                                </div>
                              </div>
                            )}
                            {!sidebarCollapsed && isActive && (
                              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!sidebarCollapsed && (
            <div className="p-3 border-t">
              <div className="text-xs text-gray-400 text-center leading-relaxed">
                财务部 FOD 部门
                <br />
                AI 技能作业平台 · 五大端到端流程
              </div>
            </div>
          )}
        </aside>

        {/* 移动端侧边栏 */}
        {mobileOpen && (
          <>
            <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMobileOpen(false)} />
            <aside className="fixed left-0 top-14 bottom-0 z-30 w-64 bg-white border-r shadow-xl md:hidden overflow-y-auto">
              <div className="p-3 space-y-1">
                {NAV_GROUPS.map((group) => (
                  <div key={group.title}>
                    <div className="px-2 pt-3 pb-1 text-[11px] font-bold text-gray-400">{group.title}</div>
                    {group.items.map((item) => {
                      const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-3 px-2 py-2 rounded-lg transition-all",
                            isActive ? `${item.bg} ${item.color} font-medium` : "text-gray-600 hover:bg-gray-100"
                          )}
                        >
                          <div className={cn("p-1.5 rounded-md", isActive ? item.bg : "bg-gray-100", item.color)}>
                            {item.icon}
                          </div>
                          <div>
                            <div className="text-sm">{item.label}</div>
                            <div className="text-xs text-gray-400">{item.sublabel}</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </aside>
          </>
        )}

        {/* 主内容区 */}
        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
