"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Zap,
  LogOut,
  User,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Menu,
  X,
  BarChart3,
  Home as HomeIcon,
  BookOpen,
  FlaskConical,
  Flag,
  Boxes,
  Sparkles,
  Map,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamSelector } from "@/components/TeamSelector";
import { useAuth } from "@/components/AuthProvider";
import {
  FOD_ROLES,
  PAGE_OWNER_ROLE,
  ROLE_THEME,
  type FODRole,
} from "@/lib/roles";
import { RoleDot } from "@/components/RoleChip";

interface UserInfo {
  open_id: string;
  name: string;
  avatar_url?: string;
  email?: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  team: string;
  onTeamChange: (team: string) => void;
  user: UserInfo | null;
}

interface NavItem {
  href: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  /** 该项应面向的角色；为空表示所有角色可见 */
  roles?: FODRole[];
}

interface NavGroup {
  id: string;
  title: string;
  subtitle?: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const ALL: FODRole[] = [...FOD_ROLES];
const FOD_FRONTLINE: FODRole[] = ["FOD一线操作"];
const FOD_LEADER: FODRole[] = ["FOD一线AI管理"];
const FOD_ADMIN: FODRole[] = ["FOD综管"];

/**
 * prd_mock v2 导航：4 板块
 *   概览：我的工作台 / 全景 / 全链路看板 / Skill 注册 / 作业中心 / Badcase
 *   知识库管理：统一管理中心 /knowledge
 *   评测集管理：统一管理中心 /evaluation
 *   打磨 Skill 平台：/skill-forge（OpenClaw Mock）
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    title: "概览",
    items: [
      {
        href: "/",
        label: "我的工作台",
        sublabel: "KPI + 本角色工作流",
        icon: <HomeIcon size={16} />,
        roles: ALL,
      },
      {
        href: "/workflow",
        label: "全景流程图",
        sublabel: "Step1 → Step2 三泳道",
        icon: <Map size={16} />,
        roles: ALL,
      },
      {
        href: "/dashboard",
        label: "全链路看板",
        sublabel: "各阶段 Skill 数量 · 卡点",
        icon: <BarChart3 size={16} />,
        roles: [...FOD_LEADER, ...FOD_ADMIN],
      },
      {
        href: "/skills/registry",
        label: "Skill 注册中心",
        sublabel: "全生命周期 · 成员管理",
        icon: <Boxes size={16} />,
        roles: ALL,
      },
      {
        href: "/operate/console",
        label: "Skill 作业中心",
        sublabel: "Step2 · 日常使用",
        icon: <Sparkles size={16} />,
        roles: [...FOD_FRONTLINE, ...FOD_LEADER, ...FOD_ADMIN],
      },
      {
        href: "/operate/badcase",
        label: "Badcase 反馈",
        sublabel: "回流知识库 · 闭环",
        icon: <Flag size={16} />,
        roles: ALL,
      },
    ],
    defaultOpen: true,
  },
  {
    id: "kb",
    title: "知识库管理",
    subtitle: "统一审核 / 发布 / 版本",
    items: [
      {
        href: "/knowledge",
        label: "知识库管理中心",
        sublabel: "提交 · 审核 · 发布 · 版本",
        icon: <BookOpen size={16} />,
        roles: ALL,
      },
    ],
    defaultOpen: true,
  },
  {
    id: "eval",
    title: "评测集管理",
    subtitle: "数据快照 + 标准答案",
    items: [
      {
        href: "/evaluation",
        label: "评测集管理中心",
        sublabel: "快照 / 答案 / 评测运行",
        icon: <FlaskConical size={16} />,
        roles: ALL,
      },
    ],
    defaultOpen: true,
  },
  {
    id: "forge",
    title: "打磨 Skill 平台",
    subtitle: "OpenClaw 云 Agent",
    items: [
      {
        href: "/skill-forge",
        label: "打磨 Skill 平台",
        sublabel: "4 步向导 · 生成子 Skill",
        icon: <Wand2 size={16} />,
        roles: ALL,
      },
    ],
    defaultOpen: true,
  },
];

const SIDEBAR_COLLAPSED_KEY = "fod-sidebar-collapsed";
const SIDEBAR_ONLY_MINE_KEY = "fod-sidebar-only-mine";

function RoleDotForHref({ href }: { href: string }) {
  const role: FODRole | undefined = PAGE_OWNER_ROLE[href];
  if (!role) return null;
  return <RoleDot role={role} className="ml-auto mr-2" />;
}

function NavGroupBlock({
  group,
  activeHref,
  onItemClick,
  collapsed,
  filterRoles,
}: {
  group: NavGroup;
  activeHref: string;
  onItemClick?: () => void;
  collapsed: boolean;
  /** 若为 null 表示不过滤（综管/IT 默认显示全部） */
  filterRoles: FODRole | null;
}) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);

  const filteredItems = useMemo(() => {
    if (!filterRoles) return group.items;
    return group.items.filter(
      (it) => !it.roles || it.roles.includes(filterRoles)
    );
  }, [group.items, filterRoles]);

  if (filteredItems.length === 0) return null;

  if (collapsed) {
    return (
      <div className="mb-2 space-y-0.5">
        {filteredItems.map((item) => {
          const isActive =
            activeHref === item.href ||
            (item.href !== "/" && activeHref.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              title={`${item.label} · ${item.sublabel}`}
              className={cn(
                "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-all",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              )}
            >
              {item.icon}
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 hover:text-gray-600"
      >
        {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {group.title}
      </button>
      {open && (
        <div className="space-y-0.5">
          {filteredItems.map((item) => {
            const isActive =
              activeHref === item.href ||
              (item.href !== "/" && activeHref.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onItemClick}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md transition-all group",
                  isActive
                    ? "bg-blue-50 text-blue-700 font-medium shadow-sm"
                    : "text-gray-600 hover:bg-gray-50"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-6 h-6 rounded",
                    isActive
                      ? "bg-white text-blue-600"
                      : "text-gray-400 group-hover:text-gray-600"
                  )}
                >
                  {item.icon}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] truncate">
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-gray-400 truncate">
                    {item.sublabel}
                  </span>
                </span>
                <RoleDotForHref href={item.href} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DemoModeSwitcher() {
  const { demoMode, setDemoMode, demoRole, setDemoRole } = useAuth();
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center rounded-lg border border-amber-300 p-0.5 bg-white">
        <button
          onClick={() => setDemoMode(false)}
          className={cn(
            "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
            !demoMode
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-700"
          )}
        >
          真实数据
        </button>
        <button
          onClick={() => setDemoMode(true)}
          className={cn(
            "px-2 py-0.5 text-[11px] font-medium rounded transition-colors",
            demoMode
              ? "bg-amber-500 text-white shadow-sm"
              : "text-amber-600 hover:text-amber-700"
          )}
        >
          演示模式
        </button>
      </div>

      {/* 仅演示模式显示视角切换：渲染为带色点的 RoleChip 风格 */}
      {demoMode && <DemoRoleChipDropdown value={demoRole} onChange={setDemoRole} />}
    </div>
  );
}

function DemoRoleChipDropdown({
  value,
  onChange,
}: {
  value: FODRole | null;
  onChange: (r: FODRole | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const theme = value ? ROLE_THEME[value] : null;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium transition-colors",
          theme
            ? cn(theme.bg, theme.text, theme.border)
            : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
        )}
      >
        {theme ? (
          <>
            <span className={cn("w-1.5 h-1.5 rounded-full", theme.dot)} />
            {value}
          </>
        ) : (
          <>切换视角…</>
        )}
        <ChevronDown size={10} className="opacity-60" />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 z-40 min-w-[160px] rounded-lg border bg-white shadow-lg py-1"
        >
          <button
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="w-full text-left px-2.5 py-1 text-[11px] text-gray-500 hover:bg-gray-50"
          >
            清空视角
          </button>
          <div className="h-px bg-gray-100 my-1" />
          {FOD_ROLES.map((r) => {
            const t = ROLE_THEME[r];
            return (
              <button
                key={r}
                onClick={() => {
                  onChange(r);
                  setOpen(false);
                }}
                className={cn(
                  "w-full text-left px-2.5 py-1 text-[11px] flex items-center gap-1.5 hover:bg-gray-50",
                  value === r && "bg-gray-50 font-semibold"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", t.dot)} />
                <span className={t.text}>{r}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AppLayout({
  children,
  team,
  onTeamChange,
  user,
}: AppLayoutProps) {
  const pathname = usePathname() || "/";
  const { effectiveRole } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    setOnlyMine(localStorage.getItem(SIDEBAR_ONLY_MINE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const nv = !v;
      if (typeof window !== "undefined") {
        if (nv) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
        else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY);
      }
      return nv;
    });
  };

  const toggleOnlyMine = () => {
    setOnlyMine((v) => {
      const nv = !v;
      if (typeof window !== "undefined") {
        if (nv) localStorage.setItem(SIDEBAR_ONLY_MINE_KEY, "1");
        else localStorage.removeItem(SIDEBAR_ONLY_MINE_KEY);
      }
      return nv;
    });
  };

  // 过滤策略：
  // - 一线角色（FOD一线操作 / FOD一线AI管理）：总是按角色过滤
  // - 综管：默认显示全部；勾选「仅看我的」后按角色过滤
  const isFrontline =
    effectiveRole === "FOD一线操作" || effectiveRole === "FOD一线AI管理";
  const canToggleOnlyMine = effectiveRole === "FOD综管";
  const filterRoles: FODRole | null = effectiveRole
    ? isFrontline
      ? effectiveRole
      : canToggleOnlyMine && onlyMine
      ? effectiveRole
      : null
    : null;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-gray-900 flex-shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="hidden sm:block">FOD · Skill 工作台</span>
          </Link>

          {pathname !== "/" && (
            <div className="hidden md:flex items-center gap-1 text-sm text-gray-500">
              <ChevronRight size={14} />
              <BreadcrumbLabel pathname={pathname} />
            </div>
          )}

          <div className="flex-1" />

          <DemoModeSwitcher />

          {user && <TeamSelector value={team} onChange={onTeamChange} />}

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

          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex max-w-screen-xl mx-auto w-full">
        <aside
          className={cn(
            "flex-shrink-0 bg-white border-r",
            "hidden md:flex flex-col transition-[width] duration-200",
            collapsed ? "w-14" : "w-64"
          )}
        >
          {!collapsed && canToggleOnlyMine && effectiveRole && (
            <div className="p-2 border-b">
              <button
                onClick={toggleOnlyMine}
                className={cn(
                  "w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] border transition-colors",
                  onlyMine
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                )}
              >
                {onlyMine ? <Eye size={12} /> : <EyeOff size={12} />}
                {onlyMine
                  ? `仅看 ${effectiveRole} 的菜单`
                  : "显示全部菜单"}
              </button>
            </div>
          )}

          <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
            {NAV_GROUPS.map((g) => (
              <NavGroupBlock
                key={g.id}
                group={g}
                activeHref={pathname}
                collapsed={collapsed}
                filterRoles={filterRoles}
              />
            ))}
          </div>

          <div className="border-t">
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "展开侧栏" : "收起侧栏"}
              className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            >
              {collapsed ? (
                <ChevronRight size={14} />
              ) : (
                <>
                  <ChevronLeft size={14} />
                  收起
                </>
              )}
            </button>
          </div>

          {!collapsed && (
            <div className="p-3 border-t text-[10px] text-gray-400 text-center leading-tight">
              财务部 FOD · SKILL 管理工作流
              <br />
              Step1 调试 → Step2 使用
            </div>
          )}
        </aside>

        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-20 bg-black/30 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="fixed left-0 top-14 bottom-0 z-30 w-72 bg-white border-r shadow-xl md:hidden overflow-y-auto">
              <div className="p-2">
                {NAV_GROUPS.map((g) => (
                  <NavGroupBlock
                    key={g.id}
                    group={g}
                    activeHref={pathname}
                    collapsed={false}
                    filterRoles={filterRoles}
                    onItemClick={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            </aside>
          </>
        )}

        <main className="flex-1 overflow-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}

function BreadcrumbLabel({ pathname }: { pathname: string }) {
  for (const g of NAV_GROUPS) {
    for (const it of g.items) {
      if (pathname === it.href || (it.href !== "/" && pathname.startsWith(it.href))) {
        return <>{it.label}</>;
      }
    }
  }
  return <>作业平台</>;
}
