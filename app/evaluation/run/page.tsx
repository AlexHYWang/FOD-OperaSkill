"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PlayCircle,
  Plus,
  ExternalLink,
  Loader2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

interface Run {
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

interface Dataset {
  recordId: string;
  name: string;
  skillName: string;
  itemCount: number;
  team: string;
}

export default function EvaluationRunPage() {
  const { user, team, setTeam, profile } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (team) params.set("team", team);
      const [r1, r2] = await Promise.all([
        fetch(`/api/evaluation/runs?${params}`).then((r) => r.json()),
        fetch(`/api/evaluation/datasets?${params}`).then((r) => r.json()),
      ]);
      if (r1.success) setRuns(r1.items || []);
      if (r2.success) setDatasets(r2.items || []);
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    load();
  }, [load]);

  const avg =
    runs.length > 0
      ? runs.reduce((s, r) => s + r.accuracy, 0) / runs.length
      : 0;

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={<PlayCircle size={22} />}
          title="评测执行"
          subtitle="针对已有评测集批量运行 Skill，记录正确率。财务训练阶段由一线操作主导；生产级阶段由 IT 产品介入复评。"
          ownerRole="FOD一线操作"
          actions={
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
            >
              <Plus size={14} /> 新增评测记录
            </Button>
          }
          badges={
            <span className="text-[11px] text-gray-400">
              共 {runs.length} 次 · 团队：{team || "全部"}
            </span>
          }
        />

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <MetricCard
            title="总评测次数"
            value={String(runs.length)}
            accent="blue"
          />
          <MetricCard
            title="平均准确率"
            value={runs.length ? `${avg.toFixed(1)}%` : "—"}
            accent="emerald"
          />
          <MetricCard
            title="可用评测集"
            value={String(datasets.length)}
            accent="purple"
          />
        </div>

        {showForm && (
          <RunForm
            team={profile.team || team}
            datasets={datasets}
            onCancel={() => setShowForm(false)}
            onSubmitted={() => {
              setShowForm(false);
              load();
            }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={16} className="animate-spin" /> 加载评测记录…
          </div>
        ) : runs.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-16 text-center text-gray-400 text-sm">
            <PlayCircle size={32} className="mx-auto mb-2 opacity-40" />
            暂无评测记录，点击右上角「新增评测记录」开始录入
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <RunRow key={r.recordId} r={r} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: "blue" | "emerald" | "purple";
}) {
  const tone: Record<string, string> = {
    blue: "from-blue-50 to-blue-100 text-blue-700 border-blue-200",
    emerald: "from-emerald-50 to-emerald-100 text-emerald-700 border-emerald-200",
    purple: "from-purple-50 to-purple-100 text-purple-700 border-purple-200",
  };
  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br px-4 py-3",
        tone[accent]
      )}
    >
      <div className="text-[11px] font-medium opacity-80">{title}</div>
      <div className="text-2xl font-black mt-0.5">{value}</div>
    </div>
  );
}

function RunRow({ r }: { r: Run }) {
  const when = r.evaluatedAt
    ? new Date(r.evaluatedAt).toLocaleString("zh-CN")
    : "";
  const pass = r.accuracy >= 90;
  return (
    <div className="rounded-xl border bg-white p-3 flex items-center gap-3 flex-wrap">
      <div className="flex-shrink-0 w-16 text-center">
        <div
          className={cn(
            "text-xl font-black",
            pass ? "text-emerald-600" : "text-amber-600"
          )}
        >
          {r.accuracy.toFixed(1)}%
        </div>
        <div
          className={cn(
            "text-[10px] inline-flex items-center gap-0.5",
            pass ? "text-emerald-600" : "text-amber-600"
          )}
        >
          {pass ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {pass ? "达标" : "待提升"}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-[13px] font-semibold text-gray-900">
            {r.skillName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
            {r.stage}
          </span>
          <span className="text-[10px] text-gray-400">{when}</span>
        </div>
        <div className="text-[11px] text-gray-500">
          评测集：{r.datasetName} · 正确 {r.correct} · 错误 {r.wrong} ·
          评测人：{r.evaluatorNames.join("、") || "—"}
        </div>
        {r.remark && (
          <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
            {r.remark}
          </div>
        )}
      </div>
      {r.reportUrl && (
        <a
          href={r.reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] inline-flex items-center gap-0.5 text-blue-600 hover:underline"
        >
          报告 <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}

function RunForm({
  team,
  datasets,
  onCancel,
  onSubmitted,
}: {
  team: string;
  datasets: Dataset[];
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [skillName, setSkillName] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [correct, setCorrect] = useState("0");
  const [wrong, setWrong] = useState("0");
  const [stage, setStage] = useState("财务训练");
  const [reportUrl, setReportUrl] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const total = (Number(correct) || 0) + (Number(wrong) || 0);
  const acc = total > 0 ? ((Number(correct) || 0) / total) * 100 : 0;

  const submit = async () => {
    if (!skillName.trim() || !datasetName.trim()) {
      alert("Skill 与评测集不能为空");
      return;
    }
    if (total <= 0) {
      alert("正确数 + 错误数 至少要有 1 题");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/evaluation/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: skillName.trim(),
          datasetName: datasetName.trim(),
          team,
          correct: Number(correct) || 0,
          wrong: Number(wrong) || 0,
          stage,
          reportUrl: reportUrl.trim(),
          remark: remark.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        alert(d.error || "保存失败");
        return;
      }
      onSubmitted();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-purple-50/40 border-purple-200 p-4 mb-4">
      <div className="text-sm font-semibold text-purple-900 mb-3">
        新增评测记录
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="关联 Skill *">
          <input
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="例：合同审核母 Skill"
            className={inputCls}
          />
        </Field>
        <Field label="关联评测集 *">
          <input
            value={datasetName}
            onChange={(e) => setDatasetName(e.target.value)}
            placeholder="例：合同审核 Skill · 基础评测集"
            list="evaluation-datasets"
            className={inputCls}
          />
          <datalist id="evaluation-datasets">
            {datasets.map((d) => (
              <option key={d.recordId} value={d.name} />
            ))}
          </datalist>
        </Field>
        <Field label="正确数">
          <input
            type="number"
            min={0}
            value={correct}
            onChange={(e) => setCorrect(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="错误数">
          <input
            type="number"
            min={0}
            value={wrong}
            onChange={(e) => setWrong(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="评测阶段">
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className={inputCls}
          >
            <option value="财务训练">财务训练</option>
            <option value="IT训练">IT训练</option>
            <option value="生产级">生产级</option>
          </select>
        </Field>
        <Field label="计算准确率">
          <div
            className={cn(
              "w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm bg-gray-50 font-semibold",
              acc >= 90 ? "text-emerald-600" : "text-amber-600"
            )}
          >
            {total > 0 ? `${acc.toFixed(1)}%（共 ${total} 题）` : "— "}
          </div>
        </Field>
        <div className="md:col-span-2">
          <Field label="报告链接">
            <input
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="备注">
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={2}
              className={cn(inputCls, "resize-none")}
            />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button
          onClick={submit}
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700"
        >
          {saving ? "提交中…" : "提交记录"}
        </Button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
