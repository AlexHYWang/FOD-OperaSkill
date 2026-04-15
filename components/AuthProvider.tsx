"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

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
  const [team, setTeamState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("fod_selected_team") || "";
    }
    return "";
  });

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
