"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRESET_TEAMS } from "@/lib/constants";

/** 与场景梳理「当前视图」一致：引导用户注意右上角团队切换（仅工作台页启用） */
const TEAM_SWITCH_HINT_KEY = "fod-team-switch-workbench-hint-seen";

interface TeamSelectorProps {
  value: string;
  onChange: (team: string) => void;
  disabled?: boolean;
  /** 我的工作台：呼吸灯引导 + 首次展开下拉即视为已引导 */
  pulseWorkbenchHint?: boolean;
}

export function TeamSelector({ value, onChange, disabled, pulseWorkbenchHint }: TeamSelectorProps) {
  const [teams, setTeams] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [newTeam, setNewTeam] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPulse, setShowPulse] = useState(false);

  const dismissPulse = useCallback(() => {
    setShowPulse(false);
    try {
      localStorage.setItem(TEAM_SWITCH_HINT_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetch("/api/bitable/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams || []))
      .catch(() => setTeams([...PRESET_TEAMS]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!pulseWorkbenchHint || typeof window === "undefined") {
      setShowPulse(false);
      return;
    }
    try {
      if (localStorage.getItem(TEAM_SWITCH_HINT_KEY)) {
        setShowPulse(false);
        return;
      }
    } catch {
      return;
    }
    setShowPulse(true);
    const t = setTimeout(() => dismissPulse(), 6000);
    return () => clearTimeout(t);
  }, [pulseWorkbenchHint, dismissPulse]);

  useEffect(() => {
    if (open && showPulse) dismissPulse();
  }, [open, showPulse, dismissPulse]);

  const handleSelect = (team: string) => {
    onChange(team);
    setOpen(false);
    dismissPulse();
  };

  const handleAddTeam = () => {
    const trimmed = newTeam.trim();
    if (!trimmed) return;
    if (!teams.includes(trimmed)) {
      setTeams((prev) => [...prev, trimmed]);
    }
    onChange(trimmed);
    setNewTeam("");
    setAdding(false);
    setOpen(false);
    dismissPulse();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-sm font-medium min-w-[200px] justify-between",
          "hover:border-blue-400 hover:bg-blue-50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled && "opacity-50 cursor-not-allowed",
          value && "border-blue-400 bg-blue-50 text-blue-700",
          showPulse && pulseWorkbenchHint && "ring-2 ring-blue-400 animate-pulse"
        )}
      >
        <span className="flex items-center gap-2">
          <Users size={16} className="text-blue-500" />
          {loading ? "加载中..." : value || "请选择团队"}
        </span>
        <ChevronDown
          size={16}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 min-w-[240px] bg-white rounded-xl border shadow-lg py-1 animate-fade-in">
          {teams.map((team) => (
            <button
              key={team}
              onClick={() => handleSelect(team)}
              className={cn(
                "w-full px-4 py-2.5 text-left text-sm hover:bg-blue-50 transition-colors",
                value === team && "bg-blue-50 text-blue-700 font-medium"
              )}
            >
              {team}
            </button>
          ))}

          <div className="border-t mt-1 pt-1">
            {adding ? (
              <div className="px-3 py-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={newTeam}
                  onChange={(e) => setNewTeam(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddTeam();
                    if (e.key === "Escape") {
                      setAdding(false);
                      setNewTeam("");
                    }
                  }}
                  placeholder="输入新团队名称..."
                  className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button size="sm" onClick={handleAddTeam} disabled={!newTeam.trim()}>
                  确认
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Plus size={14} />
                新增团队
              </button>
            )}
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setOpen(false);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}
