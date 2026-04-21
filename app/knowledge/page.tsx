"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Loader2,
  Plus,
  ExternalLink,
  Check,
  Archive,
  Undo2,
  Rocket,
  Filter as FilterIcon,
  X,
  Calendar,
  Tag as TagIcon,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";
import { E2E_PROCESSES } from "@/lib/constants";

interface KnowledgeItem {
  recordId: string;
  title: string;
  team: string;
  process: string;
  section: string;
  node: string;
  scene: string;
  fileUrl: string;
  extractorNames: string[];
  governorNames: string[];
  consolidatorNames: string[];
  status: "已提取" | "治理中" | "已整合" | "已发布" | "已归档" | "";
  version: string;
  isCurrent: boolean;
  extractedAt: number;
  governedAt: number;
  consolidatedAt: number;
  updatedAt: number;
  remark: string;
}

type TabKey = "new" | "pending" | "published" | "history";

const TAB_DEFS: Array<{ key: TabKey; label: string; desc: string }> = [
  { key: "new", label: "新建/提取", desc: "一线录入素材 · 编辑中" },
  { key: "pending", label: "待审核", desc: "AI 管 / 综管 审核发布" },
  { key: "published", label: "已发布", desc: "当前生效版本" },
  { key: "history", label: "版本历史", desc: "所有历史版本" },
];

export default function KnowledgePage() {
  return (
    <Suspense fallback={<FallbackLoading />}>
      <KnowledgePageInner />
    </Suspense>
  );
}

function FallbackLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-600" />
    </div>
  );
}

function KnowledgePageInner() {
  const { user, team, setTeam, isLoggedIn, loading: authLoading, effectiveRole } =
    useAuth();
  const sp = useSearchParams();

  // URL 预填参数（Skill-Forge Step1 跳转过来）
  const presetNew = sp?.get("new") === "1";
  const presetProcess = sp?.get("process") || "";
  const presetSection = sp?.get("section") || "";
  const presetNode = sp?.get("node") || "";
  const presetScene = sp?.get("scene") || "";

  const [tab, setTab] = useState<TabKey>(presetNew ? "new" : "pending");
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(presetNew);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    team: "",
    process: "",
    section: "",
    node: "",
    scene: "",
    submitter: "",
  });

  const isLeaderOrAdmin =
    effectiveRole === "FOD一线AI管理" || effectiveRole === "FOD综管";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.team) params.set("team", filters.team);
      if (filters.process) params.set("process", filters.process);
      if (filters.section) params.set("section", filters.section);
      if (filters.node) params.set("node", filters.node);
      if (filters.scene) params.set("scene", filters.scene);
      if (filters.submitter) params.set("submitter", filters.submitter);
      const r = await fetch(`/api/knowledge?${params.toString()}`, {
        cache: "no-store",
      });
      const d = await r.json();
      setItems(Array.isArray(d?.items) ? (d.items as KnowledgeItem[]) : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredByTab = useMemo(() => {
    switch (tab) {
      case "new":
        return items.filter((it) => it.status === "已提取");
      case "pending":
        return items.filter(
          (it) => it.status === "治理中" || it.status === "已整合"
        );
      case "published":
        return items.filter((it) => it.status === "已发布" && it.isCurrent);
      case "history":
        return items.filter(
          (it) => it.status === "已发布" || it.status === "已归档"
        );
    }
  }, [items, tab]);

  const summary = useMemo(() => {
    const all = items;
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonthAdded = all.filter(
      (it) => it.extractedAt >= monthStart.getTime()
    ).length;
    const pending = all.filter(
      (it) => it.status === "治理中" || it.status === "已整合"
    ).length;
    const published = all.filter((it) => it.status === "已发布" && it.isCurrent)
      .length;
    const teamMap = new Map<string, number>();
    for (const it of all) {
      if (!it.team) continue;
      teamMap.set(it.team, (teamMap.get(it.team) || 0) + 1);
    }
    const topTeam = Array.from(teamMap.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      thisMonthAdded,
      pending,
      published,
      teamCount: teamMap.size,
      topTeam,
      _now: now,
    };
  }, [items]);

  const handleAction = async (
    id: string,
    action: "govern" | "consolidate" | "publish" | "archive" | "revert-to-extracted",
    extra?: Record<string, unknown>
  ) => {
    const r = await fetch("/api/knowledge", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordId: id, action, ...(extra || {}) }),
    });
    if (r.ok) load();
    else alert("操作失败");
  };

  if (authLoading) return <FallbackLoading />;
  if (!isLoggedIn) {
    return (
      <div className="p-10 text-sm text-gray-500">请先登录以使用知识库管理中心。</div>
    );
  }

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader
          title="知识库管理中心"
          subtitle="一线录入 · 主管审核 · 综管发布 · 版本化管理"
          icon={<BookOpen size={18} />}
        />

        {/* 汇总看板 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            title="本月新增"
            value={summary.thisMonthAdded}
            hint="一线录入条目数"
            tone="blue"
          />
          <SummaryCard
            title="待审核"
            value={summary.pending}
            hint="待主管 / 综管 推进"
            tone="amber"
          />
          <SummaryCard
            title="当前已发布"
            value={summary.published}
            hint="对 Skill 打磨生效"
            tone="emerald"
          />
          <SummaryCard
            title="涉及团队"
            value={summary.teamCount}
            hint={summary.topTeam ? `top: ${summary.topTeam[0]} (${summary.topTeam[1]})` : "—"}
            tone="purple"
          />
        </section>

        {/* 顶栏：筛选按钮 + 新建 */}
        <section className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
              filterOpen || Object.values(filters).some(Boolean)
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
            )}
          >
            <FilterIcon size={13} />
            筛选
            {Object.values(filters).some(Boolean) && (
              <span className="ml-1 px-1 rounded bg-blue-100 text-[10px]">
                {Object.values(filters).filter(Boolean).length}
              </span>
            )}
          </button>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700 gap-1"
          >
            <Plus size={14} /> 新增条目
          </Button>
        </section>

        {filterOpen && (
          <FilterBar
            values={filters}
            onChange={(f) => setFilters(f)}
            onClose={() => setFilterOpen(false)}
          />
        )}

        {/* Tabs */}
        <section className="bg-white rounded-2xl border overflow-hidden">
          <div className="flex border-b">
            {TAB_DEFS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex-1 px-3 py-2.5 text-sm font-medium transition-colors border-b-2",
                  tab === t.key
                    ? "border-blue-600 text-blue-700 bg-blue-50/40"
                    : "border-transparent text-gray-600 hover:bg-gray-50"
                )}
              >
                <div>{t.label}</div>
                <div className="text-[10.5px] text-gray-400 font-normal">
                  {t.desc}
                </div>
              </button>
            ))}
          </div>

          <div className="p-3 md:p-4">
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">
                <Loader2 className="inline animate-spin mr-2" size={14} />
                加载中…
              </div>
            ) : filteredByTab.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                暂无条目
              </div>
            ) : (
              <div className="space-y-2">
                {filteredByTab.map((it) => (
                  <KnowledgeRow
                    key={it.recordId}
                    item={it}
                    isLeaderOrAdmin={isLeaderOrAdmin}
                    onAction={handleAction}
                    activeTab={tab}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {showForm && (
          <NewEntryModal
            onClose={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              load();
            }}
            preset={{
              process: presetProcess,
              section: presetSection,
              node: presetNode,
              scene: presetScene,
              team,
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: number | string;
  hint: string;
  tone: "blue" | "amber" | "emerald" | "purple";
}) {
  const map = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    purple: "bg-purple-50 border-purple-100 text-purple-700",
  };
  return (
    <div className={cn("rounded-xl border p-3", map[tone])}>
      <div className="text-[11px] font-medium opacity-75">{title}</div>
      <div className="text-2xl font-black mt-0.5">{value}</div>
      <div className="text-[10px] opacity-70 mt-0.5 truncate">{hint}</div>
    </div>
  );
}

function FilterBar({
  values,
  onChange,
  onClose,
}: {
  values: {
    team: string;
    process: string;
    section: string;
    node: string;
    scene: string;
    submitter: string;
  };
  onChange: (v: typeof values) => void;
  onClose: () => void;
}) {
  const proc = E2E_PROCESSES.find((p) => p.name === values.process);
  const sec = proc?.sections.find((s) => s.name === values.section);
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-blue-800">
          按 E2E 流程 / 环节 / 节点 / 场景筛选
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select
          value={values.process}
          onChange={(e) =>
            onChange({
              ...values,
              process: e.target.value,
              section: "",
              node: "",
            })
          }
          className="rounded border px-2 py-1 text-xs"
        >
          <option value="">E2E 流程 · 全部</option>
          {E2E_PROCESSES.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={values.section}
          onChange={(e) =>
            onChange({ ...values, section: e.target.value, node: "" })
          }
          disabled={!proc}
          className="rounded border px-2 py-1 text-xs disabled:bg-gray-100"
        >
          <option value="">环节 · 全部</option>
          {proc?.sections.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={values.node}
          onChange={(e) => onChange({ ...values, node: e.target.value })}
          disabled={!sec}
          className="rounded border px-2 py-1 text-xs disabled:bg-gray-100"
        >
          <option value="">节点 · 全部</option>
          {sec?.nodes.map((n) => (
            <option key={n.id} value={n.name}>
              {n.name}
            </option>
          ))}
        </select>
        <input
          value={values.scene}
          onChange={(e) => onChange({ ...values, scene: e.target.value })}
          placeholder="场景名包含…"
          className="rounded border px-2 py-1 text-xs"
        />
        <input
          value={values.team}
          onChange={(e) => onChange({ ...values, team: e.target.value })}
          placeholder="团队"
          className="rounded border px-2 py-1 text-xs"
        />
        <input
          value={values.submitter}
          onChange={(e) => onChange({ ...values, submitter: e.target.value })}
          placeholder="提交人（含昵称）"
          className="rounded border px-2 py-1 text-xs"
        />
        <button
          onClick={() =>
            onChange({
              team: "",
              process: "",
              section: "",
              node: "",
              scene: "",
              submitter: "",
            })
          }
          className="rounded border bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 col-span-2 md:col-span-1"
        >
          清空筛选
        </button>
      </div>
    </section>
  );
}

function KnowledgeRow({
  item,
  isLeaderOrAdmin,
  onAction,
  activeTab,
}: {
  item: KnowledgeItem;
  isLeaderOrAdmin: boolean;
  onAction: (
    id: string,
    action: "govern" | "consolidate" | "publish" | "archive" | "revert-to-extracted",
    extra?: Record<string, unknown>
  ) => void;
  activeTab: TabKey;
}) {
  const statusTone: Record<string, string> = {
    已提取: "bg-gray-100 text-gray-700",
    治理中: "bg-amber-100 text-amber-700",
    已整合: "bg-blue-100 text-blue-700",
    已发布: "bg-emerald-100 text-emerald-700",
    已归档: "bg-gray-200 text-gray-500 line-through",
  };
  const bumpedVersion = incrVersion(item.version);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-300 transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[10.5px] font-semibold",
            statusTone[item.status] || "bg-gray-100 text-gray-600"
          )}
        >
          {item.status || "未知"}
        </span>
        {item.isCurrent && (
          <span className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-600 text-white">
            当前版本
          </span>
        )}
        <span className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-600">
          {item.version || "v1.0"}
        </span>
        <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
          {item.title || "（未命名条目）"}
        </span>
        <span className="text-[10.5px] text-gray-400">
          {item.team} · 更新 {formatTime(item.updatedAt)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600">
        {item.process && (
          <ScopeChip icon={<TagIcon size={10} />} label={`E2E: ${item.process}`} />
        )}
        {item.section && <ScopeChip label={`环节: ${item.section}`} />}
        {item.node && <ScopeChip label={`节点: ${item.node}`} />}
        {item.scene && <ScopeChip label={`场景: ${item.scene}`} />}
        {item.extractorNames.length > 0 && (
          <ScopeChip label={`提交: ${item.extractorNames.join(",")}`} />
        )}
        {item.governorNames.length > 0 && (
          <ScopeChip label={`审核: ${item.governorNames.join(",")}`} />
        )}
      </div>

      {item.remark && (
        <div className="mt-2 text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1 border border-gray-100">
          {item.remark}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {item.fileUrl && (
          <a
            href={item.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
          >
            <ExternalLink size={11} /> 查看原文件
          </a>
        )}
        <div className="flex-1" />
        {activeTab !== "history" && (
          <>
            {isLeaderOrAdmin && item.status === "已提取" && (
              <button
                onClick={() => onAction(item.recordId, "govern")}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 text-[11px] hover:bg-amber-100"
              >
                <Check size={11} /> 开始审核
              </button>
            )}
            {isLeaderOrAdmin &&
              (item.status === "治理中" || item.status === "已整合") && (
                <button
                  onClick={() =>
                    onAction(item.recordId, "publish", {
                      version: bumpedVersion,
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                >
                  <Rocket size={11} /> 发布 {bumpedVersion}
                </button>
              )}
            {isLeaderOrAdmin && item.status === "已提取" && (
              <button
                onClick={() => onAction(item.recordId, "archive")}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-600 text-[11px] hover:bg-gray-50"
              >
                <Archive size={11} /> 归档
              </button>
            )}
            {isLeaderOrAdmin &&
              (item.status === "治理中" || item.status === "已整合") && (
                <button
                  onClick={() => onAction(item.recordId, "revert-to-extracted")}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-600 text-[11px] hover:bg-gray-50"
                >
                  <Undo2 size={11} /> 退回
                </button>
              )}
          </>
        )}
      </div>
    </div>
  );
}

function ScopeChip({
  icon,
  label,
}: {
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200 text-[10.5px] text-gray-600">
      {icon}
      {label}
    </span>
  );
}

function formatTime(ts: number): string {
  if (!ts) return "-";
  const d = new Date(ts);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

function incrVersion(v: string): string {
  const m = /^v(\d+)\.(\d+)$/.exec(v || "");
  if (!m) return "v1.0";
  return `v${m[1]}.${Number(m[2]) + 1}`;
}

function NewEntryModal({
  onClose,
  onCreated,
  preset,
}: {
  onClose: () => void;
  onCreated: () => void;
  preset: {
    process: string;
    section: string;
    node: string;
    scene: string;
    team: string;
  };
}) {
  const [title, setTitle] = useState("");
  const [team, setTeamVal] = useState(preset.team || "");
  const [process, setProcess] = useState(preset.process || "");
  const [section, setSection] = useState(preset.section || "");
  const [node, setNode] = useState(preset.node || "");
  const [scene, setScene] = useState(preset.scene || "");
  const [fileUrl, setFileUrl] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const proc = E2E_PROCESSES.find((p) => p.name === process);
  const sec = proc?.sections.find((s) => s.name === section);

  const scopeSummary = useMemo(() => {
    if (scene) return `场景颗粒度 · ${scene}`;
    if (node) return `节点颗粒度 · ${node}`;
    if (section) return `环节颗粒度 · ${section}`;
    if (process) return `流程颗粒度 · ${process}`;
    return "请至少选择一个 E2E 流程";
  }, [process, section, node, scene]);

  const canSubmit = !!title.trim() && !!process;

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const r = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          team,
          process,
          section,
          node,
          scene,
          fileUrl,
          remark,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(`提交失败：${d?.error || r.status}`);
        return;
      }
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-5 py-3 border-b flex items-center">
          <div className="font-semibold text-gray-900">新增知识库条目</div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="条目标题" required>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：发票校验 · 三单匹配要点"
            />
          </Field>
          <Field label="所属团队">
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={team}
              onChange={(e) => setTeamVal(e.target.value)}
              placeholder="如：AP 团队"
            />
          </Field>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs font-semibold text-amber-800 mb-2">
              颗粒度绑定（E2E 流程必填，环节 / 节点 / 场景任选）
            </div>
            <div className="text-[11px] text-amber-700 mb-2">
              <Calendar size={10} className="inline mr-1" />
              {scopeSummary}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                value={process}
                onChange={(e) => {
                  setProcess(e.target.value);
                  setSection("");
                  setNode("");
                }}
                className="rounded border px-2 py-1.5 text-sm"
              >
                <option value="">E2E 流程 · 必填</option>
                {E2E_PROCESSES.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={section}
                onChange={(e) => {
                  setSection(e.target.value);
                  setNode("");
                }}
                disabled={!proc}
                className="rounded border px-2 py-1.5 text-sm disabled:bg-gray-100"
              >
                <option value="">环节 · 任选</option>
                {proc?.sections.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={node}
                onChange={(e) => setNode(e.target.value)}
                disabled={!sec}
                className="rounded border px-2 py-1.5 text-sm disabled:bg-gray-100"
              >
                <option value="">节点 · 任选</option>
                {sec?.nodes.map((n) => (
                  <option key={n.id} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
              <input
                value={scene}
                onChange={(e) => setScene(e.target.value)}
                placeholder="关联场景名 · 任选"
                className="rounded border px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <Field label="文件链接">
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="如：飞书云文档 URL / OSS 链接"
            />
          </Field>
          <Field label="备注">
            <textarea
              rows={3}
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="补充说明，如适用场景、注意事项"
            />
          </Field>
        </div>
        <div className="px-5 py-3 border-t flex items-center gap-2 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border text-sm text-gray-600 hover:bg-gray-100"
          >
            取消
          </button>
          <div className="flex-1" />
          <Button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-1" size={14} />
                提交中
              </>
            ) : (
              "提交到审核"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {children}
    </div>
  );
}
