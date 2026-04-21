"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FODRole } from "@/lib/roles";

/** 已从多维表/下拉中移除的旧团队名，本地缓存命中则清空（不影响「新增团队」自定义名称） */
const STALE_SAVED_TEAMS = new Set(["互联网PTP团队"]);

function readValidTeamFromStorage(): string {
  if (typeof window === "undefined") return "";
  const raw = localStorage.getItem("fod_selected_team") || "";
  if (!raw) return "";
  if (STALE_SAVED_TEAMS.has(raw)) {
    localStorage.removeItem("fod_selected_team");
    return "";
  }
  return raw;
}

interface UserInfo {
  open_id: string;
  name: string;
  avatar_url?: string;
  email?: string;
}

export interface UserProfileClient {
  team: string; // 归属团队（不可随意改）
  role: "管理员" | "普通用户" | "";
  roleV4: FODRole | "";
  isTeamLeader: boolean;
  department: string;
  isBootstrapped: boolean;
}

interface AuthContextType {
  user: UserInfo | null;
  isLoggedIn: boolean;
  loading: boolean;
  /** 当前在看哪个团队的数据（仅视图用，可与归属团队不一致） */
  team: string;
  setTeam: (team: string) => void;
  /** 用户归属团队 / 角色 / 部门（来自 Table3） */
  profile: UserProfileClient;
  profileLoading: boolean;
  /** 当前查看的团队是否就是我归属的团队（决定编辑权限） */
  canEdit: boolean;
  /** 重新拉取 profile（onboarding 成功后调用） */
  refreshProfile: () => Promise<void>;

  /** 演示模式开关 —— 开启时首页/各页展示 Mock 数据，且允许切换角色视角 */
  demoMode: boolean;
  setDemoMode: (v: boolean) => void;
  /** 演示视角（仅演示模式下生效）—— 优先于真实 roleV4 */
  demoRole: FODRole | null;
  setDemoRole: (r: FODRole | null) => void;
  /** 前端统一通过 effectiveRole 判断当前角色，自动融合真实/演示 */
  effectiveRole: FODRole | "";
  /** 演示模式 + 综管/IT + 还没选演示角色 —— 首页应展示"角色选择屏" */
  needsRolePick: boolean;
}

const DEFAULT_PROFILE: UserProfileClient = {
  team: "",
  role: "",
  roleV4: "",
  isTeamLeader: false,
  department: "",
  isBootstrapped: false,
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  team: "",
  setTeam: () => {},
  profile: DEFAULT_PROFILE,
  profileLoading: true,
  canEdit: false,
  refreshProfile: async () => {},
  demoMode: false,
  setDemoMode: () => {},
  demoRole: null,
  setDemoRole: () => {},
  effectiveRole: "",
  needsRolePick: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

/** 无需登录即可访问的页面 */
const PUBLIC_PATHS = new Set(["/", "/onboarding"]);

const DEMO_MODE_KEY = "fod-demo-mode";
const DEMO_ROLE_KEY = "fod-demo-role";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [team, setTeamState] = useState<string>("");
  const [profile, setProfile] = useState<UserProfileClient>(DEFAULT_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [demoMode, setDemoModeState] = useState(false);
  const [demoRole, setDemoRoleState] = useState<FODRole | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const v = readValidTeamFromStorage();
    if (v) setTeamState(v);
    if (typeof window !== "undefined") {
      setDemoModeState(localStorage.getItem(DEMO_MODE_KEY) === "1");
      const dr = localStorage.getItem(DEMO_ROLE_KEY) as FODRole | null;
      if (dr) setDemoRoleState(dr);
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.isLoggedIn) {
          setIsLoggedIn(true);
          setUser(data.user);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!isLoggedIn) {
      setProfile(DEFAULT_PROFILE);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const r = await fetch("/api/user/profile");
      const d = await r.json();
      if (d.success && d.profile) {
        const p: UserProfileClient = {
          team: d.profile.team || "",
          role: d.profile.role || "",
          roleV4: d.profile.roleV4 || "",
          isTeamLeader: !!d.profile.isTeamLeader,
          department: d.profile.department || "",
          isBootstrapped: !!d.profile.isBootstrapped,
        };
        setProfile(p);
        if (p.team && !team) {
          setTeamState(p.team);
          if (typeof window !== "undefined") {
            localStorage.setItem("fod_selected_team", p.team);
          }
        }
      } else {
        setProfile(DEFAULT_PROFILE);
      }
    } catch (err) {
      console.error("[profile] 加载失败", err);
      setProfile(DEFAULT_PROFILE);
    } finally {
      setProfileLoading(false);
    }
  }, [isLoggedIn, team]);

  useEffect(() => {
    fetchProfile();
  }, [isLoggedIn, fetchProfile]);

  useEffect(() => {
    if (loading || profileLoading) return;
    if (!isLoggedIn) return;
    if (profile.isBootstrapped) return;
    if (pathname === "/onboarding") return;
    router.replace("/onboarding");
  }, [
    loading,
    profileLoading,
    isLoggedIn,
    profile.isBootstrapped,
    pathname,
    router,
  ]);

  const setTeam = (t: string) => {
    setTeamState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("fod_selected_team", t);
    }
  };

  const canEdit =
    !!profile.isBootstrapped && !!team && profile.team === team;

  const setDemoMode = useCallback((v: boolean) => {
    setDemoModeState(v);
    if (typeof window !== "undefined") {
      if (v) localStorage.setItem(DEMO_MODE_KEY, "1");
      else localStorage.removeItem(DEMO_MODE_KEY);
    }
    if (!v) {
      setDemoRoleState(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(DEMO_ROLE_KEY);
      }
    }
  }, []);

  const setDemoRole = useCallback((r: FODRole | null) => {
    setDemoRoleState(r);
    if (typeof window !== "undefined") {
      if (r) localStorage.setItem(DEMO_ROLE_KEY, r);
      else localStorage.removeItem(DEMO_ROLE_KEY);
    }
  }, []);

  const effectiveRole: FODRole | "" =
    demoMode && demoRole ? demoRole : profile.roleV4;

  // prd_mock v2：首页是混合版门户，不再强制"选角色"跳转 → 永远 false。
  // 演示模式下切换视角仍由顶栏 DemoRoleChipDropdown 承担。
  const needsRolePick = false;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        loading,
        team,
        setTeam,
        profile,
        profileLoading,
        canEdit,
        refreshProfile: fetchProfile,
        demoMode,
        setDemoMode,
        demoRole,
        setDemoRole,
        effectiveRole,
        needsRolePick,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
// 便于未登录公共页识别
export { PUBLIC_PATHS };
