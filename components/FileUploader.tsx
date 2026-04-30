"use client";

import { upload as vercelBlobUpload } from "@vercel/blob/client";
import { useState, useRef } from "react";
import { Upload, CheckCircle2, XCircle, Loader2, File, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CHUNK_RELOAD_KEY = "fod_chunk_reload_once";

function reloadOnceOnStaleChunk(err: unknown): boolean {
  const msg = String(err);
  if (!/ChunkLoadError|Loading chunk \d+ failed/i.test(msg)) return false;
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export interface UploadedFile {
  file_token: string;
  url: string;
  file_name: string;
  file_size: number;
}

export type UploadStorage = "vercel-blob" | "feishu-api" | "feishu-chunked";

type UploadStatus = "pending" | "uploading" | "success" | "error" | "cancelled";

interface UploadTask {
  id: string;
  fileName: string;
  fileSize: number;
  status: UploadStatus;
  stage: string;
  progress: number;
  attempt: number;
  error?: string;
}

type UploadStageHandler = (stage: string, progress?: number) => void;

function blobPathname(file: File): string {
  const safe = file.name.replace(/[/\\]/g, "_").slice(0, 180);
  return `eval-materials/${Date.now()}-${safe}`;
}

// ─── 单文件上传组件 ───
interface FileUploaderProps {
  label: string;
  hint?: string;
  accept?: string;
  purpose?: "common" | "skill";
  maxSizeMB?: number;
  /** 默认 feishu-api；评测集页默认传入 feishu-chunked */
  storage?: UploadStorage;
  handleBlobUploadUrl?: string;
  onUpload: (result: UploadedFile) => void;
  uploaded?: UploadedFile | null;
  disabled?: boolean;
  required?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function storageLabel(storage: UploadStorage): string {
  if (storage === "feishu-chunked") return "飞书分片上传";
  if (storage === "vercel-blob") return "Vercel Blob 直传";
  return "飞书云盘上传";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err: unknown): boolean {
  const msg = String(err);
  return msg.includes("AbortError") || msg.includes("aborted") || msg.includes("已取消");
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let data: { success?: boolean; error?: string; code?: string } & Partial<T> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  if (!res.ok || data.success === false) {
    const detail = data.error || (raw ? raw.slice(0, 160) : `HTTP ${res.status}`);
    throw new Error(detail);
  }
  return data as T;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
  parentSignal?: AbortSignal
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("上传超时"), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason || "已取消上传");
  if (parentSignal) {
    if (parentSignal.aborted) onAbort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onAbort);
  }
}

function signalWithTimeout(parentSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort("上传超时"), timeoutMs);
  const onAbort = () => controller.abort(parentSignal?.reason || "已取消上传");
  if (parentSignal) {
    if (parentSignal.aborted) onAbort();
    else parentSignal.addEventListener("abort", onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onAbort);
    },
  };
}

async function uploadFileViaChunked(
  file: File,
  options: {
    purpose?: "common" | "skill";
    signal?: AbortSignal;
    onStage?: UploadStageHandler;
  }
): Promise<UploadedFile> {
  options.onStage?.("初始化上传", 2);
  const prepareRes = await fetchWithTimeout(
    "/api/upload/chunked/prepare",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        purpose: options.purpose || "common",
      }),
    },
    45_000,
    options.signal
  );
  const prepared = await parseJsonResponse<{
    uploadId: string;
    blockSize: number;
    blockNum: number;
  }>(prepareRes);

  const blockSize = Math.max(1, prepared.blockSize);
  const blockNum = Math.max(1, prepared.blockNum);
  for (let i = 0; i < blockNum; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, file.size);
    const chunk = file.slice(start, end);
    const formData = new FormData();
    formData.append("uploadId", prepared.uploadId);
    formData.append("seq", String(i));
    formData.append("fileName", file.name);
    formData.append("mimeType", file.type || "application/octet-stream");
    formData.append("chunk", chunk, file.name);
    const progress = Math.round(((i + 0.5) / blockNum) * 90);
    options.onStage?.(`上传分片 ${i + 1}/${blockNum}`, progress);
    const partRes = await fetchWithTimeout(
      "/api/upload/chunked/part",
      { method: "POST", body: formData },
      90_000,
      options.signal
    );
    await parseJsonResponse<{ seq: number }>(partRes);
    options.onStage?.(`上传分片 ${i + 1}/${blockNum}`, Math.round(((i + 1) / blockNum) * 90));
  }

  options.onStage?.("等待完成", 94);
  const finishRes = await fetchWithTimeout(
    "/api/upload/chunked/finish",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: prepared.uploadId,
        blockNum,
        fileName: file.name,
        fileSize: file.size,
      }),
    },
    60_000,
    options.signal
  );
  const data = await parseJsonResponse<UploadedFile>(finishRes);
  options.onStage?.("成功", 100);
  return data;
}

async function uploadFile(
  file: File,
  options: {
    purpose?: "common" | "skill";
    maxSizeMB?: number;
    storage?: UploadStorage;
    handleBlobUploadUrl?: string;
    signal?: AbortSignal;
    onStage?: UploadStageHandler;
  } = {}
): Promise<UploadedFile> {
  const maxSizeMB = options.maxSizeMB ?? (options.purpose === "skill" ? 200 : 100);
  if (options.purpose === "skill" && !file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("SKILL 文件只允许上传 ZIP 包");
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    throw new Error(`文件「${file.name}」超过 ${maxSizeMB}MB 限制，请压缩后重试`);
  }

  const storage = options.storage ?? "feishu-api";
  if (storage === "feishu-chunked") {
    return uploadFileViaChunked(file, {
      purpose: options.purpose,
      signal: options.signal,
      onStage: options.onStage,
    });
  }

  if (storage === "vercel-blob") {
    const handleUrl = options.handleBlobUploadUrl ?? "/api/upload/blob";
    const timedSignal = signalWithTimeout(options.signal, 90_000);
    try {
      options.onStage?.("直连 Blob 存储上传", 5);
      const result = await vercelBlobUpload(blobPathname(file), file, {
        access: "public",
        handleUploadUrl: handleUrl,
        multipart: true,
        abortSignal: timedSignal.signal,
        onUploadProgress: ({ percentage }) => {
          options.onStage?.("直连 Blob 存储上传", Math.max(5, Math.round(percentage)));
        },
      });
      options.onStage?.("成功", 100);
      return {
        file_token: "",
        url: result.url,
        file_name: file.name,
        file_size: file.size,
      };
    } catch (err) {
      if (reloadOnceOnStaleChunk(err)) {
        return new Promise<UploadedFile>(() => {});
      }
      const msg = String(err);
      if (/ChunkLoadError|Loading chunk \d+ failed/i.test(msg)) {
        throw new Error(
          "页面脚本与当前部署不一致（常见于刚发版后）：请关闭本标签页后重新从首页进入，或强制刷新（Ctrl+Shift+R）。"
        );
      }
      if (/请先登录|401/.test(msg)) throw new Error("请先登录后再上传");
      if (/503|BLOB_READ_WRITE_TOKEN|未配置/.test(msg)) {
        throw new Error("Blob 未配置：请设置 BLOB_READ_WRITE_TOKEN，或将评测集上传模式切回默认的 feishu-chunked");
      }
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      timedSignal.cleanup();
    }
  }

  options.onStage?.("服务端转发上传", 10);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", options.purpose || "common");
  const res = await fetchWithTimeout(
    "/api/upload",
    { method: "POST", body: formData },
    120_000,
    options.signal
  );
  const raw = await res.text();
  let data: { success?: boolean; error?: string } & Partial<UploadedFile> = {};
  try {
    data = raw ? (JSON.parse(raw) as typeof data) : {};
  } catch {
    data = {};
  }
  if (!res.ok || !data.success) {
    if (res.status === 413) {
      throw new Error(
        `文件「${file.name}」经服务端转发上传失败（请求体过大）。评测集资料请使用默认的飞书分片上传模式，或检查当前组件是否仍在使用 feishu-api。`
      );
    }
    if (raw && !data.error) {
      const brief = raw.length > 120 ? `${raw.slice(0, 120)}...` : raw;
      throw new Error(`上传失败（HTTP ${res.status}）：${brief}`);
    }
    throw new Error(data.error || `上传失败（HTTP ${res.status}）`);
  }
  return data as UploadedFile;
}

export function FileUploader({
  label,
  hint,
  accept,
  purpose,
  maxSizeMB,
  storage = "feishu-api",
  handleBlobUploadUrl,
  onUpload,
  uploaded,
  disabled,
  required,
}: FileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const result = await uploadFile(file, { purpose, maxSizeMB, storage, handleBlobUploadUrl });
      onUpload(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}

      {uploaded ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-green-800 truncate">
              {uploaded.file_name}
            </div>
            <div className="text-xs text-green-600">
              {formatSize(uploaded.file_size)} ·{" "}
              {uploaded.file_token ? "已上传到飞书云盘" : "已上传"}
            </div>
          </div>
          {!disabled && (
            <button
              onClick={() => inputRef.current?.click()}
              className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0"
            >
              重新上传
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          className={cn(
            "relative flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed transition-all cursor-pointer",
            dragOver && !disabled
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50",
            (disabled || uploading) && "opacity-60 cursor-not-allowed",
            error && "border-red-400 bg-red-50"
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="text-blue-500 animate-spin" />
              <span className="text-sm text-blue-600">上传中...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2">
              <XCircle size={24} className="text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
              <span className="text-xs text-gray-500">点击重试</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-100">
                <Upload size={20} className="text-blue-500" />
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">点击或拖拽文件到此处上传</div>
                {accept && (
                  <div className="text-xs text-gray-400 mt-0.5">支持格式：{accept}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">单文件上限 {maxSizeMB ?? (purpose === "skill" ? 200 : 100)}MB，超出请压缩后重试</div>
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── 多文件上传组件 ───
interface MultiFileUploaderProps {
  label: string;
  hint?: string;
  accept?: string;
  purpose?: "common" | "skill";
  maxSizeMB?: number;
  storage?: UploadStorage;
  handleBlobUploadUrl?: string;
  onUpload: (results: UploadedFile[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  uploaded?: UploadedFile[];
  disabled?: boolean;
  required?: boolean;
}

export function MultiFileUploader({
  label,
  hint,
  accept,
  purpose,
  maxSizeMB,
  storage = "feishu-api",
  handleBlobUploadUrl,
  onUpload,
  onUploadingChange,
  uploaded = [],
  disabled,
  required,
}: MultiFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const updateTask = (id: string, patch: Partial<UploadTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  };

  const runUploadTask = async (
    task: UploadTask,
    results: UploadedFile[],
    baseUploaded: UploadedFile[]
  ) => {
    const file = filesRef.current.get(task.id);
    if (!file) return;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const controller = new AbortController();
      controllersRef.current.set(task.id, controller);
      updateTask(task.id, {
        status: "uploading",
        stage: attempt === 1 ? "准备上传" : `重试中 ${attempt}/3`,
        progress: 0,
        attempt,
        error: undefined,
      });

      try {
        const result = await uploadFile(file, {
          purpose,
          maxSizeMB,
          storage,
          handleBlobUploadUrl,
          signal: controller.signal,
          onStage: (stage, progressValue) => {
            updateTask(task.id, {
              stage,
              progress: progressValue ?? task.progress,
            });
          },
        });
        results.push(result);
        updateTask(task.id, {
          status: "success",
          stage: "成功",
          progress: 100,
          error: undefined,
        });
        onUpload([...baseUploaded, ...results]);
        return;
      } catch (err) {
        const msg = isAbortError(err) ? "已取消上传" : errorMessage(err);
        if (isAbortError(err)) {
          updateTask(task.id, {
            status: "cancelled",
            stage: "已取消",
            error: msg,
          });
          return;
        }
        if (attempt < 3) {
          updateTask(task.id, {
            stage: `上传失败，${attempt + 1}/3 即将重试`,
            error: msg,
          });
          await sleep(800 * attempt);
          continue;
        }
        updateTask(task.id, {
          status: "error",
          stage: "失败",
          error: msg,
        });
        return;
      } finally {
        controllersRef.current.delete(task.id);
      }
    }
  };

  const runUploadQueue = async (uploadTasks: UploadTask[]) => {
    setUploading(true);
    onUploadingChange?.(true);
    setError(null);
    const results: UploadedFile[] = [];
    const baseUploaded = uploaded;
    let cursor = 0;
    const workerCount = Math.min(2, uploadTasks.length);

    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < uploadTasks.length) {
        const task = uploadTasks[cursor++];
        await runUploadTask(task, results, baseUploaded);
      }
    });

    await Promise.all(workers);
    setUploading(false);
    onUploadingChange?.(false);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setError(null);
    const uploadTasks = arr.map((file, index) => {
      const id = `${Date.now()}-${index}-${file.name}`;
      filesRef.current.set(id, file);
      return {
        id,
        fileName: file.name,
        fileSize: file.size,
        status: "pending" as UploadStatus,
        stage: "准备上传",
        progress: 0,
        attempt: 0,
      };
    });
    setTasks(uploadTasks);
    await runUploadQueue(uploadTasks);
  };

  const removeFile = (idx: number) => {
    onUpload(uploaded.filter((_, i) => i !== idx));
  };

  const cancelUploads = () => {
    controllersRef.current.forEach((controller) => controller.abort("已取消上传"));
  };

  const retryFailed = async () => {
    const failed = tasks.filter((task) => task.status === "error" && filesRef.current.has(task.id));
    if (failed.length === 0) return;
    setTasks((prev) =>
      prev.map((task) =>
        failed.some((f) => f.id === task.id)
          ? { ...task, status: "pending", stage: "准备上传", progress: 0, error: undefined }
          : task
      )
    );
    await runUploadQueue(failed.map((task) => ({ ...task, status: "pending", stage: "准备上传", progress: 0 })));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}

      {/* 已上传文件列表 */}
      {uploaded.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {uploaded.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200"
            >
              <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-green-800 truncate block">{f.file_name}</span>
                <span className="text-xs text-green-600">{formatSize(f.file_size)}</span>
              </div>
              {!disabled && (
                <button
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 上传区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        className={cn(
          "relative flex flex-col items-center justify-center p-5 rounded-lg border-2 border-dashed transition-all cursor-pointer",
          dragOver && !disabled
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50",
          (disabled || uploading) && "opacity-60 cursor-not-allowed",
          error && "border-red-400 bg-red-50"
        )}
      >
        {uploading || tasks.length > 0 ? (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              {uploading && <Loader2 size={18} className="animate-spin" />}
              <span>
                {uploading
                  ? `上传中 ${tasks.filter((t) => t.status === "success").length}/${tasks.length}...`
                  : `已完成 ${tasks.filter((t) => t.status === "success").length}/${tasks.length}`}
              </span>
            </div>
            <div className="space-y-1.5">
              {tasks.map((task) => (
                <div key={task.id} className="rounded border bg-white/70 px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    {task.status === "uploading" && <Loader2 size={12} className="animate-spin text-blue-500" />}
                    {task.status === "success" && <CheckCircle2 size={12} className="text-green-500" />}
                    {task.status === "error" && <XCircle size={12} className="text-red-500" />}
                    {task.status === "cancelled" && <XCircle size={12} className="text-gray-400" />}
                    <span className="flex-1 truncate text-gray-700">{task.fileName}</span>
                    <span className="text-gray-400">{formatSize(task.fileSize)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          task.status === "error" ? "bg-red-400" : task.status === "success" ? "bg-green-500" : "bg-blue-500"
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, task.progress))}%` }}
                      />
                    </div>
                    <span className={cn("w-24 truncate text-right", task.status === "error" ? "text-red-500" : "text-gray-500")}>
                      {task.error || task.stage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-center gap-2">
              {uploading && (
                <button type="button" onClick={cancelUploads} className="text-xs text-gray-500 hover:text-red-600">
                  取消上传
                </button>
              )}
              {!uploading && tasks.some((task) => task.status === "error") && (
                <button type="button" onClick={retryFailed} className="text-xs text-blue-600 hover:text-blue-700">
                  重试失败文件
                </button>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2">
            <XCircle size={20} className="text-red-500" />
            <span className="text-sm text-red-600">{error}</span>
            <span className="text-xs text-gray-500">点击重试</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Upload size={18} className="text-blue-500" />
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">点击或拖拽，可一次选多个文件</div>
              {accept && (
                <div className="text-xs text-gray-400 mt-0.5">支持格式：{accept}</div>
              )}
              <div className="text-xs text-blue-500 mt-0.5">{storageLabel(storage)}</div>
              <div className="text-xs text-gray-400 mt-0.5">单文件上限 {maxSizeMB ?? (purpose === "skill" ? 200 : 100)}MB，超出请压缩后重试</div>
            </div>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

// ─── 准确率输入组件 ───
interface AccuracyInputProps {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  minValue?: number;
  hint?: string;
  disabled?: boolean;
}

export function AccuracyInput({
  value,
  onChange,
  label,
  minValue,
  hint,
  disabled,
}: AccuracyInputProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      onChange(null);
      setError(null);
      return;
    }
    const num = parseFloat(raw);
    if (isNaN(num) || num < 0 || num > 100) {
      setError("请输入 0-100 之间的数值");
      return;
    }
    if (minValue !== undefined && num < minValue) {
      setError(`准确率必须 ≥ ${minValue}%`);
      onChange(num);
      return;
    }
    setError(null);
    onChange(num);
  };

  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
      </div>
      {hint && <div className="text-xs text-gray-500">{hint}</div>}
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={value ?? ""}
            onChange={handleChange}
            disabled={disabled}
            placeholder="输入准确率..."
            className={cn(
              "w-32 px-3 py-2 pr-8 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500",
              error ? "border-red-400" : "border-gray-300",
              disabled && "opacity-60 cursor-not-allowed bg-gray-50"
            )}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm pointer-events-none">
            %
          </span>
        </div>
        {value !== null && !error && (
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "text-sm font-semibold",
                value >= (minValue ?? 100)
                  ? "text-green-600"
                  : "text-orange-500"
              )}
            >
              {value}%
            </div>
            {value >= (minValue ?? 0) ? (
              <CheckCircle2 size={16} className="text-green-500" />
            ) : (
              <File size={16} className="text-orange-500" />
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <XCircle size={12} /> {error}
        </div>
      )}
      {minValue !== undefined && (
        <div className="text-xs text-gray-400">
          要求：准确率必须达到 {minValue}% 才可继续
        </div>
      )}
    </div>
  );
}
