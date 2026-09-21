export interface User {
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  property_name?: string;
  created_at?: string;
}

export interface MeterMenu {
  menu_id: string;
  name: string;
  unit: string;
  kind: "simple" | "pln";
  icon?: string;
  order: number;
  created_at?: string;
  deleted?: boolean;
}

export interface Reading {
  reading_id: string;
  meter_id: string;
  meter_name: string;
  meter_unit: string;
  user_id: string;
  user_name: string;
  awal: number;
  akhir: number;
  total: number;
  photo_path?: string;
  seal_photo_path?: string;
  voltase?: number;
  ampere?: number;
  lwbp?: number;
  lwbp_awal?: number;
  lwbp_akhir?: number;
  wbp?: number;
  wbp_awal?: number;
  wbp_akhir?: number;
  kvar?: number;
  kvar_awal?: number;
  kvar_akhir?: number;
  notes?: string;
  recorded_at: string;
  shift: "pagi" | "sore" | "malam";
  alarm: boolean;
}

export interface DashboardStat {
  menu_id: string;
  name: string;
  unit: string;
  icon: string;
  kind: "simple" | "pln";
  total: number;
  count: number;
  last_akhir?: number | null;
  last_recorded_at?: string | null;
  daily_total: number;
  daily_count: number;
  mtd_total: number;
  mtd_count: number;
  mtd_days: number;
  daily_avg: number;
  yesterday_total?: number;
  all_time_total?: number;
}

export interface ChartSeries {
  label: string;
  sublabel?: string;
  pagi: number;
  sore: number;
  malam: number;
  total: number;
}

export interface AppSettings {
  settings_id: string;
  property_name: string;
  dashboard_bg_url: string;
  threshold_percent: number;
  shift_pagi_start: string;
  shift_sore_start: string;
  shift_malam_start: string;
  alert_emails?: string[];
  report_emails?: string[];
  plant_report_emails?: string[];
  reset_emails?: string[];
  chart_days_count?: number; // default: 2
  chart_months_count?: number; // default: 2
  chart_years_count?: number; // default: 2
  hydrant_min_pressure?: number; // default: 7.0 Bar
  genset_min_battery_volt?: number; // default: 24.0 V
  hydrant_min_battery_volt?: number; // default: 24.0 V
  lvmdp_max_room_temp?: number; // default: 32.0 °C
  ac_maintenance_cycle?: "1 Bulan Sekali" | "2 Bulan Sekali" | "3 Bulan Sekali";
  ac_maintenance_cycle_months?: number; // 1, 2, or 3
}

export type ACCategory =
  | "Kamar Hotel"
  | "Ruang Meeting"
  | "Office"
  | "Ruangan Peralatan Hotel"
  | "Outdoor VRV per Lantai";

export const AC_CATEGORIES: ACCategory[] = [
  "Kamar Hotel",
  "Ruang Meeting",
  "Office",
  "Ruangan Peralatan Hotel",
  "Outdoor VRV per Lantai",
];

export const REAL_FLOORS = [
  "Basement",
  "Lobby / Lantai 1",
  "Lantai 2",
  "Lantai 3",
  "Lantai 5",
  "Lantai 6",
  "Lantai 7",
  "Lantai 8",
  "Lantai 9",
  "Lantai 10",
  "Lantai 11",
  "Lantai 12",
  "Rooftop",
  "Lantai Lain / VRV",
] as const;

export type RealFloor = (typeof REAL_FLOORS)[number];

export function resolveFloorFromUnit(unit: {
  floor?: string;
  name?: string;
  code?: string;
  category?: string;
}): RealFloor {
  if (unit.floor) {
    if (unit.floor === "Basement 1" || unit.floor === "Basement 2" || unit.floor === "Basement") {
      return "Basement";
    }
    if (
      unit.floor === "Lobby" ||
      unit.floor === "Lantai 1" ||
      unit.floor === "Lt 1" ||
      unit.floor === "Lt. 1" ||
      unit.floor === "Lobby / Lantai 1"
    ) {
      return "Lobby / Lantai 1";
    }
    if (
      unit.floor === "Lantai 2" ||
      unit.floor === "Lt 2" ||
      unit.floor === "Lt. 2"
    ) {
      return "Lantai 2";
    }
    if ((REAL_FLOORS as readonly string[]).includes(unit.floor)) {
      return unit.floor as RealFloor;
    }
  }

  const text = `${unit.name || ""} ${unit.code || ""} ${unit.floor || ""}`.trim();

  // Rooftop detection
  if (/\b(?:rooftop|roof\s*top|rt|rf)\b/i.test(text)) {
    return "Rooftop";
  }

  // Basement detection (Basement, Basement 1, Basement 2, B1, B2, BS1, BS2)
  if (/\b(?:basement|basemant|basemen|bs|b1|b2|bs1|bs2)\b/i.test(text)) {
    return "Basement";
  }

  // Lobby / Lantai 1 detection
  if (/\b(?:lobby|loby|front\s*desk|reception|lantai\s*1|lt\.?\s*1|fl\.?\s*1)\b/i.test(text)) {
    return "Lobby / Lantai 1";
  }

  // Lantai 2 detection
  if (/\b(?:lantai\s*2|lt\.?\s*2|fl\.?\s*2)\b/i.test(text)) {
    return "Lantai 2";
  }

  // 4-digit room numbers: 1001-1099, 1101-1199, 1201-1299
  const m4 = text.match(/\b(1[0-2])\d{2}\b/);
  if (m4) {
    const num = parseInt(m4[1], 10);
    if (num === 10) return "Lantai 10";
    if (num === 11) return "Lantai 11";
    if (num === 12) return "Lantai 12";
  }

  // 3-digit room numbers: 101-199 -> Lobby / Lantai 1, 201-299 -> Lantai 2, 301-399 -> Lantai 3, etc.
  const m3 = text.match(/\b([12356789])\d{2}\b/);
  if (m3) {
    const num = parseInt(m3[1], 10);
    if (num === 1) return "Lobby / Lantai 1";
    if (num === 2) return "Lantai 2";
    if (num === 3) return "Lantai 3";
    if (num >= 5 && num <= 9) return `Lantai ${num}` as RealFloor;
  }

  // Explicit mention like "Lantai 1", "Lantai 2", "Lantai 3", "Lt. 5", "Lt 8"
  const mLt = text.match(/(?:Lantai|Lt\.?)\s*(\d+)/i);
  if (mLt) {
    const num = parseInt(mLt[1], 10);
    if (num === 1) return "Lobby / Lantai 1";
    if (num === 2) return "Lantai 2";
    if (num === 3) return "Lantai 3";
    if (num >= 5 && num <= 12) return `Lantai ${num}` as RealFloor;
  }

  return "Lantai Lain / VRV";
}

export interface ACUnitLocation {
  id: string;
  category: ACCategory;
  floor?: RealFloor | string; // Penanda lantai riil: Lantai 3, Lantai 5, dst.
  name: string; // contoh: "Kamar 301", "Kamar 502", "Meeting Aster 1", "Office HRD", "Outdoor VRV Lt. 5"
  code?: string;
  notes?: string;
  order?: number;
  created_at?: string;
}

export interface ACMaintenanceLog {
  log_id: string;
  recorded_at: string; // ISO string otomatis waktu pengisian
  user_id: string;
  user_name: string; // Nama Teknisi yang login
  category: ACCategory;
  unit_id: string;
  unit_name: string; // Nama/Nomor Ruangan / Identifikasi Lantai Outdoor VRV
  temp_before: number; // Suhu Sebelum Cleaning (°C)
  temp_after: number; // Suhu Sesudah Cleaning (°C)
  anemo_before: number; // Anemometer Sebelum Cleaning (m/s)
  anemo_after: number; // Anemometer Sesudah Cleaning (m/s)
  notes: string; // Catatan Tambahan kondisi sebelum dan sesudah
  photo_url?: string;
  created_at?: string;
}

export interface ACUnitScheduleStatus {
  unit: ACUnitLocation;
  last_log: ACMaintenanceLog | null;
  last_cleaned_date: string | null;
  next_due_date: string | null;
  days_remaining: number; // < 0 is overdue, 0..7 is approaching, > 7 is safe
  status: "overdue" | "approaching" | "safe" | "never";
  status_label: string;
}

export interface PlantLog {
  log_id: string;
  recorded_at: string;
  shift: "pagi" | "sore" | "malam";
  user_id: string;
  user_name: string;
  property_name: string;

  // 1. Ruang LVMDP
  // a. Panel
  lvmdp_volt_rs: number | null;
  lvmdp_volt_st: number | null;
  lvmdp_volt_tr: number | null;
  lvmdp_volt_rn: number | null;
  lvmdp_volt_sn: number | null;
  lvmdp_volt_tn: number | null;
  lvmdp_ampere_total: number | null;
  lvmdp_frekuensi: number | null;
  lvmdp_cos_phi: number | null;
  lvmdp_step_aktif: string;
  lvmdp_suhu_kapasitor: string;
  // b. Trafo
  trafo_level_oli: "Normal" | "Cukup" | "Kurang";
  trafo_rembesan_oli: "Aman / Tidak Ada" | "Ada Rembesan";
  // Kondisi Fisik & Ruangan LVMDP
  lvmdp_suhu_ruang: number | null;
  lvmdp_ac_status: "Normal" | "Mati / Rusak";
  lvmdp_kondisi_suara_bau: "Normal" | "Suara Berdengung Keras" | "Bau Terbakar" | "Alarm Trip";
  lvmdp_kebersihan_penerangan: "Bersih & Terang" | "Perlu Pembersihan" | "Lampu Mati";
  lvmdp_pintu_tertutup: "Tertutup Rapat" | "Terbuka";

  // 2. Ruang Genset
  // A. Genset 1
  g1_solar_harian: number | null;
  g1_solar_bulanan: number | null;
  g1_meter_solar: number | null;
  g1_air_radiator: "Penuh / Normal" | "Kurang";
  g1_oli_mesin: "Max" | "Normal" | "Low / Min";
  g1_volt_aki: number | null;
  g1_air_aki: "Max" | "Middle" | "Low";
  g1_tgl_ganti_aki: string;
  g1_selector_switch: "AUTO" | "MANUAL" | "OFF";
  g1_running_hours: number | null;
  g1_kwh_total: number | null;
  g1_emergency_stop: "Normal" | "Tertekan";
  g1_kebersihan_ventilasi: "Baik / Normal" | "Ada Tetesan Oli/Solar" | "Fan Macet";

  // B. Genset 2
  g2_solar_harian: number | null;
  g2_solar_bulanan: number | null;
  g2_meter_solar: number | null;
  g2_air_radiator: "Penuh / Normal" | "Kurang";
  g2_oli_mesin: "Max" | "Normal" | "Low / Min";
  g2_volt_aki: number | null;
  g2_air_aki: "Max" | "Middle" | "Low";
  g2_tgl_ganti_aki: string;
  g2_selector_switch: "AUTO" | "MANUAL" | "OFF";
  g2_running_hours: number | null;
  g2_kwh_total: number | null;
  g2_emergency_stop: "Normal" | "Tertekan";
  g2_kebersihan_ventilasi: "Baik / Normal" | "Ada Tetesan Oli/Solar" | "Fan Macet";

  // 3. Ruang Pompa (Air Bersih & Hydrant)
  // A. Sistem Air Bersih
  level_rwt: number | null;
  level_cwt: number | null;
  level_gwt1: number | null;
  level_gwt2: number | null;
  transfer_selector: "AUTO" | "OFF" | "MANUAL";
  transfer_trip_status: "Normal / Tidak Trip" | "TRIP / Alarm";
  transfer_pompa1: "Standby" | "Running" | "Trouble";
  transfer_pompa2: "Standby" | "Running" | "Trouble";
  pompa_mekanikal_status: "Normal / Halus" | "Getaran Tinggi" | "Suara Kasar" | "Rembesan Seal";

  // B. Sistem Pompa Hydrant (Fire Fighting)
  hydrant_header_pressure: number | null;
  jockey_selector: "AUTO" | "MANUAL" | "OFF";
  jockey_auto_test: "Normal Auto" | "Gagal Auto";
  electric_selector: "AUTO" | "MANUAL" | "OFF";
  electric_power_indicator: "Menyala Normal" | "Mati / Abnormal";
  diesel_selector: "AUTO" | "MANUAL" | "OFF";
  diesel_solar_level: number | null;
  hydrant_volt_aki: number | null;
  hydrant_air_aki: "Max" | "Middle" | "Low";
  hydrant_tgl_ganti_aki: string;
  hydrant_key_switch: "AUTO" | "MANUAL" | "OFF";
  hydrant_main_valve: "Full Open" | "Tertutup Sebagian";
  ruang_pompa_lantai: "Kering & Drain Lancar" | "Ada Genangan Air";

  // Temuan & Catatan
  photo_temuan_url?: string;
  notes?: string;

  // Indikator Alarm Otomatis
  has_alarm: boolean;
  alarm_reasons: string[];
}
