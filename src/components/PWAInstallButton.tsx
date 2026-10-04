import React, { useEffect, useState } from "react";
import { Download, Smartphone, Check } from "lucide-react";

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export function PWAInstallButton({ compact = false, className = "" }: PWAInstallButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // Check if iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isAppleDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      // Guide user how to install or add to home screen via browser menu
      alert("Untuk memasang aplikasi di HP/Laptop: Tekan menu browser (titik tiga) lalu pilih 'Tambahkan ke Layar Utama' atau 'Pasang Aplikasi'.");
    }
  };

  // If already running inside installed standalone PWA, don't show install button
  if (isInstalled) {
    return null;
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          title="Pasang Aplikasi ke HP (PWA)"
          className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition shadow-xs cursor-pointer ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline">Pasang Aplikasi</span>
          <span className="sm:hidden">Install</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Pasang di iPhone / iPad</h3>
              <p className="text-xs text-slate-600 leading-relaxed text-left">
                1. Ketuk ikon <strong>Bagikan (Share)</strong> di bilah navigasi Safari bawah.<br />
                2. Gulir ke bawah lalu pilih <strong>'Tambahkan ke Layar Utama' (Add to Home Screen)</strong>.<br />
                3. Ketuk <strong>'Tambah'</strong> di kanan atas.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition shadow-xs cursor-pointer ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-blue-600" />
        <span>Pasang Aplikasi di HP / Layar Utama</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-2xl border border-slate-200 text-center space-y-3">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Pasang di iPhone / iPad</h3>
            <p className="text-xs text-slate-600 leading-relaxed text-left">
              1. Ketuk tombol <strong>Bagikan (Share)</strong> di Safari.<br />
              2. Pilih <strong>'Tambahkan ke Layar Utama' (Add to Home Screen)</strong>.<br />
              3. Ketuk <strong>'Tambah'</strong> untuk memasang ikon aplikasi di layar HP.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
