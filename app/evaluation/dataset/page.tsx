"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FlaskConical,
  Plus,
  ExternalLink,
  Loader2,
  Package,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

interface Dataset {
  recordId: string;
  name: string;
  team: string;
  skillName: string;
  itemCount: number;
  fileUrl: string;
  uploaderNames: string[];
  uploadedAt: number;
  version: string;
  status: string;
  remark: string;
}

export default function EvaluationDatasetPage() {
  const { user, team, setTeam, profile } = useAuth();
  const [items, setItems] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (team) params.set("team", team);
      const r = await fetch(`/api/evaluation/datasets?${params}`);
      const d = await r.json();
      if (d.success) setItems(d.items || []);
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppLayout team={team} onTeamChange={setTeam} user={user}>
      <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
        <PageHeader
          icon={<FlaskConical size={22} />}
          title="评测集管理"
          subtitle="上传与维护评测题库 · 每个 Skill 可对应 1~N 个评测集版本，用于训练阶段和生产阶段的准确率评估。"
          ownerRole="FOD一线操作"
          actions={
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
            >
              <Plus size={14} /> 新增评测集
            </Button>
          }
          badges={
            <span className="text-[11px] text-gray-400">
              共 {items.length} 个 · 团队：{team || "全部"}
            </span>
          }
        />

        {showForm && (
          <DatasetForm
            team={profile.team || team}
            onCancel={() => setShowForm(false)}
            onSubmitted={() => {
              setShowForm(false);
              load();
            }}
          />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
            <Loader2 size={16} className="animate-spin" /> 加载评测集…
          </div>
        ) : items.length === 0 ? (
          <div className="border-2 border-dashed rounded-xl p-16 text-center text-gray-400 text-sm">
            <Package size={32} className="mx-auto mb-2 opacity-40" />
            暂无评测集，点击右上角「新增评测集」开始上传
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {items.map((d) => (
              <DatasetCard key={d.recordId} d={d} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    草稿: "bg-gray-50 text-gray-600 border-gray-200",
    可用: "bg-emerald-50 text-emerald-700 border-emerald-200",
    已归档: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border",
        map[status] || "bg-gray-50 text-gray-500 border-gray-200"
      )}
    >
      {status}
    </span>
  );
}

function DatasetCard({ d }: { d: Dataset }) {
  const when = d.uploadedAt
    ? new Date(d.uploadedAt).toLocaleDateString("zh-CN")
    : "";
  return (
    <div className="rounded-xl border bg-white p-3.5 hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <StatusPill status={d.status} />
        <div className="text-[14px] font-semibold text-gray-900 truncate">
          {d.name}
        </div>
        <span className="text-[10px] text-gray-400">{d.version}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="bg-purple-50 rounded px-2 py-1.5">
          <div className="text-[10px] text-purple-600">关联 Skill</div>
          <div className="text-xs font-medium text-purple-900 truncate">
            {d.skillName || "—"}
          </div>
        </div>
        <div className="bg-blue-50 rounded px-2 py-1.5">
          <div className="text-[10px] text-blue-600">题目数</div>
          <div className="text-sm font-bold text-blue-900">{d.itemCount}</div>
        </div>
        <div className="bg-gray-50 rounded px-2 py-1.5">
          <div className="text-[10px] text-gray-500">团队</div>
          <div className="text-xs text-gray-700 truncate">{d.team || "—"}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
        <span>上传：{d.uploaderNames.join("、") || "—"}</span>
        <span>·</span>
        <span>{when}</span>
        {d.fileUrl && (
          <a
            href={d.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 text-blue-600 hover:underline"
          >
            文件 <ExternalLink size={10} />
          </a>
        )}
      </div>
      {d.remark && (
        <div className="mt-1 pt-1 border-t text-[11px] text-gray-500 line-clamp-2">
          {d.remark}
        </div>
      )}
    </div>
  );
}

function DatasetForm({
  team,
  onCancel,
  onSubmitted,
}: {
  team: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [name, setName] = useState("");
  const [skillName, setSkillName] = useState("");
  const [itemCount, setItemCount] = useState("50");
  const [fileUrl, setFileUrl] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      alert("评测集名称不能为空");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/evaluation/datasets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          team,
          skillName: skillName.trim(),
          itemCount: Number(itemCount) || 0,
          fileUrl: fileUrl.trim(),
          version: version.trim(),
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
        新增评测集
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <Field label="评测集名称 *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例：合同审核 Skill · 基础评测集"
            className={inputCls}
          />
        </Field>
        <Field label="关联 Skill">
          <input
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="例：合同审核母 Skill"
            className={inputCls}
          />
        </Field>
        <Field label="题目数">
          <input
            type="number"
            min={0}
            value={itemCount}
            onChange={(e) => setItemCount(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="版本">
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="文件链接（飞书云文档 / 附件 URL）">
            <input
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
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
          {saving ? "提交中…" : "提交评测集"}
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
