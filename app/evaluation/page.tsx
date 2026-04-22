"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlaskConical,
  Loader2,
  Plus,
  ExternalLink,
  Radio,
  Check,
  X,
  Image as ImageIcon,
  FileJson,
  Target,
  CheckCircle2,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

interface Snapshot {
  recordId: string;
  name: string;
  team: string;
  skillName: string;
  scene: string;
  itemCount: number;
  source: string;
  systemName: string;
  systemDesc: string;
  screenshotUrl: string;
  inputPayload: string;
  outputPayload: string;
  fileUrl: string;
  uploaderNames: string[];
  uploadedAt: number;
  snapshotAt: number;
  version: string;
  status: string;
  remark: string;
}

interface Answer {
  recordId: string;
  snapshotId: string;
  snapshotName: string;
  skillName: string;
  title: string;
  answerText: string;
  fileUrl: string;
  authorNames: string[];
  answeredAt: number;
  isAdopted: boolean;
  remark: string;
}

interface RunItem {
  recordId: string;
  skillName: string;
  datasetName: string;
  team: string;
  accuracy: number;
  correct: number;
  wrong: number;
  stage: string;
  evaluatorNames: string[];
  evaluatedAt: number;
  reportUrl: string;
  remark: string;
}

type TabKey = "snapshots" | "answers" | "runs";

export default function EvaluationPage() {
  const { user, team, setTeam, isLoggedIn, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<TabKey>("snapshots");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewSnapshot, setShowNewSnapshot] = useState(false);
  const [activeSnapshotId, setActiveSnapshotId] = useState<string>("");
  const [showNewAnswer, setShowNewAnswer] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, ar, rr] = await Promise.all([
        fetch("/api/evaluation/datasets", { cache: "no-store" }).then((r) =>
          r.json()
        ),
        fetch("/api/evaluation/answers", { cache: "no-store" }).then((r) =>
          r.json()
        ),
        fetch("/api/evaluation/runs", { cache: "no-store" }).then((r) =>
          r.json()
        ),
      ]);
      setSnapshots(Array.isArray(sr?.items) ? sr.items : []);
      setAnswers(Array.isArray(ar?.items) ? ar.items : []);
      setRuns(Array.isArray(rr?.items) ? rr.items : []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeSnapshot = useMemo(
    () => snapshots.find((s) => s.recordId === activeSnapshotId) || null,
    [snapshots, activeSnapshotId]
  );

  const summary = useMemo(() => {
    const totalSnap = snapshots.length;
    const totalAns = answers.length;
    const adoptedAns = answers.filter((a) => a.isAdopted).length;
    const paired = snapshots.filter((s) =>
      answers.some((a) => a.snapshotId === s.recordId && a.isAdopted)
    ).length;
    const pairingRate =
      totalSnap > 0 ? Math.round((paired / totalSnap) * 1000) / 10 : 0;
    return { totalSnap, totalAns, adoptedAns, paired, pairingRate };
  }, [snapshots, answers]);

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" />
      </div>
    );
  if (!isLoggedIn)
    return (
      <div className="p-10 text-sm text-gray-500">请先登录以使用评测集管理。</div>
    );

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        <PageHeader title="评测集管理" icon={<FlaskConical size={18} />} />

        {/* 汇总看板 */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryCard
            title="评测数据源"
            value={summary.totalSnap}
            hint="线上 MCP / 离线上传"
            tone="blue"
            icon={<Radio size={14} />}
          />
          <SummaryCard
            title="人工答案"
            value={summary.totalAns}
            hint={`已采纳 ${summary.adoptedAns}`}
            tone="amber"
            icon={<Users size={14} />}
          />
          <SummaryCard
            title="完整评测用例"
            value={summary.paired}
            hint="数据源 + 已采纳答案"
            tone="emerald"
            icon={<Target size={14} />}
          />
          <SummaryCard
            title="配对覆盖率"
            value={`${summary.pairingRate}%`}
            hint="已配对 / 总数据源"
            tone="purple"
            icon={<CheckCircle2 size={14} />}
          />
        </section>

        {/* Tabs */}
        <section className="bg-white rounded-2xl border overflow-hidden">
          <div className="flex border-b">
            <TabButton
              active={tab === "snapshots"}
              label="数据源"
              desc="离线上传 + 线上 MCP（演示）"
              onClick={() => setTab("snapshots")}
            />
            <TabButton
              active={tab === "answers"}
              label="标准答案（人工）"
              desc="同一数据源可多条 · 采纳 1 条"
              onClick={() => setTab("answers")}
            />
            <TabButton
              active={tab === "runs"}
              label="评测记录"
              desc="Skill × 评测用例 · 历史跑批"
              onClick={() => setTab("runs")}
            />
          </div>

          <div className="p-3 md:p-4">
            {loading && (
              <div className="py-8 text-center text-sm text-gray-400">
                <Loader2 className="inline animate-spin mr-1" size={14} />
                加载中…
              </div>
            )}

            {!loading && tab === "snapshots" && (
              <SnapshotPane
                snapshots={snapshots}
                answers={answers}
                onNew={() => setShowNewSnapshot(true)}
                onPickAnswer={(snapshotId) => {
                  setActiveSnapshotId(snapshotId);
                  setTab("answers");
                }}
                onAddAnswer={(snapshotId) => {
                  setActiveSnapshotId(snapshotId);
                  setShowNewAnswer(true);
                }}
              />
            )}
            {!loading && tab === "answers" && (
              <AnswerPane
                answers={answers}
                snapshots={snapshots}
                activeSnapshotId={activeSnapshotId}
                setActiveSnapshotId={setActiveSnapshotId}
                activeSnapshot={activeSnapshot}
                onNew={() => setShowNewAnswer(true)}
                onAction={async (id, action) => {
                  const r = await fetch("/api/evaluation/answers", {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ recordId: id, action }),
                  });
                  if (r.ok) load();
                }}
              />
            )}
            {!loading && tab === "runs" && <RunsPane runs={runs} />}
          </div>
        </section>

        {showNewSnapshot && (
          <NewSnapshotModal
            defaultTeam={team}
            onClose={() => setShowNewSnapshot(false)}
            onCreated={() => {
              setShowNewSnapshot(false);
              load();
            }}
          />
        )}
        {showNewAnswer && (
          <NewAnswerModal
            snapshots={snapshots}
            defaultSnapshotId={activeSnapshotId}
            onClose={() => setShowNewAnswer(false)}
            onCreated={() => {
              setShowNewAnswer(false);
              load();
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}

function TabButton({
  active,
  label,
  desc,
  onClick,
}: {
  active: boolean;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 px-3 py-2.5 text-sm font-medium transition-colors border-b-2",
        active
          ? "border-blue-600 text-blue-700 bg-blue-50/40"
          : "border-transparent text-gray-600 hover:bg-gray-50"
      )}
    >
      <div>{label}</div>
      <div className="text-[10.5px] text-gray-400 font-normal">{desc}</div>
    </button>
  );
}

function SummaryCard({
  title,
  value,
  hint,
  tone,
  icon,
}: {
  title: string;
  value: number | string;
  hint: string;
  tone: "blue" | "amber" | "emerald" | "purple";
  icon?: React.ReactNode;
}) {
  const map = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    amber: "bg-amber-50 border-amber-100 text-amber-700",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-700",
    purple: "bg-purple-50 border-purple-100 text-purple-700",
  };
  return (
    <div className={cn("rounded-xl border p-3", map[tone])}>
      <div className="flex items-center gap-1 text-[11px] font-medium opacity-75">
        {icon}
        {title}
      </div>
      <div className="text-2xl font-black mt-0.5">{value}</div>
      <div className="text-[10px] opacity-70 mt-0.5 truncate">{hint}</div>
    </div>
  );
}

function SnapshotPane({
  snapshots,
  answers,
  onNew,
  onPickAnswer,
  onAddAnswer,
}: {
  snapshots: Snapshot[];
  answers: Answer[];
  onNew: () => void;
  onPickAnswer: (snapshotId: string) => void;
  onAddAnswer: (snapshotId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-gray-500">
          固定「查询条件 + 系统返回结果」便于复现评测；标准答案在下一 Tab 绑定。
        </div>
        <Button
          size="sm"
          onClick={onNew}
          className="bg-blue-600 hover:bg-blue-700 gap-1"
        >
          <Plus size={14} /> 新建数据源
        </Button>
      </div>
      {snapshots.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          暂无评测数据源，点击「新建」或先在弹窗内做「线上 MCP 抽样」
        </div>
      ) : (
        <div className="space-y-2">
          {snapshots.map((s) => {
            const relatedAns = answers.filter(
              (a) => a.snapshotId === s.recordId
            );
            const adopted = relatedAns.find((a) => a.isAdopted);
            return (
              <div
                key={s.recordId}
                className="rounded-xl border bg-white p-3 hover:border-gray-300 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  {s.source && (
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10.5px] font-semibold",
                        s.source === "MCP线上抽样"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {s.source}
                    </span>
                  )}
                  {s.systemName && (
                    <span className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-indigo-100 text-indigo-700">
                      {s.systemName}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
                    {s.name}
                  </span>
                  <span className="text-[10.5px] text-gray-400">
                    {s.team} · {formatTime(s.uploadedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-600 mb-1.5">
                  {s.skillName && <Chip label={`绑定 Skill: ${s.skillName}`} />}
                  {s.scene && <Chip label={`场景: ${s.scene}`} />}
                  {s.itemCount > 0 && <Chip label={`样本 ${s.itemCount} 条`} />}
                  {s.version && <Chip label={s.version} />}
                  <Chip
                    tone={adopted ? "emerald" : "gray"}
                    label={
                      adopted
                        ? `已采纳答案：${adopted.title}`
                        : `答案 ${relatedAns.length} / 未采纳`
                    }
                  />
                </div>
                {s.systemDesc && (
                  <div className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1 border border-gray-100 mb-1.5">
                    {s.systemDesc}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {s.screenshotUrl && (
                    <a
                      href={s.screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      <ImageIcon size={11} /> 来源截图
                    </a>
                  )}
                  {s.fileUrl && (
                    <a
                      href={s.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      <ExternalLink size={11} /> 原文件
                    </a>
                  )}
                  {(s.inputPayload || s.outputPayload) && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                      <FileJson size={11} /> 已固定查询与返回
                    </span>
                  )}
                  <div className="flex-1" />
                  <button
                    onClick={() => onAddAnswer(s.recordId)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-200 bg-amber-50 text-amber-700 text-[11px] hover:bg-amber-100"
                  >
                    <Plus size={11} /> 追加答案
                  </button>
                  <button
                    onClick={() => onPickAnswer(s.recordId)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-600 text-[11px] hover:bg-gray-50"
                  >
                    查看答案 ({relatedAns.length})
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnswerPane({
  answers,
  snapshots,
  activeSnapshotId,
  setActiveSnapshotId,
  activeSnapshot,
  onNew,
  onAction,
}: {
  answers: Answer[];
  snapshots: Snapshot[];
  activeSnapshotId: string;
  setActiveSnapshotId: (id: string) => void;
  activeSnapshot: Snapshot | null;
  onNew: () => void;
  onAction: (id: string, action: "adopt" | "unadopt") => void;
}) {
  const list = activeSnapshotId
    ? answers.filter((a) => a.snapshotId === activeSnapshotId)
    : answers;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={activeSnapshotId}
          onChange={(e) => setActiveSnapshotId(e.target.value)}
          className="rounded border px-2 py-1 text-xs min-w-[180px]"
        >
          <option value="">全部数据源</option>
          {snapshots.map((s) => (
            <option key={s.recordId} value={s.recordId}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="text-[11px] text-gray-500">
          {activeSnapshot
            ? `当前数据源：${activeSnapshot.name} · 绑定 ${activeSnapshot.skillName || "—"}`
            : `共 ${list.length} 条答案`}
        </div>
        <div className="flex-1" />
        <Button
          size="sm"
          onClick={onNew}
          className="bg-blue-600 hover:bg-blue-700 gap-1"
        >
          <Plus size={14} /> 新增答案
        </Button>
      </div>
      {list.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">
          该数据源下还没有标准答案
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((a) => (
            <div
              key={a.recordId}
              className={cn(
                "rounded-xl border bg-white p-3",
                a.isAdopted
                  ? "border-emerald-300 ring-1 ring-emerald-200"
                  : "border-gray-200"
              )}
            >
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                {a.isAdopted && (
                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-600 text-white">
                    采纳标准
                  </span>
                )}
                <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
                  {a.title}
                </span>
                <span className="text-[10.5px] text-gray-400">
                  {a.authorNames.join(",") || "—"} · {formatTime(a.answeredAt)}
                </span>
              </div>
              {a.snapshotName && (
                <div className="text-[11px] text-gray-600 mb-1">
                  关联数据源：{a.snapshotName}
                  {a.skillName && <span className="ml-2">· Skill: {a.skillName}</span>}
                </div>
              )}
              {a.answerText && (
                <div className="text-[11.5px] text-gray-800 bg-gray-50 rounded px-2 py-1.5 border border-gray-100 whitespace-pre-wrap">
                  {a.answerText}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                {a.fileUrl && (
                  <a
                    href={a.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                  >
                    <ExternalLink size={11} /> 附件
                  </a>
                )}
                <div className="flex-1" />
                {a.isAdopted ? (
                  <button
                    onClick={() => onAction(a.recordId, "unadopt")}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-gray-600 text-[11px] hover:bg-gray-50"
                  >
                    <X size={11} /> 取消采纳
                  </button>
                ) : (
                  <button
                    onClick={() => onAction(a.recordId, "adopt")}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px]"
                  >
                    <Check size={11} /> 采纳为标准
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RunsPane({ runs }: { runs: RunItem[] }) {
  if (runs.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        暂无评测记录，Skill 打磨过程中会自动沉淀
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {runs.map((r) => (
        <div
          key={r.recordId}
          className="rounded-xl border bg-white p-3"
        >
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-700">
              {r.stage}
            </span>
            <span className="text-sm font-semibold text-gray-900 flex-1 min-w-0 truncate">
              {r.skillName} × {r.datasetName}
            </span>
            <span
              className={cn(
                "text-sm font-black",
                r.accuracy >= 95
                  ? "text-emerald-600"
                  : r.accuracy >= 80
                  ? "text-amber-600"
                  : "text-red-600"
              )}
            >
              {r.accuracy}%
            </span>
          </div>
          <div className="flex gap-x-3 text-[11px] text-gray-600">
            <span>正确 {r.correct}</span>
            <span>错误 {r.wrong}</span>
            <span>{r.team}</span>
            <span>{r.evaluatorNames.join(",") || "—"}</span>
            <span>{formatTime(r.evaluatedAt)}</span>
          </div>
          {r.reportUrl && (
            <a
              href={r.reportUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 mt-1"
            >
              <ExternalLink size={11} /> 报告
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function Chip({
  label,
  tone = "gray",
}: {
  label: string;
  tone?: "gray" | "emerald";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
      : "bg-gray-50 border-gray-200 text-gray-600";
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10.5px]",
        cls
      )}
    >
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

function NewSnapshotModal({
  defaultTeam,
  onClose,
  onCreated,
}: {
  defaultTeam: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [teamVal, setTeamVal] = useState(defaultTeam || "");
  const [skillName, setSkillName] = useState("");
  const [scene, setScene] = useState("");
  const [source, setSource] = useState<"MCP线上抽样" | "离线上传">("离线上传");
  const [systemName, setSystemName] = useState("SAP");
  const [systemDesc, setSystemDesc] = useState("");
  const [inputPayload, setInputPayload] = useState("");
  const [outputPayload, setOutputPayload] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [itemCount, setItemCount] = useState(0);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [snapshotAt, setSnapshotAt] = useState(0);

  const doSample = async () => {
    setSampling(true);
    try {
      const r = await fetch(
        `/api/evaluation/mcp-sample?system=${encodeURIComponent(systemName)}&scene=${encodeURIComponent(scene)}`,
        { cache: "no-store" }
      );
      const d = await r.json();
      if (d?.snapshot) {
        const s = d.snapshot;
        setSource("MCP线上抽样");
        setSystemName(s.systemName);
        setSystemDesc(s.systemDesc);
        setScreenshotUrl(s.screenshotUrl);
        setInputPayload(s.inputPayload);
        setOutputPayload(s.outputPayload);
        setSnapshotAt(s.snapshotAt);
        setItemCount(s.itemCount);
        if (!name) {
          const dt = new Date(s.snapshotAt);
          setName(
            `${s.systemName} · ${scene || "演示场景"} · ${dt.getMonth() + 1}月抽样`
          );
        }
      }
    } finally {
      setSampling(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/evaluation/datasets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          team: teamVal,
          skillName,
          scene,
          itemCount,
          source,
          systemName,
          systemDesc,
          inputPayload,
          outputPayload,
          screenshotUrl,
          fileUrl,
          snapshotAt: snapshotAt || Date.now(),
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="px-5 py-3 border-b flex items-center">
          <div className="font-semibold text-gray-900">新建评测数据源</div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
            <div className="text-xs font-semibold text-sky-800 mb-2">
              来源类型
            </div>
            <div className="flex gap-2 mb-2">
              {(["离线上传", "MCP线上抽样"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSource(s)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs border font-medium",
                    source === s
                      ? "bg-sky-600 border-sky-600 text-white"
                      : "bg-white border-gray-300 text-gray-600"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {source === "MCP线上抽样" && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <div className="text-[10.5px] text-sky-800 mb-0.5">来源系统</div>
                  <select
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="SAP">SAP</option>
                    <option value="U8">用友 U8</option>
                    <option value="OA">OA</option>
                  </select>
                </div>
                <Button
                  size="sm"
                  disabled={sampling}
                  onClick={doSample}
                  className="bg-sky-600 hover:bg-sky-700 gap-1"
                >
                  {sampling ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <Radio size={14} />
                  )}
                  {sampling ? "抽样中" : "一键抽样（演示态）"}
                </Button>
                <div className="text-[10.5px] text-sky-700">
                  Mock 会预填系统描述 / 输入载荷 / 返回结果 / 截图
                </div>
              </div>
            )}
          </div>

          <Field label="数据源名称" required>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：SAP · 发票校验 · 4 月抽样"
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Field label="所属团队">
              <input
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={teamVal}
                onChange={(e) => setTeamVal(e.target.value)}
              />
            </Field>
            <Field label="绑定 Skill">
              <input
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="如：发票三单匹配 v1"
              />
            </Field>
            <Field label="关联场景名">
              <input
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={scene}
                onChange={(e) => setScene(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Field label="来源系统描述">
              <input
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={systemDesc}
                onChange={(e) => setSystemDesc(e.target.value)}
                placeholder="如：SAP MIRO 模块 · 本月挂账发票查询"
              />
            </Field>
            <Field label="样本数">
              <input
                type="number"
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={itemCount}
                onChange={(e) => setItemCount(Number(e.target.value))}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Field label="截图链接（演示态）">
              <input
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                placeholder="https://..."
              />
              {screenshotUrl && (
                <div className="mt-1 relative rounded border overflow-hidden bg-gray-50 h-24">
                  {/* 允许外部图；placehold.co 等占位域名在 Next config 之外时用原生 img */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshotUrl}
                    alt="数据源预览"
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
            </Field>
            <Field label="原文件链接">
              <input
                className="w-full rounded border px-2 py-1.5 text-sm"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="飞书云文档 / OSS 链接"
              />
            </Field>
          </div>
          <Field label="输入载荷（JSON）">
            <textarea
              rows={4}
              className="w-full rounded border px-2 py-1.5 text-xs font-mono"
              value={inputPayload}
              onChange={(e) => setInputPayload(e.target.value)}
              placeholder='{"module":"MIRO","period":"2026-04"}'
            />
          </Field>
          <Field label="返回结果（JSON）">
            <textarea
              rows={5}
              className="w-full rounded border px-2 py-1.5 text-xs font-mono"
              value={outputPayload}
              onChange={(e) => setOutputPayload(e.target.value)}
              placeholder='{"total":12,"sample":[...]}'
            />
          </Field>
          <Field label="备注">
            <textarea
              rows={2}
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
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
            disabled={!name.trim() || saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-1" size={14} />
                提交中
              </>
            ) : (
              "保存数据源"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewAnswerModal({
  snapshots,
  defaultSnapshotId,
  onClose,
  onCreated,
}: {
  snapshots: Snapshot[];
  defaultSnapshotId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [snapshotId, setSnapshotId] = useState(defaultSnapshotId || "");
  const [title, setTitle] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const snapshot = snapshots.find((s) => s.recordId === snapshotId) || null;

  const submit = async () => {
    if (!snapshotId || !title.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/evaluation/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          snapshotName: snapshot?.name || "",
          skillName: snapshot?.skillName || "",
          title,
          answerText,
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
          <div className="font-semibold text-gray-900">新增人工标准答案</div>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-800"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="绑定评测数据源" required>
            <select
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              className="w-full rounded border px-2 py-1.5 text-sm"
            >
              <option value="">请选择…</option>
              {snapshots.map((s) => (
                <option key={s.recordId} value={s.recordId}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          {snapshot && (
            <div className="rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-600">
              {snapshot.systemDesc || snapshot.skillName || snapshot.team}
            </div>
          )}
          <Field label="答案标题" required>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如：AP 主管审定版 / 初稿 v1"
            />
          </Field>
          <Field label="答案正文">
            <textarea
              rows={6}
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="基于该数据源的标准处理结论：结构化字段/结论/建议…"
            />
          </Field>
          <Field label="附件">
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="飞书云文档 / OSS 链接"
            />
          </Field>
          <Field label="备注">
            <textarea
              rows={2}
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
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
            disabled={!snapshotId || !title.trim() || saving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-1" size={14} />
                提交中
              </>
            ) : (
              "提交答案"
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
