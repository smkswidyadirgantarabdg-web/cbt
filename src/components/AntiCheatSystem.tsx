import React, { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert, Lock, Maximize2, Monitor } from 'lucide-react';
import { CBTStorage } from '../utils/cbtStorage';
import { Siswa } from '../types/cbt';

interface AntiCheatSystemProps {
  student: Siswa;
  isActive: boolean;
  maxViolations?: number;
  onViolationLimitReached?: () => void;
  onViolationRecorded?: (count: number) => void;
}

export const AntiCheatSystem: React.FC<AntiCheatSystemProps> = ({
  student,
  isActive,
  maxViolations = 3,
  onViolationLimitReached,
  onViolationRecorded,
}) => {
  const [violationCount, setViolationCount] = useState<number>(student.violationCount || 0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [lastWarningMsg, setLastWarningMsg] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Check if currently fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);

      if (isActive && !isFull) {
        handleTriggerViolation('FULLSCREEN_EXIT', 'Peserta keluar dari mode Layar Penuh (Fullscreen Lock).');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isActive]);

  const requestFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Fullscreen request rejected by browser:', err);
    }
  };

  const handleTriggerViolation = (
    type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'APP_BLUR' | 'KEY_RESTRICTED',
    description: string
  ) => {
    if (!isActive) return;

    const newCount = violationCount + 1;
    setViolationCount(newCount);
    setLastWarningMsg(description);
    setShowWarningModal(true);

    // Save incident to central storage & broadcast to proctor
    CBTStorage.recordIncident({
      studentId: student.id,
      studentName: student.name,
      type,
      description,
      severity: newCount >= maxViolations ? 'CRITICAL' : 'WARNING',
    });

    onViolationRecorded?.(newCount);

    if (newCount >= maxViolations) {
      onViolationLimitReached?.();
    }
  };

  // Visibility & Blur listeners
  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleTriggerViolation(
          'TAB_SWITCH',
          'Peserta terdeteksi berpindah tab atau meminimalkan jendela ujian!'
        );
      }
    };

    const handleWindowBlur = () => {
      handleTriggerViolation(
        'APP_BLUR',
        'Peserta terdeteksi memindahkan fokus ke aplikasi pihak ketiga / jendela lain!'
      );
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleTriggerViolation('KEY_RESTRICTED', 'Klik kanan / menu konteks dinonaktifkan demi keamanan.');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent PrintScreen, F12 (Inspect), Ctrl+C, Ctrl+V, Ctrl+U (View Source)
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'u' || e.key === 'p' || e.key === 's')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j'))
      ) {
        e.preventDefault();
        handleTriggerViolation(
          'KEY_RESTRICTED',
          `Kombinasi tombol terlarang (${e.key}) diblokir sistem pengawas.`
        );
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, violationCount]);

  return (
    <>
      {/* Anti-cheat status banner */}
      <div className="bg-slate-900 text-white px-3 py-1.5 flex items-center justify-between text-xs border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-400 flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" /> Anti-Kecurangan Real-Time Aktif
          </span>
          <span className="text-slate-400 hidden sm:inline">| Deteksi Layar & Tab Switch</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[11px]">
            <span className="text-slate-400">Peringatan:</span>
            <span
              className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs ${
                violationCount === 0
                  ? 'bg-slate-800 text-slate-300'
                  : violationCount < maxViolations
                  ? 'bg-amber-900/80 text-amber-300 border border-amber-600'
                  : 'bg-rose-900/80 text-rose-300 border border-rose-600 animate-pulse'
              }`}
            >
              {violationCount} / {maxViolations}
            </span>
          </div>

          {!isFullscreen && (
            <button
              type="button"
              onClick={requestFullscreen}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded text-[11px] inline-flex items-center gap-1 transition"
            >
              <Maximize2 className="w-3 h-3" /> Kunci Layar Penuh
            </button>
          )}

          {/* Teacher / Tester trigger button */}
          <button
            type="button"
            onClick={() => handleTriggerViolation('TAB_SWITCH', 'Uji coba simulasi deteksi tab switch / pindah aplikasi.')}
            className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-700 transition"
            title="Klik untuk mensimulasikan peringatan anti curang"
          >
            Simulasi Pindah Tab
          </button>
        </div>
      </div>

      {/* High-priority Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border-4 border-rose-500 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-3">
              <div className="p-2 bg-rose-700/80 rounded-xl">
                <AlertTriangle className="w-7 h-7 text-amber-300" />
              </div>
              <div>
                <h3 className="font-extrabold text-base tracking-tight">PERINGATAN SISTEM PENGAWAS!</h3>
                <p className="text-xs text-rose-100">Pelanggaran Terdeteksi Secara Real-Time</p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 text-xs leading-relaxed">
                <span className="font-bold block mb-1">Rincian Deteksi:</span>
                {lastWarningMsg || 'Aplikasi pihak ketiga atau perpindahan layar terdeteksi.'}
              </div>

              <div className="bg-slate-100 p-3 rounded-xl text-xs space-y-1 text-slate-700">
                <div className="flex justify-between">
                  <span>Nama Peserta:</span>
                  <span className="font-bold text-slate-900">{student.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Status Kuota Pelanggaran:</span>
                  <span className="font-bold text-rose-600">
                    {violationCount} dari maksimal {maxViolations} kali
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Log Terkirim:</span>
                  <span className="text-emerald-700 font-semibold">Tersinkronisasi ke Dashboard Pengawas</span>
                </div>
              </div>

              {violationCount >= maxViolations ? (
                <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-bold text-center">
                  Batas toleransi pelanggaran telah habis. Ujian Anda akan ditandai atau dikunci oleh pengawas!
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 text-center italic">
                  Tetap berada di halaman ujian hingga selesai. Jangan membuka browser lain, aplikasi chat, atau split screen.
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowWarningModal(false);
                    if (!isFullscreen) requestFullscreen();
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-amber-400" />
                  Saya Mengerti & Kembali Mengerjakan Ujian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
