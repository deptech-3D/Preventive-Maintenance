import * as XLSX from "xlsx";
import { Reading } from "./types";

export function exportReadingsToExcel(readings: Reading[], filename = "Meter_Checklist_Report"): void {
  if (!readings || readings.length === 0) {
    alert("Tidak ada data checklist meter untuk diexport.");
    return;
  }

  const workbook = XLSX.utils.book_new();

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return iso;
    }
  };

  const rows = readings.map((r, idx) => ({
    "No": idx + 1,
    "Tanggal & Waktu": formatDate(r.recorded_at),
    "Shift": (r.shift || "").toUpperCase(),
    "Titik Meter": r.meter_name,
    "Stand Awal": r.awal,
    "Stand Akhir": r.akhir,
    "Pemakaian": r.total,
    "Satuan": r.meter_unit,
    "Voltase (V)": r.voltase ?? "-",
    "Ampere (A)": r.ampere ?? "-",
    "LWBP": r.lwbp_akhir ?? r.lwbp ?? "-",
    "WBP": r.wbp_akhir ?? r.wbp ?? "-",
    "kVARh": r.kvar_akhir ?? r.kvar ?? "-",
    "Petugas": r.user_name,
    "Status Alarm": r.alarm ? "ALARM LONJAKAN" : "NORMAL",
    "Catatan": r.notes || "-",
    "Link Foto": r.photo_path || "-",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Auto column width
  const keys = Object.keys(rows[0] || {});
  worksheet["!cols"] = keys.map((key) => ({
    wch: Math.max(key.length + 3, 14),
  }));

  XLSX.utils.book_append_sheet(workbook, worksheet, "Checklist Meter");

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
