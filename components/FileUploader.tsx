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

export type UploadStorage = "vercel-blob" | "feishu-api";

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
  /** 默认 feishu-api；评测集在开启 NEXT_PUBLIC_BLOB_UPLOAD_ENABLED 时用 vercel-blob */
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

async function uploadFile(
  file: File,
  options: {
    purpose?: "common" | "skill";
    maxSizeMB?: number;
    storage?: UploadStorage;
    handleBlobUploadUrl?: string;
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
  if (storage === "vercel-blob") {
    const handleUrl = options.handleBlobUploadUrl ?? "/api/upload/blob";
    try {
      const result = await vercelBlobUpload(blobPathname(file), file, {
        access: "public",
        handleUploadUrl: handleUrl,
        multipart: file.size >= 8 * 1024 * 1024,
      });
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
        throw new Error("Blob 未配置：请在环境变量中设置 BLOB_READ_WRITE_TOKEN，或暂时关闭 NEXT_PUBLIC_BLOB_UPLOAD_ENABLED");
      }
      throw err instanceof Error ? err : new Error(msg);
    }
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("purpose", options.purpose || "common");
  const res = await fetch("/api/upload", { method: "POST", body: formData });
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
        `文件「${file.name}」经服务端转发上传失败（请求体过大）。请在 Vercel 配置 BLOB_READ_WRITE_TOKEN 并设置 NEXT_PUBLIC_BLOB_UPLOAD_ENABLED=1 以启用直传。`
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
  uploaded = [],
  disabled,
  required,
}: MultiFileUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setError(null);
    setUploading(true);
    setProgress({ done: 0, total: arr.length });
    const results: UploadedFile[] = [];
    try {
      for (let i = 0; i < arr.length; i++) {
        const result = await uploadFile(arr[i], { purpose, maxSizeMB, storage, handleBlobUploadUrl });
        results.push(result);
        setProgress({ done: i + 1, total: arr.length });
      }
      onUpload([...uploaded, ...results]);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  const removeFile = (idx: number) => {
    onUpload(uploaded.filter((_, i) => i !== idx));
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
        {uploading && progress ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <Loader2 size={20} className="text-blue-500 animate-spin" />
            <span className="text-sm text-blue-600">
              上传中 {progress.done}/{progress.total}...
            </span>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
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
