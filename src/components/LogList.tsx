import React, { useEffect, useState } from "react";
import {
  Droplet,
  Zap,
  Flame,
  Building2,
  Recycle,
  Gauge,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { MeterMenu } from "../types";
import { useI18n } from "../i18n";
import { fetchMenus } from "../supabaseService";

const METER_ICONS: Record<string, React.ElementType> = {
  Drop: Droplet,
  Lightning: Zap,
  Flame: Flame,
  Buildings: Building2,
  Recycle: Recycle,
  Gauge: Gauge,
};

interface LogListProps {
  onSelectMeter: (meterId: string) => void;
}

export function LogList({ onSelectMeter }: LogListProps) {
  const { t } = useI18n();
  const [menus, setMenus] = useState<MeterMenu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const m = await fetchMenus();
        setMenus(m);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4 max-w-2xl mx-auto pb-20">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("select_meter")}</h1>
            <p className="text-xs text-slate-500">{t("log")} - Pilih peralatan meter yang akan dicatat</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          menus.map((m) => {
            const Icon = METER_ICONS[m.icon || ""] || Gauge;
            return (
              <button
                key={m.menu_id}
                id={`meter-row-${m.name}`}
                onClick={() => onSelectMeter(m.menu_id)}
                className="w-full flex items-center gap-4 p-4 bg-white hover:bg-blue-50/40 rounded-2xl border border-slate-200 hover:border-blue-300 transition shadow-sm text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 truncate">{m.name}</h3>
                    {m.kind === "pln" && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">
                        PLN (V/A/WBP)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Satuan: <span className="font-semibold text-slate-700">{m.unit}</span>
                    {m.kind === "pln" ? " • Voltase, Ampere, LWBP, WBP, kvar" : " • Meter standar"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
