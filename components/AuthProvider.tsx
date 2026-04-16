"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
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

interface AuthContextType {
  user: UserInfo | null;
  isLoggedIn: boolean;
  loading: boolean;
  team: string;
  setTeam: (team: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  loading: true,
  team: "",
  setTeam: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  // 不在 useState 初始化里读 localStorage，避免 SSR 与客户端水合不一致
  const [team, setTeamState] = useState<string>("");

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

  const setTeam = (t: string) => {
    setTeamState(t);
    if (typeof window !== "undefined") {
      localStorage.setItem("fod_selected_team", t);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, loading, team, setTeam }}>
      {children}
    </AuthContext.Provider>
  );
}
