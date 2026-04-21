"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Boxes,
  Plus,
  Loader2,
  AlertCircle,
  Users,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  PowerOff,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { E2E_PROCESSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { RoleChip } from "@/components/RoleChip";
import type { FODRole } from "@/lib/roles";

interface SkillItem {
  recordId: string;
  name: string;
  team: string;
  e2e: string;
  stage: string;
  node: string;
  scene: string;
  knowledgeRef: string;
  version: string;
  status: string;
  ownerNames: string[];
  accuracy: number;
  createdAt: number;
  launchedAt: number;
  updatedAt: number;
  remark: string;
}

const STATUS_META: Record<
  string,
  { color: string; icon: React.ReactNode; nextAction?: string; nextLabel?: string }
> = {
  训练中: {
    color: "bg-sky-100 text-sky-700 border-sky-200",
    icon: <Sparkles size={11} />,
    nextAction: "advance-to-eval",
    nextLabel: "进入评测",
  },
  评测中: {
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    icon: <Sparkles size={11} />,
    nextAction: "advance-to-debug",
    nextLabel: "进入生产调试",
  },
  生产调试中: {
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <Sparkles size={11} />,
    nextAction: "release",
    nextLabel: "正式发布",
  },
  已发布: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 size={11} />,
    nextAction: "offline",
    nextLabel: "下线",
  },
  已下线: {
    color: "bg-gray-100 text-gray-500 border-gray-200",
    icon: <PowerOff size={11} />,
  },
};

const ALL_STATUSES = ["训练中", "评测中", "生产调试中", "已发布", "已下线"];

function fmtDate(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function SkillRegistryPage() {
  const { user, team, setTeam, effectiveRole } = useAuth();
  const [activeTab, setActiveTab] = useState<"list" | "members">("list");
  const canManageMembers = effectiveRole === "FOD综管";

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1280px] mx-auto">
        <PageHeader
          icon={<Boxes size={22} />}
          title="Skill 注册中心"
          subtitle="所有 Skill 的全生命周期视图：训练 → 评测 → 生产调试 → 发布 → 下线"
          ownerRole="FOD一线AI管理"
          badges={
            <span className="text-[11px] text-gray-400">
              数据源：Table8（Skill注册表）
            </span>
          }
        />

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b">
          <TabBtn
            active={activeTab === "list"}
            onClick={() => setActiveTab("list")}
            icon={<Boxes size={13} />}
            label="Skill 列表"
          />
          {canManageMembers && (
            <TabBtn
              active={activeTab === "members"}
              onClick={() => setActiveTab("members")}
              icon={<Users size={13} />}
              label="成员管理"
              adminOnly
            />
          )}
        </div>

        {activeTab === "list" && (
          <SkillListTab team={team} effectiveRole={effectiveRole} />
        )}
        {activeTab === "members" && canManageMembers && <MemberManagementTab />}
      </div>
    </AppLayout>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  adminOnly,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  adminOnly?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium flex items-center gap-1.5 border-b-2 -mb-px transition-colors",
        active
          ? "border-orange-500 text-orange-600"
          : "border-transparent text-gray-500 hover:text-gray-800"
      )}
    >
      {icon}
      {label}
      {adminOnly && (
        <span className="text-[9px] bg-purple-50 text-purple-600 border border-purple-200 rounded px-1 py-0">
          仅综管
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────
// Tab 1：Skill 列表
// ─────────────────────────────────────────────────
function SkillListTab({
  team,
  effectiveRole,
}: {
  team: string;
  effectiveRole: FODRole | "";
}) {
  const [items, setItems] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);

  const canAdvance =
    effectiveRole === "FOD一线AI管理" || effectiveRole === "FOD综管";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (team) params.set("team", team);
      if (filter) params.set("status", filter);
      const r = await fetch(`/api/skills?${params.toString()}`);
      const d = await r.json();
      setItems(d?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [team, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const counters = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) map[it.status] = (map[it.status] || 0) + 1;
    return map;
  }, [items]);

  return (
    <div>
      {/* 漏斗式状态筛选 */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
        <FilterChip
          active={!filter}
          onClick={() => setFilter("")}
          label="全部"
          count={items.length}
        />
        {ALL_STATUSES.map((s) => (
          <FilterChip
            key={s}
            active={filter === s}
            onClick={() => setFilter(s)}
            label={s}
            count={counters[s] || 0}
            color={STATUS_META[s]?.color}
          />
        ))}
        <div className="flex-1" />
        <Button
          onClick={() => setShowForm((v) => !v)}
          className="bg-orange-600 hover:bg-orange-700 gap-1 shrink-0"
          size="sm"
        >
          <Plus size={14} /> 注册新 Skill
        </Button>
      </div>

      {showForm && (
        <SkillCreateForm
          team={team}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400 text-sm">
          <Loader2 size={14} className="animate-spin" /> 加载中
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm bg-white rounded-xl border">
          <Boxes size={32} className="mx-auto opacity-30 mb-2" />
          暂无 Skill
          <div className="mt-2 text-[11px]">
            点击右上角「注册新 Skill」开始第一条
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((it) => (
            <SkillCard
              key={it.recordId}
              item={it}
              canAdvance={canAdvance}
              onAfter={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 border",
        active
          ? color || "bg-orange-100 text-orange-700 border-orange-300"
          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
      )}
    >
      {label}
      {count !== undefined && (
        <span className="ml-1 text-[10px] opacity-70">{count}</span>
      )}
    </button>
  );
}

function SkillCard({
  item,
  canAdvance,
  onAfter,
}: {
  item: SkillItem;
  canAdvance: boolean;
  onAfter: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editAcc, setEditAcc] = useState(false);
  const [accInput, setAccInput] = useState(String(item.accuracy || ""));
  const meta = STATUS_META[item.status];

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      await fetch("/api/skills", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: item.recordId,
          currentStatus: item.status,
          action,
          ...extra,
        }),
      });
      onAfter();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-3.5 hover:shadow-sm transition-shadow flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border",
                meta?.color
              )}
            >
              {meta?.icon}
              {item.status}
            </span>
            <span className="text-[10px] text-gray-400">{item.version}</span>
          </div>
          <div className="text-sm font-semibold text-gray-900 truncate">
            {item.name}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {item.team}
            {item.scene && <> · {item.scene}</>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-gray-400">准确率</div>
          {editAcc ? (
            <div className="flex items-center gap-0.5 mt-0.5">
              <input
                type="number"
                value={accInput}
                onChange={(e) => setAccInput(e.target.value)}
                className="w-14 text-xs border rounded px-1 py-0.5"
              />
              <Button
                size="sm"
                className="h-5 px-1 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                onClick={async () => {
                  await act("update-accuracy", { accuracy: Number(accInput) });
                  setEditAcc(false);
                }}
              >
                ✓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 px-1 text-[10px]"
                onClick={() => setEditAcc(false)}
              >
                ×
              </Button>
            </div>
          ) : (
            <button
              onClick={() => canAdvance && setEditAcc(true)}
              className={cn(
                "text-lg font-bold",
                item.accuracy >= 90
                  ? "text-emerald-600"
                  : item.accuracy >= 70
                  ? "text-amber-600"
                  : "text-gray-400",
                canAdvance && "hover:underline decoration-dotted"
              )}
              title={canAdvance ? "点击编辑" : ""}
            >
              {item.accuracy > 0 ? item.accuracy.toFixed(1) : "—"}
              <span className="text-xs font-normal">%</span>
            </button>
          )}
        </div>
      </div>

      {/* 流水线进度 */}
      <LifecyclePipeline current={item.status} />

      {/* 元信息 */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-gray-500 mt-2.5">
        {item.e2e && (
          <div className="truncate">
            流程：<span className="text-gray-700">{item.e2e}</span>
          </div>
        )}
        {item.stage && (
          <div className="truncate">
            环节：<span className="text-gray-700">{item.stage}</span>
          </div>
        )}
        {item.node && (
          <div className="truncate">
            节点：<span className="text-gray-700">{item.node}</span>
          </div>
        )}
        {item.ownerNames.length > 0 && (
          <div className="truncate">
            负责人：
            <span className="text-gray-700">{item.ownerNames.join("、")}</span>
          </div>
        )}
        <div>建：{fmtDate(item.createdAt)}</div>
        {item.launchedAt > 0 && <div>上线：{fmtDate(item.launchedAt)}</div>}
      </div>

      {/* 状态流转 */}
      {canAdvance && (
        <div className="mt-3 pt-2.5 border-t flex items-center gap-1 flex-wrap">
          {meta?.nextAction && (
            <Button
              onClick={() => act(meta.nextAction!)}
              disabled={busy !== null}
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 gap-1 text-[11px] h-7"
            >
              {busy === meta.nextAction ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <ArrowRight size={11} />
              )}
              {meta.nextLabel}
            </Button>
          )}
          {item.status !== "训练中" && item.status !== "已下线" && (
            <Button
              onClick={() => act("revert")}
              disabled={busy !== null}
              size="sm"
              variant="outline"
              className="gap-1 text-[11px] h-7"
            >
              {busy === "revert" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RotateCcw size={11} />
              )}
              回退
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function LifecyclePipeline({ current }: { current: string }) {
  const idx = ALL_STATUSES.indexOf(current);
  return (
    <div className="flex items-center gap-0.5">
      {ALL_STATUSES.map((s, i) => {
        const reached = idx >= i && current !== "已下线";
        const isCurrent = i === idx;
        const isOfflineCurrent = s === current && current === "已下线";
        return (
          <div key={s} className="flex items-center gap-0.5 flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full flex-1 transition-all",
                isOfflineCurrent
                  ? "bg-gray-300"
                  : reached
                  ? "bg-orange-500"
                  : "bg-gray-200",
                isCurrent && !isOfflineCurrent && "bg-orange-600 h-2"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

function SkillCreateForm({
  team,
  onClose,
  onCreated,
}: {
  team: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [e2eId, setE2eId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [scene, setScene] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const e2e = E2E_PROCESSES.find((p) => p.id === e2eId);
  const section = e2e?.sections.find((s) => s.id === sectionId);
  const node = section?.nodes.find((n) => n.id === nodeId);

  const submit = async () => {
    setErr("");
    if (!name.trim()) {
      setErr("Skill 名称不能为空");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          team,
          e2e: e2e?.name || "",
          stage: section?.name || "",
          node: node?.name || "",
          scene,
          version,
          remark,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "创建失败");
      onCreated();
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-gray-800 flex items-center gap-1">
          <Plus size={14} /> 注册新 Skill
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          <X size={12} />
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-gray-500">Skill 名称 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：合同审核母Skill"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">版本号</label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="v1.0"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">端到端流程</label>
          <select
            value={e2eId}
            onChange={(e) => {
              setE2eId(e.target.value);
              setSectionId("");
              setNodeId("");
            }}
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400 bg-white"
          >
            <option value="">—</option>
            {E2E_PROCESSES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500">环节</label>
          <select
            value={sectionId}
            onChange={(e) => {
              setSectionId(e.target.value);
              setNodeId("");
            }}
            disabled={!e2e}
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400 bg-white disabled:bg-gray-50"
          >
            <option value="">—</option>
            {e2e?.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500">节点</label>
          <select
            value={nodeId}
            onChange={(e) => setNodeId(e.target.value)}
            disabled={!section}
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400 bg-white disabled:bg-gray-50"
          >
            <option value="">—</option>
            {section?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-gray-500">关联场景名</label>
          <input
            value={scene}
            onChange={(e) => setScene(e.target.value)}
            placeholder="例：合同审核"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-gray-500">备注</label>
          <input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="可写训练目标 / 应用范围"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
      </div>

      {err && (
        <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle size={12} /> {err}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
          取消
        </Button>
        <Button
          onClick={submit}
          disabled={submitting}
          size="sm"
          className="bg-orange-600 hover:bg-orange-700 gap-1 text-xs"
        >
          {submitting && <Loader2 size={12} className="animate-spin" />}
          注册
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Tab 2：成员管理（仅 FOD综管）
// ─────────────────────────────────────────────────
interface MemberProfile {
  openId: string;
  name?: string;
  team: string;
  roleV4: FODRole | "";
  isTeamLeader: boolean;
  department?: string;
}

function MemberManagementTab() {
  const [grouped, setGrouped] = useState<Record<string, MemberProfile[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/members");
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "加载失败");
      setGrouped(d?.groupedByTeam || {});
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleLeader = async (openId: string, isLeader: boolean) => {
    setBusy(openId);
    try {
      await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openId, isLeader }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const filteredTeams = Object.entries(grouped).filter(([team, list]) => {
    if (!search) return true;
    const s = search.toLowerCase();
    if (team.toLowerCase().includes(s)) return true;
    return list.some((m) => (m.name || "").toLowerCase().includes(s));
  });

  return (
    <div>
      <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 mb-4 flex items-start gap-2 text-xs text-purple-900">
        <Users size={14} className="shrink-0 mt-0.5" />
        <div>
          勾选某人的「团队主管」，此人会自动成为该团队的
          <RoleChip role="FOD一线AI管理" compact />，拥有治理知识库、管理 Skill
          等权限。取消勾选则回落为
          <RoleChip role="FOD一线操作" compact />。
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="按团队名 / 人员名搜索…"
          className="flex-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
        />
        <Button variant="outline" size="sm" onClick={load} className="text-xs">
          刷新
        </Button>
      </div>

      {err && (
        <div className="text-xs text-red-600 mb-2 flex items-center gap-1">
          <AlertCircle size={12} /> {err}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-gray-400 text-sm">
          <Loader2 size={14} className="animate-spin" /> 加载中
        </div>
      ) : filteredTeams.length === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm bg-white rounded-xl border">
          暂无成员数据
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTeams.map(([teamName, members]) => (
            <div key={teamName} className="rounded-xl border bg-white">
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-b bg-gray-50 rounded-t-xl">
                <span className="text-sm font-semibold text-gray-800">
                  {teamName || "未分配团队"}
                </span>
                <span className="text-[11px] text-gray-500">
                  · {members.length} 人
                </span>
                <div className="flex-1" />
                <span className="text-[11px] text-gray-500">
                  主管：
                  <span className="text-gray-800 font-medium">
                    {members.filter((m) => m.isTeamLeader).length}
                  </span>{" "}
                  / {members.length}
                </span>
              </div>
              <div className="divide-y">
                {members.map((m) => (
                  <div
                    key={m.openId}
                    className="flex items-center gap-2 px-3.5 py-2.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate flex items-center gap-1.5">
                        {m.name || "—"}
                        {m.roleV4 && <RoleChip role={m.roleV4} compact />}
                      </div>
                      <div className="text-[10.5px] text-gray-400 truncate">
                        {m.openId}
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={m.isTeamLeader}
                        disabled={busy === m.openId}
                        onChange={(e) =>
                          toggleLeader(m.openId, e.target.checked)
                        }
                        className="accent-orange-600"
                      />
                      <span className="text-gray-700">团队主管</span>
                      {busy === m.openId && (
                        <Loader2 size={11} className="animate-spin text-gray-400" />
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
