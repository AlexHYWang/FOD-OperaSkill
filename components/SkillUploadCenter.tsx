"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, CheckCircle2, Download, Loader2, RefreshCw, UploadCloud, X,
} from "lucide-react";
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

interface SkillRecord {
  version: string;
  fileUrl: string;
  fileName: string;
  submittedAt: number;
}

interface Props {
  team: string;
  userName: string;
  readOnly?: boolean;
}

const PROCESS_COLORS: Record<string, { tab: string; active: string }> = {
  ptp: { tab: "hover:text-blue-600 hover:border-blue-400", active: "text-blue-700 border-blue-600 bg-blue-50" },
  otc: { tab: "hover:text-green-600 hover:border-green-400", active: "text-green-700 border-green-600 bg-green-50" },
  rtr: { tab: "hover:text-purple-600 hover:border-purple-400", active: "text-purple-700 border-purple-600 bg-purple-50" },
  pic: { tab: "hover:text-orange-600 hover:border-orange-400", active: "text-orange-700 border-orange-600 bg-orange-50" },
  tax: { tab: "hover:text-red-600 hover:border-red-400", active: "text-red-700 border-red-600 bg-red-50" },
};

function processIdFrom(raw: string, sectionName: string) {
  for (const proc of E2E_PROCESSES) {
    if (raw === proc.shortName || raw === proc.name || raw === proc.id) return proc.id;
    if (proc.sections.some((s) => s.name === sectionName)) return proc.id;
  }
  return "";
}

export function SkillUploadCenter({ team, userName, readOnly = false }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [skillRecordMap, setSkillRecordMap] = useState<Record<string, SkillRecord>>({});
  const [activeProcessId, setActiveProcessId] = useState(E2E_PROCESSES[0].id);
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
        const latestMap: Record<string, SkillRecord> = {};
        for (const rec of r2.records || []) {
          const scene = String(rec.fields["所属场景"] || "");
          const status = String(rec.fields["步骤状态"] || "");
          if (!scene || status !== "已完成") continue;
          const ver = String(rec.fields["版本号"] || "v1.0");
          const ts = Number(rec.fields["提交时间"] || 0);
          const linkField = rec.fields["SKILL文件链接"] as { link?: string; text?: string } | null;
          const fileUrl = linkField?.link || "";
          const fileName = String(rec.fields["SKILL文件名"] || "");
          const prev = latestMap[scene];
          if (!prev || ts > prev.submittedAt) {
            latestMap[scene] = { version: ver, fileUrl, fileName, submittedAt: ts };
          }
        }
        setSkillRecordMap(latestMap);
      }
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => { load(); }, [load]);

  const activeProcess = E2E_PROCESSES.find((p) => p.id === activeProcessId) ?? E2E_PROCESSES[0];

  // 按流程统计 SKILL数/场景总数
  const processStat = useMemo(() => {
    const stat: Record<string, { total: number; uploaded: number }> = {};
    for (const proc of E2E_PROCESSES) {
      stat[proc.id] = { total: 0, uploaded: 0 };
    }
    for (const task of tasks) {
      if (!stat[task.processId]) stat[task.processId] = { total: 0, uploaded: 0 };
      stat[task.processId].total += 1;
      if (skillRecordMap[task.taskName]) stat[task.processId].uploaded += 1;
    }
    return stat;
  }, [tasks, skillRecordMap]);

  // 当前流程按环节→节点分组
  const sectionGroups = useMemo(() => {
    const filtered = tasks.filter((t) => t.processId === activeProcessId);
    const sectionMap = new Map<string, Map<string, TaskItem[]>>();
    for (const task of filtered) {
      const sec = task.sectionName || "其他";
      const node = task.nodeName || "其他";
      if (!sectionMap.has(sec)) sectionMap.set(sec, new Map());
      const nodeMap = sectionMap.get(sec)!;
      if (!nodeMap.has(node)) nodeMap.set(node, []);
      nodeMap.get(node)!.push(task);
    }
    return sectionMap;
  }, [tasks, activeProcessId]);

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
      setSkillRecordMap((prev) => ({
        ...prev,
        [selectedTask.taskName]: {
          version: version || "v1.0",
          fileUrl: file.url,
          fileName: file.file_name,
          submittedAt: Date.now(),
        },
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
    <div className="flex flex-col h-full">
      {/* 流程 Tab 栏 */}
      <div className="bg-white border-b px-4 overflow-x-auto flex-shrink-0">
        <div className="flex items-end gap-0 min-w-max">
          {E2E_PROCESSES.map((proc) => {
            const isActive = proc.id === activeProcessId;
            const colors = PROCESS_COLORS[proc.id] ?? PROCESS_COLORS.ptp;
            const stat = processStat[proc.id] ?? { total: 0, uploaded: 0 };
            return (
              <button
                key={proc.id}
                onClick={() => setActiveProcessId(proc.id)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5",
                  isActive
                    ? `${colors.active} border-b-2`
                    : `text-gray-500 border-transparent ${colors.tab}`
                )}
              >
                <span className="font-bold">{proc.shortName}</span>
                <span className={cn(
                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                  isActive ? "bg-white/60" : "bg-gray-100 text-gray-500"
                )}>
                  {stat.uploaded}/{stat.total}
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center px-3 pb-1">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <RefreshCw size={12} className={cn(loading && "animate-spin")} /> 刷新
            </button>
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">
            <Loader2 className="inline mr-2 animate-spin" size={16} />
            正在加载场景...
          </div>
        ) : sectionGroups.size === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-sm text-gray-500">
            <UploadCloud size={32} className="mx-auto mb-3 opacity-30" />
            当前流程暂无可上传 SKILL 的纯线下场景。
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(sectionGroups.entries()).map(([sectionName, nodeMap]) => (
              <section key={sectionName}>
                {/* 环节标题 */}
                <div className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-purple-400 inline-block" />
                  {sectionName}
                </div>
                <div className="space-y-3">
                  {Array.from(nodeMap.entries()).map(([nodeName, sceneTasks]) => (
                    <div key={nodeName}>
                      {/* 节点子标题 */}
                      <div className="text-xs font-semibold text-gray-500 mb-2 pl-3 border-l-2 border-gray-200">
                        {nodeName}
                      </div>
                      {/* 场景卡片 */}
                      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2 pl-3">
                        {sceneTasks.map((task) => {
                          const record = skillRecordMap[task.taskName];
                          return (
                            <div
                              key={task.taskName}
                              className={cn(
                                "rounded-xl border p-3 transition-all",
                                record
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : "border-gray-200 bg-white hover:border-purple-300"
                              )}
                            >
                              <div className="flex items-start gap-2">
                                <Archive size={15} className={cn("mt-0.5 shrink-0", record ? "text-emerald-500" : "text-purple-400")} />
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 truncate">{task.taskName}</div>
                                  {record ? (
                                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-2 py-0.5 font-semibold">
                                        <CheckCircle2 size={10} /> {record.version}
                                      </span>
                                      {record.fileUrl && (
                                        <a
                                          href={record.fileUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:underline"
                                          title={record.fileName || "下载 SKILL"}
                                        >
                                          <Download size={10} /> 下载
                                        </a>
                                      )}
                                      {!readOnly && (
                                        <button
                                          onClick={() => {
                                            setSelectedTask(task);
                                            setSkillName(task.taskName);
                                            setVersion("v1.0");
                                          }}
                                          className="text-[10px] text-purple-600 hover:underline"
                                        >
                                          重新上传
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    !readOnly && (
                                      <button
                                        onClick={() => {
                                          setSelectedTask(task);
                                          setSkillName(task.taskName);
                                        }}
                                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                                      >
                                        <UploadCloud size={12} /> 上传 SKILL
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* 上传弹窗 */}
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
                  {selectedTask.processName} · {selectedTask.sectionName} · {selectedTask.nodeName}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">SKILL 名称</span>
                  <input value={skillName} onChange={(e) => setSkillName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">版本号</span>
                  <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="如 v1.0" />
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
              <Button variant="outline" onClick={() => { setSelectedTask(null); setFile(null); }}>取消</Button>
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
