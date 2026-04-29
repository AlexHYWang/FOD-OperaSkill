"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  ArrowRight,
  X,
  AlertTriangle,
  Tag,
  Lock,
  Trash2,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUploader, type UploadedFile } from "@/components/FileUploader";
import { cn } from "@/lib/utils";
import {
  TASK_LABELS,
  parseTaskLabelFromFeishu,
  parseParadigmsFromFeishu,
  paradigmIdsToFeishuFieldValue,
  TABLE1_FIELD_PARADIGM,
  PARADIGM_DEFS,
  type TaskLabel,
  type E2EProcess,
  type ProcessSection,
  type ProcessNode,
  type ParadigmId,
} from "@/lib/constants";

interface TaskRow {
  id: string;
  taskName: string;
  label: TaskLabel | "";
  /** 与 Table1「归属范式」多选一致；老数据可为空 */
  paradigms: ParadigmId[];
  saved: boolean;
  recordId?: string;
  submittedAt?: number;
}

interface NodeMappingGridProps {
  team: string;
  userName: string;
  process: E2EProcess;
  onlyManual: boolean;
  onlyHasTasks: boolean;
  readOnly?: boolean;
  onStatsChange?: (stats: {
    totalTasks: number;
    totalNodes: number;
    visibleTasks: number;
    visibleNodes: number;
  }) => void;
}

type ProgressMap = Record<string, number>;

interface DupAlert {
  nodeId: string;
  nodeName: string;
  sectionName: string;
  duplicates: { taskName: string; submittedAt?: number }[];
  newOnes: TaskRow[];
  bulkLabel?: TaskLabel | "";
  bulkParadigms?: ParadigmId[];
  isBatch: boolean;
}

interface AddTaskState {
  nodeId: string;
  nodeName: string;
  sectionName: string;
  taskName: string;
  label: TaskLabel | "";
  paradigms: ParadigmId[];
  saving: boolean;
}

interface BatchState {
  nodeId: string;
  sectionName: string;
  nodeName: string;
  text: string;
  step: "input" | "label";
  tempTasks: string[];
  bulkLabel: TaskLabel | "";
  bulkParadigms: ParadigmId[];
}

interface DeleteTarget {
  recordId: string;
  taskName: string;
  hasSubmission: boolean;
}

interface DeleteConfirm {
  targets: DeleteTarget[];
  stage: 1 | 2; // 1=初次确认 2=二次"真的删除？"
  blocked: boolean; // 若 true 则对普通用户禁用，仅展示阻断信息
  blockedCount: number; // 被阻断的场景数（普通用户视角）
  deleting: boolean;
  error?: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function formatTs(ms?: number): string {
  if (!ms) return "未知时间";
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NodeMappingGrid({
  team,
  userName,
  process,
  onlyManual,
  onlyHasTasks,
  readOnly = false,
  onStatsChange,
}: NodeMappingGridProps) {
  const [nodeTasksMap, setNodeTasksMap] = useState<Record<string, TaskRow[]>>({});
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [milestoneMap, setMilestoneMap] = useState<Record<string, [boolean, boolean, boolean, boolean]>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "success" | "error" | null>>({});
  const [loading, setLoading] = useState(false);

  const [addState, setAddState] = useState<AddTaskState | null>(null);
  const [batchState, setBatchState] = useState<BatchState | null>(null);
  const [dupAlert, setDupAlert] = useState<DupAlert | null>(null);

  // 多选 recordId 集合；仅在 !readOnly 时启用
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applyingBulk, setApplyingBulk] = useState(false);
  const [paradigmBulkOpen, setParadigmBulkOpen] = useState(false);
  const [paradigmBulkSelection, setParadigmBulkSelection] = useState<ParadigmId[]>([]);
  const [postSaveHint, setPostSaveHint] = useState<{ nodeId: string; count: number } | null>(null);

  // 哪些场景已经在 Table2 里有任何一条提交（用来决定是否允许普通用户删除）
  const [tasksWithSubmissions, setTasksWithSubmissions] = useState<Set<string>>(
    new Set()
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  const router = useRouter();
  const batchTextRef = useRef<HTMLTextAreaElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  // 场景卡片内嵌 SKILL 上传弹窗
  const [skillDialogTask, setSkillDialogTask] = useState<{
    taskName: string; sectionName: string; nodeName: string; processName: string; processShortName: string;
  } | null>(null);
  const [skillName, setSkillName] = useState("");
  const [skillVersion, setSkillVersion] = useState("v1.0");
  const [skillFile, setSkillFile] = useState<UploadedFile | null>(null);
  const [skillSubmitting, setSkillSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/admin-check")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setIsAdmin(!!d.isAdmin);
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/bitable/records?table=1&team=${encodeURIComponent(team)}`).then((r) => r.json()),
        fetch(`/api/bitable/records?table=2&team=${encodeURIComponent(team)}`).then((r) => r.json()),
      ]);

      const nodeNameToId: Record<string, string> = {};
      const sectionNameToId: Record<string, string> = {};
      for (const sec of process.sections) {
        sectionNameToId[sec.name] = sec.id;
        for (const node of sec.nodes) {
          nodeNameToId[node.name] = node.id;
        }
      }

      const map: Record<string, TaskRow[]> = {};
      if (r1.success) {
        for (const record of r1.records) {
          const nodeName = record.fields["流程节点"] as string;
          const sectionName = record.fields["流程环节"] as string;
          const taskName = (record.fields["场景名称"] ||
            record.fields["任务名称"]) as string;
          const labelRaw = record.fields["标签"] as string | undefined;
          const submittedAt = record.fields["提交时间"] as number | undefined;
          const e2eField = record.fields["端到端流程"] as string | undefined;

          if (e2eField && e2eField !== process.shortName && e2eField !== process.name && e2eField !== process.id) {
            continue;
          }

          const nodeId = nodeNameToId[nodeName];
          if (!nodeId) continue;
          if (!e2eField && sectionName && sectionNameToId[sectionName] === undefined) continue;

          const label = parseTaskLabelFromFeishu(labelRaw);
          const paradigms = parseParadigmsFromFeishu(
            record.fields[TABLE1_FIELD_PARADIGM]
          );

          if (!map[nodeId]) map[nodeId] = [];
          map[nodeId].push({
            id: generateId(),
            taskName: taskName || "",
            label,
            paradigms,
            saved: true,
            recordId: record.id,
            submittedAt,
          });
        }
      }
      setNodeTasksMap(map);

      const prog: ProgressMap = {};
      const submittedNames = new Set<string>();
      if (r2.success) {
        for (const record of r2.records) {
          const taskName = record.fields["所属场景"] as string;
          const status = record.fields["步骤状态"] as string;
          if (!taskName) continue;
          submittedNames.add(String(taskName).trim());
          if (status === "已完成") {
            prog[taskName] = (prog[taskName] || 0) + 1;
          }
        }
      }
      setProgressMap(prog);
      setTasksWithSubmissions(submittedNames);

      // 批量加载里程碑数据
      try {
        const msRes = await fetch(
          `/api/scene/milestone?team=${encodeURIComponent(team)}&process=${encodeURIComponent(process.shortName)}`
        ).then((r) => r.json());
        if (msRes.success) {
          setMilestoneMap(msRes.milestones || {});
        }
      } catch {
        // 里程碑加载失败不影响主流程
      }
    } catch (err) {
      console.error("加载失败:", err);
    } finally {
      setLoading(false);
    }
  }, [team, process]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 当切换团队或流程时清空多选
  useEffect(() => {
    setSelectedIds(new Set());
  }, [team, process.id]);

  // 统计：总 / 可见（受 onlyManual / onlyHasTasks 影响）
  useEffect(() => {
    if (!onStatsChange) return;
    let totalTasks = 0;
    let totalNodes = 0;
    let visibleTasks = 0;
    let visibleNodes = 0;
    for (const section of process.sections) {
      for (const node of section.nodes) {
        const raw = nodeTasksMap[node.id] || [];
        const saved = raw.filter((t) => t.saved);
        totalTasks += saved.length;
        totalNodes += 1;
        const visible = onlyManual ? saved.filter((t) => t.label === "pure_manual") : saved;
        if (onlyHasTasks && visible.length === 0) continue;
        visibleTasks += visible.length;
        visibleNodes += 1;
      }
    }
    onStatsChange({ totalTasks, totalNodes, visibleTasks, visibleNodes });
  }, [nodeTasksMap, process, onlyManual, onlyHasTasks, onStatsChange]);

  // ─── 单条添加：通过弹窗保存 ────────────────────────────────
  const openAddModal = (nodeId: string, nodeName: string, sectionName: string) => {
    if (readOnly) return;
    setAddState({
      nodeId,
      nodeName,
      sectionName,
      taskName: "",
      label: "",
      paradigms: [],
      saving: false,
    });
    setTimeout(() => addInputRef.current?.focus(), 50);
  };

  const handleAddSave = async () => {
    if (!addState) return;
    const name = addState.taskName.trim();
    if (!name || !addState.label || addState.paradigms.length === 0) return;

    // 重复检测
    const existing = nodeTasksMap[addState.nodeId] || [];
    const dup = existing.find((t) => t.saved && t.taskName.trim() === name);
    if (dup) {
      setDupAlert({
        nodeId: addState.nodeId,
        nodeName: addState.nodeName,
        sectionName: addState.sectionName,
        duplicates: [{ taskName: dup.taskName, submittedAt: dup.submittedAt }],
        newOnes: [],
        isBatch: false,
      });
      setAddState(null);
      return;
    }

    setAddState((prev) => prev && { ...prev, saving: true });
    const labelOpt = TASK_LABELS.find((l) => l.value === addState.label);
    const labelText = labelOpt ? `${labelOpt.icon} ${labelOpt.label}` : "";
    const paradigmField: Record<string, unknown> = {
      [TABLE1_FIELD_PARADIGM]: paradigmIdsToFeishuFieldValue(
        addState.paradigms
      ),
    };

    try {
      const r = await fetch("/api/bitable/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "1",
          fields: {
            团队名称: team,
            端到端流程: process.shortName,
            流程环节: addState.sectionName,
            流程节点: addState.nodeName,
            场景名称: name,
            标签: labelText,
            ...paradigmField,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.success) {
        alert(typeof d.error === "string" ? d.error : "保存失败，请稍后重试");
        setAddState((prev) => prev && { ...prev, saving: false });
        return;
      }
      const recordId = d.record?.record_id || d.record?.id;
      setNodeTasksMap((prev) => ({
        ...prev,
        [addState.nodeId]: [
          ...(prev[addState.nodeId] || []),
          {
            id: generateId(),
            taskName: name,
            label: addState.label as TaskLabel,
            paradigms: [...addState.paradigms],
            saved: true,
            recordId,
            submittedAt: Date.now(),
          },
        ],
      }));
      const nodeId = addState.nodeId;
      setAddState(null);
      setPostSaveHint({ nodeId, count: 1 });
      setTimeout(() => setPostSaveHint(null), 5000);
    } catch (err) {
      console.error(err);
      alert("保存失败，请检查网络后重试");
      setAddState((prev) => prev && { ...prev, saving: false });
    }
  };

  // ─── 批量导入 ─────────────────────────────────────────────
  const confirmBatchText = () => {
    if (!batchState) return;
    const lines = batchState.text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setBatchState((prev) =>
      prev && {
        ...prev,
        step: "label",
        tempTasks: lines,
        bulkLabel: "",
        bulkParadigms: [],
      }
    );
  };

  const saveBatchImport = async () => {
    if (!batchState || batchState.step !== "label" || !batchState.bulkLabel) return;
    if (batchState.bulkParadigms.length === 0) return;
    const { nodeId, sectionName, nodeName, tempTasks, bulkLabel, bulkParadigms } =
      batchState;
    const existingTasks = nodeTasksMap[nodeId] || [];
    const savedNames = new Set(existingTasks.filter((t) => t.saved).map((t) => t.taskName.trim()));

    const duplicateNames = tempTasks.filter((name) => savedNames.has(name.trim()));
    const newNames = tempTasks.filter((name) => !savedNames.has(name.trim()));

    if (duplicateNames.length > 0) {
      const duplicates = duplicateNames.map((name) => ({
        taskName: name,
        submittedAt: existingTasks.find((t) => t.saved && t.taskName.trim() === name.trim())?.submittedAt,
      }));
      const newOnes = newNames.map((name) => ({
        id: generateId(),
        taskName: name,
        label: bulkLabel,
        paradigms: [...bulkParadigms],
        saved: false,
      }));
      setBatchState(null);
      setDupAlert({
        nodeId,
        nodeName,
        sectionName,
        duplicates,
        newOnes,
        bulkLabel,
        bulkParadigms,
        isBatch: true,
      });
      return;
    }

    setBatchState(null);
    const newOnes = newNames.map((name) => ({
      id: generateId(),
      taskName: name,
      label: bulkLabel,
      paradigms: [...bulkParadigms],
      saved: false,
    }));
    await commitBatchRows(
      nodeId,
      nodeName,
      sectionName,
      newOnes,
      bulkLabel,
      bulkParadigms
    );
  };

  const commitBatchRows = async (
    nodeId: string,
    nodeName: string,
    sectionName: string,
    rows: TaskRow[],
    bulkLabel: TaskLabel | "",
    bulkParadigms: ParadigmId[]
  ) => {
    if (rows.length === 0) return;
    const labelOpt = TASK_LABELS.find((l) => l.value === bulkLabel);
    const labelText = labelOpt ? `${labelOpt.icon} ${labelOpt.label}` : "";
    const pField: Record<string, unknown> = {
      [TABLE1_FIELD_PARADIGM]: paradigmIdsToFeishuFieldValue(bulkParadigms),
    };
    setSaving((prev) => ({ ...prev, [nodeId]: true }));
    try {
      const newRows: TaskRow[] = [];
      for (const row of rows) {
        const r = await fetch("/api/bitable/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "1",
            fields: {
              团队名称: team,
              端到端流程: process.shortName,
              流程环节: sectionName,
              流程节点: nodeName,
              场景名称: row.taskName.trim(),
              标签: labelText,
              ...pField,
            },
          }),
        });
        const d = await r.json();
        if (!r.ok || !d.success) {
          throw new Error(typeof d.error === "string" ? d.error : `HTTP ${r.status}`);
        }
        const recordId = d.record?.record_id || d.record?.id;
        newRows.push({
          ...row,
          label: bulkLabel as TaskLabel,
          paradigms: [...bulkParadigms],
          saved: true,
          recordId,
          submittedAt: Date.now(),
        });
      }
      setNodeTasksMap((prev) => ({
        ...prev,
        [nodeId]: [...(prev[nodeId] || []), ...newRows],
      }));
      setSaveStatus((prev) => ({ ...prev, [nodeId]: "success" }));
      setPostSaveHint({ nodeId, count: newRows.length });
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [nodeId]: null })), 3000);
      setTimeout(() => setPostSaveHint(null), 5000);
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "批量保存失败");
      setSaveStatus((prev) => ({ ...prev, [nodeId]: "error" }));
    } finally {
      setSaving((prev) => ({ ...prev, [nodeId]: false }));
    }
  };

  const handleDupContinue = async () => {
    if (!dupAlert) return;
    const { nodeId, nodeName, sectionName, newOnes, bulkLabel, bulkParadigms, isBatch } = dupAlert;
    setDupAlert(null);
    if (newOnes.length === 0) return;
    if (isBatch && bulkLabel !== undefined) {
      await commitBatchRows(
        nodeId,
        nodeName,
        sectionName,
        newOnes,
        bulkLabel,
        bulkParadigms ?? []
      );
    }
  };

  // ─── 多选 + 批量打标签 ──────────────────────────────────
  const toggleSelect = (recordId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // 所有已保存场景（扁平化）
  const allSavedTasks = useMemo(() => {
    const list: { task: TaskRow; nodeId: string; nodeName: string; sectionName: string }[] = [];
    for (const section of process.sections) {
      for (const node of section.nodes) {
        const tasks = nodeTasksMap[node.id] || [];
        for (const t of tasks) {
          if (t.saved && t.recordId) {
            list.push({ task: t, nodeId: node.id, nodeName: node.name, sectionName: section.name });
          }
        }
      }
    }
    return list;
  }, [nodeTasksMap, process.sections]);

  // ─── 删除（单条/批量）──────────────────────────────────
  const requestDelete = (items: DeleteTarget[]) => {
    if (readOnly || items.length === 0) return;
    const blockedItems = items.filter((x) => x.hasSubmission);
    const blocked = !isAdmin && blockedItems.length > 0;
    setDeleteConfirm({
      targets: items,
      stage: 1,
      blocked,
      blockedCount: blockedItems.length,
      deleting: false,
    });
  };

  const performDelete = async () => {
    if (!deleteConfirm || deleteConfirm.blocked) return;
    if (deleteConfirm.stage === 1) {
      setDeleteConfirm({ ...deleteConfirm, stage: 2 });
      return;
    }
    setDeleteConfirm({ ...deleteConfirm, deleting: true, error: undefined });

    const failed: string[] = [];
    for (const t of deleteConfirm.targets) {
      try {
        const qs = new URLSearchParams({
          table: "1",
          recordId: t.recordId,
        });
        if (t.hasSubmission && isAdmin) qs.set("force", "1");
        const resp = await fetch(`/api/bitable/records?${qs.toString()}`, {
          method: "DELETE",
        });
        const d = await resp.json();
        if (!resp.ok || !d.success) {
          failed.push(`${t.taskName}：${d.error || resp.statusText}`);
        }
      } catch (err) {
        failed.push(`${t.taskName}：${String(err)}`);
      }
    }

    // 成功的从本地 state 移除
    const okIds = new Set(
      deleteConfirm.targets
        .filter(
          (t) =>
            !failed.some((f) => f.startsWith(t.taskName + "："))
        )
        .map((t) => t.recordId)
    );
    if (okIds.size > 0) {
      setNodeTasksMap((prev) => {
        const next: Record<string, TaskRow[]> = {};
        for (const [nid, arr] of Object.entries(prev)) {
          next[nid] = arr.filter((t) => !t.recordId || !okIds.has(t.recordId));
        }
        return next;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        okIds.forEach((id) => next.delete(id));
        return next;
      });
    }

    if (failed.length > 0) {
      setDeleteConfirm({
        ...deleteConfirm,
        stage: 2,
        deleting: false,
        error: `${failed.length} 条删除失败：\n${failed.slice(0, 5).join("\n")}${failed.length > 5 ? `\n… 还有 ${failed.length - 5} 条` : ""}`,
      });
    } else {
      setDeleteConfirm(null);
    }
  };

  const requestDeleteOne = (recordId: string, taskName: string) => {
    const hasSubmission = tasksWithSubmissions.has(taskName.trim());
    requestDelete([{ recordId, taskName, hasSubmission }]);
  };

  const requestDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const items: DeleteTarget[] = allSavedTasks
      .filter((x) => x.task.recordId && selectedIds.has(x.task.recordId))
      .map((x) => ({
        recordId: x.task.recordId!,
        taskName: x.task.taskName,
        hasSubmission: tasksWithSubmissions.has(x.task.taskName.trim()),
      }));
    if (items.length === 0) return;
    requestDelete(items);
  };

  const applyBulkLabel = async (label: TaskLabel) => {
    if (selectedIds.size === 0) return;
    const labelOpt = TASK_LABELS.find((l) => l.value === label)!;
    const labelText = `${labelOpt.icon} ${labelOpt.label}`;
    setApplyingBulk(true);
    try {
      const targets = allSavedTasks.filter(
        (x) => x.task.recordId && selectedIds.has(x.task.recordId)
      );
      await Promise.all(
        targets.map((x) =>
          fetch("/api/bitable/records", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: "1",
              recordId: x.task.recordId,
              fields: { 标签: labelText },
            }),
          })
        )
      );
      // 更新本地状态
      setNodeTasksMap((prev) => {
        const next = { ...prev };
        for (const x of targets) {
          next[x.nodeId] = (next[x.nodeId] || []).map((t) =>
            t.id === x.task.id ? { ...t, label } : t
          );
        }
        return next;
      });
      setSelectedIds(new Set());
    } catch (err) {
      console.error("批量打标失败:", err);
    } finally {
      setApplyingBulk(false);
    }
  };

  const toggleParadigmInList = (list: ParadigmId[], id: ParadigmId): ParadigmId[] => {
    if (list.includes(id)) return list.filter((x) => x !== id);
    return [...list, id];
  };

  const applyBulkParadigmsConfirm = async () => {
    if (selectedIds.size === 0 || paradigmBulkSelection.length === 0) return;
    setApplyingBulk(true);
    const feishuVal = paradigmIdsToFeishuFieldValue(paradigmBulkSelection);
    try {
      const targets = allSavedTasks.filter(
        (x) => x.task.recordId && selectedIds.has(x.task.recordId)
      );
      await Promise.all(
        targets.map((x) =>
          fetch("/api/bitable/records", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: "1",
              recordId: x.task.recordId,
              fields: { [TABLE1_FIELD_PARADIGM]: feishuVal },
            }),
          })
        )
      );
      const picked = [...paradigmBulkSelection];
      setNodeTasksMap((prev) => {
        const next: Record<string, TaskRow[]> = { ...prev };
        for (const x of targets) {
          next[x.nodeId] = (next[x.nodeId] || []).map((t) =>
            t.id === x.task.id ? { ...t, paradigms: picked } : t
          );
        }
        return next;
      });
      setSelectedIds(new Set());
      setParadigmBulkOpen(false);
      setParadigmBulkSelection([]);
    } catch (err) {
      console.error("批量设范式失败:", err);
    } finally {
      setApplyingBulk(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3" />
        正在加载 {team} 的历史数据...
      </div>
    );
  }

  return (
    <div className="relative pb-24">
      {/* 顶部提示行（仅只读态时显示） */}
      {readOnly && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-xs text-amber-800">
          <Lock size={12} />
          当前团队数据仅可查看，不可新增/批量/编辑。若需修改请先在顶部切换回自己的归属团队。
        </div>
      )}

      {/* 二维看板（横向滚动） */}
      <div className="overflow-x-auto">
        <div className="flex min-w-max">
          {process.sections.map((section, sIdx) => {
            if (onlyHasTasks) {
              const hasAny = section.nodes.some((n) => {
                const saved = (nodeTasksMap[n.id] || []).filter((t) => t.saved);
                if (onlyManual) return saved.some((t) => t.label === "pure_manual");
                return saved.length > 0;
              });
              if (!hasAny) return null;
            }
            return (
              <SectionGroup
                key={section.id}
                section={section}
                sectionIndex={sIdx}
                processColor={process.color}
                nodeTasksMap={nodeTasksMap}
                progressMap={progressMap}
                milestoneMap={milestoneMap}
                saving={saving}
                saveStatus={saveStatus}
                onlyManual={onlyManual}
                onlyHasTasks={onlyHasTasks}
                readOnly={readOnly}
                postSaveHint={postSaveHint}
                selectedIds={selectedIds}
                tasksWithSubmissions={tasksWithSubmissions}
                isAdmin={isAdmin}
                onToggleSelect={toggleSelect}
                onToggleSelectMany={(ids, selected) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (selected) for (const id of ids) next.add(id);
                    else for (const id of ids) next.delete(id);
                    return next;
                  });
                }}
                onRequestDeleteOne={requestDeleteOne}
                onAddTask={(nodeId, nodeName, sectionName) =>
                  openAddModal(nodeId, nodeName, sectionName)
                }
                onOpenBatch={(nodeId, sectionName, nodeName) => {
                  setBatchState({
                    nodeId,
                    sectionName,
                    nodeName,
                    text: "",
                    step: "input",
                    tempTasks: [],
                    bulkLabel: "",
                    bulkParadigms: [],
                  });
                  setTimeout(() => batchTextRef.current?.focus(), 50);
                }}
                onNavigateToTask={(taskName) => {
                  const found = allSavedTasks.find((x) => x.task.taskName === taskName);
                  setSkillDialogTask({
                    taskName,
                    sectionName: found?.sectionName || "",
                    nodeName: found?.nodeName || "",
                    processName: process.name,
                    processShortName: process.shortName,
                  });
                  setSkillName(taskName);
                  setSkillVersion("v1.0");
                  setSkillFile(null);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 单条添加弹窗 */}
      {addState && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 pb-0">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <div className="text-xs text-blue-600 font-semibold mb-0.5">
                    添加一个场景
                  </div>
                  <div className="text-base font-bold text-gray-900">
                    {addState.sectionName} / {addState.nodeName}
                  </div>
                </div>
                <button
                  onClick={() => setAddState(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 max-h-[min(70vh,560px)] overflow-y-auto">
              {/* Step1 场景名 */}
              <div>
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px]">
                    1
                  </span>
                  场景名称
                </label>
                <input
                  ref={addInputRef}
                  value={addState.taskName}
                  onChange={(e) =>
                    setAddState((prev) => prev && { ...prev, taskName: e.target.value })
                  }
                  placeholder="例如：供应商主数据新增"
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {/* Step2 选标签（必选） */}
              <div>
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px]">
                    2
                  </span>
                  选一个标签
                  <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">
                    （必选，决定后续是否能进入「Skill创建」）
                  </span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {TASK_LABELS.map((opt) => {
                    const active = addState.label === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setAddState((prev) => prev && { ...prev, label: opt.value })
                        }
                        className={cn(
                          "text-left flex items-start gap-2 px-3 py-2.5 rounded-lg border transition-all",
                          active
                            ? cn(opt.color, opt.bgColor, opt.borderColor, "ring-2 ring-offset-1")
                            : "bg-white border-gray-200 hover:border-gray-400 text-gray-700"
                        )}
                      >
                        <span className="text-base leading-none mt-0.5">{opt.icon}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold">{opt.label}</span>
                          <span className="block text-xs opacity-75 mt-0.5">
                            {opt.description}
                          </span>
                        </span>
                        {active && <CheckCircle2 size={16} className="shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step3 归属范式（多选、至少 1 项） */}
              <div>
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1.5">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[10px]">
                    3
                  </span>
                  归属范式
                  <span className="text-red-500">*</span>
                  <span className="text-gray-400 font-normal ml-1">（多选，至少 1 项）</span>
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {PARADIGM_DEFS.map((def) => {
                    const on = addState.paradigms.includes(def.id);
                    return (
                      <label
                        key={def.id}
                        className={cn(
                          "flex items-start gap-2 px-2.5 py-2 rounded-lg border cursor-pointer text-xs",
                          on
                            ? "border-violet-400 bg-violet-50 text-violet-900"
                            : "border-gray-200 bg-white text-gray-700"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-violet-600"
                          checked={on}
                          onChange={() =>
                            setAddState(
                              (prev) =>
                                prev && {
                                  ...prev,
                                  paradigms: toggleParadigmInList(prev.paradigms, def.id),
                                }
                            )
                          }
                        />
                        <span>
                          <span className="font-semibold text-[11px]">{def.shortLabel}</span>{" "}
                          {def.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-1 text-[11px] text-gray-500 bg-gray-50 px-3 py-2 rounded-lg flex gap-1.5">
                <ClipboardList size={12} className="shrink-0 mt-0.5 text-gray-400" />
                <span>
                  要一次录多条？关掉这个窗口，点节点下方的「批量导入」即可粘贴多行场景名。
                </span>
              </div>
            </div>

            <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setAddState(null)}>
                取消
              </Button>
              <Button
                onClick={handleAddSave}
                disabled={
                  !addState.taskName.trim() ||
                  !addState.label ||
                  addState.paradigms.length === 0 ||
                  addState.saving
                }
                className="gap-1"
              >
                <Save size={14} />
                {addState.saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入弹层 */}
      {batchState && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-gray-900">批量导入场景</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  节点：{batchState.nodeName}（{batchState.sectionName}）
                </div>
              </div>
              <button onClick={() => setBatchState(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {batchState.step === "input" ? (
              <>
                <div className="text-sm text-gray-600">
                  每行写一条场景名，粘完就可以下一步打标签：
                </div>
                <textarea
                  ref={batchTextRef}
                  value={batchState.text}
                  onChange={(e) =>
                    setBatchState((prev) => prev && { ...prev, text: e.target.value })
                  }
                  rows={8}
                  placeholder={"场景名称1\n场景名称2\n场景名称3\n..."}
                  className="w-full text-sm border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono"
                />
                <div className="text-xs text-gray-400">
                  已识别 {batchState.text.split("\n").filter((l) => l.trim()).length} 个场景
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setBatchState(null)}>取消</Button>
                  <Button
                    onClick={confirmBatchText}
                    disabled={!batchState.text.split("\n").filter((l) => l.trim()).length}
                  >
                    下一步：统一打标签 →
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm text-gray-700">
                  即将导入 <strong>{batchState.tempTasks.length}</strong> 条，先统一一个标签（稍后可多选再分开调）：
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                  {batchState.tempTasks.map((t, i) => (
                    <div key={i} className="text-xs text-gray-700 py-0.5 border-b last:border-b-0">
                      {i + 1}. {t}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500">统一标签</div>
                <div className="flex flex-wrap gap-2">
                  {TASK_LABELS.map((label) => (
                    <button
                      key={label.value}
                      onClick={() =>
                        setBatchState((prev) => prev && { ...prev, bulkLabel: label.value })
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        batchState.bulkLabel === label.value
                          ? cn(label.color, label.bgColor, label.borderColor, "ring-2 ring-offset-1")
                          : "text-gray-500 border-gray-300 hover:border-gray-400"
                      )}
                    >
                      {label.icon} {label.label}
                    </button>
                  ))}
                </div>
                <div className="text-xs font-semibold text-gray-800 pt-1">
                  归属范式 <span className="text-red-500">*</span>（多选，至少 1 项）
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2 bg-white">
                  {PARADIGM_DEFS.map((def) => {
                    const on = batchState.bulkParadigms.includes(def.id);
                    return (
                      <label
                        key={def.id}
                        className={cn(
                          "flex items-start gap-2 px-2 py-1.5 rounded text-xs cursor-pointer",
                          on
                            ? "bg-violet-50 text-violet-900"
                            : "text-gray-700 hover:bg-gray-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-violet-600 shrink-0"
                          checked={on}
                          onChange={() =>
                            setBatchState((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    bulkParadigms: toggleParadigmInList(
                                      prev.bulkParadigms,
                                      def.id
                                    ),
                                  }
                                : prev
                            )
                          }
                        />
                        <span>
                          <span className="font-semibold">{def.shortLabel}</span> {def.title}
                        </span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-2 justify-between">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setBatchState((prev) => prev && { ...prev, step: "input" })
                    }
                  >
                    ← 返回修改
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setBatchState(null)}>取消</Button>
                    <Button
                      onClick={saveBatchImport}
                      disabled={
                        !batchState.bulkLabel || batchState.bulkParadigms.length === 0
                      }
                    >
                      <Save size={14} className="mr-1" />
                      保存 {batchState.tempTasks.length} 条
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 重复场景警告 */}
      {dupAlert && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-100">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                <div className="font-bold text-gray-900">发现重复场景</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  节点：{dupAlert.nodeName}（{dupAlert.sectionName}）
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-700 font-medium">
                以下 {dupAlert.duplicates.length} 个场景已存在，将被跳过：
              </div>
              <div className="max-h-40 overflow-y-auto border border-amber-200 rounded-lg divide-y divide-amber-100 bg-amber-50">
                {dupAlert.duplicates.map((d, i) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <span className="font-medium text-amber-900">{d.taskName}</span>
                    <span className="text-amber-600 ml-2">（提交于 {formatTs(d.submittedAt)}）</span>
                  </div>
                ))}
              </div>
            </div>

            {dupAlert.newOnes.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-700 font-medium">
                  以下 {dupAlert.newOnes.length} 个场景是新增的，将被保存：
                </div>
                <div className="max-h-32 overflow-y-auto border border-green-200 rounded-lg divide-y divide-green-100 bg-green-50">
                  {dupAlert.newOnes.map((t, i) => (
                    <div key={i} className="px-3 py-2 text-xs text-green-900 font-medium">
                      {t.taskName}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 text-center">
                所有场景均已存在，无新内容需要保存。
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDupAlert(null)}>取消</Button>
              {dupAlert.newOnes.length > 0 && (
                <Button onClick={handleDupContinue}>
                  <Save size={14} className="mr-1" />
                  跳过重复，保存新场景
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 底部浮动批量工具条（多选 ≥1 时显示） */}
      {!readOnly && selectedIds.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 bg-white rounded-full shadow-2xl border px-5 py-2 flex items-center gap-3 animate-fade-in">
          <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Tag size={14} className="text-blue-500" />
            已选 {selectedIds.size} 个场景
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="text-xs text-gray-400">批量打：</div>
          {TASK_LABELS.map((opt) => (
            <button
              key={opt.value}
              disabled={applyingBulk}
              onClick={() => applyBulkLabel(opt.value)}
              className={cn(
                "text-sm px-2.5 py-1 rounded-full border font-medium transition-all",
                opt.color,
                opt.bgColor,
                opt.borderColor,
                "hover:ring-2 hover:ring-offset-1 disabled:opacity-50"
              )}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200" />
          <button
            type="button"
            disabled={applyingBulk}
            onClick={() => {
              setParadigmBulkSelection([]);
              setParadigmBulkOpen(true);
            }}
            className="text-sm px-2.5 py-1 rounded-full border font-medium border-violet-300 text-violet-800 bg-violet-50 hover:ring-2 hover:ring-violet-200 hover:ring-offset-1 disabled:opacity-50 whitespace-nowrap"
          >
            设范式
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button
            onClick={requestDeleteSelected}
            disabled={applyingBulk}
            className="text-sm px-2.5 py-1 rounded-full border font-semibold transition-all text-red-600 bg-red-50 border-red-200 hover:bg-red-100 hover:ring-2 hover:ring-red-300 hover:ring-offset-1 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 size={13} />
            批量删除 ({selectedIds.size})
          </button>
          <button
            onClick={clearSelection}
            className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
            title="取消选择"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {paradigmBulkOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          onClick={() => {
            setParadigmBulkOpen(false);
            setParadigmBulkSelection([]);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <div className="font-bold text-gray-900">批量设置归属范式</div>
            <p className="text-xs text-gray-500 leading-relaxed">
              将更新已选 {selectedIds.size} 条场景在「归属范式」字段的值（不修改标签）。请至少选 1 个范式。
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-200 rounded-lg p-2">
              {PARADIGM_DEFS.map((def) => {
                const on = paradigmBulkSelection.includes(def.id);
                return (
                  <label
                    key={def.id}
                    className={cn(
                      "flex items-start gap-2 px-2 py-1.5 rounded text-xs cursor-pointer",
                      on ? "bg-violet-50 text-violet-900" : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-violet-600 shrink-0"
                      checked={on}
                      onChange={() =>
                        setParadigmBulkSelection((prev) =>
                          toggleParadigmInList(prev, def.id)
                        )
                      }
                    />
                    <span>
                      <span className="font-semibold">{def.shortLabel}</span> {def.title}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => {
                  setParadigmBulkOpen(false);
                  setParadigmBulkSelection([]);
                }}
              >
                取消
              </Button>
              <Button
                onClick={applyBulkParadigmsConfirm}
                disabled={applyingBulk || paradigmBulkSelection.length === 0}
              >
                应用到已选
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <DeleteConfirmDialog
          confirm={deleteConfirm}
          isAdmin={isAdmin}
          onCancel={() => setDeleteConfirm(null)}
          onProceed={performDelete}
        />
      )}

      {/* 场景卡片 SKILL 上传弹窗 */}
      {skillDialogTask && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-3 border-b flex items-center gap-3">
              <UploadCloud size={18} className="text-purple-600" />
              <div className="font-semibold text-gray-900">上传 SKILL ZIP</div>
              <div className="flex-1" />
              <button onClick={() => setSkillDialogTask(null)} className="p-1 text-gray-500 hover:text-gray-800"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-xl border bg-gray-50 p-3 text-sm">
                <div className="font-semibold text-gray-900">{skillDialogTask.taskName}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {skillDialogTask.processName} / {skillDialogTask.sectionName} / {skillDialogTask.nodeName}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">SKILL 名称</span>
                  <input value={skillName} onChange={(e) => setSkillName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-gray-600">版本号</span>
                  <input value={skillVersion} onChange={(e) => setSkillVersion(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm" />
                </label>
              </div>
              <FileUploader
                label="SKILL ZIP 包"
                hint="只允许上传 1 个 .zip 文件，大小不超过 200MB"
                accept=".zip,application/zip"
                purpose="skill"
                maxSizeMB={200}
                uploaded={skillFile}
                onUpload={setSkillFile}
                required
              />
            </div>
            <div className="px-5 py-3 bg-gray-50 border-t flex items-center gap-2">
              <span className="text-xs text-gray-400">提交人：{userName}</span>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setSkillDialogTask(null)}>取消</Button>
              <Button
                onClick={async () => {
                  if (!skillDialogTask || !skillFile) return;
                  setSkillSubmitting(true);
                  try {
                    const res = await fetch("/api/bitable/records", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        table: "2",
                        fields: {
                          团队名称: team,
                          所属场景: skillDialogTask.taskName,
                          SKILL名称: skillName || skillDialogTask.taskName,
                          SKILL文件名: skillFile.file_name,
                          SKILL文件链接: { link: skillFile.url, text: skillFile.file_name },
                          SKILL文件Token: skillFile.file_token,
                          版本号: skillVersion || "v1.0",
                          端到端流程: skillDialogTask.processShortName,
                          流程环节: skillDialogTask.sectionName,
                          流程节点: skillDialogTask.nodeName,
                          步骤状态: "已完成",
                        },
                      }),
                    });
                    const data = await res.json();
                    if (!data.success) throw new Error(data.error || "提交失败");
                    setProgressMap((prev) => ({ ...prev, [skillDialogTask.taskName]: (prev[skillDialogTask.taskName] || 0) + 1 }));
                    setSkillDialogTask(null);
                  } catch (err) {
                    alert(`SKILL 上传失败：${err}`);
                  } finally {
                    setSkillSubmitting(false);
                  }
                }}
                disabled={!skillFile || skillSubmitting}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {skillSubmitting ? "保存中..." : "绑定到场景"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <span className="hidden">{userName}</span>
    </div>
  );
}

function DeleteConfirmDialog({
  confirm,
  isAdmin,
  onCancel,
  onProceed,
}: {
  confirm: DeleteConfirm;
  isAdmin: boolean;
  onCancel: () => void;
  onProceed: () => void;
}) {
  const total = confirm.targets.length;
  const submissionCount = confirm.targets.filter((t) => t.hasSubmission).length;
  const preview = confirm.targets.slice(0, 6);
  const more = confirm.targets.length - preview.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-full",
              confirm.blocked ? "bg-gray-100" : "bg-red-100"
            )}
          >
            {confirm.blocked ? (
              <Lock size={20} className="text-gray-600" />
            ) : (
              <Trash2 size={20} className="text-red-600" />
            )}
          </div>
          <div>
            <div className="font-bold text-gray-900">
              {confirm.blocked
                ? "无法删除 · 仅管理员可操作"
                : total === 1
                ? `确认删除场景「${confirm.targets[0].taskName}」？`
                : `确认删除选中的 ${total} 个场景？`}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              删除后不可恢复；同名场景在「场景梳理」里的标签也会一并移除
            </div>
          </div>
        </div>

        <div className="max-h-40 overflow-y-auto border rounded-lg bg-gray-50 divide-y divide-gray-100">
          {preview.map((t, i) => (
            <div
              key={t.recordId}
              className={cn(
                "px-3 py-2 text-xs flex items-center justify-between gap-2",
                t.hasSubmission && "bg-amber-50"
              )}
            >
              <span className="truncate text-gray-800 font-medium">
                {i + 1}. {t.taskName}
              </span>
              {t.hasSubmission && (
                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                  已登记 Skill 创建
                </span>
              )}
            </div>
          ))}
          {more > 0 && (
            <div className="px-3 py-2 text-xs text-gray-500 text-center">
              … 还有 {more} 条
            </div>
          )}
        </div>

        {confirm.blocked && (
          <div className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3 leading-relaxed">
            其中 <b>{confirm.blockedCount}</b> 个场景已有「Skill创建」相关记录，普通用户不能删除。
            <br />
            请取消勾选这些条目，或联系管理员处理。
          </div>
        )}

        {!confirm.blocked && submissionCount > 0 && isAdmin && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed flex gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-600" />
            <span>
              管理员模式：其中 <b>{submissionCount}</b> 个场景已有「Skill创建」相关记录，Table2
              历史记录仍会保留，仅不再展示在「场景梳理」。
            </span>
          </div>
        )}

        {confirm.error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
            {confirm.error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={confirm.deleting}>
            取消
          </Button>
          {!confirm.blocked && (
            <Button
              onClick={onProceed}
              disabled={confirm.deleting}
              className={cn(
                "gap-1 text-white",
                confirm.stage === 1
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-red-700 hover:bg-red-800 ring-2 ring-red-300"
              )}
            >
              <Trash2 size={14} />
              {confirm.deleting
                ? "删除中…"
                : confirm.stage === 1
                ? "确认删除"
                : "真的删除？再点一次"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 环节组（包含该环节下所有节点列） ───
function SectionGroup({
  section,
  sectionIndex,
  processColor,
  nodeTasksMap,
  progressMap,
  milestoneMap,
  saving,
  saveStatus,
  onlyManual,
  onlyHasTasks,
  readOnly,
  postSaveHint,
  selectedIds,
  tasksWithSubmissions,
  isAdmin,
  onToggleSelect,
  onToggleSelectMany,
  onRequestDeleteOne,
  onAddTask,
  onOpenBatch,
  onNavigateToTask,
}: {
  section: ProcessSection;
  sectionIndex: number;
  processColor: string;
  nodeTasksMap: Record<string, TaskRow[]>;
  progressMap: ProgressMap;
  milestoneMap: Record<string, [boolean, boolean, boolean, boolean]>;
  saving: Record<string, boolean>;
  saveStatus: Record<string, "success" | "error" | null>;
  onlyManual: boolean;
  onlyHasTasks: boolean;
  readOnly: boolean;
  postSaveHint: { nodeId: string; count: number } | null;
  selectedIds: Set<string>;
  tasksWithSubmissions: Set<string>;
  isAdmin: boolean;
  onToggleSelect: (recordId: string) => void;
  onToggleSelectMany: (recordIds: string[], selected: boolean) => void;
  onRequestDeleteOne: (recordId: string, taskName: string) => void;
  onAddTask: (nodeId: string, nodeName: string, sectionName: string) => void;
  onOpenBatch: (nodeId: string, sectionName: string, nodeName: string) => void;
  onNavigateToTask: (taskName: string) => void;
}) {
  const headerColors: Record<string, string> = {
    blue: "from-blue-600 to-blue-500",
    green: "from-green-600 to-green-500",
    purple: "from-purple-600 to-purple-500",
    orange: "from-orange-600 to-orange-500",
    red: "from-red-600 to-red-500",
  };

  const visibleNodes = onlyHasTasks
    ? section.nodes.filter((n) => {
        const saved = (nodeTasksMap[n.id] || []).filter((t) => t.saved);
        if (onlyManual) return saved.some((t) => t.label === "pure_manual");
        return saved.length > 0;
      })
    : section.nodes;

  if (visibleNodes.length === 0) return null;

  return (
    <div className={cn("flex flex-col border-r border-gray-200", sectionIndex === 0 && "border-l")}>
      <div
        className={cn(
          "px-3 py-2 text-white text-sm font-semibold text-center bg-gradient-to-r",
          headerColors[processColor] || "from-blue-600 to-blue-500"
        )}
        style={{ minWidth: `${visibleNodes.length * 220}px` }}
      >
        {section.name}
        <span className="ml-2 text-xs font-normal opacity-80">
          {visibleNodes.length} 个节点
        </span>
      </div>

      <div className="flex flex-1">
        {visibleNodes.map((node, nIdx) => (
          <NodeColumn
            key={node.id}
            node={node}
            sectionName={section.name}
            isLastInSection={nIdx === visibleNodes.length - 1}
            tasks={nodeTasksMap[node.id] || []}
            progressMap={progressMap}
            milestoneMap={milestoneMap}
            isSaving={saving[node.id] || false}
            saveStatus={saveStatus[node.id] || null}
            onlyManual={onlyManual}
            readOnly={readOnly}
            postSaveHint={postSaveHint && postSaveHint.nodeId === node.id ? postSaveHint : null}
            selectedIds={selectedIds}
            tasksWithSubmissions={tasksWithSubmissions}
            isAdmin={isAdmin}
            onToggleSelect={onToggleSelect}
            onToggleSelectMany={onToggleSelectMany}
            onRequestDeleteOne={onRequestDeleteOne}
            onAddTask={() => onAddTask(node.id, node.name, section.name)}
            onOpenBatch={() => onOpenBatch(node.id, section.name, node.name)}
            onNavigateToTask={onNavigateToTask}
          />
        ))}
      </div>
    </div>
  );
}

// ─── 节点列 ───
function NodeColumn({
  node,
  sectionName,
  isLastInSection,
  tasks,
  progressMap,
  milestoneMap,
  saveStatus,
  onlyManual,
  readOnly,
  postSaveHint,
  selectedIds,
  tasksWithSubmissions,
  isAdmin,
  onToggleSelect,
  onToggleSelectMany,
  onRequestDeleteOne,
  onAddTask,
  onOpenBatch,
  onNavigateToTask,
}: {
  node: ProcessNode;
  sectionName: string;
  isLastInSection: boolean;
  tasks: TaskRow[];
  progressMap: ProgressMap;
  milestoneMap: Record<string, [boolean, boolean, boolean, boolean]>;
  isSaving: boolean;
  saveStatus: "success" | "error" | null;
  onlyManual: boolean;
  readOnly: boolean;
  postSaveHint: { nodeId: string; count: number } | null;
  selectedIds: Set<string>;
  tasksWithSubmissions: Set<string>;
  isAdmin: boolean;
  onToggleSelect: (recordId: string) => void;
  onToggleSelectMany: (recordIds: string[], selected: boolean) => void;
  onRequestDeleteOne: (recordId: string, taskName: string) => void;
  onAddTask: () => void;
  onOpenBatch: () => void;
  onNavigateToTask: (taskName: string) => void;
}) {
  const visibleTasks = onlyManual ? tasks.filter((t) => t.label === "pure_manual") : tasks;
  const manualTaskCount = tasks.filter((t) => t.label === "pure_manual").length;
  const headerTaskCount = onlyManual ? manualTaskCount : tasks.length;

  // 可选场景：已保存 + 有 recordId + （普通用户再要求无提交；管理员全部可选）
  const selectableTasks = visibleTasks.filter((t) => {
    if (!t.saved || !t.recordId) return false;
    if (isAdmin) return true;
    return !tasksWithSubmissions.has(t.taskName.trim());
  });
  const selectableIds = selectableTasks
    .map((t) => t.recordId!)
    .filter(Boolean);
  const selectedCountHere = selectableIds.filter((id) => selectedIds.has(id)).length;
  const allSelectedHere =
    selectableIds.length > 0 && selectedCountHere === selectableIds.length;
  const partiallySelectedHere =
    selectedCountHere > 0 && selectedCountHere < selectableIds.length;
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = partiallySelectedHere;
    }
  }, [partiallySelectedHere]);

  const toggleAllHere = () => {
    if (selectableIds.length === 0) return;
    onToggleSelectMany(selectableIds, !allSelectedHere);
  };

  return (
    <div
      className={cn(
        "w-[220px] flex-shrink-0 flex flex-col border-r border-gray-100",
        isLastInSection && "border-r border-gray-200"
      )}
      style={{ minHeight: "320px" }}
    >
      <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {!readOnly && selectableIds.length > 0 && (
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={allSelectedHere}
              onChange={toggleAllHere}
              className="shrink-0 accent-blue-600 cursor-pointer"
              title={
                allSelectedHere
                  ? "取消选中当前节点全部场景"
                  : partiallySelectedHere
                  ? `已选 ${selectedCountHere}/${selectableIds.length}，点击选中全部可操作场景`
                  : `选中当前节点全部可操作场景（共 ${selectableIds.length} 个）`
              }
            />
          )}
          <span className="text-xs font-semibold text-gray-700 truncate">
            {node.name}
          </span>
        </div>
        <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
          {headerTaskCount}
        </span>
      </div>

      {saveStatus === "success" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-green-50 text-xs text-green-600 border-b border-green-100">
          <CheckCircle2 size={11} /> 已保存
        </div>
      )}
      {saveStatus === "error" && (
        <div className="flex items-center gap-1 px-3 py-1 bg-red-50 text-xs text-red-600 border-b border-red-100">
          <AlertCircle size={11} /> 保存失败
        </div>
      )}

      {postSaveHint && (
        <div className="px-3 py-1.5 bg-blue-50 text-[11px] text-blue-700 border-b border-blue-100 leading-tight">
          已保存 {postSaveHint.count} 条。想一次录多条？试试「批量导入」
        </div>
      )}

      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto max-h-[480px]">
        {visibleTasks.length === 0 && !readOnly && (
          <div
            onClick={onAddTask}
            className="flex flex-col items-center justify-center py-6 text-xs text-gray-400 border-2 border-dashed rounded-lg cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors"
          >
            <Plus size={14} className="mb-1" />
            {onlyManual ? "点这里加★纯线下场景" : "点击添加场景"}
          </div>
        )}
        {visibleTasks.length === 0 && readOnly && (
          <div className="text-center py-4 text-xs text-gray-400">
            {onlyManual ? "暂无纯线下场景" : "暂无场景"}
          </div>
        )}
        {visibleTasks.map((task) => {
          const hasSubmission =
            !!task.taskName &&
            tasksWithSubmissions.has(task.taskName.trim());
          const canDelete =
            !readOnly &&
            task.saved &&
            !!task.recordId &&
            (isAdmin || !hasSubmission);
          const canSelect =
            !readOnly &&
            task.saved &&
            !!task.recordId &&
            (isAdmin || !hasSubmission);
          return (
            <TaskCard
              key={task.id}
              task={task}
              milestones={
                task.saved && task.label === "pure_manual" && task.taskName
                  ? milestoneMap[task.taskName] ?? undefined
                  : undefined
              }
              readOnly={readOnly}
              hasSubmission={hasSubmission}
              canDelete={canDelete}
              canSelect={canSelect}
              selected={!!task.recordId && selectedIds.has(task.recordId)}
              onToggleSelect={() => task.recordId && onToggleSelect(task.recordId)}
              onRequestDelete={() =>
                task.recordId && onRequestDeleteOne(task.recordId, task.taskName)
              }
              onNavigate={() => onNavigateToTask(task.taskName)}
            />
          );
        })}
      </div>

      {!readOnly && (
        <div className="p-2 border-t border-gray-100 space-y-1">
          <div className="flex gap-1">
            <button
              onClick={onAddTask}
              className="flex-1 flex items-center justify-center gap-0.5 h-7 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
            >
              <Plus size={11} /> 添加
            </button>
            <button
              onClick={onOpenBatch}
              title={`批量导入：${sectionName} > ${node.name}`}
              className="flex-1 flex items-center justify-center gap-0.5 h-7 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
              <ClipboardList size={11} /> 批量
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 场景卡片（已保存态；编辑态由对话框负责，不再有内联编辑） ───
const MILESTONE_STEPS = [
  { label: "知识库", shortLabel: "知识库" },
  { label: "评测集", shortLabel: "评测集" },
  { label: "SKILL", shortLabel: "SKILL" },
  { label: "评测达标", shortLabel: "达标" },
];

function TaskCard({
  task,
  milestones,
  readOnly,
  hasSubmission,
  canDelete,
  canSelect,
  selected,
  onToggleSelect,
  onRequestDelete,
  onNavigate,
}: {
  task: TaskRow;
  milestones?: [boolean, boolean, boolean, boolean];
  readOnly: boolean;
  hasSubmission: boolean;
  canDelete: boolean;
  canSelect: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onRequestDelete: () => void;
  onNavigate: () => void;
}) {
  const [showTimeline, setShowTimeline] = useState(false);
  const router = useRouter();
  const labelOpt = TASK_LABELS.find((l) => l.value === task.label);
  const isPureManual = task.label === "pure_manual";

  const completedCount = milestones ? milestones.filter(Boolean).length : 0;
  const allDone = completedCount === 4;

  // 第一个未完成步骤的跳转目标
  function getNextHref() {
    if (!milestones) return "/section2";
    if (!milestones[0]) return "/knowledge";
    if (!milestones[1]) return "/evaluation";
    if (!milestones[2]) return "/section2";
    if (!milestones[3]) return "/evaluation/test";
    return "/dashboard";
  }

  const NEXT_LABELS = [
    "前往知识库管理中心",
    "前往评测集管理",
    "前往 SKILL 生产",
    "前往评测集测试",
  ];

  function getNextLabel() {
    if (!milestones) return NEXT_LABELS[2];
    const idx = milestones.findIndex((v) => !v);
    if (idx === -1) return "查看场景资产（全部完成）";
    return NEXT_LABELS[idx];
  }

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-2 text-xs transition-all",
        isPureManual
          ? "border-orange-300 bg-orange-50 shadow-sm"
          : "border-gray-200 bg-white",
        selected && "ring-2 ring-blue-400 border-blue-400"
      )}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        {!readOnly && task.recordId && canSelect && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="mt-0.5 shrink-0 accent-blue-600 cursor-pointer"
            title="选中以批量打标或批量删除"
          />
        )}
        {!readOnly && task.recordId && !canSelect && (
          <span
            title="该场景已有「Skill创建」相关记录，仅管理员可批量操作"
            className="mt-0.5 shrink-0 inline-flex items-center justify-center w-3 h-3 text-gray-300"
          >
            <Lock size={10} />
          </span>
        )}
        <span
          className={cn(
            "leading-tight break-words flex-1",
            isPureManual ? "text-orange-900 font-medium" : "text-gray-800"
          )}
        >
          {task.taskName}
        </span>
        {milestones && (
          <span
            className={cn(
              "flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap border",
              completedCount === 4
                ? "bg-green-100 text-green-700 border-green-200"
                : completedCount > 0
                ? "bg-blue-100 text-blue-700 border-blue-200"
                : "bg-gray-100 text-gray-500 border-gray-200"
            )}
            title="场景四步里程碑完成进度"
          >
            {completedCount}/4
          </span>
        )}
        {!readOnly && task.saved && task.recordId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!canDelete) return;
              onRequestDelete();
            }}
            disabled={!canDelete}
            title={
              canDelete
                ? "删除这个场景"
                : "该场景已有「Skill创建」相关记录，只有管理员可删除"
            }
            className={cn(
              "flex-shrink-0 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100",
              canDelete
                ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                : "text-gray-300 cursor-not-allowed !opacity-60"
            )}
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        {isPureManual && (
          <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-600 text-white">
            ★ 纯线下
          </span>
        )}
        {labelOpt && !isPureManual && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium border",
              labelOpt.color,
              labelOpt.bgColor,
              labelOpt.borderColor
            )}
          >
            {labelOpt.icon} {labelOpt.label}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-0.5 mt-1.5 min-h-[18px]">
        {task.paradigms.length > 0 ? (
          <>
            <span className="text-[10px] text-gray-500 mr-0.5 shrink-0">所属范式：</span>
            {task.paradigms.map((pid) => {
              const d = PARADIGM_DEFS.find((p) => p.id === pid);
              return d ? (
                <span
                  key={pid}
                  title={d.title}
                  className="text-[10px] leading-tight px-0.5 py-0 text-slate-700"
                >
                  {d.shortLabel}
                </span>
              ) : null;
            })}
          </>
        ) : (
          <span className="text-[10px] text-gray-400">范式未设</span>
        )}
      </div>
      {isPureManual && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowTimeline((v) => !v); }}
            title="查看该场景的四步里程碑进度"
            className={cn(
              "mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2",
              "text-xs font-semibold shadow-sm border",
              allDone
                ? "text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100"
                : "text-orange-700 bg-orange-100 border-orange-300 hover:bg-orange-200",
              "transition-colors focus:outline-none"
            )}
          >
            <span>场景进度</span>
            <ArrowRight size={13} strokeWidth={2.5} className="flex-shrink-0" aria-hidden />
          </button>
          {showTimeline && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-white p-2 space-y-1.5">
              {MILESTONE_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className={cn(
                    "w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold",
                    milestones?.[i] ? "bg-emerald-500 text-white" : "bg-gray-200 text-gray-500"
                  )}>
                    {i + 1}
                  </span>
                  <span className={cn(
                    "text-[11px] flex-1",
                    milestones?.[i] ? "text-emerald-700 line-through" : "text-gray-700"
                  )}>
                    {step.label}
                  </span>
                  {milestones?.[i] && (
                    <span className="text-[9px] text-emerald-600">✓</span>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); router.push(getNextHref()); }}
                className="mt-1 w-full text-[10px] text-blue-600 hover:text-blue-800 text-center font-medium"
              >
                {getNextLabel()} →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
