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
}

export interface UserProfileClient {
  team: string; // 归属团队（不可随意改）
  role: "管理员" | "普通用户" | "";
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
}

const DEFAULT_PROFILE: UserProfileClient = {
  team: "",
  role: "",
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
});

export function useAuth() {
  return useContext(AuthContext);
}

/** 无需登录即可访问的页面 */
const PUBLIC_PATHS = new Set(["/", "/onboarding"]);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [team, setTeamState] = useState<string>("");
  const [profile, setProfile] = useState<UserProfileClient>(DEFAULT_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const v = readValidTeamFromStorage();
    if (v) setTeamState(v);
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
          department: d.profile.department || "",
          isBootstrapped: !!d.profile.isBootstrapped,
        };
        setProfile(p);
        // 初次加载：默认把"查看团队"同步为归属团队
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

  // 登录后未选归属团队，强制跳转 /onboarding
  useEffect(() => {
    if (loading || profileLoading) return;
    if (!isLoggedIn) return;
    if (profile.isBootstrapped) return;
    if (pathname === "/onboarding") return;
    // 其它任何页面都强引导
    router.replace("/onboarding");
  }, [loading, profileLoading, isLoggedIn, profile.isBootstrapped, pathname, router]);

  const setTeam = (t: string) => {
    setTeamState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("fod_selected_team", t);
    }
  };

  const canEdit =
    !!profile.isBootstrapped && !!team && profile.team === team;

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
// 便于未登录公共页识别
export { PUBLIC_PATHS };
