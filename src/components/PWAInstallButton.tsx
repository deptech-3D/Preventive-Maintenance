import React, { useState } from 'react';
import { Download, Smartphone, Monitor, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../utils/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed standalone PWA/APK, hide the install button
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shadow-xs flex items-center gap-1.5 transition cursor-pointer shrink-0'
            : 'w-full px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer'
        }
        title="Install Aplikasi Preventive Maintenance di HP atau PC"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{compact ? 'Install App' : 'Install Aplikasi di HP / PC'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 text-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src="/app-icon.png?v=4"
                  alt="Engineering Logbook"
                  className="w-11 h-11 rounded-xl shadow-sm border border-slate-200 object-cover"
                />
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Install Engineering Logbook
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pasang ikon aplikasi resmi di layar utama HP atau Desktop PC
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2 text-xs">
                <div className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>Cara Install di iPhone / iPad (Safari):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  <li>
                    Ketuk tombol <strong>Share (Bagikan)</strong> di bagian bawah browser Safari.
                  </li>
                  <li>
                    Geser ke bawah lalu pilih <strong>Add to Home Screen (Tambahkan ke Layar Utama)</strong>.
                  </li>
                  <li>
                    Ketuk <strong>Add (Tambah)</strong> — logo biru <em>Preventive Maintenance APP</em> akan muncul di layar HP Anda.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1.5">
                  <div className="font-bold text-blue-900 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    <span>Cara Install di HP Android (Chrome):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700">
                    <li>
                      Ketuk ikon <strong> titik tiga (⋮)</strong> di pojok kanan atas browser Chrome.
                    </li>
                    <li>
                      Pilih <strong>Install aplikasi (Install app)</strong> atau <strong>Tambahkan ke Layar Utama</strong>.
                    </li>
                  </ol>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-indigo-600" />
                    <span>Cara Install di PC / Laptop (Chrome / Edge):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700">
                    <li>
                      Klik ikon <strong>Install (layar dengan panah bawah)</strong> di sisi kanan kolom alamat URL browser, atau klik menu <strong>(⋮) → Cast, save, and share → Install page as app</strong>.
                    </li>
                    <li>
                      Klik <strong>Install</strong> — aplikasi akan tampil dengan logo resmi di Desktop & Taskbar PC Anda.
                    </li>
                  </ol>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Logo Resmi 512x512 Aktif
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
