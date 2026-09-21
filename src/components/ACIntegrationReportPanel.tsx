import React, { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  Copy,
  Check,
  CheckCircle2,
  Download,
  Mail,
  Send,
  ExternalLink,
  Thermometer,
  CalendarClock,
  Gauge,
  Activity,
  Filter,
  Sparkles,
  Layers,
  Building2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Share2,
  Calendar,
} from "lucide-react";
import {
  ACCategory,
  AC_CATEGORIES,
  ACMaintenanceLog,
  ACUnitScheduleStatus,
  normalizeACCategory,
  formatUnitCycleLabel,
  resolveFloorFromUnit,
  REAL_FLOORS,
  RealFloor,
} from "../types";
import {
  fetchACMaintenanceLogs,
  getACScheduleOverview,
  copyACLogsToClipboardAsTsv,
  copyACScheduleToClipboardAsTsv,
  exportACLogsToExcel,
  exportACMasterReportToExcel,
  downloadACLogsAsCsv,
  downloadACScheduleAsCsv,
  fetchAppSettings,
  updateAppSettings,
  fetchReadings,
  copyReadingsToClipboardAsTsv,
  fetchPlantLogs,
  copyPlantLogsToClipboardAsTsv,
  exportPlantLogsToExcel,
} from "../supabaseService";
import { exportReadingsToExcel } from "../excelExport";

interface ACIntegrationReportPanelProps {
  propertyName?: string;
}

export function ACIntegrationReportPanel({ propertyName = "Engineering Hotel" }: ACIntegrationReportPanelProps) {
  // Main Tab selector: AC PM is the primary theme!
  const [activeTab, setActiveTab] = useState<"ac_logs" | "ac_schedule" | "meter" | "plant">("ac_logs");

  // State for AC Logs tab
  const [acLogs, setAcLogs] = useState<ACMaintenanceLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [acCategoryFilter, setAcCategoryFilter] = useState<ACCategory | "all">("all");
  const [acDateFilter, setAcDateFilter] = useState<"all" | "30d" | "7d" | "today">("30d");
  const [copiedACLogsTsv, setCopiedACLogsTsv] = useState(false);
  const [copiedACFormula, setCopiedACFormula] = useState(false);
  const [copiedACWaSummary, setCopiedACWaSummary] = useState(false);
  const [acReportEmail, setAcReportEmail] = useState("engmidtownhotelsmd@gmail.com");
  const [sendingACEmail, setSendingACEmail] = useState(false);

  // State for AC Schedule tab
  const [acSchedule, setAcSchedule] = useState<ACUnitScheduleStatus[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleCategoryFilter, setScheduleCategoryFilter] = useState<ACCategory | "all">("all");
  const [scheduleFloorFilter, setScheduleFloorFilter] = useState<RealFloor | "all">("all");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<"all" | "overdue" | "approaching" | "safe">("all");
  const [copiedACScheduleTsv, setCopiedACScheduleTsv] = useState(false);
  const [copiedACScheduleWa, setCopiedACScheduleWa] = useState(false);

  // State for Checklist Meter tab (Preserved)
  const [formulaMode, setFormulaMode] = useState<string>("complete");
  const [meterReportEmail, setMeterReportEmail] = useState("engmidtownhotelsmd@gmail.com");
  const [copiedMeterFormula, setCopiedMeterFormula] = useState(false);
  const [copiedMeterTsv, setCopiedMeterTsv] = useState(false);
  const [sendingMeterReport, setSendingMeterReport] = useState(false);

  // State for Ruang Mesin tab (Preserved)
  const [plantFormulaMode, setPlantFormulaMode] = useState<"complete" | "lvmdp" | "genset" | "pompa" | "simple">("complete");
  const [plantReportEmail, setPlantReportEmail] = useState("engmidtownhotelsmd@gmail.com");
  const [copiedPlantFormula, setCopiedPlantFormula] = useState(false);
  const [copiedPlantTsv, setCopiedPlantTsv] = useState(false);
  const [sendingPlantReport, setSendingPlantReport] = useState(false);

  // Toast / notification message
  const [statusMsg, setStatusMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  // Global settings
  const [cycleMonths, setCycleMonths] = useState<number>(1);

  const loadACLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const data = await fetchACMaintenanceLogs();
      setAcLogs(data);
    } catch (err) {
      console.error("Gagal memuat log AC:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const loadACSchedule = useCallback(async () => {
    try {
      setLoadingSchedule(true);
      const data = await getACScheduleOverview();
      setAcSchedule(data);
    } catch (err) {
      console.error("Gagal memuat jadwal AC:", err);
    } finally {
      setLoadingSchedule(false);
    }
  }, []);

  useEffect(() => {
    loadACLogs();
    loadACSchedule();
    fetchAppSettings()
      .then((s) => {
        if (s?.ac_maintenance_cycle_months) setCycleMonths(s.ac_maintenance_cycle_months);
        if (s?.report_emails && s.report_emails.length > 0) {
          setAcReportEmail(s.report_emails[0]);
          setMeterReportEmail(s.report_emails[0]);
        }
        if (s?.plant_report_emails && s.plant_report_emails.length > 0) {
          setPlantReportEmail(s.plant_report_emails[0]);
        }
      })
      .catch(() => {});
  }, [loadACLogs, loadACSchedule]);

  // Filtered AC logs
  const filteredACLogs = acLogs.filter((log) => {
    if (acCategoryFilter !== "all" && normalizeACCategory(log.category) !== acCategoryFilter) {
      return false;
    }
    if (acDateFilter !== "all") {
      const now = new Date();
      const logDate = new Date(log.recorded_at);
      const diffMs = now.getTime() - logDate.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (acDateFilter === "today" && diffDays > 1) return false;
      if (acDateFilter === "7d" && diffDays > 7) return false;
      if (acDateFilter === "30d" && diffDays > 30) return false;
    }
    return true;
  });

  // Filtered AC schedule
  const filteredACSchedule = acSchedule.filter((item) => {
    if (scheduleCategoryFilter !== "all" && normalizeACCategory(item.unit.category) !== scheduleCategoryFilter) {
      return false;
    }
    if (scheduleFloorFilter !== "all" && resolveFloorFromUnit(item.unit) !== scheduleFloorFilter) {
      return false;
    }
    if (scheduleStatusFilter !== "all" && item.status !== scheduleStatusFilter) {
      return false;
    }
    return true;
  });

  // Schedule counters
  const scheduleCounts = {
    total: acSchedule.length,
    overdue: acSchedule.filter((s) => s.status === "overdue").length,
    approaching: acSchedule.filter((s) => s.status === "approaching").length,
    safe: acSchedule.filter((s) => s.status === "safe").length,
  };

  // -------------------------------------------------------------
  // AC LOGS HANDLERS
  // -------------------------------------------------------------
  const handleCopyACLogsTsv = async () => {
    try {
      setStatusMsg(null);
      if (filteredACLogs.length === 0) {
        setStatusMsg({ text: "Belum ada riwayat perawatan AC pada filter ini untuk disalin.", kind: "err" });
        return;
      }
      const res = await copyACLogsToClipboardAsTsv(filteredACLogs);
      setCopiedACLogsTsv(true);
      setTimeout(() => setCopiedACLogsTsv(false), 3500);
      setStatusMsg({
        text: `Berhasil menyalin ${res.rowCount} baris data riwayat perawatan AC ke clipboard! Buka Google Sheets & tekan Ctrl+V di sel A1.`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal menyalin: " + err.message, kind: "err" });
    }
  };

  const handleDownloadACLogsExcel = () => {
    try {
      if (filteredACLogs.length === 0) {
        setStatusMsg({ text: "Tidak ada data riwayat AC untuk diekspor ke Excel.", kind: "err" });
        return;
      }
      exportACLogsToExcel(filteredACLogs, propertyName);
      setStatusMsg({ text: `File Excel riwayat perawatan AC (${filteredACLogs.length} data) berhasil diunduh!`, kind: "ok" });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal mengunduh Excel: " + err.message, kind: "err" });
    }
  };

  const handleDownloadACMasterBook = () => {
    try {
      if (acLogs.length === 0 && acSchedule.length === 0) {
        setStatusMsg({ text: "Belum ada data AC untuk dibuatkan buku master.", kind: "err" });
        return;
      }
      exportACMasterReportToExcel(acLogs, acSchedule, propertyName, cycleMonths);
      setStatusMsg({
        text: "Buku Master Perawatan AC berhasil diunduh! Berisi 2 Sheet lengkap: Riwayat Cuci AC + Monitoring Jadwal.",
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal mengunduh Buku Master: " + err.message, kind: "err" });
    }
  };

  const handleDownloadACLogsCsv = () => {
    if (filteredACLogs.length === 0) {
      setStatusMsg({ text: "Tidak ada data riwayat AC untuk format CSV.", kind: "err" });
      return;
    }
    downloadACLogsAsCsv(filteredACLogs, `Laporan_Cuci_AC_${propertyName.replace(/\s+/g, "_")}.csv`);
  };

  const getACFormulaUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let url = `${origin}/api/export/csv?type=ac_maintenance&order=asc`;
    if (acCategoryFilter !== "all") {
      url += `&category=${encodeURIComponent(acCategoryFilter)}`;
    }
    return url;
  };

  const handleCopyACFormula = () => {
    const formula = `=IMPORTDATA("${getACFormulaUrl()}")`;
    navigator.clipboard.writeText(formula);
    setCopiedACFormula(true);
    setTimeout(() => setCopiedACFormula(false), 3000);
  };

  const handleCopyACWaSummary = () => {
    const todayStr = new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    let msg = `*LAPORAN PREVENTIVE MAINTENANCE AC & VRV*\n`;
    msg += `🏨 *Property:* ${propertyName}\n`;
    msg += `📅 *Tanggal Laporan:* ${todayStr}\n`;
    msg += `----------------------------------------\n\n`;
    msg += `📊 *RINGKASAN STATUS UNIT AC:*\n`;
    msg += `• Total Unit Terdaftar: ${scheduleCounts.total} unit\n`;
    msg += `• Lewat Jadwal (Perlu Cuci): ${scheduleCounts.overdue} unit 🚨\n`;
    msg += `• Mendekati Jatuh Tempo: ${scheduleCounts.approaching} unit ⏳\n`;
    msg += `• Kondisi Terawat / Aman: ${scheduleCounts.safe} unit ✅\n\n`;

    msg += `🧼 *AKTIVITAS PERAWATAN (${acDateFilter === "today" ? "Hari Ini" : acDateFilter === "7d" ? "7 Hari Terakhir" : "Periode Terkini"}):*\n`;
    msg += `• Total Pekerjaan Cuci: ${filteredACLogs.length} unit AC\n`;

    if (filteredACLogs.length > 0) {
      msg += `\n*5 Pekerjaan Cuci Terakhir:*\n`;
      filteredACLogs.slice(0, 5).forEach((l, idx) => {
        const d = new Date(l.recorded_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
        const drop = (l.temp_before - l.temp_after).toFixed(1);
        msg += `${idx + 1}. [${d}] *${l.unit_name}* (${l.category}) - Suhu: ${l.temp_before}°C ➔ ${l.temp_after}°C (Turun ${drop}°C) | Tek: ${l.user_name}\n`;
      });
    }

    const urgentList = acSchedule.filter((s) => s.status === "overdue").slice(0, 5);
    if (urgentList.length > 0) {
      msg += `\n🚨 *PRIORITAS CUCI BERIKUTNYA (OVERDUE):*\n`;
      urgentList.forEach((s, idx) => {
        msg += `${idx + 1}. *${s.unit.name}* (${resolveFloorFromUnit(s.unit)}) - Lewat ${Math.abs(s.days_remaining)} hari\n`;
      });
    }

    msg += `\nSalam,\n*Departemen Engineering*`;

    navigator.clipboard.writeText(msg);
    setCopiedACWaSummary(true);
    setTimeout(() => setCopiedACWaSummary(false), 3500);
    setStatusMsg({
      text: "Ringkasan Laporan Perawatan AC berhasil disalin! Siap dipaste ke grup WhatsApp manajemen.",
      kind: "ok",
    });
  };

  const handleSendACEmailReport = async () => {
    if (!acReportEmail || !acReportEmail.trim()) {
      setStatusMsg({ text: "Alamat email tujuan laporan wajib diisi.", kind: "err" });
      return;
    }
    setSendingACEmail(true);
    const cleanEmail = acReportEmail.trim();

    try {
      await updateAppSettings({ report_emails: [cleanEmail] });
      handleDownloadACMasterBook();

      const todayStr = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      let emailBody = `Yth. Manajemen & Tim Engineering,\n\nBerikut terlampir laporan ringkasan Preventive Maintenance AC (${propertyName}) per ${todayStr}:\n\n`;
      emailBody += `--- MONITORING JADWAL CUCI AC ---\n`;
      emailBody += `• Total Unit AC: ${scheduleCounts.total} unit\n`;
      emailBody += `• Perlu Segera Dicuci (Overdue): ${scheduleCounts.overdue} unit\n`;
      emailBody += `• Mendekati Jatuh Tempo (H-7): ${scheduleCounts.approaching} unit\n`;
      emailBody += `• Unit Terawat Aman: ${scheduleCounts.safe} unit\n\n`;
      emailBody += `--- AKTIVITAS CUCI TERAKHIR ---\n`;
      emailBody += `• Total Log Pekerjaan: ${filteredACLogs.length} pencatatan\n\n`;

      if (filteredACLogs.length > 0) {
        emailBody += `Daftar 5 Unit Terakhir Dicuci:\n`;
        filteredACLogs.slice(0, 5).forEach((l, i) => {
          emailBody += `${i + 1}. ${l.unit_name} (${l.category}) - Suhu: ${l.temp_before}°C -> ${l.temp_after}°C | Petugas: ${l.user_name}\n`;
        });
        emailBody += `\n*File Excel lengkap (2 Tab: Riwayat Cuci + Status Jadwal) telah otomatis diunduh ke perangkat Anda dan siap dilampirkan.*\n\n`;
      }

      emailBody += `Salam,\nDepartemen Engineering`;

      const subject = encodeURIComponent(`Laporan Preventive Maintenance AC - ${propertyName} (${todayStr})`);
      const body = encodeURIComponent(emailBody);
      window.location.href = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;

      setStatusMsg({
        text: `Buku Excel AC berhasil diunduh dan aplikasi email (Gmail) dibuka untuk: ${cleanEmail}`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal memproses email: " + err.message, kind: "err" });
    } finally {
      setSendingACEmail(false);
    }
  };

  // -------------------------------------------------------------
  // AC SCHEDULE HANDLERS
  // -------------------------------------------------------------
  const handleCopyACScheduleTsv = async () => {
    try {
      setStatusMsg(null);
      if (filteredACSchedule.length === 0) {
        setStatusMsg({ text: "Tidak ada data jadwal unit pada filter ini untuk disalin.", kind: "err" });
        return;
      }
      const res = await copyACScheduleToClipboardAsTsv(filteredACSchedule, cycleMonths);
      setCopiedACScheduleTsv(true);
      setTimeout(() => setCopiedACScheduleTsv(false), 3500);
      setStatusMsg({
        text: `Berhasil menyalin ${res.rowCount} baris tabel jadwal & jatuh tempo AC! Buka Google Sheets & tekan Ctrl+V di sel A1.`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal menyalin: " + err.message, kind: "err" });
    }
  };

  const handleDownloadACScheduleCsv = () => {
    if (filteredACSchedule.length === 0) {
      setStatusMsg({ text: "Tidak ada data jadwal untuk format CSV.", kind: "err" });
      return;
    }
    downloadACScheduleAsCsv(filteredACSchedule, cycleMonths, `Monitoring_Jadwal_AC_${propertyName.replace(/\s+/g, "_")}.csv`);
  };

  const handleCopyUrgentUnitsWa = () => {
    const urgentList = acSchedule.filter((s) => s.status === "overdue" || s.status === "approaching");
    if (urgentList.length === 0) {
      setStatusMsg({ text: "Semua unit AC saat ini berstatus Aman! Tidak ada unit mendesak.", kind: "ok" });
      return;
    }

    let msg = `🚨 *TARGET CUCI AC MINGGU INI (PRIORITAS JATUH TEMPO)*\n`;
    msg += `🏨 *Property:* ${propertyName}\n`;
    msg += `Total Unit Mendesak: ${urgentList.length} Unit\n`;
    msg += `----------------------------------------\n\n`;

    const overdueList = urgentList.filter((s) => s.status === "overdue");
    if (overdueList.length > 0) {
      msg += `🔴 *LEWAT JADWAL (HARUS SEGERA DICUCI):*\n`;
      overdueList.forEach((s, idx) => {
        const floor = resolveFloorFromUnit(s.unit);
        msg += `${idx + 1}. *${s.unit.name}* (${floor} - ${s.unit.category})\n   └ Terlambat: ${Math.abs(s.days_remaining)} Hari | Siklus: ${formatUnitCycleLabel(s.unit, cycleMonths)}\n`;
      });
      msg += `\n`;
    }

    const approachingList = urgentList.filter((s) => s.status === "approaching");
    if (approachingList.length > 0) {
      msg += `🟡 *MENDEKATI JATUH TEMPO (H-7):*\n`;
      approachingList.forEach((s, idx) => {
        const floor = resolveFloorFromUnit(s.unit);
        msg += `${idx + 1}. *${s.unit.name}* (${floor})\n   └ Sisa: ${s.days_remaining} Hari lagi | Terakhir Cuci: ${s.last_cleaned_date ? new Date(s.last_cleaned_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "-"}\n`;
      });
    }

    msg += `\nMohon tim engineering menjadwalkan cuci unit di atas.\nTerima kasih.`;

    navigator.clipboard.writeText(msg);
    setCopiedACScheduleWa(true);
    setTimeout(() => setCopiedACScheduleWa(false), 3500);
    setStatusMsg({
      text: `Daftar ${urgentList.length} unit prioritas cuci berhasil disalin ke format WhatsApp!`,
      kind: "ok",
    });
  };

  // -------------------------------------------------------------
  // METER HANDLERS (PRESERVED)
  // -------------------------------------------------------------
  const getMeterFormulaUrl = (mode = formulaMode) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (mode === "pln") return `${origin}/api/export/csv?system=pln&order=asc`;
    if (mode === "pdam") return `${origin}/api/export/csv?system=pdam&order=asc`;
    if (mode === "rooftop") return `${origin}/api/export/csv?system=rooftop&order=asc`;
    if (mode === "stp") return `${origin}/api/export/csv?system=stp&order=asc`;
    if (mode === "gas") return `${origin}/api/export/csv?system=gas&order=asc`;
    if (mode === "simple") return `${origin}/api/export/csv?details=simple&order=asc`;
    return `${origin}/api/export/csv?order=asc`;
  };

  const handleCopyMeterFormula = (overrideMode?: string) => {
    const mode = overrideMode || formulaMode;
    const formula = `=IMPORTDATA("${getMeterFormulaUrl(mode)}")`;
    navigator.clipboard.writeText(formula);
    setCopiedMeterFormula(true);
    setTimeout(() => setCopiedMeterFormula(false), 3000);
  };

  const handleCopyMeterTsv = async () => {
    try {
      setStatusMsg(null);
      const readingsData = await fetchReadings({ limit: 1000 });
      if (!readingsData || readingsData.length === 0) {
        setStatusMsg({ text: "Belum ada data pencatatan meteran untuk disalin.", kind: "err" });
        return;
      }
      let filtered = readingsData;
      if (formulaMode === "pln") {
        filtered = readingsData.filter((r) => r.meter_id === "menu_pln" || (r.meter_name && r.meter_name.toUpperCase().includes("PLN")));
      } else if (formulaMode === "pdam") {
        filtered = readingsData.filter((r) => r.meter_id === "menu_pdam" || (r.meter_name && r.meter_name.toUpperCase().includes("PDAM")));
      } else if (formulaMode === "rooftop") {
        filtered = readingsData.filter((r) => r.meter_id === "menu_rooftop" || (r.meter_name && r.meter_name.toUpperCase().includes("ROOFTOP")));
      } else if (formulaMode === "stp") {
        filtered = readingsData.filter((r) => r.meter_id === "menu_stp" || (r.meter_name && r.meter_name.toUpperCase().includes("STP")));
      } else if (formulaMode === "gas") {
        filtered = readingsData.filter((r) => r.meter_id === "menu_gas" || (r.meter_name && r.meter_name.toUpperCase().includes("GAS")));
      }
      if (filtered.length === 0) filtered = readingsData;

      const res = await copyReadingsToClipboardAsTsv(filtered, formulaMode);
      setCopiedMeterTsv(true);
      setTimeout(() => setCopiedMeterTsv(false), 3500);
      setStatusMsg({
        text: `Berhasil menyalin ${res.rowCount} baris data tabel meteran (${formulaMode.toUpperCase()}) ke clipboard! Buka Google Sheets dan tekan Ctrl+V pada sel A1.`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: err?.message || "Gagal menyalin tabel data meteran", kind: "err" });
    }
  };

  const handleSendMeterEmailReport = async () => {
    if (!meterReportEmail || !meterReportEmail.trim()) {
      setStatusMsg({ text: "Alamat email tujuan wajib diisi", kind: "err" });
      return;
    }
    setSendingMeterReport(true);
    const cleanEmail = meterReportEmail.trim();

    try {
      await updateAppSettings({ report_emails: [cleanEmail] });
      const readingsData = await fetchReadings({ limit: 100 });
      if (readingsData && readingsData.length > 0) {
        exportReadingsToExcel(readingsData, "Laporan_Meteran_Hotel");
      }
      const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      let summaryText = `Yth. Manajemen & Tim Engineering,\n\nBerikut terlampir ringkasan data pencatatan checklist meteran utilitas (${propertyName}) per ${todayStr}:\n\n`;
      summaryText += `Total Data Terakhir: ${readingsData.length} pencatatan\n`;
      if (readingsData.length > 0) {
        summaryText += `--- 5 PENCATATAN TERAKHIR ---\n`;
        readingsData.slice(0, 5).forEach((r, i) => {
          summaryText += `${i + 1}. [${r.meter_name}] Stand: ${r.awal} -> ${r.akhir} | Pemakaian: ${r.total} ${r.meter_unit} | Petugas: ${r.user_name}\n`;
        });
        summaryText += `\n*File Excel (.xlsx) otomatis diunduh dan siap dilampirkan ke email ini.*\n`;
      }
      summaryText += `\nSalam,\nDepartemen Engineering`;

      const subject = encodeURIComponent(`Laporan Harian Checklist Meteran - ${propertyName} (${todayStr})`);
      const body = encodeURIComponent(summaryText);
      window.location.href = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;

      setStatusMsg({
        text: `File Excel meteran berhasil diunduh dan aplikasi email (Gmail) dibuka untuk: ${cleanEmail}`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Data email tujuan berhasil disimpan: " + cleanEmail, kind: "ok" });
    } finally {
      setSendingMeterReport(false);
    }
  };

  // -------------------------------------------------------------
  // PLANT LOGS HANDLERS (PRESERVED)
  // -------------------------------------------------------------
  const getPlantFormulaUrl = (mode = plantFormulaMode) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (mode === "lvmdp") return `${origin}/api/export/plant-logs/csv?mode=lvmdp&order=asc`;
    if (mode === "genset") return `${origin}/api/export/plant-logs/csv?mode=genset&order=asc`;
    if (mode === "pompa") return `${origin}/api/export/plant-logs/csv?mode=pompa&order=asc`;
    if (mode === "simple") return `${origin}/api/export/plant-logs/csv?mode=simple&order=asc`;
    return `${origin}/api/export/plant-logs/csv?order=asc`;
  };

  const handleCopyPlantFormula = (overrideMode?: "complete" | "lvmdp" | "genset" | "pompa" | "simple") => {
    const mode = overrideMode || plantFormulaMode;
    const formula = `=IMPORTDATA("${getPlantFormulaUrl(mode)}")`;
    navigator.clipboard.writeText(formula);
    setCopiedPlantFormula(true);
    setTimeout(() => setCopiedPlantFormula(false), 3000);
  };

  const handleCopyPlantTsv = async () => {
    try {
      const plantLogsData = await fetchPlantLogs();
      if (!plantLogsData || plantLogsData.length === 0) {
        setStatusMsg({ text: "Belum ada data log sheet ruang mesin untuk disalin.", kind: "err" });
        return;
      }
      const res = await copyPlantLogsToClipboardAsTsv(plantLogsData, plantFormulaMode);
      setCopiedPlantTsv(true);
      setTimeout(() => setCopiedPlantTsv(false), 3500);
      setStatusMsg({
        text: `Berhasil menyalin ${res.rowCount} baris data Ruang Mesin (${plantFormulaMode.toUpperCase()}) ke clipboard! Buka Google Sheets dan tekan Ctrl+V pada sel A1.`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal menyalin data: " + err.message, kind: "err" });
    }
  };

  const handleDownloadPlantExcel = async () => {
    try {
      const plantLogsData = await fetchPlantLogs();
      if (!plantLogsData || plantLogsData.length === 0) {
        setStatusMsg({ text: "Belum ada data log sheet ruang mesin untuk diexport.", kind: "err" });
        return;
      }
      exportPlantLogsToExcel(plantLogsData, propertyName, "all_sheets");
      setStatusMsg({ text: "File Excel Ruang Mesin berhasil diunduh (lengkap tab LVMDP, Genset, Pompa)!", kind: "ok" });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal mengunduh file Excel: " + err.message, kind: "err" });
    }
  };

  const handleSendPlantEmailReport = async () => {
    if (!plantReportEmail || !plantReportEmail.trim()) {
      setStatusMsg({ text: "Alamat email tujuan laporan ruang mesin wajib diisi", kind: "err" });
      return;
    }
    setSendingPlantReport(true);
    const cleanEmail = plantReportEmail.trim();

    try {
      await updateAppSettings({ plant_report_emails: [cleanEmail] });
      const plantLogsData = await fetchPlantLogs();
      if (plantLogsData && plantLogsData.length > 0) {
        exportPlantLogsToExcel(plantLogsData, propertyName);
      }
      const todayStr = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      let summaryText = `Yth. Manajemen & Tim Engineering,\n\nBerikut ringkasan status teknis Ruang Mesin (${propertyName}) per ${todayStr}:\n\n`;
      summaryText += `Total Data: ${plantLogsData.length} pencatatan\n`;
      summaryText += `\n*File Excel lengkap (.xlsx) telah diunduh dan siap dilampirkan.*\n\nSalam,\nDepartemen Engineering`;

      const subject = encodeURIComponent(`Laporan Ruang Mesin - ${propertyName} (${todayStr})`);
      const body = encodeURIComponent(summaryText);
      window.location.href = `mailto:${cleanEmail}?subject=${subject}&body=${body}`;

      setStatusMsg({
        text: `File Excel Ruang Mesin diunduh dan aplikasi email (Gmail) dibuka untuk: ${cleanEmail}`,
        kind: "ok",
      });
    } catch (err: any) {
      setStatusMsg({ text: "Gagal memproses email: " + err.message, kind: "err" });
    } finally {
      setSendingPlantReport(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      {/* Toast Alert */}
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 animate-fadeIn ${
            statusMsg.kind === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            onClick={() => setStatusMsg(null)}
            className="text-slate-400 hover:text-slate-700 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900 tracking-tight">
                Integrasi Google Sheets, Excel & Laporan Otomatis
              </h2>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-full">
                Live Sync
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Salin data tabel rapi, download Excel multi-sheet, formula live feed, dan rekap otomatis WhatsApp/Email.
            </p>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200/80 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ac_logs")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "ac_logs"
                ? "bg-white text-blue-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Thermometer className="w-3.5 h-3.5 text-blue-600" />
            <span>Perawatan AC & VRV</span>
            <span className="px-1.5 py-0.2 bg-blue-600 text-white text-[9px] font-black rounded-full">
              Utama
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ac_schedule")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "ac_schedule"
                ? "bg-white text-indigo-700 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Jadwal & Jatuh Tempo</span>
            {scheduleCounts.overdue > 0 && (
              <span className="px-1.5 py-0.2 bg-red-500 text-white text-[9px] font-black rounded-full animate-pulse">
                {scheduleCounts.overdue}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("meter")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "meter"
                ? "bg-white text-emerald-800 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-emerald-600" />
            <span>Checklist Meter</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("plant")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeTab === "plant"
                ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-slate-600" />
            <span>Ruang Mesin</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PERAWATAN AC & VRV (LOG CUCI AC) - TEMA UTAMA APLIKASI */}
      {/* ========================================================================= */}
      {activeTab === "ac_logs" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1.5">
                <Thermometer className="w-3 h-3 text-blue-600" />
                Data Khusus: Preventive Maintenance AC & Outdoor VRV
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                Total: {filteredACLogs.length} Log Cuci
              </span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1.5 w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync AC PM
            </span>
          </div>

          {/* Q&A Confirmation Banner (Matching user preferred method) */}
          <div className="p-4 bg-gradient-to-r from-blue-50/90 to-indigo-50/80 border border-blue-200/90 rounded-2xl text-xs text-blue-950 space-y-1.5">
            <div className="font-extrabold flex items-center gap-2 text-blue-950 text-sm">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Bisa! Data riwayat perawatan AC dapat disalin langsung ke Google Sheets & Excel secara rapi.</span>
            </div>
            <p className="text-blue-900 text-[11px] leading-relaxed pl-6">
              Gunakan <strong>Metode 1 (Salin Tabel)</strong> untuk menaruh hasil cuci AC langsung ke Google Sheets tanpa kendala formula atau login. Atau gunakan <strong>Metode 2 (Download Excel)</strong> untuk arsip resmi hotel dengan sheet dan rumus yang sudah tertata rapi.
            </p>
          </div>

          {/* Kategori Area Filter (5 Kategori) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                <span>Pilih Kategori Area untuk Laporan:</span>
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                {(["all", "30d", "7d", "today"] as const).map((df) => (
                  <button
                    key={df}
                    type="button"
                    onClick={() => setAcDateFilter(df)}
                    className={`px-2 py-0.5 rounded-md font-bold transition cursor-pointer ${
                      acDateFilter === df
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {df === "all" ? "Semua Waktu" : df === "30d" ? "30 Hari" : df === "7d" ? "7 Hari" : "Hari Ini"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setAcCategoryFilter("all")}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  acCategoryFilter === "all"
                    ? "bg-white text-blue-700 shadow-xs border border-blue-300"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">Semua Kategori</span>
                <span className="block text-[10px] font-normal text-slate-500">14 Kolom Lengkap</span>
              </button>

              {AC_CATEGORIES.map((cat) => {
                const shortLabel = cat.replace("Area ", "").replace("Ruang ", "");
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAcCategoryFilter(cat)}
                    className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                      acCategoryFilter === cat
                        ? "bg-white text-blue-700 shadow-xs border border-blue-300"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title={cat}
                  >
                    <span className="block truncate">{shortLabel}</span>
                    <span className="block text-[10px] font-normal text-slate-500 truncate">
                      {cat.includes("VRV") ? "Outdoor" : cat.includes("Kamar") ? "Kamar" : "Fasilitas"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ============================================================== */}
          {/* METODE 1: SALIN TABEL KE GOOGLE SHEETS (PALING RAPI & CEPAT) */}
          {/* ============================================================== */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                    Metode 1: Salin Tabel ke Google Sheets (Paling Rapi & Cepat)
                  </span>
                </div>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  Klik tombol di samping &rarr; buka <strong>Google Sheets</strong> &rarr; klik sel <strong>A1</strong> &rarr; tekan <strong>Ctrl + V</strong> (Paste). Tabel tersusun rapi dengan urutan update baru berada di baris paling bawah tanpa kendala login atau verifikasi cookie.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyACLogsTsv}
                  disabled={loadingLogs}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  {copiedACLogsTsv ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>
                        Salin Tabel ({acCategoryFilter === "all" ? "SEMUA" : "TERFILTER"})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* METODE 2: UNDUH FILE EXCEL (.XLSX) RESMI & MULTI-SHEET */}
          {/* ============================================================== */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Metode 2: Unduh File Excel Resmi (.xlsx) & CSV
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Dapatkan file spreadsheet Excel lengkap dengan header berwarna, lebar kolom otomatis, dan perhitungan delta penurunan suhu serta hembusan angin.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={handleDownloadACLogsExcel}
                  className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh log riwayat perawatan yang terfilter"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Excel Log Cuci</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadACMasterBook}
                  className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Unduh 2 Sheet sekaligus: Riwayat Cuci + Monitoring Jadwal"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Buku Master AC (2 Sheet)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadACLogsCsv}
                  className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* ============================================================== */}
          {/* METODE 3: FORMULA OTOMATIS (=IMPORTDATA) */}
          {/* ============================================================== */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <span>Metode 3: Formula Otomatis Google Sheets (=IMPORTDATA):</span>
              </label>
              <button
                type="button"
                onClick={handleDownloadACLogsCsv}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>Unduh File CSV Langsung</span>
                <Download className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-slate-900 text-blue-300 font-mono text-xs rounded-xl overflow-x-auto select-all border border-slate-800">
                {`=IMPORTDATA("${getACFormulaUrl()}")`}
              </div>
              <button
                type="button"
                onClick={handleCopyACFormula}
                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border border-slate-200 shadow-sm cursor-pointer"
              >
                {copiedACFormula ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-600" />
                    <span>Salin Formula</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table Gabungan Struktur Kolom (Visual Pills like user screenshot) */}
          <div className="text-[11px] bg-blue-50/70 border border-blue-200/70 p-3.5 rounded-xl space-y-1.5 text-blue-950">
            <div className="font-bold flex items-center gap-1.5 text-blue-900">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Tabel Riwayat Perawatan AC (13 Kolom Terstruktur Rapi):</span>
            </div>
            <p className="text-blue-800 leading-relaxed pl-5">
              Menampilkan seluruh data riwayat cuci AC hotel secara lengkap tanpa teks berhamburan. Setiap baris mewakili 1 pekerjaan cuci AC dengan susunan kolom:
            </p>
            <div className="pt-1 pl-5 flex flex-wrap gap-1 text-[10px] text-blue-900 font-medium">
              {[
                "No",
                "Tanggal",
                "Jam",
                "Kategori Area",
                "Ruangan / Unit",
                "Nama Teknisi",
                "Suhu Before (°C)",
                "Suhu After (°C)",
                "Penurunan Suhu (°C)",
                "Anemometer Before (m/s)",
                "Anemometer After (m/s)",
                "Peningkatan Angin (m/s)",
                "Catatan Kondisi",
              ].map((col) => (
                <span key={col} className="bg-white/90 px-2 py-0.5 rounded border border-blue-300/80 font-semibold">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* ============================================================== */}
          {/* METODE 4: REKAP FORMAT LAPORAN WHATSAPP & EMAIL OTOMATIS */}
          {/* ============================================================== */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Metode 4: Salin Format WhatsApp & Kirim Email Laporan:</span>
              </label>
              <button
                type="button"
                onClick={handleCopyACWaSummary}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer w-fit"
              >
                {copiedACWaSummary ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Format WA Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Format Ringkasan WhatsApp</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={acReportEmail}
                onChange={(e) => setAcReportEmail(e.target.value)}
                placeholder="engmidtownhotelsmd@gmail.com"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleSendACEmailReport}
                disabled={sendingACEmail}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{sendingACEmail ? "Membuka Email..." : "Kirim Laporan via Email (Gmail)"}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Saat tombol <strong>"Kirim Laporan via Email"</strong> ditekan, aplikasi akan otomatis mengunduh <strong>Buku Master Excel (.xlsx)</strong> lengkap dan langsung membuka Gmail / Email di perangkat Anda dengan format pesan dan ringkasan status siap kirim ke manajemen hotel.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MONITORING JADWAL & JATUH TEMPO CUCI AC */}
      {/* ========================================================================= */}
      {activeTab === "ac_schedule" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1.5">
                <CalendarClock className="w-3 h-3 text-indigo-600" />
                Data Khusus: Monitoring Jadwal & Siklus Jatuh Tempo AC
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                Total: {filteredACSchedule.length} Unit
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyUrgentUnitsWa}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer w-fit"
            >
              {copiedACScheduleWa ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Daftar Mendesak Tersalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Salin Broadcast WA Unit Mendesak ({scheduleCounts.overdue + scheduleCounts.approaching})</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Unit Terdaftar</span>
              <span className="text-xl font-black text-slate-900">{scheduleCounts.total}</span>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-red-600 block">Lewat Jadwal (Overdue)</span>
              <span className="text-xl font-black text-red-700">{scheduleCounts.overdue}</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-amber-700 block">Mendekati Jatuh Tempo (H-7)</span>
              <span className="text-xl font-black text-amber-800">{scheduleCounts.approaching}</span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold uppercase text-emerald-700 block">Kondisi Terawat (Aman)</span>
              <span className="text-xl font-black text-emerald-800">{scheduleCounts.safe}</span>
            </div>
          </div>

          {/* Filters: Category & Floor & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">Filter Kategori:</label>
              <select
                value={scheduleCategoryFilter}
                onChange={(e) => setScheduleCategoryFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="all">Semua Kategori Area</option>
                {AC_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">Filter Lantai:</label>
              <select
                value={scheduleFloorFilter}
                onChange={(e) => setScheduleFloorFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="all">Semua Lantai Hotel</option>
                {REAL_FLOORS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">Status Jatuh Tempo:</label>
              <select
                value={scheduleStatusFilter}
                onChange={(e) => setScheduleStatusFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                <option value="all">Semua Status (Aman, Mendekati, Overdue)</option>
                <option value="overdue">Lewat Jadwal Saja (Overdue)</option>
                <option value="approaching">Mendekati Jatuh Tempo Saja (H-7)</option>
                <option value="safe">Kondisi Aman Saja</option>
              </select>
            </div>
          </div>

          {/* Primary Action Button: Salin Tabel Jadwal */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-700" />
                  <span className="text-xs font-black text-indigo-900 uppercase tracking-wider">
                    Metode 1: Salin Tabel Jadwal Jatuh Tempo ke Google Sheets
                  </span>
                </div>
                <p className="text-xs text-indigo-800 mt-1 leading-relaxed">
                  Salin seluruh daftar unit beserta <strong>durasi siklus cuci khusus, tanggal terakhir cuci, dan tanggal jatuh tempo berikutnya</strong> langsung ke Google Sheets.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyACScheduleTsv}
                  disabled={loadingSchedule}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  {copiedACScheduleTsv ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Salin Tabel Jadwal ({filteredACSchedule.length} Unit)</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadACScheduleCsv}
                  className="px-3 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Table Breakdown Info for Schedule */}
          <div className="text-[11px] bg-indigo-50/70 border border-indigo-200/70 p-3.5 rounded-xl space-y-1.5 text-indigo-950">
            <div className="font-bold flex items-center gap-1.5 text-indigo-900">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Struktur Kolom Monitoring Jadwal (11 Kolom Lengkap):</span>
            </div>
            <div className="pt-1 flex flex-wrap gap-1 text-[10px] text-indigo-900 font-medium">
              {[
                "No",
                "Nama Ruangan / Unit",
                "Lantai",
                "Kategori Area",
                "Durasi Siklus Cuci",
                "Terakhir Dicuci",
                "Tanggal Jatuh Tempo",
                "Status Jadwal",
                "Sisa Hari",
                "Teknisi Terakhir",
                "Catatan Unit",
              ].map((col) => (
                <span key={col} className="bg-white/90 px-2 py-0.5 rounded border border-indigo-300 font-semibold">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: CHECKLIST METERAN (PRESERVED) */}
      {/* ========================================================================= */}
      {activeTab === "meter" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider rounded-md">
                Data Khusus: Checklist Meter Utilitas
              </span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync Meter
            </span>
          </div>

          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Bisa! Data hasil pencatatan meteran dapat diakses langsung oleh Google Sheets.</span>
            </div>
            <p className="text-blue-800 text-[11px] leading-relaxed pl-5.5">
              Anda dapat menghubungkan Google Sheets menggunakan fungsi live feed (<code className="font-mono bg-blue-100 px-1 py-0.5 rounded font-bold">=IMPORTDATA</code>) sehingga setiap teknisi mengisi checklist meteran, spreadsheet otomatis terupdate secara real-time.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Formula Google Sheets Meteran (Live Feed):
              </label>
              <a
                href={getMeterFormulaUrl()}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Preview CSV Meteran</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setFormulaMode("complete")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "complete" ? "bg-white text-emerald-700 shadow-xs border border-emerald-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">Semua Sistem</span>
                <span className="block text-[10px] font-normal text-slate-500">18 Kolom</span>
              </button>
              <button
                type="button"
                onClick={() => setFormulaMode("pln")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "pln" ? "bg-white text-blue-700 shadow-xs border border-blue-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">PLN</span>
                <span className="block text-[10px] font-normal text-slate-500">Listrik</span>
              </button>
              <button
                type="button"
                onClick={() => setFormulaMode("pdam")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "pdam" ? "bg-white text-sky-700 shadow-xs border border-sky-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">PDAM</span>
                <span className="block text-[10px] font-normal text-slate-500">Air Bersih</span>
              </button>
              <button
                type="button"
                onClick={() => setFormulaMode("rooftop")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "rooftop" ? "bg-white text-cyan-700 shadow-xs border border-cyan-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">ROOFTOP</span>
                <span className="block text-[10px] font-normal text-slate-500">Air Atap</span>
              </button>
              <button
                type="button"
                onClick={() => setFormulaMode("stp")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "stp" ? "bg-white text-teal-700 shadow-xs border border-teal-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">STP</span>
                <span className="block text-[10px] font-normal text-slate-500">Limbah/Daur</span>
              </button>
              <button
                type="button"
                onClick={() => setFormulaMode("gas")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "gas" ? "bg-white text-amber-700 shadow-xs border border-amber-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">GAS</span>
                <span className="block text-[10px] font-normal text-slate-500">LPG Hotel</span>
              </button>
              <button
                type="button"
                onClick={() => setFormulaMode("simple")}
                className={`px-2.5 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  formulaMode === "simple" ? "bg-white text-slate-900 shadow-xs border border-slate-300" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block truncate">Ringkas</span>
                <span className="block text-[10px] font-normal text-slate-500">11 Kolom</span>
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                      Metode 1: Salin Tabel ke Google Sheets (Paling Rapi & Cepat)
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Klik tombol di samping &rarr; buka Google Sheets &rarr; klik sel <strong>A1</strong> &rarr; tekan <strong>Ctrl + V</strong> (Paste). Tabel tersusun rapi dengan urutan update baru berada di baris paling bawah.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyMeterTsv}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {copiedMeterTsv ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Tersalin ke Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Tabel ({formulaMode.toUpperCase()})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <span>Metode 2: Formula Otomatis (=IMPORTDATA):</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto select-all border border-slate-800">
                  {`=IMPORTDATA("${getMeterFormulaUrl()}")`}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyMeterFormula()}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border border-slate-200 shadow-sm cursor-pointer"
                >
                  {copiedMeterFormula ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Salin Formula</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Kirim Data Checklist Meter ke Email:</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={meterReportEmail}
                onChange={(e) => setMeterReportEmail(e.target.value)}
                placeholder="engmidtownhotelsmd@gmail.com"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
              />
              <button
                type="button"
                onClick={handleSendMeterEmailReport}
                disabled={sendingMeterReport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingMeterReport ? "Membuka Email..." : "Kirim Data ke Email (Gmail)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: RUANG MESIN (PLANT LOGS) (PRESERVED) */}
      {/* ========================================================================= */}
      {activeTab === "plant" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 text-[10px] font-extrabold uppercase tracking-wider rounded-md flex items-center gap-1">
                <Activity className="w-3 h-3 text-blue-600" />
                Data Khusus: Log Sheet Ruang Mesin
              </span>
            </div>
            <span className="px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-extrabold uppercase tracking-wider rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live Sync Ruang Mesin
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Formula Google Sheets Ruang Mesin (Live Real-Time Feed):
              </label>
              <a
                href={getPlantFormulaUrl()}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>Preview CSV Ruang Mesin</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPlantFormulaMode("complete")}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  plantFormulaMode === "complete" ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block">Semua Sistem</span>
                <span className="block text-[10px] font-normal text-slate-500">75 Kolom Lengkap</span>
              </button>
              <button
                type="button"
                onClick={() => setPlantFormulaMode("lvmdp")}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  plantFormulaMode === "lvmdp" ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block">Panel LVMDP</span>
                <span className="block text-[10px] font-normal text-slate-500">27 Kolom Listrik</span>
              </button>
              <button
                type="button"
                onClick={() => setPlantFormulaMode("genset")}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  plantFormulaMode === "genset" ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block">Genset 1 & 2</span>
                <span className="block text-[10px] font-normal text-slate-500">35 Kolom Mesin</span>
              </button>
              <button
                type="button"
                onClick={() => setPlantFormulaMode("pompa")}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  plantFormulaMode === "pompa" ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block">Pompa Transfer</span>
                <span className="block text-[10px] font-normal text-slate-500">18 Kolom Pompa</span>
              </button>
              <button
                type="button"
                onClick={() => setPlantFormulaMode("simple")}
                className={`px-2 py-2 text-xs font-bold rounded-lg transition text-center cursor-pointer ${
                  plantFormulaMode === "simple" ? "bg-white text-slate-900 shadow-xs border border-slate-200/80" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className="block">Ringkas</span>
                <span className="block text-[10px] font-normal text-slate-500">16 Kolom Kunci</span>
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                      Metode 1: Salin Langsung ke Google Sheets
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                    Klik tombol di samping &rarr; buka Google Sheets &rarr; klik sel <strong>A1</strong> &rarr; tekan <strong>Ctrl + V</strong> (Paste). Data tersusun rapi seketika tanpa login cloud.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyPlantTsv}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {copiedPlantTsv ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Tersalin ke Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Data ({plantFormulaMode.toUpperCase()})</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPlantExcel}
                    className="px-3.5 py-2.5 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Excel (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <span>Metode 2: Formula Otomatis (=IMPORTDATA):</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-900 text-blue-300 font-mono text-xs rounded-xl overflow-x-auto select-all border border-slate-800">
                  {`=IMPORTDATA("${getPlantFormulaUrl()}")`}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyPlantFormula()}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 border border-slate-200 shadow-sm cursor-pointer"
                >
                  {copiedPlantFormula ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-700">Tersalin!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Salin Rumus</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-blue-600" />
              <span>Kirim & Buatkan Laporan Ruang Mesin ke Email Penerima:</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="email"
                value={plantReportEmail}
                onChange={(e) => setPlantReportEmail(e.target.value)}
                placeholder="engmidtownhotelsmd@gmail.com"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
              />
              <button
                type="button"
                onClick={handleSendPlantEmailReport}
                disabled={sendingPlantReport}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sendingPlantReport ? "Membuka Email..." : "Kirim Laporan Ruang Mesin (Gmail)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
