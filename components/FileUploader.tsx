"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle2, XCircle, Loader2, File } from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadedFile {
  file_token: string;
  url: string;
  file_name: string;
  file_size: number;
}

interface FileUploaderProps {
  label: string;
  hint?: string;
  accept?: string;
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

export function FileUploader({
  label,
  hint,
  accept,
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
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "上传失败");
      }

      onUpload(data as UploadedFile);
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
        // 已上传状态
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-green-800 truncate">
              {uploaded.file_name}
            </div>
            <div className="text-xs text-green-600">
              {formatSize(uploaded.file_size)} · 已上传到飞书云盘
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
        // 上传区域
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
                <div className="text-sm text-gray-600">
                  点击或拖拽文件到此处上传
                </div>
                {accept && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    支持格式：{accept}
                  </div>
                )}
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
                value >= (minValue ?? 90)
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
          要求：准确率 ≥ {minValue}%（第二步要求达到 {minValue}% 才可继续）
        </div>
      )}
    </div>
  );
}
