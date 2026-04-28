"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Loader2, RefreshCw, UploadCloud, X } from "lucide-react";
import { FileUploader, type UploadedFile } from "@/components/FileUploader";
import { Button } from "@/components/ui/button";
import { E2E_PROCESSES, feishuLabelIsPureManual } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TaskItem {
  taskName: string;
  sectionName: string;
  nodeName: string;
  label: string;
  processId: string;
  processName: string;
  processShortName: string;
}

interface Props {
  team: string;
  userName: string;
  readOnly?: boolean;
}

function processIdFrom(raw: string, sectionName: string) {
  for (const proc of E2E_PROCESSES) {
    if (raw === proc.shortName || raw === proc.name || raw === proc.id) return proc.id;
    if (proc.sections.some((s) => s.name === sectionName)) return proc.id;
  }
  return "";
}

export function SkillUploadCenter({ team, userName, readOnly = false }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [uploadedMap, setUploadedMap] = useState<Record<string, number>>({});
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [skillName, setSkillName] = useState("");
  const [version, setVersion] = useState("v1.0");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`).then((r) => r.json()),
        fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`).then((r) => r.json()),
      ]);
      if (r1.success) {
        const seen = new Set<string>();
        const next: TaskItem[] = [];
        for (const rec of r1.records || []) {
          const taskName = String(rec.fields["场景名称"] || rec.fields["任务名称"] || "");
          const sectionName = String(rec.fields["流程环节"] || "");
          const nodeName = String(rec.fields["流程节点"] || "");
          const label = String(rec.fields["标签"] || "");
          const e2e = String(rec.fields["端到端流程"] || "");
          if (!taskName || seen.has(taskName) || !feishuLabelIsPureManual(label)) continue;
          seen.add(taskName);
          const processId = processIdFrom(e2e, sectionName);
          const processDef = E2E_PROCESSES.find((p) => p.id === processId);
          const processName = processDef?.name || e2e || "未分类流程";
          const processShortName = processDef?.shortName || e2e || "";
          next.push({ taskName, sectionName, nodeName, label, processId, processName, processShortName });
        }
        setTasks(next);
      }
      if (r2.success) {
        const counts: Record<string, number> = {};
        for (const rec of r2.records || []) {
          const scene = String(rec.fields["所属场景"] || "");
          const status = String(rec.fields["步骤状态"] || "");
          if (scene && status === "已完成") {
            counts[scene] = (counts[scene] || 0) + 1;
          }
        }
        setUploadedMap(counts);
      }
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      const key = task.processName || "未分类流程";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return Array.from(map.entries());
  }, [tasks]);

  const submit = async () => {
    if (!selectedTask || !file || readOnly) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "2",
          fields: {
            团队名称: team,
            所属场景: selectedTask.taskName,
            SKILL名称: skillName || selectedTask.taskName,
            SKILL文件名: file.file_name,
            SKILL文件链接: { link: file.url, text: file.file_name },
            SKILL文件Token: file.file_token,
            版本号: version || "v1.0",
            端到端流程: selectedTask.processShortName,
            流程环节: selectedTask.sectionName,
            流程节点: selectedTask.nodeName,
            步骤状态: "已完成",
          },
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "提交失败");
      setUploadedMap((prev) => ({
        ...prev,
        [selectedTask.taskName]: (prev[selectedTask.taskName] || 0) + 1,
      }));
      setSelectedTask(null);
      setFile(null);
      setSkillName("");
      setVersion("v1.0");
    } catch (err) {
      alert(`SKILL 上传记录保存失败：${err}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!team) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">请先在顶部选择团队。</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          仅展示标记为「★ 纯线下」的场景。选择场景后上传一个训练好的 SKILL ZIP 包。
        </div>
        <button onClick={load} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
          <RefreshCw size={13} className={cn(loading && "animate-spin")} /> 刷新
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">
          <Loader2 className="inline mr-2 animate-spin" size={16} />
          正在加载场景...
        </div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
          当前团队暂无可上传 SKILL 的纯线下场景。
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([group, items]) => (
            <section key={group} className="rounded-2xl border bg-white overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-700">{group}</div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 p-3">
                {items.map((task) => (
                  <button
                    key={task.taskName}
                    onClick={() => {
                      setSelectedTask(task);
                      setSkillName(task.taskName);
                    }}
                    className="text-left rounded-xl border border-gray-200 bg-white p-3 hover:border-purple-300 hover:bg-purple-50/40 transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <Archive size={16} className="text-purple-500 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-gray-900 truncate">{task.taskName}</div>
                        <div className="text-[11px] text-gray-500 mt-1 truncate">
                          {task.sectionName} / {task.nodeName}
                        </div>
                      </div>
                      {uploadedMap[task.taskName] ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">
                          <CheckCircle2 size={10} /> {uploadedMap[task.taskName]}
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center gap-3">
              <UploadCloud size={18} className="text-purple-600" />
              <div className="font-semibold text-gray-900">上传 SKILL ZIP</div>
              <div className="flex-1" />
              <button onClick={() => setSelectedTask(null)} className="p-1 text-gray-500 hover:text-gray-800">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl border bg-gray-50 p-3 text-sm">
                <div className="font-semibold text-gray-900">{selectedTask.taskName}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {selectedTask.processName} / {selectedTask.sectionName} / {selectedTask.nodeName}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">SKILL 名称</span>
                  <input value={skillName} onChange={(e) => setSkillName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">版本号</span>
                  <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
              </div>
              <FileUploader
                label="SKILL ZIP 包"
                hint="只允许上传 1 个 .zip 文件，大小不超过 200MB"
                accept=".zip,application/zip"
                purpose="skill"
                maxSizeMB={200}
                uploaded={file}
                onUpload={setFile}
                disabled={readOnly}
                required
              />
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t flex items-center gap-2">
              <span className="text-xs text-gray-400">提交人：{userName}</span>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setSelectedTask(null)}>取消</Button>
              <Button onClick={submit} disabled={!file || submitting || readOnly} className="bg-purple-600 hover:bg-purple-700">
                {submitting ? "保存中..." : "绑定到场景"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
