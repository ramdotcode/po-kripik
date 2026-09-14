// Bikin CSV + trigger download di browser. Tanpa library tambahan.

const cell = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Excel-friendly: bungkus kalau ada koma, kutip, atau newline
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers, rows) {
  const lines = [headers.map(cell).join(",")];
  for (const r of rows) lines.push(r.map(cell).join(","));
  // BOM biar Excel baca UTF-8 (nama produk pakai karakter non-ASCII)
  return "﻿" + lines.join("\r\n");
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob([toCsv(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// "Batch 1 — September" -> "batch-1-september"
export const slug = (s) =>
  String(s || "data")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "data";
