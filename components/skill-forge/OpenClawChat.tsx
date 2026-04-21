"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, User as UserIcon, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "agent" | "user" | "system";
  content: string;
  /** 可选：消息尾部渲染的自定义 React 节点（例如操作按钮、结果卡片） */
  attachment?: React.ReactNode;
  timestamp: number;
}

export type PlaybookStep =
  | {
      kind: "agent";
      content: string;
      /** 单条消息在 UI 上以打字机动效展示需要的时长 (ms) */
      duration?: number;
      attachment?: React.ReactNode;
    }
  | {
      kind: "progress";
      label: string;
      /** 进度条从 0 → 100 的总耗时 ms */
      duration: number;
    }
  | {
      kind: "user";
      content: string;
    };

interface Props {
  /** 顶部标题 */
  title?: string;
  /** 播放脚本：按顺序一条条输出到聊天区 */
  playbook: PlaybookStep[];
  /** 触发脚本自动播放（默认 true）；设为 false 可用于只接入手动推进 */
  autoplay?: boolean;
  /** 全部播放完毕后的回调 */
  onFinish?: () => void;
  /** 允许用户追加自由输入（演示版通常禁用，演示可控性优先） */
  userInputEnabled?: boolean;
}

/**
 * 脚本化 OpenClaw 对话面板（演示态 · Mock）
 * 所有消息按预设脚本滴出，配合进度条强化"AI 自动化"观感。
 */
export function OpenClawChat({
  title = "OpenClaw · 云 Agent",
  playbook,
  autoplay = true,
  onFinish,
  userInputEnabled = false,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(
    null
  );
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const finishedRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight + 100;
    }
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    if (step >= playbook.length) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish?.();
      }
      return;
    }
    const current = playbook[step];
    let cancelled = false;

    const advance = () => {
      if (!cancelled) setStep((s) => s + 1);
    };

    if (current.kind === "agent") {
      setTyping(true);
      const d = current.duration ?? 900;
      const t = setTimeout(() => {
        if (cancelled) return;
        setMessages((prev) => [
          ...prev,
          {
            id: `agent-${Date.now()}-${Math.random()}`,
            role: "agent",
            content: current.content,
            attachment: current.attachment,
            timestamp: Date.now(),
          },
        ]);
        setTyping(false);
        scrollToBottom();
        advance();
      }, d);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    if (current.kind === "user") {
      const t = setTimeout(() => {
        if (cancelled) return;
        setMessages((prev) => [
          ...prev,
          {
            id: `user-${Date.now()}-${Math.random()}`,
            role: "user",
            content: current.content,
            timestamp: Date.now(),
          },
        ]);
        scrollToBottom();
        advance();
      }, 400);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    if (current.kind === "progress") {
      setProgress({ label: current.label, value: 0 });
      const total = current.duration;
      const start = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - start;
        const v = Math.min(100, Math.round((elapsed / total) * 100));
        setProgress({ label: current.label, value: v });
        if (v >= 100) {
          clearInterval(timer);
          if (!cancelled) {
            setTimeout(() => {
              if (!cancelled) {
                setProgress(null);
                advance();
              }
            }, 200);
          }
        }
      }, 80);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }
  }, [step, playbook, autoplay, onFinish, scrollToBottom]);

  return (
    <div className="flex flex-col h-[560px] bg-gradient-to-b from-indigo-50/40 to-white rounded-2xl border border-indigo-100 overflow-hidden">
      <div className="px-3 py-2 border-b border-indigo-100 bg-white/70 flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-indigo-600 text-white flex items-center justify-center">
          <Bot size={14} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-gray-900">{title}</div>
          <div className="text-[10.5px] text-gray-500">
            演示态 · 脚本化回放 · 结果固化到 Bitable
          </div>
        </div>
        <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-indigo-600 text-white font-semibold inline-flex items-center gap-1">
          <Sparkles size={10} /> Mock Agent
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} msg={m} />
        ))}
        {typing && (
          <div className="flex items-center gap-2 text-[11px] text-indigo-600">
            <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center">
              <Bot size={12} />
            </div>
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce" />
              <span
                className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="h-1.5 w-1.5 rounded-full bg-indigo-600 animate-bounce"
                style={{ animationDelay: "240ms" }}
              />
            </span>
          </div>
        )}
        {progress && (
          <div className="rounded-xl border border-indigo-200 bg-white/80 p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-indigo-700 mb-1.5">
              <Loader2 className="animate-spin" size={12} />
              <span className="font-semibold">{progress.label}</span>
              <div className="flex-1" />
              <span className="text-[10.5px]">{progress.value}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-indigo-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                style={{ width: `${progress.value}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {userInputEnabled && (
        <div className="px-3 py-2 border-t bg-white">
          <div className="text-[10.5px] text-gray-400">
            演示态屏蔽自由输入，请跟随 AI 脚本推进。
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "system") {
    return (
      <div className="text-center text-[11px] text-gray-400 py-1">
        {msg.content}
      </div>
    );
  }
  const isAgent = msg.role === "agent";
  return (
    <div
      className={cn(
        "flex gap-2",
        isAgent ? "" : "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
          isAgent ? "bg-indigo-100 text-indigo-700" : "bg-blue-600 text-white"
        )}
      >
        {isAgent ? <Bot size={13} /> : <UserIcon size={13} />}
      </div>
      <div className="max-w-[80%]">
        <div
          className={cn(
            "rounded-2xl px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap",
            isAgent
              ? "bg-white border border-indigo-100 text-gray-800"
              : "bg-blue-600 text-white"
          )}
        >
          {msg.content}
        </div>
        {msg.attachment && <div className="mt-2">{msg.attachment}</div>}
      </div>
    </div>
  );
}
