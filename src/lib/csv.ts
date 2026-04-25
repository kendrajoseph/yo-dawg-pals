// CSV serializer + browser download helper.
// Handles commas, quotes, newlines, and null/undefined safely.

export type CsvValue = string | number | boolean | null | undefined | Date;
export type CsvRow = Record<string, CsvValue>;

const escapeCell = (val: CsvValue): string => {
  if (val === null || val === undefined) return "";
  let s: string;
  if (val instanceof Date) {
    s = val.toISOString();
  } else if (typeof val === "boolean") {
    s = val ? "true" : "false";
  } else {
    s = String(val);
  }
  // Quote if it contains comma, quote, newline, or leading/trailing whitespace
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const rowsToCsv = (rows: CsvRow[], headers?: string[]): string => {
  if (rows.length === 0 && !headers) return "";
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const headerLine = cols.map((c) => escapeCell(c)).join(",");
  const lines = rows.map((row) => cols.map((c) => escapeCell(row[c])).join(","));
  return [headerLine, ...lines].join("\r\n");
};

export const downloadCsv = (filename: string, rows: CsvRow[], headers?: string[]) => {
  const csv = rowsToCsv(rows, headers);
  // Prepend BOM so Excel detects UTF-8
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const todayStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const isoDate = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const formatCentsForCsv = (cents: number | null | undefined) =>
  ((cents ?? 0) / 100).toFixed(2);
