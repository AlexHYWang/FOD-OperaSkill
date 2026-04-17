"use client";

import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Target,
  Plus,
  CheckCircle2,
  Clock,
  ChevronDown,
  X,
} from "lucide-react";

interface UserInfo {
  open_id: string;
  name: string;
  avatar_url?: string;
}

interface BitableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface Props {
  team: string;
  isAdmin: boolean;
  user: UserInfo | null;
  mode: "blockers" | "goals";
}

// ─── 主组件 ────────────────────────────────────────────────────────
export function BlockersGoalsSection({ team, isAdmin, user, mode }: Props) {
  const tableNum = mode === "blockers" ? "5" : "6";
  const [records, setRecords] = useState<BitableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "待解决" | "已解决">("all");

  // 卡点 combobox 状态
  const [comboInput, setComboInput] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // 明日目标输入
  const [goalInput, setGoalInput] = useState("");

  const fetchRecords = () => {
    setLoading(true);
    const params = new URLSearchParams({ table: tableNum });
    if (!isAdmin && team) params.set("team", team);
    fetch(`/api/bitable/records?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.success && Array.isArray(d.records)) setRecords(d.records); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRecords(); }, [team, isAdmin, tableNum]); // eslint-disable-line react-hooks/exhaustive-deps

  // 点击外部关闭 combobox
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setComboOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 卡点 combobox 选项：已有记录的去重描述
  const existingBlockerDescs = Array.from(
    new Set(records.map((r) => r.fields["卡点描述"] as string).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "zh"));

  const filteredOptions = existingBlockerDescs.filter(
    (d) => !comboInput || d.toLowerCase().includes(comboInput.toLowerCase())
  );

  const handleBlockerSubmit = async () => {
    if (!comboInput.trim() || !team) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "5",
          fields: { 团队名称: team, 卡点描述: comboInput.trim(), 状态: "待解决" },
        }),
      });
      const d = await res.json();
      if (d.success) { setComboInput(""); setShowForm(false); fetchRecords(); }
    } catch (e) { console.error("提交失败", e); }
    finally { setSubmitting(false); }
  };

  const handleGoalSubmit = async () => {
    if (!goalInput.trim() || !team) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "6",
          fields: { 团队名称: team, 目标内容: goalInput.trim(), 提交日期: Date.now() },
        }),
      });
      const d = await res.json();
      if (d.success) { setGoalInput(""); setShowForm(false); fetchRecords(); }
    } catch (e) { console.error("提交失败", e); }
    finally { setSubmitting(false); }
  };

  const handleToggleStatus = async (recordId: string, currentStatus: string) => {
    const newStatus = currentStatus === "已解决" ? "待解决" : "已解决";
    try {
      await fetch("/api/bitable/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "5", recordId, fields: { 状态: newStatus } }),
      });
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, fields: { ...r.fields, 状态: newStatus } } : r
        )
      );
    } catch (e) { console.error("更新状态失败", e); }
  };

  const isBlockers = mode === "blockers";

  // ─── 卡点聚合：以卡点描述为主键 ───
  const blockerGroups: Record<
    string,
    { teams: string[]; records: BitableRecord[]; hasResolved: boolean }
  > = {};
  if (isBlockers) {
    for (const rec of records) {
      if (statusFilter !== "all" && (rec.fields["状态"] as string) !== statusFilter) continue;
      const desc = (rec.fields["卡点描述"] as string) || "";
      const t = (rec.fields["团队名称"] as string) || "";
      if (!desc) continue;
      if (!blockerGroups[desc]) blockerGroups[desc] = { teams: [], records: [], hasResolved: false };
      if (!blockerGroups[desc].teams.includes(t)) blockerGroups[desc].teams.push(t);
      blockerGroups[desc].records.push(rec);
      if ((rec.fields["状态"] as string) === "已解决") blockerGroups[desc].hasResolved = true;
    }
  }
  const sortedBlockers = Object.entries(blockerGroups).sort(
    (a, b) => b[1].teams.length - a[1].teams.length
  );

  // ─── 明日目标：各团队最新一条 ───
  const goalsByTeam: Record<string, BitableRecord> = {};
  if (!isBlockers) {
    for (const rec of records) {
      const t = (rec.fields["团队名称"] as string) || "";
      if (t) goalsByTeam[t] = rec;
    }
  }

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          {isBlockers ? (
            <AlertTriangle size={16} className="text-orange-500" />
          ) : (
            <Target size={16} className="text-emerald-500" />
          )}
          <span className="text-sm font-semibold text-gray-700">
            {isBlockers ? "主要卡点" : "明日关键目标"}
          </span>
          {isBlockers && (
            <span className="text-xs text-gray-400">
              ({records.filter((r) => r.fields["状态"] === "待解决").length} 待解决 ·{" "}
              {records.filter((r) => r.fields["状态"] === "已解决").length} 已解决)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 卡点状态筛选 */}
          {isBlockers && (isAdmin || team) && (
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              {(["all", "待解决", "已解决"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
                    statusFilter === s
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  {s === "all" ? "全部" : s}
                </button>
              ))}
            </div>
          )}

          {/* 新增按钮 */}
          {team && user && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all",
                showForm
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-white border-gray-200 text-gray-600 hover:text-gray-800 hover:border-gray-300"
              )}
            >
              <Plus size={13} />
              {isBlockers ? "登记卡点" : "更新目标"}
            </button>
          )}
        </div>
      </div>

      {/* 卡点提交表单（combobox） */}
      {showForm && team && isBlockers && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-xs text-gray-500">
            团队：<span className="font-medium text-gray-700">{team}</span>
          </div>
          <div ref={comboRef} className="relative">
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-emerald-300">
              <input
                value={comboInput}
                onChange={(e) => { setComboInput(e.target.value); setComboOpen(true); }}
                onFocus={() => setComboOpen(true)}
                placeholder="选择已有卡点或输入新卡点..."
                className="flex-1 text-sm focus:outline-none bg-transparent"
              />
              {comboInput && (
                <button onClick={() => setComboInput("")} className="text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
              <button onClick={() => setComboOpen((v) => !v)} className="text-gray-400 hover:text-gray-600">
                <ChevronDown size={13} className={cn("transition-transform", comboOpen ? "rotate-180" : "")} />
              </button>
            </div>
            {/* 下拉列表 */}
            {comboOpen && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredOptions.length === 0 && comboInput ? (
                  <div className="px-3 py-2.5 text-sm text-gray-400">
                    将新增卡点：「{comboInput}」
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-3 py-2.5 text-sm text-gray-400">暂无已有卡点，请直接输入</div>
                ) : (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { setComboInput(opt); setComboOpen(false); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                    >
                      {opt}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setComboInput(""); }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleBlockerSubmit}
              disabled={submitting || !comboInput.trim()}
              className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "提交中..." : "提交"}
            </button>
          </div>
        </div>
      )}

      {/* 明日目标提交表单 */}
      {showForm && team && !isBlockers && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="text-xs text-gray-500">
            团队：<span className="font-medium text-gray-700">{team}</span>
          </div>
          <textarea
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            rows={3}
            placeholder="描述明日关键目标..."
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setGoalInput(""); }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={handleGoalSubmit}
              disabled={submitting || !goalInput.trim()}
              className="px-4 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "提交中..." : "提交"}
            </button>
          </div>
        </div>
      )}

      {!team && !isAdmin && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          请先在顶部选择您的团队，以查看或登记{isBlockers ? "卡点" : "目标"}
        </div>
      )}

      {/* 内容区 */}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">加载中...</div>
      ) : isBlockers ? (
        <BlockersByDesc
          sortedBlockers={sortedBlockers}
          onToggleStatus={handleToggleStatus}
        />
      ) : (
        <GoalsList goalsByTeam={goalsByTeam} currentTeam={team} />
      )}
    </div>
  );
}

// ─── 卡点列表（以卡点描述为主键） ─────────────────────────────────
function BlockersByDesc({
  sortedBlockers,
  onToggleStatus,
}: {
  sortedBlockers: Array<[string, { teams: string[]; records: BitableRecord[]; hasResolved: boolean }]>;
  onToggleStatus: (recordId: string, status: string) => void;
}) {
  if (sortedBlockers.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        暂无卡点记录
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedBlockers.map(([desc, group]) => {
        const teamCount = group.teams.length;
        const allResolved = group.records.every((r) => r.fields["状态"] === "已解决");
        const anyResolved = group.records.some((r) => r.fields["状态"] === "已解决");

        return (
          <div
            key={desc}
            className={cn(
              "rounded-xl border p-4 space-y-3 transition-all",
              allResolved
                ? "border-green-200 bg-green-50/30"
                : teamCount >= 2
                ? "border-orange-200 bg-orange-50/20"
                : "border-gray-200 bg-white"
            )}
          >
            {/* 卡点描述 + 优先级 badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1">
                {allResolved ? (
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Clock size={16} className="text-orange-400 mt-0.5 shrink-0" />
                )}
                <p className={cn(
                  "text-sm font-medium flex-1",
                  allResolved ? "text-gray-400 line-through" : "text-gray-800"
                )}>
                  {desc}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 团队数 badge */}
                {teamCount >= 2 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
                    {teamCount} 个团队 · 优先处理
                  </span>
                )}
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  allResolved
                    ? "bg-green-50 text-green-600"
                    : "bg-orange-50 text-orange-600"
                )}>
                  {allResolved ? "已解决" : "待解决"}
                </span>
              </div>
            </div>

            {/* 反馈团队列表 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">反馈团队：</span>
              {group.teams.map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {t}
                </span>
              ))}
            </div>

            {/* 各条记录的状态切换（仅展示操作按钮，不显示冗余内容） */}
            {group.records.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
                <span className="text-xs text-gray-400">状态操作：</span>
                {group.records.map((rec) => {
                  const recTeam = rec.fields["团队名称"] as string;
                  const recStatus = rec.fields["状态"] as string;
                  const isDone = recStatus === "已解决";
                  return (
                    <button
                      key={rec.id}
                      onClick={() => onToggleStatus(rec.id, recStatus)}
                      className={cn(
                        "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all",
                        isDone
                          ? "border-green-200 text-green-600 hover:bg-green-50"
                          : "border-orange-200 text-orange-600 hover:bg-orange-50"
                      )}
                      title={isDone ? `将 ${recTeam} 标记为待解决` : `将 ${recTeam} 标记为已解决`}
                    >
                      {isDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      {recTeam}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 明日目标列表（当前团队置顶） ─────────────────────────────────
function GoalsList({
  goalsByTeam,
  currentTeam,
}: {
  goalsByTeam: Record<string, BitableRecord>;
  currentTeam: string;
}) {
  const allTeams = Object.keys(goalsByTeam);
  // 当前团队置顶，其余按拼音排序
  const sorted = [
    ...allTeams.filter((t) => t === currentTeam),
    ...allTeams.filter((t) => t !== currentTeam).sort((a, b) => a.localeCompare(b, "zh")),
  ];

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
        暂无目标记录
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sorted.map((t) => {
        const rec = goalsByTeam[t];
        const content = rec.fields["目标内容"] as string;
        const isCurrentTeam = t === currentTeam;
        return (
          <div
            key={t}
            className={cn(
              "rounded-xl border p-4 space-y-2 transition-all",
              isCurrentTeam
                ? "border-emerald-300 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-200"
                : "border-gray-200 bg-white hover:border-gray-300"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800">{t}</span>
              {isCurrentTeam && (
                <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                  我的团队
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{content}</p>
          </div>
        );
      })}
    </div>
  );
}
