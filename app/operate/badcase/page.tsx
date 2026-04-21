"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Flag,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Recycle,
  Wrench,
  Ban,
  FileText,
  Clock,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

interface BadcaseItem {
  recordId: string;
  title: string;
  skillName: string;
  team: string;
  caseDesc: string;
  expected: string;
  actual: string;
  reporterNames: string[];
  reportedAt: number;
  status: string;
  knowledgeRef: string;
  handlerNames: string[];
  handledAt: number;
  remark: string;
}

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "待分析", label: "待分析" },
  { key: "已入知识库", label: "已入知识库" },
  { key: "已修复", label: "已修复" },
  { key: "不受理", label: "不受理" },
];

function fmt(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(
    2,
    "0"
  )}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function BadcasePage() {
  const { user, team, setTeam, effectiveRole } = useAuth();
  const sp = useSearchParams();
  const preSkill = sp.get("skill") || "";

  const [items, setItems] = useState<BadcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(Boolean(preSkill));

  const canHandle =
    effectiveRole === "FOD一线AI管理" || effectiveRole === "FOD综管";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (team) params.set("team", team);
      if (statusFilter) params.set("status", statusFilter);
      const r = await fetch(`/api/badcase?${params.toString()}`);
      const d = await r.json();
      setItems(d?.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [team, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const counters = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of items) {
      map[it.status] = (map[it.status] || 0) + 1;
    }
    return map;
  }, [items]);

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1280px] mx-auto">
        <PageHeader
          icon={<Flag size={22} />}
          title="Badcase 反馈"
          subtitle="Skill 运行效果不佳？在这里提交 Badcase。FOD 一线AI管理可以把 Badcase 回流到知识库，形成闭环。"
          ownerRole="FOD一线操作"
          actions={
            <Button
              onClick={() => setShowForm((v) => !v)}
              className="bg-orange-600 hover:bg-orange-700 gap-1"
              size="sm"
            >
              <Plus size={14} /> 新建 Badcase
            </Button>
          }
          badges={
            <span className="text-[11px] text-gray-400">
              数据源：Table11（Badcase反馈）
            </span>
          }
        />

        {showForm && (
          <BadcaseForm
            defaultSkill={preSkill}
            defaultTeam={team || ""}
            onClose={() => setShowForm(false)}
            onSubmitted={() => {
              setShowForm(false);
              load();
            }}
          />
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                statusFilter === t.key
                  ? "bg-orange-100 text-orange-700 border-orange-300"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {t.label}
              {t.key && counters[t.key] !== undefined && (
                <span className="ml-1 text-[10px] opacity-70">
                  {counters[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-gray-400 text-sm">
            <Loader2 size={14} className="animate-spin" /> 加载中
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm bg-white rounded-xl border">
            <Flag size={32} className="mx-auto opacity-30 mb-2" />
            暂无 Badcase 记录
            <div className="mt-2 text-[11px]">
              Skill 跑出来的结果不对？点击右上角「新建 Badcase」
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <BadcaseRow
                key={it.recordId}
                item={it}
                canHandle={canHandle}
                onAfter={load}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ─── 子组件：新建表单 ───────────────────────────
function BadcaseForm({
  defaultSkill,
  defaultTeam,
  onClose,
  onSubmitted,
}: {
  defaultSkill: string;
  defaultTeam: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [title, setTitle] = useState("");
  const [skillName, setSkillName] = useState(defaultSkill);
  const [caseDesc, setCaseDesc] = useState("");
  const [expected, setExpected] = useState("");
  const [actual, setActual] = useState("");
  const [remark, setRemark] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!title.trim()) {
      setErr("请填写 Badcase 标题");
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/badcase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          skillName,
          team: defaultTeam,
          caseDesc,
          expected,
          actual,
          remark,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || "提交失败");
      onSubmitted();
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
          <Plus size={14} /> 提交 Badcase
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
          取消
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-gray-500">
            Badcase 标题 *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：发票金额识别错误"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">关联 Skill</label>
          <input
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="例：合同审核母Skill"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-gray-500">用例描述</label>
          <textarea
            value={caseDesc}
            onChange={(e) => setCaseDesc(e.target.value)}
            rows={2}
            placeholder="输入了什么？触发了什么场景？"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">期望结果</label>
          <textarea
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            rows={2}
            placeholder="应当输出什么？"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div>
          <label className="text-[11px] text-gray-500">实际结果</label>
          <textarea
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            rows={2}
            placeholder="Skill 实际输出了什么？"
            className="w-full mt-1 text-sm border rounded px-2.5 py-1.5 focus:outline-none focus:border-orange-400"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[11px] text-gray-500">备注</label>
          <input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="可附录：截图链接、飞书云文档链接等"
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
          提交
        </Button>
      </div>
    </div>
  );
}

// ─── 子组件：行 ───────────────────────────────
function BadcaseRow({
  item,
  canHandle,
  onAfter,
}: {
  item: BadcaseItem;
  canHandle: boolean;
  onAfter: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (action: "recycle-to-knowledge" | "fix" | "reject") => {
    setBusy(action);
    try {
      await fetch("/api/badcase", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: item.recordId,
          action,
          title: item.title,
          team: item.team,
          skillName: item.skillName,
        }),
      });
      onAfter();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border bg-white p-3.5 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <StatusIcon status={item.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-sm font-semibold text-gray-900 hover:text-orange-600 text-left truncate"
            >
              {item.title}
            </button>
            <StatusBadge status={item.status} />
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {item.skillName && (
              <span className="inline-flex items-center gap-0.5">
                <FileText size={10} /> {item.skillName}
              </span>
            )}
            {item.team && <span>· {item.team}</span>}
            <span className="inline-flex items-center gap-0.5">
              <Clock size={10} /> {fmt(item.reportedAt)}
            </span>
            {item.reporterNames.length > 0 && (
              <span>· 提交人 {item.reporterNames.join("、")}</span>
            )}
          </div>

          {expanded && (
            <div className="mt-2.5 grid md:grid-cols-3 gap-2 text-xs">
              <DetailBox label="用例描述" content={item.caseDesc} />
              <DetailBox label="期望结果" content={item.expected} />
              <DetailBox label="实际结果" content={item.actual} />
              {item.remark && (
                <DetailBox label="备注" content={item.remark} full />
              )}
              {item.knowledgeRef && (
                <div className="md:col-span-3 text-[11px] text-emerald-700 bg-emerald-50 rounded border border-emerald-200 px-2 py-1.5">
                  已回流知识库条目：{item.knowledgeRef}
                </div>
              )}
              {item.handlerNames.length > 0 && (
                <div className="md:col-span-3 text-[11px] text-gray-500">
                  处理：{item.handlerNames.join("、")} · {fmt(item.handledAt)}
                </div>
              )}
            </div>
          )}
        </div>

        {canHandle && item.status === "待分析" && (
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              onClick={() => act("recycle-to-knowledge")}
              disabled={busy !== null}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 gap-1 text-[11px] h-7"
            >
              {busy === "recycle-to-knowledge" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Recycle size={11} />
              )}
              回流知识库
            </Button>
            <Button
              onClick={() => act("fix")}
              disabled={busy !== null}
              size="sm"
              variant="outline"
              className="gap-1 text-[11px] h-7"
            >
              {busy === "fix" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Wrench size={11} />
              )}
              已修复
            </Button>
            <Button
              onClick={() => act("reject")}
              disabled={busy !== null}
              size="sm"
              variant="ghost"
              className="gap-1 text-[11px] h-7 text-gray-500"
            >
              {busy === "reject" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Ban size={11} />
              )}
              不受理
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailBox({
  label,
  content,
  full,
}: {
  label: string;
  content: string;
  full?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg bg-gray-50 border border-gray-100 p-2",
        full && "md:col-span-3"
      )}
    >
      <div className="text-[10px] font-semibold text-gray-500 mb-0.5">
        {label}
      </div>
      <div className="text-[11.5px] text-gray-700 whitespace-pre-wrap leading-relaxed">
        {content || <span className="text-gray-300">未填写</span>}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "已入知识库")
    return <CheckCircle2 size={18} className="text-emerald-500 mt-0.5" />;
  if (status === "已修复")
    return <CheckCircle2 size={18} className="text-blue-500 mt-0.5" />;
  if (status === "不受理")
    return <XCircle size={18} className="text-gray-400 mt-0.5" />;
  return <AlertCircle size={18} className="text-amber-500 mt-0.5" />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    待分析: "bg-amber-50 text-amber-700 border-amber-200",
    已入知识库: "bg-emerald-50 text-emerald-700 border-emerald-200",
    已修复: "bg-blue-50 text-blue-700 border-blue-200",
    不受理: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border",
        map[status] || "bg-gray-50 text-gray-600 border-gray-200"
      )}
    >
      {status}
    </span>
  );
}
