"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Target,
  CheckCircle2,
  Clock,
  ArrowRight,
  Tag,
  RefreshCw,
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

function asString(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) {
    return v
      .map((i) =>
        typeof i === "string"
          ? i
          : i && typeof i === "object" && "text" in i
          ? (i as { text?: string }).text || ""
          : ""
      )
      .filter(Boolean)
      .join("");
  }
  if (typeof v === "object") {
    const obj = v as { name?: string; text?: string };
    return obj.name || obj.text || "";
  }
  return String(v);
}

function formatDate(ms?: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

// ─── 关联标签（端到端/环节/节点/场景/步骤） ─────
function BindingTags({ rec }: { rec: BitableRecord }) {
  const e2e = asString(rec.fields["端到端流程"]);
  const section = asString(rec.fields["环节"]);
  const node = asString(rec.fields["节点"]);
  const taskName =
    asString(rec.fields["关联场景名"]) ||
    asString(rec.fields["关联任务名"]) ||
    asString(rec.fields["所属场景"]) ||
    asString(rec.fields["关联任务"]);
  const step = asString(rec.fields["步骤编号"]);
  const stepList = asString(rec.fields["步骤编号列表"]);
  const bindType = asString(rec.fields["关联类型"]);

  const hasAny = e2e || section || node || taskName || step || stepList;
  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {bindType && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
          {bindType}
        </span>
      )}
      {e2e && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
          {e2e}
        </span>
      )}
      {(section || node) && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-600 border border-gray-200">
          {section}
          {section && node && " / "}
          {node}
        </span>
      )}
      {taskName && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 max-w-[200px] truncate">
          场景：{taskName}
        </span>
      )}
      {(step || stepList) && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
          第 {step || stepList} 步
        </span>
      )}
    </div>
  );
}

export function BlockersGoalsSection({ team, isAdmin, user, mode }: Props) {
  const tableNum = mode === "blockers" ? "5" : "6";
  const [records, setRecords] = useState<BitableRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "待解决" | "已解决">("all");
  const router = useRouter();

  const fetchRecords = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ table: tableNum });
    if (!isAdmin && team) params.set("team", team);
    fetch(`/api/bitable/records?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.records)) setRecords(d.records);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [tableNum, team, isAdmin]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

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
    } catch (e) {
      console.error("更新状态失败", e);
    }
  };

  const isBlockers = mode === "blockers";

  // 卡点以 (标题 ?? 描述) 为主键聚合
  const blockerGroups: Record<
    string,
    { teams: string[]; records: BitableRecord[]; hasResolved: boolean }
  > = {};
  if (isBlockers) {
    for (const rec of records) {
      if (statusFilter !== "all" && asString(rec.fields["状态"]) !== statusFilter) continue;
      const desc = asString(rec.fields["卡点标题"]) || asString(rec.fields["卡点描述"]);
      const t = asString(rec.fields["团队名称"]);
      if (!desc) continue;
      if (!blockerGroups[desc])
        blockerGroups[desc] = { teams: [], records: [], hasResolved: false };
      if (!blockerGroups[desc].teams.includes(t))
        blockerGroups[desc].teams.push(t);
      blockerGroups[desc].records.push(rec);
      if (asString(rec.fields["状态"]) === "已解决")
        blockerGroups[desc].hasResolved = true;
    }
  }
  const sortedBlockers = Object.entries(blockerGroups).sort(
    (a, b) => b[1].teams.length - a[1].teams.length
  );

  const goalsSorted = !isBlockers
    ? [...records].sort((a, b) => {
        const at = Number(a.fields["提交日期"]) || Number(a.fields["提交时间"]) || 0;
        const bt = Number(b.fields["提交日期"]) || Number(b.fields["提交时间"]) || 0;
        return bt - at;
      })
    : [];

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
          {!isBlockers && (
            <span className="text-xs text-gray-400">
              ({records.length} 条目标)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
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
          <button
            onClick={fetchRecords}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded transition-colors"
            title="刷新"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* 看板只读说明 + CTA 入口 */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
        <Tag size={14} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          看板只汇总展示。要
          {isBlockers ? "登记卡点" : "登记明日目标"}
          ，请到
          <b className="mx-1">作业中心 · 打磨 Skill</b>
          的具体步骤内填写，会自动带上 场景/步骤 绑定信息。
        </div>
        <button
          onClick={() => router.push("/section2")}
          className="shrink-0 inline-flex items-center gap-1 text-blue-700 font-medium hover:text-blue-900 bg-white border border-blue-300 rounded-lg px-2.5 py-1"
        >
          去作业中心 <ArrowRight size={12} />
        </button>
      </div>

      {!team && !isAdmin && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
          请先在顶部选择您的团队，以查看{isBlockers ? "卡点" : "目标"}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          加载中...
        </div>
      ) : isBlockers ? (
        <BlockersByDesc
          sortedBlockers={sortedBlockers}
          onToggleStatus={handleToggleStatus}
          onGoToHub={() => router.push("/section2")}
        />
      ) : (
        <GoalsList
          records={goalsSorted}
          currentTeam={team}
          onGoToHub={() => router.push("/section2")}
        />
      )}

      {/* 当前用户标识（隐藏但保留接入点） */}
      <span className="hidden">{user?.name}</span>
    </div>
  );
}

// ─── 卡点列表 ─────
function BlockersByDesc({
  sortedBlockers,
  onToggleStatus,
  onGoToHub,
}: {
  sortedBlockers: Array<[string, { teams: string[]; records: BitableRecord[]; hasResolved: boolean }]>;
  onToggleStatus: (recordId: string, status: string) => void;
  onGoToHub: () => void;
}) {
  if (sortedBlockers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 text-center space-y-3">
        <div className="text-sm text-gray-500">暂无卡点记录</div>
        <button
          onClick={onGoToHub}
          className="inline-flex items-center gap-1 text-sm text-blue-700 font-medium hover:text-blue-900 bg-white border border-blue-200 rounded-lg px-3 py-1.5"
        >
          去作业中心 · 打磨 Skill 登记 <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedBlockers.map(([desc, group]) => {
        const teamCount = group.teams.length;
        const allResolved = group.records.every((r) => r.fields["状态"] === "已解决");
        const firstRec = group.records[0];
        const detail = asString(firstRec.fields["卡点详情"]);

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
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                {allResolved ? (
                  <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <Clock size={16} className="text-orange-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      allResolved ? "text-gray-400 line-through" : "text-gray-800"
                    )}
                  >
                    {desc}
                  </p>
                  {detail && (
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
                      {detail}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {teamCount >= 2 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
                    {teamCount} 个团队 · 优先
                  </span>
                )}
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    allResolved
                      ? "bg-green-50 text-green-600"
                      : "bg-orange-50 text-orange-600"
                  )}
                >
                  {allResolved ? "已解决" : "待解决"}
                </span>
              </div>
            </div>

            {/* 绑定信息 */}
            <BindingTags rec={firstRec} />

            {/* 反馈团队列表 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">反馈团队：</span>
              {group.teams.map((t) => (
                <span
                  key={t}
                  className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                >
                  {t}
                </span>
              ))}
            </div>

            {/* 状态切换 */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
              <span className="text-xs text-gray-400">状态操作：</span>
              {group.records.map((rec) => {
                const recTeam = asString(rec.fields["团队名称"]);
                const recStatus = asString(rec.fields["状态"]);
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
                    title={
                      isDone
                        ? `将 ${recTeam} 标记为待解决`
                        : `将 ${recTeam} 标记为已解决`
                    }
                  >
                    {isDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                    {recTeam}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── 明日目标列表 ─────
function GoalsList({
  records,
  currentTeam,
  onGoToHub,
}: {
  records: BitableRecord[];
  currentTeam: string;
  onGoToHub: () => void;
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 py-10 text-center space-y-3">
        <div className="text-sm text-gray-500">暂无目标记录</div>
        <button
          onClick={onGoToHub}
          className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium hover:text-emerald-900 bg-white border border-emerald-200 rounded-lg px-3 py-1.5"
        >
          去作业中心 · 打磨 Skill 登记 <ArrowRight size={13} />
        </button>
      </div>
    );
  }

  // 按绑定类型上色
  const typeTone: Record<string, string> = {
    任务步骤: "border-purple-200 bg-purple-50/40",
    环节节点: "border-blue-200 bg-blue-50/40",
    自由文本: "border-gray-200 bg-white",
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {records.map((rec) => {
        const t = asString(rec.fields["团队名称"]);
        const title =
          asString(rec.fields["目标标题"]) || asString(rec.fields["目标内容"]);
        const ts =
          Number(rec.fields["提交日期"]) || Number(rec.fields["提交时间"]) || 0;
        const bindType = asString(rec.fields["关联类型"]) || "自由文本";
        const isCurrentTeam = t === currentTeam;

        return (
          <div
            key={rec.id}
            className={cn(
              "rounded-xl border p-4 space-y-2 transition-all",
              typeTone[bindType] || "border-gray-200 bg-white",
              isCurrentTeam && "ring-1 ring-emerald-300"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-gray-800">{t}</span>
              <div className="flex items-center gap-1.5">
                {isCurrentTeam && (
                  <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                    我的团队
                  </span>
                )}
                {ts > 0 && (
                  <span className="text-[10px] text-gray-400">{formatDate(ts)}</span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {title}
            </p>
            <BindingTags rec={rec} />
          </div>
        );
      })}
    </div>
  );
}
