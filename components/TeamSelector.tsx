"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TeamSelectorProps {
  value: string;
  onChange: (team: string) => void;
  disabled?: boolean;
}

export function TeamSelector({ value, onChange, disabled }: TeamSelectorProps) {
  const [teams, setTeams] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [newTeam, setNewTeam] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/bitable/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams || []))
      .catch(() => setTeams(["互联网PTP团队"]))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (team: string) => {
    onChange(team);
    setOpen(false);
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
  };

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-white text-sm font-medium min-w-[200px] justify-between",
          "hover:border-blue-400 hover:bg-blue-50 transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled && "opacity-50 cursor-not-allowed",
          value && "border-blue-400 bg-blue-50 text-blue-700"
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
