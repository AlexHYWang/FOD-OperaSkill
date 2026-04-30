"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SelectWithChevron({
  value,
  onChange,
  placeholder,
  disabled,
  children,
  selectClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  children: React.ReactNode;
  selectClassName?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          "w-full appearance-none rounded border px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-teal-300",
          disabled ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700",
          selectClassName
        )}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}
