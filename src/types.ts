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
