export function asString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          return String(obj.text || obj.name || obj.link || "");
        }
        return "";
      })
      .filter(Boolean)
      .join("");
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj.text || obj.name || obj.link || obj.url || "");
  }
  return String(value);
}

export function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(asString(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function asBoolean(value: unknown): boolean {
  if (value === true || value === 1 || value === "true") return true;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function extractUrl(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return String(obj.link || obj.url || obj.text || "");
  }
  return "";
}

export function extractPersonNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((person) => {
      if (typeof person === "string") return person;
      if (person && typeof person === "object") {
        const obj = person as Record<string, unknown>;
        return String(obj.name || obj.en_name || obj.id || "");
      }
      return "";
    })
    .filter(Boolean);
}

export function extractPersonOpenIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((person) => {
      if (typeof person === "string") return person;
      if (person && typeof person === "object") {
        const obj = person as Record<string, unknown>;
        return String(obj.id || obj.open_id || "");
      }
      return "";
    })
    .filter(Boolean);
}

export function makeBitableFilter(parts: Array<string | false | undefined>): string | undefined {
  const filters = parts.filter(Boolean) as string[];
  if (filters.length === 0) return undefined;
  if (filters.length === 1) return filters[0];
  return `AND(${filters.join(",")})`;
}
