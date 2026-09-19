import React, { useState, useEffect, useCallback } from "react";
import {
  Droplet,
  Zap,
  Flame,
  Building2,
  Recycle,
  Gauge,
  ShieldCheck,
  RefreshCw,
  Clock,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  Activity,
  Calendar,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Eye,
  X,
  Filter,
  User as UserIcon,
  Plus,
  FileText,
  Check,
} from "lucide-react";
import { DashboardStat, ChartSeries, AppSettings, Reading } from "../types";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import {
  fetchDashboardStats,
  fetchChartSeries,
  fetchAppSettings,
  fetchReadings,
} from "../supabaseService";

const METER_ICONS: Record<string, React.ElementType> = {
  Drop: Droplet,
  Lightning: Zap,
  Flame: Flame,
  Buildings: Building2,
  Recycle: Recycle,
  Gauge: Gauge,
};

interface DashboardProps {
  onSelectMeter: (meterId: string) => void;
}

export function Dashboard({ onSelectMeter }: DashboardProps) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<DashboardStat[]>([]);
  const [chartSeries, setChartSeries] = useState<ChartSeries[]>([]);
  const [dailyReadings, setDailyReadings] = useState<Reading[]>([]);
  const [dailyShiftFilter, setDailyShiftFilter] = useState<"all" | "pagi" | "sore" | "malam">("all");
  const [dailyMeterFilter, setDailyMeterFilter] = useState<string>("all");
  const [selectedPhotoReading, setSelectedPhotoReading] = useState<Reading | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Timeframe for Summary Cards: "daily" vs "mtd" (Month to Date)
  const [timeframe, setTimeframe] = useState<"daily" | "mtd">("daily");

  const formatYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const todayYmd = formatYmd(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayYmd);

  const [period, setPeriod] = useState<"daily" | "mtd" | "monthly" | "yearly">("daily");
  const [dailyViewMode, setDailyViewMode] = useState<"shifts" | "days">("shifts");
  const [customCount, setCustomCount] = useState<number | undefined>(undefined);
  const [lineVisibility, setLineVisibility] = useState<"all" | "total" | "shifts">("all");
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active count based on settings or custom selection
  const effectiveCount =
    customCount !== undefined
      ? customCount
      : period === "daily"
      ? settings?.chart_days_count ?? 2
      : period === "monthly"
      ? settings?.chart_months_count ?? 2
      : settings?.chart_years_count ?? 2;

  const loadData = useCallback(
    async (
      countOverride?: number,
      modeOverride?: "shifts" | "days",
      dateOverride?: string
    ) => {
      try {
        const stData = await fetchAppSettings();
        setSettings(stData);

        const targetCount =
          countOverride !== undefined
            ? countOverride
            : customCount !== undefined
            ? customCount
            : period === "daily"
            ? stData.chart_days_count ?? 2
            : period === "monthly"
            ? stData.chart_months_count ?? 2
            : stData.chart_years_count ?? 2;

        const targetMode = modeOverride || dailyViewMode;
        const targetDate = dateOverride || selectedDate;

        const [sData, cData, rData] = await Promise.all([
          fetchDashboardStats(user?.role || "user", user?.user_id || "", targetDate),
          fetchChartSeries(period, targetCount, targetMode),
          fetchReadings({ limit: 1500 }),
        ]);
        setStats(sData);
        setChartSeries(cData);

        // Filter readings strictly matching targetDate (by formatted Ymd or ISO prefix)
        const targetDaily = (rData || []).filter((r) => {
          const rd = new Date(r.recorded_at);
          const rIso = formatYmd(rd);
          const rawPrefix = typeof r.recorded_at === "string" ? r.recorded_at.slice(0, 10) : "";
          return rIso === targetDate || rawPrefix === targetDate;
        });
        // Sort newest recorded first
        targetDaily.sort(
          (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
        );
        setDailyReadings(targetDaily);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.role, user?.user_id, customCount, period, dailyViewMode, selectedDate]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePeriodChange = (p: "daily" | "mtd" | "monthly" | "yearly") => {
    setPeriod(p);
    setCustomCount(undefined);
    setActivePointIndex(null);
  };

  const handleCountChange = (cnt: number) => {
    setCustomCount(cnt);
    setActivePointIndex(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const prev = new Date(y, m - 1, d - 1);
    setSelectedDate(formatYmd(prev));
  };

  const handleNextDay = () => {
    if (selectedDate >= todayYmd) return;
    const [y, m, d] = selectedDate.split("-").map(Number);
    const next = new Date(y, m - 1, d + 1);
    setSelectedDate(formatYmd(next));
  };

  const handleToday = () => {
    setSelectedDate(todayYmd);
  };

  const formatDateDisplay = (isoStr: string) => {
    const [y, m, d] = isoStr.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const currentNow = new Date();
  const currentDayNum = currentNow.getDate();
  const currentMonthName = currentNow.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    month: "long",
  });
  const currentYearNum = currentNow.getFullYear();

  const todayStr = new Date().toLocaleDateString(lang === "id" ? "id-ID" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const heroBg =
    settings?.dashboard_bg_url ||
    (typeof localStorage !== "undefined" ? localStorage.getItem("meter_dashboard_custom_bg") : null) ||
    "https://images.unsplash.com/photo-1784411641863-d163d776ed55?crop=entropy&cs=srgb&fm=jpg&w=1200&q=75";

  const propertyName = settings?.property_name || user?.property_name || "Grand Hotel Resort";

  // Line Chart SVG Calculations
  const chartW = 760;
  const chartH = 240;
  const padL = 50;
  const padR = 35;
  const padT = 20;
  const padB = 45;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxValRaw = Math.max(
    5,
    ...chartSeries.map((s) => Math.max(s.pagi, s.sore, s.malam, s.total))
  );
  const roundFactor = maxValRaw > 100 ? 50 : maxValRaw > 20 ? 10 : 5;
  const maxChartValue = Math.ceil(maxValRaw / roundFactor) * roundFactor;

  const getPtX = (index: number) => {
    if (chartSeries.length <= 1) return padL + plotW / 2;
    return padL + (index / (chartSeries.length - 1)) * plotW;
  };

  const getPtY = (val: number) => {
    const clamped = Math.max(0, val);
    return padT + plotH - (clamped / maxChartValue) * plotH;
  };

  const buildPath = (key: "total" | "pagi" | "sore" | "malam") => {
    if (chartSeries.length === 0) return "";
    return chartSeries
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getPtX(i).toFixed(1)},${getPtY(d[key]).toFixed(1)}`)
      .join(" ");
  };

  const buildAreaPath = () => {
    if (chartSeries.length === 0) return "";
    const linePath = chartSeries
      .map((d, i) => `${i === 0 ? "M" : "L"} ${getPtX(i).toFixed(1)},${getPtY(d.total).toFixed(1)}`)
      .join(" ");
    const lastX = getPtX(chartSeries.length - 1).toFixed(1);
    const firstX = getPtX(0).toFixed(1);
    const bottomY = (padT + plotH).toFixed(1);
    return `${linePath} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const val = Math.round(ratio * maxChartValue * 10) / 10;
    const y = getPtY(ratio * maxChartValue);
    return { val, y };
  });

  const activeItem = activePointIndex !== null && chartSeries[activePointIndex]
    ? chartSeries[activePointIndex]
    : null;

  return (
    <div className="space-y-6 pb-20">
      {/* Top Hero Section */}
      <div className="relative h-64 md:h-72 w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200">
        <img
          src={heroBg}
          alt="Hotel Property"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 flex flex-col justify-end">
          <div className="flex items-center justify-between mb-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/20 backdrop-blur-md rounded-full text-blue-200 text-xs font-semibold border border-blue-400/30">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>{t("safety_first")}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition backdrop-blur-md"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <h1 id="welcome-text" className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            {t("welcome")}, {user?.name}
          </h1>
          <p className="text-xs md:text-sm text-slate-300 mt-1">{todayStr}</p>
          <div className="flex items-center gap-1.5 text-xs text-blue-200/90 mt-2 font-medium">
            <Building2 className="w-3.5 h-3.5" />
            <span>{propertyName}</span>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span>{t("total_used")}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {timeframe === "daily"
                ? `Menampilkan total pemakaian harian (${selectedDate === todayYmd ? "Hari Ini" : formatDateDisplay(selectedDate)})`
                : `Menampilkan total pemakaian akumulasi bulan berjalan (Month to Date)`}
            </p>
          </div>

          {/* Daily vs Month-to-Date Toggle Pills */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 border border-slate-200/90 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimeframe("daily")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                timeframe === "daily"
                  ? "bg-white text-blue-700 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Daily (Harian)</span>
            </button>
            <button
              type="button"
              onClick={() => setTimeframe("mtd")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                timeframe === "mtd"
                  ? "bg-white text-emerald-700 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Month to Date (MTD)</span>
            </button>
          </div>
        </div>

        {/* Dynamic Context Header Bar based on Active Timeframe */}
        {timeframe === "daily" ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl px-3.5 py-2 mb-3.5 text-xs text-blue-950">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1 rounded-lg bg-white hover:bg-blue-100 border border-blue-200 text-blue-700 transition shadow-2xs cursor-pointer"
                title="Kemarin"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 font-bold text-blue-900">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{formatDateDisplay(selectedDate)}</span>
                {selectedDate === todayYmd && (
                  <span className="text-[10px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Hari Ini
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleNextDay}
                disabled={selectedDate >= todayYmd}
                className={`p-1 rounded-lg border transition shadow-2xs ${
                  selectedDate >= todayYmd
                    ? "opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200"
                    : "bg-white hover:bg-blue-100 border-blue-200 text-blue-700 cursor-pointer"
                }`}
                title="Besok"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {selectedDate !== todayYmd && (
                <button
                  type="button"
                  onClick={handleToday}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] transition shadow-2xs cursor-pointer"
                >
                  Kembali ke Hari Ini
                </button>
              )}
              <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2 py-1 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-medium">Pilih Tanggal:</span>
                <input
                  type="date"
                  max={todayYmd}
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="text-xs text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2.5 bg-emerald-50/80 border border-emerald-200/90 rounded-xl px-3.5 py-2.5 mb-3.5 text-xs text-emerald-950">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <div className="flex items-baseline gap-1.5">
                <span className="font-extrabold text-emerald-950">Periode Month to Date (MTD):</span>
                <span className="font-semibold text-emerald-800">
                  1 s/d {currentDayNum} {currentMonthName} {currentYearNum} ({currentDayNum} Hari Berjalan)
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] bg-emerald-100/90 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-300/70 shadow-2xs">
                Total Akumulasi Sejak Tanggal 1 Bulan Ini
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {stats.map((s) => {
              const Icon = METER_ICONS[s.icon] || Gauge;
              const isDaily = timeframe === "daily";
              const primaryTotal = isDaily ? s.daily_total : s.mtd_total;
              const primaryCount = isDaily ? s.daily_count : s.mtd_count;

              return (
                <button
                  key={s.menu_id}
                  id={`metric-${s.name}`}
                  onClick={() => onSelectMeter(s.menu_id)}
                  className="group text-left bg-white hover:bg-blue-50/40 p-4 rounded-2xl border border-slate-200 hover:border-blue-300 transition-all shadow-sm hover:shadow relative overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center border transition ${
                          isDaily
                            ? "bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-600 group-hover:text-white"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                            isDaily
                              ? "bg-blue-50 text-blue-700 border-blue-200/80"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200/80"
                          }`}
                        >
                          {isDaily ? "DAILY" : "MTD"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition group-hover:translate-x-0.5" />
                      </div>
                    </div>

                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                      {s.name}
                    </span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
                        {primaryTotal.toLocaleString("id-ID")}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">{s.unit}</span>
                    </div>

                    {/* Subtitle context */}
                    {isDaily ? (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {s.daily_count > 0 ? `${s.daily_count} kali catat ${selectedDate === todayYmd ? "hari ini" : "pada tanggal ini"}` : "Belum ada pencatatan"}
                      </p>
                    ) : (
                      <p className="text-[10px] text-emerald-700 font-medium mt-0.5">
                        Rata-rata: ~{s.daily_avg.toLocaleString("id-ID")} {s.unit}/hari
                      </p>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] space-y-1">
                    <div className="text-slate-500 flex items-center justify-between">
                      <span>{primaryCount} logs</span>
                      {s.last_akhir !== null && s.last_akhir !== undefined ? (
                        <span className="font-mono text-slate-700 font-semibold">
                          Akhir: {s.last_akhir.toLocaleString("id-ID")}
                        </span>
                      ) : (
                        <span className="text-slate-400">Belum ada</span>
                      )}
                    </div>

                    {/* Comparison metric */}
                    <div className="pt-1.5 border-t border-slate-100/70 flex items-center justify-between text-[9.5px]">
                      {isDaily ? (
                        <>
                          <span className="text-slate-400">Month to Date:</span>
                          <span className="font-bold text-emerald-700">
                            {s.mtd_total.toLocaleString("id-ID")} {s.unit}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-slate-400">Hari Ini:</span>
                          <span className="font-bold text-blue-700">
                            {s.daily_total.toLocaleString("id-ID")} {s.unit}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Consumption Trend Line Chart Section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        {/* Header with Title & Period Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">{t("consumption_trend")}</h3>
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-extrabold border border-blue-100 uppercase tracking-wide">
                Line Chart
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {period === "daily"
                ? `Grafik tren pemakaian ${effectiveCount} hari per jam shift operasional`
                : period === "mtd"
                ? `Grafik tren pemakaian harian selama bulan berjalan (Month to Date: 1 s/d ${currentDayNum} ${currentMonthName})`
                : period === "monthly"
                ? `Grafik tren perbandingan pemakaian ${effectiveCount} bulan terakhir`
                : `Grafik tren perbandingan pemakaian ${effectiveCount} tahun terakhir`}
            </p>
          </div>

          {/* Period Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start md:self-auto">
            {(["daily", "mtd", "monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  period === p
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p === "daily" ? (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Harian ({effectiveCount} Hari)</span>
                  </>
                ) : p === "mtd" ? (
                  <>
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>MTD (Bulan Ini)</span>
                  </>
                ) : p === "monthly" ? (
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Bulanan ({effectiveCount} Bln)</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-3.5 h-3.5" />
                    <span>Tahunan ({effectiveCount} Thn)</span>
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Interval Controls & View Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80 text-xs">
          {/* Interval Quick Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-600 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span>Tampilkan:</span>
            </span>

            {period === "daily" && (
              <>
                {[
                  { count: 2, label: "2 Hari (Jam)" },
                  { count: 3, label: "3 Hari" },
                  { count: 7, label: "7 Hari (1 Mgg)" },
                  { count: 14, label: "14 Hari" },
                ].map((btn) => (
                  <button
                    key={btn.count}
                    onClick={() => handleCountChange(btn.count)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      effectiveCount === btn.count
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}

                {/* Sub-toggle: Jam Shift vs Total Harian */}
                <div className="ml-2 pl-2 border-l border-slate-300 flex items-center gap-1">
                  <button
                    onClick={() => setDailyViewMode("shifts")}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                      dailyViewMode === "shifts"
                        ? "bg-blue-100 text-blue-800 font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Menampilkan titik data per jam pergantian shift"
                  >
                    Titik Jam Shift
                  </button>
                  <button
                    onClick={() => setDailyViewMode("days")}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                      dailyViewMode === "days"
                        ? "bg-blue-100 text-blue-800 font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Akumulasi total per hari"
                  >
                    Total Harian
                  </button>
                </div>
              </>
            )}

            {period === "mtd" && (
              <div className="flex items-center gap-2 text-emerald-800 font-medium">
                <span className="bg-emerald-100 px-2 py-0.5 rounded-md font-bold text-[11px]">
                  1 s/d {currentDayNum} {currentMonthName} {currentYearNum}
                </span>
                <span className="text-slate-500 text-[11px]">
                  Menampilkan grafik akumulasi harian dari awal bulan hingga hari ini ({currentDayNum} data poin).
                </span>
              </div>
            )}

            {period === "monthly" && (
              <>
                {[
                  { count: 2, label: "2 Bulan (Bawaan)" },
                  { count: 3, label: "3 Bulan" },
                  { count: 6, label: "6 Bulan" },
                  { count: 12, label: "12 Bulan (1 Thn)" },
                ].map((btn) => (
                  <button
                    key={btn.count}
                    onClick={() => handleCountChange(btn.count)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      effectiveCount === btn.count
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </>
            )}

            {period === "yearly" && (
              <>
                {[
                  { count: 2, label: "2 Tahun (Bawaan)" },
                  { count: 3, label: "3 Tahun" },
                  { count: 5, label: "5 Tahun" },
                ].map((btn) => (
                  <button
                    key={btn.count}
                    onClick={() => handleCountChange(btn.count)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                      effectiveCount === btn.count
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </>
            )}
          </div>

          {/* Line Visibility Toggles */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setLineVisibility("all")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                lineVisibility === "all" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Semua Garis
            </button>
            <button
              onClick={() => setLineVisibility("total")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                lineVisibility === "total" ? "bg-blue-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Garis Total
            </button>
            <button
              onClick={() => setLineVisibility("shifts")}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                lineVisibility === "shifts" ? "bg-amber-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Per Shift
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 pt-1">
          {(lineVisibility === "all" || lineVisibility === "total") && (
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-1 rounded-full bg-blue-600 inline-block shadow-xs" />
              <span className="font-bold text-blue-900">Garis Total Pemakaian</span>
            </div>
          )}

          {(lineVisibility === "all" || lineVisibility === "shifts") && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-full bg-sky-500 inline-block" />
                <span>Pagi ({settings?.shift_pagi_start || "06:00"} - {settings?.shift_sore_start || "14:00"})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-full bg-amber-500 inline-block" />
                <span>Sore ({settings?.shift_sore_start || "14:00"} - {settings?.shift_malam_start || "22:00"})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-1 rounded-full bg-indigo-600 inline-block" />
                <span>Malam ({settings?.shift_malam_start || "22:00"} - {settings?.shift_pagi_start || "06:00"})</span>
              </div>
            </>
          )}

          <span className="text-[11px] text-slate-400 ml-auto hidden sm:inline">
            Arahkan kursor / sentuh titik untuk melihat detail
          </span>
        </div>

        {/* Active Point Detail Card (Interactive on hover/tap) */}
        {activeItem && (
          <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-xl p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">{activeItem.label}</span>
                {activeItem.sublabel && (
                  <span className="px-2 py-0.5 rounded bg-blue-600/60 font-mono text-[11px] font-bold">
                    Jam: {activeItem.sublabel}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Detail pemakaian pada titik waktu ini
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Pagi</span>
                <span className="text-xs font-mono font-bold text-sky-300">{activeItem.pagi}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Sore</span>
                <span className="text-xs font-mono font-bold text-amber-300">{activeItem.sore}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Malam</span>
                <span className="text-xs font-mono font-bold text-indigo-300">{activeItem.malam}</span>
              </div>
              <div className="text-right pl-3 border-l border-slate-700">
                <span className="text-[10px] text-slate-300 block uppercase font-bold">Total</span>
                <span className="text-sm font-mono font-black text-emerald-400">{activeItem.total}</span>
              </div>
            </div>
          </div>
        )}

        {/* Line Chart SVG Area */}
        {chartSeries.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <Activity className="w-8 h-8 text-slate-300 mb-2" />
            <span>{t("no_data")}</span>
            <span className="text-[11px] text-slate-400 mt-0.5">Belum ada pencatatan meter pada rentang waktu ini</span>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[580px] pt-2 pb-2">
              <svg
                viewBox={`0 0 ${chartW} ${chartH}`}
                className="w-full h-64 select-none"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Total Gradient Area */}
                  <linearGradient id="totalLineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Horizontal Grid Lines */}
                {yTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line
                      x1={padL}
                      y1={tick.y}
                      x2={chartW - padR}
                      y2={tick.y}
                      stroke="#E2E8F0"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text
                      x={padL - 10}
                      y={tick.y + 3.5}
                      textAnchor="end"
                      className="text-[10px] font-mono fill-slate-400"
                    >
                      {tick.val}
                    </text>
                  </g>
                ))}

                {/* Active Column Guideline */}
                {activePointIndex !== null && (
                  <line
                    x1={getPtX(activePointIndex)}
                    y1={padT}
                    x2={getPtX(activePointIndex)}
                    y2={padT + plotH}
                    stroke="#3B82F6"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                )}

                {/* Area under Total Line */}
                {(lineVisibility === "all" || lineVisibility === "total") && (
                  <path d={buildAreaPath()} fill="url(#totalLineGradient)" />
                )}

                {/* Shift Lines */}
                {(lineVisibility === "all" || lineVisibility === "shifts") && (
                  <>
                    {/* Malam Line */}
                    <path
                      d={buildPath("malam")}
                      fill="none"
                      stroke="#4F46E5"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all"
                    />

                    {/* Sore Line */}
                    <path
                      d={buildPath("sore")}
                      fill="none"
                      stroke="#F59E0B"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all"
                    />

                    {/* Pagi Line */}
                    <path
                      d={buildPath("pagi")}
                      fill="none"
                      stroke="#0284C7"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all"
                    />
                  </>
                )}

                {/* Total Line (Thickest) */}
                {(lineVisibility === "all" || lineVisibility === "total") && (
                  <path
                    d={buildPath("total")}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all"
                  />
                )}

                {/* Data Points & Interactive Touch/Click Targets */}
                {chartSeries.map((item, idx) => {
                  const ptX = getPtX(idx);
                  const isHovered = activePointIndex === idx;

                  return (
                    <g key={idx}>
                      {/* X-Axis Tick Label */}
                      <text
                        x={ptX}
                        y={chartH - 22}
                        textAnchor="middle"
                        className={`text-[10px] font-bold ${
                          isHovered ? "fill-blue-700 font-extrabold" : "fill-slate-700"
                        }`}
                      >
                        {item.label}
                      </text>
                      {item.sublabel && (
                        <text
                          x={ptX}
                          y={chartH - 10}
                          textAnchor="middle"
                          className={`text-[9px] font-mono ${
                            isHovered ? "fill-blue-600 font-bold" : "fill-slate-400"
                          }`}
                        >
                          {item.sublabel}
                        </text>
                      )}

                      {/* Points on shift lines */}
                      {(lineVisibility === "all" || lineVisibility === "shifts") && (
                        <>
                          <circle
                            cx={ptX}
                            cy={getPtY(item.pagi)}
                            r={isHovered ? 4.5 : 3}
                            fill="#0284C7"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={ptX}
                            cy={getPtY(item.sore)}
                            r={isHovered ? 4.5 : 3}
                            fill="#F59E0B"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                          <circle
                            cx={ptX}
                            cy={getPtY(item.malam)}
                            r={isHovered ? 4.5 : 3}
                            fill="#4F46E5"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                          />
                        </>
                      )}

                      {/* Total Point (Bigger Node) */}
                      {(lineVisibility === "all" || lineVisibility === "total") && (
                        <circle
                          cx={ptX}
                          cy={getPtY(item.total)}
                          r={isHovered ? 6.5 : 4.5}
                          fill="#2563EB"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          className="transition-all cursor-pointer"
                        />
                      )}

                      {/* Transparent Overlay Trigger for easy tapping & hovering */}
                      <rect
                        x={ptX - (plotW / chartSeries.length) / 2}
                        y={padT}
                        width={plotW / chartSeries.length}
                        height={plotH + padB}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setActivePointIndex(idx)}
                        onClick={() => setActivePointIndex(idx)}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TABEL DATA PENCATATAN DAILY (HARIAN)                                     */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Header bar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-50/60 to-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ClipboardList className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Data Pencatatan Daily ({formatDateDisplay(selectedDate)})
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100/70 text-blue-700">
                {dailyReadings.length} Data Masuk
              </span>
            </div>
            <p className="text-[11px] text-slate-500 pl-10">
              Rincian checklist meteran yang dicatat petugas secara real-time pada tanggal terpilih
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {stats.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectMeter(stats[0]?.menu_id || "menu_pdam")}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Catat Meter Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Shift Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Shift:</span>
            </span>
            <button
              type="button"
              onClick={() => setDailyShiftFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                dailyShiftFilter === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              Semua ({dailyReadings.length})
            </button>
            <button
              type="button"
              onClick={() => setDailyShiftFilter("pagi")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                dailyShiftFilter === "pagi"
                  ? "bg-sky-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              Pagi ({dailyReadings.filter((r) => r.shift === "pagi").length})
            </button>
            <button
              type="button"
              onClick={() => setDailyShiftFilter("sore")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                dailyShiftFilter === "sore"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              Sore ({dailyReadings.filter((r) => r.shift === "sore").length})
            </button>
            <button
              type="button"
              onClick={() => setDailyShiftFilter("malam")}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                dailyShiftFilter === "malam"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80"
              }`}
            >
              Malam ({dailyReadings.filter((r) => r.shift === "malam").length})
            </button>
          </div>

          {/* Meter Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Meter:</span>
            <select
              value={dailyMeterFilter}
              onChange={(e) => setDailyMeterFilter(e.target.value)}
              className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer"
            >
              <option value="all">Semua Titik Meter</option>
              {stats.map((s) => (
                <option key={s.menu_id} value={s.menu_id}>
                  {s.name} ({s.unit})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content Section */}
        {(() => {
          const filtered = dailyReadings.filter((r) => {
            if (dailyShiftFilter !== "all" && r.shift !== dailyShiftFilter) return false;
            if (dailyMeterFilter !== "all" && r.meter_id !== dailyMeterFilter) return false;
            return true;
          });

          if (filtered.length === 0) {
            return (
              <div className="p-10 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6" />
                </div>
                {dailyReadings.length === 0 ? (
                  <>
                    <h4 className="text-sm font-bold text-slate-800">
                      Belum Ada Pencatatan Meter untuk Tanggal Ini
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Belum ada teknisi yang menginput checklist meteran untuk{" "}
                      <strong>{formatDateDisplay(selectedDate)}</strong>. Anda dapat mencatat sekarang atau memilih tanggal lain.
                    </p>
                    {stats.length > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectMeter(stats[0]?.menu_id || "menu_pdam")}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Mulai Catat Meter Sekarang</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-bold text-slate-800">
                      Tidak Ditemukan Data untuk Filter Ini
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tidak ada checklist meteran yang cocok dengan filter Shift atau Titik Meter terpilih.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDailyShiftFilter("all");
                        setDailyMeterFilter("all");
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </>
                )}
              </div>
            );
          }

          return (
            <>
              {/* Desktop & Tablet Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="py-3 px-3.5">Jam & Shift</th>
                      <th className="py-3 px-3.5">Titik Meter</th>
                      <th className="py-3 px-3.5">Stand Awal &rarr; Akhir</th>
                      <th className="py-3 px-3.5 text-right">Pemakaian</th>
                      <th className="py-3 px-3.5">Parameter Listrik</th>
                      <th className="py-3 px-3.5">Petugas</th>
                      <th className="py-3 px-3.5 text-center">Status</th>
                      <th className="py-3 px-3.5 text-center">Foto</th>
                      <th className="py-3 px-3.5">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filtered.map((r) => {
                      const d = new Date(r.recorded_at);
                      const timeStr = d.toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const shiftBadgeClass =
                        r.shift === "pagi"
                          ? "bg-sky-50 text-sky-700 border-sky-200/80"
                          : r.shift === "sore"
                          ? "bg-amber-50 text-amber-700 border-amber-200/80"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200/80";

                      const IconComp = METER_ICONS[r.meter_name] || Gauge;
                      const isPln =
                        r.meter_id === "menu_pln" ||
                        (r.meter_name && r.meter_name.toUpperCase().includes("PLN"));

                      return (
                        <tr key={r.reading_id} className="hover:bg-slate-50/70 transition">
                          {/* Jam & Shift */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900">{timeStr}</div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase mt-0.5 ${shiftBadgeClass}`}
                            >
                              Shift {r.shift}
                            </span>
                          </td>

                          {/* Titik Meter */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <IconComp className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block">{r.meter_name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ID: {r.meter_id}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Stand Awal -> Akhir */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="font-mono text-slate-600">
                              <span className="text-slate-500">{r.awal}</span>
                              <span className="mx-1 text-slate-300 font-bold">&rarr;</span>
                              <strong className="text-slate-900">{r.akhir}</strong>
                              <span className="text-[10px] text-slate-400 ml-1">{r.meter_unit}</span>
                            </div>
                          </td>

                          {/* Pemakaian */}
                          <td className="py-3 px-3.5 whitespace-nowrap text-right">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                              +{Number(r.total).toLocaleString("id-ID")} {r.meter_unit}
                            </span>
                          </td>

                          {/* Parameter Teknis PLN */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            {isPln || r.voltase != null || r.ampere != null ? (
                              <div className="text-[11px] text-slate-600 font-mono space-y-0.5">
                                <div>
                                  <span className="text-slate-400">V:</span> {r.voltase ?? "-"}V •{" "}
                                  <span className="text-slate-400">A:</span> {r.ampere ?? "-"}A
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  LWBP: {r.lwbp_akhir ?? r.lwbp ?? "-"} | WBP: {r.wbp_akhir ?? r.wbp ?? "-"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-mono">-</span>
                            )}
                          </td>

                          {/* Petugas */}
                          <td className="py-3 px-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-bold text-slate-800">{r.user_name || "Petugas"}</span>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-3.5 whitespace-nowrap text-center">
                            {r.alarm ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-500" />
                                <span>Lonjakan</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Normal</span>
                              </span>
                            )}
                          </td>

                          {/* Foto Meter */}
                          <td className="py-3 px-3.5 whitespace-nowrap text-center">
                            {r.photo_path ? (
                              <button
                                type="button"
                                onClick={() => setSelectedPhotoReading(r)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Lihat</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 font-mono text-[11px]">-</span>
                            )}
                          </td>

                          {/* Catatan */}
                          <td className="py-3 px-3.5 max-w-xs truncate text-[11px] text-slate-500">
                            {r.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-slate-100">
                {filtered.map((r) => {
                  const d = new Date(r.recorded_at);
                  const timeStr = d.toLocaleTimeString(lang === "id" ? "id-ID" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const IconComp = METER_ICONS[r.meter_name] || Gauge;
                  const isPln =
                    r.meter_id === "menu_pln" ||
                    (r.meter_name && r.meter_name.toUpperCase().includes("PLN"));

                  return (
                    <div key={r.reading_id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">
                              {r.meter_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {timeStr} • Shift {r.shift}
                            </span>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                          +{Number(r.total).toLocaleString("id-ID")} {r.meter_unit}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Stand Awal:</span>
                          <span className="font-mono font-bold text-slate-700">{r.awal}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Stand Akhir:</span>
                          <span className="font-mono font-bold text-slate-900">{r.akhir}</span>
                        </div>
                      </div>

                      {isPln && (
                        <div className="text-[11px] font-mono text-slate-600 bg-amber-50/50 border border-amber-100 p-2 rounded-lg">
                          <div>V: {r.voltase ?? "-"}V • A: {r.ampere ?? "-"}A</div>
                          <div className="text-[10px] text-slate-500">
                            LWBP: {r.lwbp_akhir ?? r.lwbp ?? "-"} | WBP: {r.wbp_akhir ?? r.wbp ?? "-"} | kVARh: {r.kvar_akhir ?? r.kvar ?? "-"}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.user_name || "Petugas"}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {r.alarm && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Lonjakan
                            </span>
                          )}
                          {r.photo_path && (
                            <button
                              type="button"
                              onClick={() => setSelectedPhotoReading(r)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer"
                            >
                              Lihat Foto
                            </button>
                          )}
                        </div>
                      </div>

                      {r.notes && (
                        <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                          Catatan: {r.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </div>

      {/* ========================================================================= */}
      {/* PHOTO PREVIEW MODAL                                                      */}
      {/* ========================================================================= */}
      {selectedPhotoReading && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs"
          onClick={() => setSelectedPhotoReading(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h4 className="text-sm font-bold text-slate-900">
                  Foto Bukti: {selectedPhotoReading.meter_name}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Shift {selectedPhotoReading.shift?.toUpperCase()} • Petugas:{" "}
                  <strong>{selectedPhotoReading.user_name || "Petugas"}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoReading(null)}
                className="w-8 h-8 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex items-center justify-center bg-black/5 min-h-[250px]">
              {(() => {
                const p = selectedPhotoReading.photo_path || "";
                let src = p;
                if (!p.startsWith("data:") && !p.startsWith("http://") && !p.startsWith("https://")) {
                  src = `/api/files/${p}`;
                }
                return (
                  <img
                    src={src}
                    alt={`Foto ${selectedPhotoReading.meter_name}`}
                    className="max-h-[60vh] w-auto object-contain rounded-xl shadow-md border border-slate-200"
                  />
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs flex items-center justify-between">
              <div className="font-mono text-slate-700">
                Stand: {selectedPhotoReading.awal} &rarr;{" "}
                <strong>{selectedPhotoReading.akhir} {selectedPhotoReading.meter_unit}</strong>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoReading(null)}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
