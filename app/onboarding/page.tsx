"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CheckCircle2, ArrowRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { PRESET_TEAMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const { user, isLoggedIn, loading, profile, profileLoading, refreshProfile } =
    useAuth();
  const router = useRouter();
  const [teams, setTeams] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [customInput, setCustomInput] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 未登录 → 回首页登录
  useEffect(() => {
    if (!loading && !isLoggedIn) {
      router.replace("/");
    }
  }, [loading, isLoggedIn, router]);

  // 已有归属团队 → 直接进主页（防止二次进入）
  useEffect(() => {
    if (!profileLoading && profile.isBootstrapped) {
      router.replace("/");
    }
  }, [profileLoading, profile.isBootstrapped, router]);

  useEffect(() => {
    fetch("/api/bitable/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams || PRESET_TEAMS))
      .catch(() => setTeams([...PRESET_TEAMS]));
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  const handleSubmit = async () => {
    const finalTeam = addingCustom ? customInput.trim() : selected;
    if (!finalTeam) {
      setError("请选择或输入您所在的团队");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: finalTeam }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        throw new Error(d.error || "保存失败");
      }
      // 本地缓存同步
      if (typeof window !== "undefined") {
        localStorage.setItem("fod_selected_team", finalTeam);
      }
      await refreshProfile();
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 text-white p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Users size={20} />
            </div>
            <span className="text-sm font-medium opacity-90">
              欢迎，{user.name}
            </span>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            第一次来？请先选择你的团队
          </h1>
          <p className="text-sm text-white/80 leading-relaxed">
            你会以这个团队的身份提交任务一/任务二数据。其它团队的内容你可以查看但不能修改。
            <br />
            如选错了请联系管理员在后台调整。
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {teams.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setSelected(t);
                  setAddingCustom(false);
                  setError(null);
                }}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-3 rounded-xl border text-sm font-medium transition-all text-left",
                  selected === t && !addingCustom
                    ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/50"
                )}
              >
                <span className="truncate">{t}</span>
                {selected === t && !addingCustom && (
                  <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setAddingCustom(true);
                setSelected("");
                setError(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1 px-3 py-3 rounded-xl border border-dashed text-sm font-medium transition-all",
                addingCustom
                  ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                  : "border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-600"
              )}
            >
              + 其他 / 自定义
            </button>
          </div>

          {addingCustom && (
            <input
              autoFocus
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="请输入你所属团队的全称"
              className="w-full px-4 py-2.5 rounded-xl border border-blue-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          )}

          {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors"
            >
              <LogOut size={12} /> 换个账号登录
            </button>
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-2 px-6"
            >
              {submitting ? "保存中..." : "确认并进入"}
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
