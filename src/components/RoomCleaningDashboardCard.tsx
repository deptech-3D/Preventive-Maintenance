import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BedDouble,
  CheckCircle2,
  AlertCircle,
  Building2,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Search,
  Clock,
  Sparkles,
  Layers,
  Wrench,
  X,
  AlertTriangle,
  Target,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Table,
  Check,
} from "lucide-react";
import {
  ACUnitScheduleStatus,
  REAL_FLOORS,
  RealFloor,
  resolveFloorFromUnit,
  ACCategory,
  ACMaintenanceLog,
} from "../types";
import {
  getLocalACScheduleOverview,
  getACScheduleOverview,
  createACUnit,
  deleteACUnit,
  fetchACMaintenanceLogs,
  getLocalACLogs,
  fetchAppSettings,
} from "../supabaseService";
import { useAuth } from "../auth";

export interface RoomCleaningItem {
  id: string; // unique key `${floor}__${baseRoomName}`
  floor: string;
  roomName: string; // e.g. "Kamar 307" or "Kamar 1201"
  cleanRoomNumber: string; // e.g. "307", "1201"
  units: ACUnitScheduleStatus[];
  hasMultipleAC: boolean;
  isClean: boolean; // Opsi A: all units have status === 'safe' || status === 'approaching'
  isPartiallyClean: boolean; // 1 clean, 1 unclean
  lastCleanedDate: string | null;
  lastCleanedTech: string | null;
  minDaysRemaining: number;
}

interface RoomCleaningDashboardCardProps {
  onOpenACLog?: (unitId?: string) => void;
}

export function RoomCleaningDashboardCard({ onOpenACLog }: RoomCleaningDashboardCardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [scheduleList, setScheduleList] = useState<ACUnitScheduleStatus[]>(() =>
    getLocalACScheduleOverview()
  );
  const [isOpen, setIsOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "clean" | "unclean">("all");
  const [selectedFloor, setSelectedFloor] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dualACModalRoom, setDualACModalRoom] = useState<RoomCleaningItem | null>(null);

  // Monthly Budget Target States
  const [acLogs, setAcLogs] = useState<ACMaintenanceLog[]>(() => getLocalACLogs());
  const [multiplier, setMultiplier] = useState<number>(2);
  const [selectedMonthDate, setSelectedMonthDate] = useState<Date>(() => new Date());
  const [showMonthlyRoomList, setShowMonthlyRoomList] = useState(false);

  // Admin Add Room Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoomFloor, setNewRoomFloor] = useState<RealFloor>("Lantai 3");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomDualAC, setNewRoomDualAC] = useState(false);
  const [newRoomNotes, setNewRoomNotes] = useState("Daikin AC Split Duct");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Admin Delete Room Modal State
  const [roomToDelete, setRoomToDelete] = useState<RoomCleaningItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load schedule data
  const loadData = useCallback(async () => {
    try {
      const [statuses, logs, appSettings] = await Promise.all([
        getACScheduleOverview(),
        fetchACMaintenanceLogs(),
        fetchAppSettings(),
      ]);
      setScheduleList(statuses);
      if (Array.isArray(logs)) {
        setAcLogs(logs);
      }
      if (appSettings?.ac_room_daily_budget_multiplier) {
        setMultiplier(appSettings.ac_room_daily_budget_multiplier);
      }
    } catch (err) {
      console.error("Gagal memuat status jadwal kamar:", err);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleSynced = () => {
      setScheduleList(getLocalACScheduleOverview());
      setAcLogs(getLocalACLogs());
    };

    const handleSettingsSynced = (e: Event) => {
      const s = (e as CustomEvent)?.detail;
      if (s?.ac_room_daily_budget_multiplier) {
        setMultiplier(s.ac_room_daily_budget_multiplier);
      }
    };

    window.addEventListener("ac-data-synced", handleSynced);
    window.addEventListener("app-settings-synced", handleSettingsSynced);
    return () => {
      window.removeEventListener("ac-data-synced", handleSynced);
      window.removeEventListener("app-settings-synced", handleSettingsSynced);
    };
  }, [loadData]);

  // Extract and group kamar units into real rooms (1 kamar = 1 item, multiple ACs grouped together)
  const roomItems: RoomCleaningItem[] = useMemo(() => {
    // 1. Filter out only room units (exclude corridors, public areas, VRV, etc.)
    const roomUnits = scheduleList.filter((s) => {
      const cat = s.unit.category;
      const name = s.unit.name.toLowerCase();
      const isKamarCat = cat === "Area Privat / Kamar Hotel" || cat === ("Kamar Hotel" as ACCategory);
      const isRoomName = name.includes("kamar") || /^\d{3,4}/.test(name.trim());
      const isCorridor = name.includes("koridor");
      return isKamarCat && isRoomName && !isCorridor;
    });

    // 2. Group by Floor + Base Room Name
    const map = new Map<string, ACUnitScheduleStatus[]>();
    for (const item of roomUnits) {
      const fl = resolveFloorFromUnit(item.unit);
      // Remove trailing suffix A/B or number like "Kamar 1201 A" -> "Kamar 1201"
      const rawName = item.unit.name.trim();
      const baseRoomName = rawName.replace(/\s+[A-Za-z0-9]$/, "").trim();
      const key = `${fl}__${baseRoomName}`;

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
    }

    // 3. Transform groups into RoomCleaningItem
    const results: RoomCleaningItem[] = [];

    for (const [key, units] of map.entries()) {
      const [floor, roomName] = key.split("__");
      // Sort units by name (e.g. Unit A before Unit B)
      units.sort((a, b) => a.unit.name.localeCompare(b.unit.name));

      // Opsi A: An AC unit is clean if it has a log and status is "safe" or "approaching"
      const cleanUnits = units.filter(
        (u) => u.status === "safe" || u.status === "approaching"
      );
      const isClean = cleanUnits.length === units.length;
      const isPartiallyClean = cleanUnits.length > 0 && cleanUnits.length < units.length;

      // Find latest cleaned date and tech
      let latestDate: string | null = null;
      let latestTech: string | null = null;
      let minDays = 99999;

      for (const u of units) {
        if (u.last_cleaned_date) {
          if (!latestDate || new Date(u.last_cleaned_date).getTime() > new Date(latestDate).getTime()) {
            latestDate = u.last_cleaned_date;
            latestTech = u.last_log?.user_name || null;
          }
        }
        if (u.days_remaining !== undefined && u.days_remaining < minDays) {
          minDays = u.days_remaining;
        }
      }

      // Extract number for sorting (e.g. "Kamar 307" -> 307)
      const numMatch = roomName.match(/\d+/);
      const cleanNum = numMatch ? numMatch[0] : roomName;

      results.push({
        id: key,
        floor,
        roomName,
        cleanRoomNumber: cleanNum,
        units,
        hasMultipleAC: units.length > 1,
        isClean,
        isPartiallyClean,
        lastCleanedDate: latestDate,
        lastCleanedTech: latestTech,
        minDaysRemaining: minDays === 99999 ? -9999 : minDays,
      });
    }

    // Sort by floor order, then by room number ascending
    const floorOrder = [
      "Lantai 3",
      "Lantai 5",
      "Lantai 6",
      "Lantai 7",
      "Lantai 8",
      "Lantai 9",
      "Lantai 10",
      "Lantai 11",
      "Lantai 12",
    ];

    results.sort((a, b) => {
      const idxA = floorOrder.indexOf(a.floor);
      const idxB = floorOrder.indexOf(b.floor);
      if (idxA !== -idxB) {
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
      }
      const numA = parseInt(a.cleanRoomNumber, 10);
      const numB = parseInt(b.cleanRoomNumber, 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.roomName.localeCompare(b.roomName);
    });

    return results;
  }, [scheduleList]);

  // Overall Metrics
  const totalRooms = roomItems.length;
  const cleanRooms = useMemo(() => roomItems.filter((r) => r.isClean), [roomItems]);
  const uncleanRooms = useMemo(() => roomItems.filter((r) => !r.isClean), [roomItems]);

  const cleanCount = cleanRooms.length;
  const uncleanCount = uncleanRooms.length;
  const percentClean = totalRooms > 0 ? Math.round((cleanCount / totalRooms) * 100) : 0;

  // Month Navigator Handlers
  const handlePrevMonth = () => {
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleCurrentMonth = () => {
    setSelectedMonthDate(new Date());
  };

  // Monthly Budget Target Calculation
  const monthlyStats = useMemo(() => {
    const year = selectedMonthDate.getFullYear();
    const month = selectedMonthDate.getMonth(); // 0-11
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const now = new Date();
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    const isFutureMonth = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
    const currentDay = isCurrentMonth ? now.getDate() : daysInMonth;
    const daysRemaining = Math.max(0, daysInMonth - currentDay);

    const mult = multiplier > 0 ? multiplier : 2;
    const targetMonthly = daysInMonth * mult;
    const targetToDate = currentDay * mult;

    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];
    const monthName = monthNames[month] || `Bulan ${month + 1}`;
    const monthLabel = `${monthName} ${year}`;

    // Filter room cleaning logs for this month
    const roomLogsInMonth = (acLogs || []).filter((l) => {
      if (!l || !l.recorded_at) return false;
      const dt = new Date(l.recorded_at);
      if (isNaN(dt.getTime())) return false;
      if (dt.getFullYear() !== year || dt.getMonth() !== month) return false;

      const cat = l.category;
      const name = (l.unit_name || "").toLowerCase();
      const isKamarCat = cat === "Area Privat / Kamar Hotel" || cat === ("Kamar Hotel" as ACCategory);
      const isRoomName = name.includes("kamar") || /^\d{3,4}/.test(name.trim());
      const isCorridor = name.includes("koridor");
      return (isKamarCat || isRoomName) && !isCorridor;
    });

    // Group unique rooms (e.g. "Kamar 1201 A" and "Kamar 1201 B" are 1 room "Kamar 1201")
    const uniqueRoomsMap = new Map<
      string,
      {
        roomName: string;
        cleanDate: string;
        technician: string;
        unitCount: number;
      }
    >();

    for (const log of roomLogsInMonth) {
      const rawName = (log.unit_name || "").trim();
      const baseRoomName = rawName.replace(/\s+[A-Za-z0-9]$/, "").trim();
      const existing = uniqueRoomsMap.get(baseRoomName);
      if (!existing) {
        uniqueRoomsMap.set(baseRoomName, {
          roomName: baseRoomName,
          cleanDate: log.recorded_at,
          technician: log.user_name || "Teknisi",
          unitCount: 1,
        });
      } else {
        existing.unitCount += 1;
        if (new Date(log.recorded_at).getTime() > new Date(existing.cleanDate).getTime()) {
          existing.cleanDate = log.recorded_at;
          existing.technician = log.user_name || existing.technician;
        }
      }
    }

    const cleanedCount = uniqueRoomsMap.size;
    const percent = targetMonthly > 0 ? Math.round((cleanedCount / targetMonthly) * 100) : 0;
    const remaining = Math.max(0, targetMonthly - cleanedCount);

    // Calculate Pace Status
    let paceBadgeText: string;
    let paceBadgeClass: string;
    let paceDetailText: string;

    if (cleanedCount >= targetMonthly) {
      paceBadgeText = "🏆 Target Tercapai";
      paceBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
      paceDetailText = `Melampaui target (+${cleanedCount - targetMonthly} kamar)`;
    } else if (isCurrentMonth) {
      const diff = cleanedCount - targetToDate;
      if (diff >= 0) {
        paceBadgeText = diff > 0 ? `⚡ On-Track (+${diff})` : "⚡ Sesuai Jadwal";
        paceBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
        paceDetailText = `Target s/d tgl ${currentDay}: ${targetToDate} kamar`;
      } else {
        const neededPerDay = daysRemaining > 0 ? (remaining / daysRemaining).toFixed(1) : remaining;
        paceBadgeText = `⏳ Kurang ${Math.abs(diff)} Kamar`;
        paceBadgeClass = "bg-amber-100 text-amber-800 border-amber-300";
        paceDetailText = `Butuh ~${neededPerDay} kamar/hari di sisa ${daysRemaining} hari`;
      }
    } else {
      paceBadgeText = percent >= 100 ? "✓ 100% Tercapai" : `Capaian: ${percent}%`;
      paceBadgeClass =
        percent >= 100
          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
          : "bg-slate-100 text-slate-700 border-slate-300";
      paceDetailText = `${cleanedCount} dari ${targetMonthly} kamar selesai`;
    }

    const cleanedRoomsList = Array.from(uniqueRoomsMap.values()).sort(
      (a, b) => new Date(b.cleanDate).getTime() - new Date(a.cleanDate).getTime()
    );

    return {
      year,
      month,
      monthName,
      monthLabel,
      daysInMonth,
      currentDay,
      isCurrentMonth,
      isFutureMonth,
      daysRemaining,
      targetMonthly,
      targetToDate,
      cleanedCount,
      percent,
      remaining,
      paceBadgeText,
      paceBadgeClass,
      paceDetailText,
      cleanedRoomsList,
    };
  }, [selectedMonthDate, acLogs, multiplier]);

  // Available floors with room counts
  const floorsList = useMemo(() => {
    const map = new Map<string, { total: number; clean: number }>();
    for (const r of roomItems) {
      if (!map.has(r.floor)) {
        map.set(r.floor, { total: 0, clean: 0 });
      }
      const item = map.get(r.floor)!;
      item.total += 1;
      if (r.isClean) item.clean += 1;
    }
    return Array.from(map.entries()).map(([floor, stats]) => ({
      floor,
      total: stats.total,
      clean: stats.clean,
      percent: stats.total > 0 ? Math.round((stats.clean / stats.total) * 100) : 0,
    }));
  }, [roomItems]);

  // Filtered rooms to display in list
  const filteredRooms = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roomItems.filter((r) => {
      // Status filter
      if (statusFilter === "clean" && !r.isClean) return false;
      if (statusFilter === "unclean" && r.isClean) return false;

      // Floor filter
      if (selectedFloor !== "all" && r.floor !== selectedFloor) return false;

      // Search filter
      if (q) {
        const hay = `${r.roomName} ${r.cleanRoomNumber} ${r.floor} ${
          r.hasMultipleAC ? "2 ac dual suite" : "1 ac"
        }`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [roomItems, statusFilter, selectedFloor, searchQuery]);

  // Format date helper: "04 Okt"
  const formatShortDate = (isoString?: string | null) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  // Rooms organized by floor column (Pilihan A: Format Matriks Excel Foto 2)
  const roomsByFloor = useMemo(() => {
    const floorOrder = [
      "Lantai 3",
      "Lantai 5",
      "Lantai 6",
      "Lantai 7",
      "Lantai 8",
      "Lantai 9",
      "Lantai 10",
      "Lantai 11",
      "Lantai 12",
    ];
    const grouped = new Map<string, RoomCleaningItem[]>();
    for (const f of floorOrder) {
      grouped.set(f, []);
    }

    for (const r of filteredRooms) {
      if (!grouped.has(r.floor)) {
        grouped.set(r.floor, []);
      }
      grouped.get(r.floor)!.push(r);
    }

    const result: { floor: string; rooms: RoomCleaningItem[]; cleanCount: number; totalCount: number }[] = [];
    for (const [floor, rooms] of grouped.entries()) {
      if (selectedFloor !== "all" && floor !== selectedFloor) continue;
      if (rooms.length > 0 || (selectedFloor === floor && filteredRooms.length === 0)) {
        const clean = rooms.filter((rm) => rm.isClean).length;
        result.push({
          floor,
          rooms,
          cleanCount: clean,
          totalCount: rooms.length,
        });
      }
    }
    return result;
  }, [filteredRooms, selectedFloor]);

  // Handle clicking a room to quickly log AC cleaning
  const handleRoomClick = (room: RoomCleaningItem) => {
    if (!onOpenACLog) return;
    if (room.units.length === 1) {
      onOpenACLog(room.units[0].unit.id);
    } else if (room.units.length > 1) {
      setDualACModalRoom(room);
    }
  };

  // Handle clicking column cards
  const handleCardClick = (targetStatus: "all" | "clean" | "unclean") => {
    if (!isOpen) {
      setIsOpen(true);
      setStatusFilter(targetStatus);
    } else if (statusFilter === targetStatus) {
      setIsOpen(false);
    } else {
      setStatusFilter(targetStatus);
    }
  };

  // Admin Add Room Handler
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    let normalizedNumber = newRoomNumber.trim();
    if (!normalizedNumber) {
      setFormError("Nomor kamar wajib diisi!");
      return;
    }
    if (!normalizedNumber.toLowerCase().startsWith("kamar")) {
      normalizedNumber = `Kamar ${normalizedNumber}`;
    }

    // Check if room name already exists on this floor
    const exists = roomItems.some(
      (r) => r.floor === newRoomFloor && r.roomName.toLowerCase() === normalizedNumber.toLowerCase()
    );
    if (exists) {
      setFormError(`Kamar "${normalizedNumber}" sudah terdaftar di ${newRoomFloor}!`);
      return;
    }

    setIsSubmitting(true);
    try {
      const codeNum = normalizedNumber.replace(/\D/g, "");

      if (newRoomDualAC) {
        // Create Unit A
        await createACUnit({
          name: `${normalizedNumber} A`,
          code: `KM-${codeNum}-A`,
          floor: newRoomFloor,
          category: "Area Privat / Kamar Hotel",
          notes: newRoomNotes || "Daikin AC Split Duct",
          cycle_months: 3,
          cycle_days: null,
        });

        // Create Unit B
        await createACUnit({
          name: `${normalizedNumber} B`,
          code: `KM-${codeNum}-B`,
          floor: newRoomFloor,
          category: "Area Privat / Kamar Hotel",
          notes: newRoomNotes || "Daikin AC Split Duct",
          cycle_months: 3,
          cycle_days: null,
        });
      } else {
        // Create 1 Unit
        await createACUnit({
          name: normalizedNumber,
          code: `KM-${codeNum || normalizedNumber}`,
          floor: newRoomFloor,
          category: "Area Privat / Kamar Hotel",
          notes: newRoomNotes || "Daikin AC Split Duct",
          cycle_months: 3,
          cycle_days: null,
        });
      }

      // Reset & Close
      setShowAddModal(false);
      setNewRoomNumber("");
      setNewRoomDualAC(false);
      setNewRoomNotes("Daikin AC Split Duct");
      // Auto open view on the floor where room was added
      setSelectedFloor(newRoomFloor);
      setIsOpen(true);
    } catch (err: unknown) {
      console.error("Gagal menambah kamar:", err);
      setFormError("Terjadi kesalahan saat menyimpan kamar baru.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Delete Room Handler
  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    setIsDeleting(true);
    try {
      for (const u of roomToDelete.units) {
        await deleteACUnit(u.unit.id);
      }
      setRoomToDelete(null);
    } catch (err) {
      console.error("Gagal menghapus kamar:", err);
      alert("Gagal menghapus kamar terdaftar.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 md:p-6 transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
            <BedDouble className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Monitoring Cleaning Kamar Hotel
              </h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                Fokus {totalRooms} Kamar Riil
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kamar dengan 2 unit AC dihitung 1 kamar &bull; Opsi A: Siklus Perawatan Aktif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer"
              title="Tambah Kamar Terdaftar (Khusus Admin)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Kamar</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
          >
            <span>{isOpen ? "Tutup Rincian" : "Lihat Rincian Lantai"}</span>
            {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Target Budget Cleaning AC Kamar (Bulanan Otomatis) */}
      <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50/70 via-blue-50/40 to-slate-50 border border-indigo-100/90 shadow-2xs">
        {/* Top Header of Budget Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-indigo-100/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-950">
                  Budget Cleaning AC Kamar
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200/60">
                  {multiplier} Kamar / Hari
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Target otomatis: {monthlyStats.daysInMonth} hari &times; {multiplier} = <strong className="text-slate-800">{monthlyStats.targetMonthly} Kamar</strong>
              </p>
            </div>
          </div>

          {/* Month Navigator Controls */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto bg-white p-1 rounded-xl border border-indigo-100 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-2 text-xs font-bold text-slate-800 select-none flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>{monthlyStats.monthLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-600 transition cursor-pointer"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {!monthlyStats.isCurrentMonth && (
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="ml-1 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[10px] font-bold text-indigo-700 transition cursor-pointer"
              >
                Bulan Ini
              </button>
            )}
          </div>
        </div>

        {/* 4 Quick Stat Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3">
          <div className="bg-white p-2.5 rounded-xl border border-indigo-100/70 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Target Bulan Ini</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">{monthlyStats.targetMonthly}</span>
              <span className="text-xs text-slate-500 font-semibold">Kamar</span>
            </div>
            <span className="text-[10px] text-indigo-600 font-medium mt-0.5">
              {monthlyStats.daysInMonth} Hari &times; {multiplier}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-emerald-800">Sudah Dicuci</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-black text-emerald-600">{monthlyStats.cleanedCount}</span>
              <span className="text-xs text-emerald-700 font-semibold">Kamar</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 mt-0.5">
              {monthlyStats.percent}% Tercapai
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-amber-100 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-amber-800">Sisa Target</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-black text-amber-600">{monthlyStats.remaining}</span>
              <span className="text-xs text-amber-700 font-semibold">Kamar</span>
            </div>
            <span className="text-[10px] text-slate-500 font-medium mt-0.5">
              {monthlyStats.isCurrentMonth ? `${monthlyStats.daysRemaining} hari tersisa` : "Bulan selesai"}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-indigo-100/70 flex flex-col justify-between shadow-2xs">
            <span className="text-[11px] font-medium text-slate-500">Status Laju</span>
            <div className="mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${monthlyStats.paceBadgeClass}`}>
                {monthlyStats.paceBadgeText}
              </span>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 truncate" title={monthlyStats.paceDetailText}>
              {monthlyStats.paceDetailText}
            </span>
          </div>
        </div>

        {/* Realization Progress Bar */}
        <div className="mt-3 bg-white p-2.5 rounded-xl border border-indigo-100/70 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <span className="flex items-center gap-1">
              <span>Realisasi Bulanan ({monthlyStats.monthLabel}):</span>
              <strong className="text-indigo-950">{monthlyStats.cleanedCount} dari {monthlyStats.targetMonthly} Kamar</strong>
            </span>
            <span className="text-indigo-700 font-black">{monthlyStats.percent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${Math.min(100, monthlyStats.percent)}%` }}
            />
          </div>
        </div>

        {/* Expandable Room Details */}
        {monthlyStats.cleanedCount > 0 && (
          <div className="mt-2.5 pt-1.5 flex items-center justify-between border-t border-indigo-100/50">
            <button
              type="button"
              onClick={() => setShowMonthlyRoomList((prev) => !prev)}
              className="text-xs text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer transition"
            >
              <span>{showMonthlyRoomList ? "Tutup rincian kamar bulan ini" : `Lihat ${monthlyStats.cleanedCount} kamar yang dicuci di bulan ${monthlyStats.monthName}`}</span>
              {showMonthlyRoomList ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[10px] text-slate-400 hidden sm:inline">
              Dihitung otomatis dari log AC kamar
            </span>
          </div>
        )}

        {showMonthlyRoomList && monthlyStats.cleanedRoomsList.length > 0 && (
          <div className="mt-2.5 p-2 bg-white rounded-xl border border-indigo-100/80 max-h-56 overflow-y-auto space-y-1.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
              {monthlyStats.cleanedRoomsList.map((item, idx) => {
                const dt = new Date(item.cleanDate);
                const dateStr = dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                return (
                  <div
                    key={`${item.roomName}-${idx}`}
                    className="p-2 bg-slate-50 hover:bg-indigo-50/50 rounded-lg border border-slate-200/80 flex items-center justify-between text-xs transition"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{item.roomName}</div>
                        <div className="text-[10px] text-slate-500">{item.technician}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                      {dateStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 3 Interactive Summary Cards (Clickable Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {/* 1. Kamar Sudah Dicuci */}
        <button
          type="button"
          onClick={() => handleCardClick("clean")}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between ${
            isOpen && statusFilter === "clean"
              ? "bg-emerald-100/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-500/30 shadow-sm -translate-y-0.5"
              : "bg-emerald-50/70 border-emerald-200/90 text-emerald-900 hover:bg-emerald-100/70 hover:border-emerald-300 hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Kamar Sudah Dicuci</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-800">
              {percentClean}%
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-emerald-950">
              {cleanCount} <span className="text-sm font-semibold opacity-70">Kamar</span>
            </span>
            <span className="text-[10px] font-semibold opacity-80 flex items-center gap-0.5">
              <span>Siklus Terawat</span>
              {isOpen && statusFilter === "clean" ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              )}
            </span>
          </div>
        </button>

        {/* 2. Kamar Belum Dicuci */}
        <button
          type="button"
          onClick={() => handleCardClick("unclean")}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between ${
            isOpen && statusFilter === "unclean"
              ? "bg-amber-100/90 border-amber-500 text-amber-950 ring-2 ring-amber-500/30 shadow-sm -translate-y-0.5"
              : "bg-amber-50/70 border-amber-200/90 text-amber-900 hover:bg-amber-100/70 hover:border-amber-300 hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Kamar Belum Dicuci</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-800">
              {totalRooms > 0 ? 100 - percentClean : 0}%
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-amber-950">
              {uncleanCount} <span className="text-sm font-semibold opacity-70">Kamar</span>
            </span>
            <span className="text-[10px] font-semibold opacity-80 flex items-center gap-0.5">
              <span>Perlu Dijadwalkan</span>
              {isOpen && statusFilter === "unclean" ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              )}
            </span>
          </div>
        </button>

        {/* 3. Total Kamar Terdaftar */}
        <button
          type="button"
          onClick={() => handleCardClick("all")}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer select-none flex flex-col justify-between ${
            isOpen && statusFilter === "all"
              ? "bg-slate-900 border-slate-950 text-white ring-2 ring-slate-800/40 shadow-sm -translate-y-0.5"
              : "bg-slate-900 text-white border-slate-800 hover:bg-slate-800 hover:shadow-xs"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-bold flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Total Kamar Terdaftar</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-blue-300">
              {floorsList.length} Lantai
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between w-full">
            <span className="text-2xl font-black text-white">
              {totalRooms} <span className="text-sm font-semibold opacity-70">Kamar</span>
            </span>
            <span className="text-[10px] font-medium text-slate-300 flex items-center gap-0.5">
              <span>Semua Kamar Riil</span>
              {isOpen && statusFilter === "all" ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
              )}
            </span>
          </div>
        </button>
      </div>

      {/* Progress Bar Visual (Di bawah 3 Kartu Ringkasan) */}
      <div className="mt-3.5 bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
          <span className="text-slate-700 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Progress Cuci Kamar Hotel:</span>
            <strong className="text-slate-900">
              {cleanCount} dari {totalRooms} Kamar ({percentClean}%)
            </strong>
          </span>
          <span className="text-slate-500 text-[11px]">
            Sisa <strong>{uncleanCount} Kamar</strong> belum dicuci
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-700 ease-out"
            style={{ width: `${percentClean}%` }}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-700 ease-out"
            style={{ width: `${100 - percentClean}%` }}
          />
        </div>
      </div>

      {/* Expanded Detail Section by Floor */}
      {isOpen && (
        <div className="mt-5 pt-5 border-t border-slate-200 space-y-4 animate-in fade-in duration-200">
          {/* Controls: Search, Status Filters, and Floor Tabs */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nomor kamar (contoh: 307, 1201)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Status Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start md:self-auto text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Semua ({totalRooms})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("clean")}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  statusFilter === "clean"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 hover:text-emerald-900"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>Sudah ({cleanCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("unclean")}
                className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer ${
                  statusFilter === "unclean"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-700 hover:text-amber-900"
                }`}
              >
                <AlertCircle className="w-3 h-3" />
                <span>Belum ({uncleanCount})</span>
              </button>
            </div>
          </div>

          {/* Floor Navigation Badges */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedFloor("all")}
              className={`px-3 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
                selectedFloor === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Semua Lantai ({totalRooms})
            </button>
            {floorsList.map((f) => (
              <button
                key={f.floor}
                type="button"
                onClick={() => setSelectedFloor(f.floor)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  selectedFloor === f.floor
                    ? "bg-blue-600 text-white shadow-xs font-bold"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{f.floor}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                    selectedFloor === f.floor
                      ? "bg-white/20 text-white"
                      : f.clean === f.total
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {f.clean}/{f.total}
                </span>
              </button>
            ))}
          </div>

          {/* MATRIKS KOLOM EXCEL (FORMAT SEPERTI FOTO 2) */}
          {roomsByFloor.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
              <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Tidak ada kamar yang cocok dengan filter</p>
              <p className="text-slate-400 mt-0.5">
                Coba ubah kata kunci pencarian atau reset filter.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto pb-3 pt-1 -mx-1 px-1">
              <div className="flex gap-2.5 min-w-max items-start">
                {roomsByFloor.map((f) => (
                  <div
                    key={f.floor}
                    className="w-[140px] sm:w-[150px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs shrink-0 flex flex-col"
                  >
                    {/* Floor Header */}
                    <div className="bg-slate-900 text-white px-2.5 py-2 flex items-center justify-between text-xs font-bold select-none">
                      <span className="truncate">{f.floor}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          f.cleanCount === f.totalCount && f.totalCount > 0
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {f.cleanCount}/{f.totalCount}
                      </span>
                    </div>

                    {/* Subheader: KMR | Tanggal */}
                    <div className="bg-slate-100 border-b border-slate-200 grid grid-cols-2 text-[10px] font-bold text-slate-600 text-center py-1.5 uppercase tracking-wider select-none">
                      <div className="border-r border-slate-200">KMR</div>
                      <div>Tanggal</div>
                    </div>

                    {/* Room Rows List */}
                    <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                      {f.rooms.map((room) => {
                        const shortDate = formatShortDate(room.lastCleanedDate);
                        return (
                          <div
                            key={room.id}
                            onClick={() => handleRoomClick(room)}
                            className="grid grid-cols-2 items-center py-1.5 px-1 hover:bg-blue-50/80 transition cursor-pointer group text-xs select-none"
                            title={`Klik untuk catat cuci Kamar ${room.roomName}${
                              room.lastCleanedDate
                                ? ` (Terakhir dicuci: ${new Date(room.lastCleanedDate).toLocaleDateString(
                                    "id-ID"
                                  )}${room.lastCleanedTech ? ` oleh ${room.lastCleanedTech}` : ""})`
                                : " (Belum pernah dicuci)"
                            }`}
                          >
                            {/* KMR Column */}
                            <div className="flex items-center justify-center gap-1 font-bold text-slate-900 group-hover:text-blue-700 border-r border-slate-100">
                              <span>{room.cleanRoomNumber}</span>
                              {room.hasMultipleAC && (
                                <span
                                  className="text-[8px] px-1 py-0.2 rounded font-bold bg-purple-100 text-purple-700"
                                  title="Kamar Suite 2 AC"
                                >
                                  2AC
                                </span>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoomToDelete(room);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-600 transition shrink-0 ml-0.5 cursor-pointer"
                                  title={`Hapus ${room.roomName} dari Master`}
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>

                            {/* Tanggal / Status Column */}
                            <div className="text-center px-1">
                              {room.isClean ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-2xs">
                                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                  <span>{shortDate}</span>
                                </span>
                              ) : room.isPartiallyClean ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 shadow-2xs">
                                  <span>✓½</span>
                                  <span>{shortDate}</span>
                                </span>
                              ) : (
                                <span className="inline-block text-[10px] font-semibold text-amber-600 px-1.5 py-0.5 rounded bg-amber-50/70">
                                  Belum
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: PILIH AC UNTUK KAMAR SUITE (DUAL AC) */}
      {dualACModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {dualACModalRoom.roomName}
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {dualACModalRoom.floor} &bull; Memiliki 2 Unit AC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDualACModalRoom(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
              <p className="text-xs text-slate-600 mb-1 font-medium">
                Pilih unit AC yang ingin dicatat pencuciannya:
              </p>
              {dualACModalRoom.units.map((u) => {
                const isSafe = u.status === "safe" || u.status === "approaching";
                return (
                  <div
                    key={u.unit.id}
                    className="p-3 rounded-xl border border-slate-200 flex items-center justify-between bg-slate-50 hover:bg-blue-50/60 transition"
                  >
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">
                        {u.unit.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          isSafe ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {isSafe ? "✓ Sudah Cuci" : "Belum Cuci"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const unitId = u.unit.id;
                        setDualACModalRoom(null);
                        if (onOpenACLog) onOpenACLog(unitId);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      Catat Cuci
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH KAMAR BARU (ADMIN ONLY) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <BedDouble className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Tambah Kamar Terdaftar Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddRoom} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Floor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pilih Lantai
                </label>
                <select
                  value={newRoomFloor}
                  onChange={(e) => setNewRoomFloor(e.target.value as RealFloor)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold"
                >
                  {REAL_FLOORS.filter((f) => f.startsWith("Lantai")).map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Number Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nomor Kamar
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 320 atau Kamar 320"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Cukup ketik angka (misal: 320) sistem otomatis menambahkan "Kamar 320"
                </span>
              </div>

              {/* Dual AC Checkbox */}
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newRoomDualAC}
                    onChange={(e) => setNewRoomDualAC(e.target.checked)}
                    className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Kamar ini memiliki 2 Unit AC (Split / Suite - Unit A & B)
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5 block leading-relaxed">
                      Sistem akan mendaftarkan 2 unit master (Unit A & Unit B). Di dashboard tetap terhitung sebagai <strong>1 kamar riil</strong>.
                    </span>
                  </div>
                </label>
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Keterangan Tipe Unit (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Daikin AC Split Duct"
                  value={newRoomNotes}
                  onChange={(e) => setNewRoomNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/30 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? "Menyimpan..." : "Simpan Kamar"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KONFIRMASI HAPUS KAMAR (ADMIN ONLY) */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">
                Hapus {roomToDelete.roomName}?
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tindakan ini akan menghapus <strong>{roomToDelete.units.length} unit AC</strong> master untuk kamar ini di {roomToDelete.floor}.
              </p>
              {roomToDelete.hasMultipleAC && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 text-left">
                  Unit yang akan dihapus:
                  <ul className="list-disc pl-4 mt-0.5 font-medium">
                    {roomToDelete.units.map((u) => (
                      <li key={u.unit.id}>{u.unit.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 p-4 bg-slate-50 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition"
                disabled={isDeleting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoom}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus Kamar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
