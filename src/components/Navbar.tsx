import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Laptop,
  CreditCard,
  BarChart3,
  Zap,
  GraduationCap,
  RotateCcw,
  Wifi,
  WifiOff,
  ShieldAlert
} from 'lucide-react';
import { CBTStorage, cbtChannel } from '../utils/cbtStorage';

export type ActiveTab = 'SISWA' | 'BANK_SOAL' | 'PENGAWAS' | 'KARTU_UJIAN' | 'ANALITIK' | 'CONCURRENCY';

interface NavbarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  onResetData: () => void;
  violationCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onChangeTab,
  onResetData,
  violationCount,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { id: 'SISWA' as ActiveTab, label: 'Ruang Ujian Siswa', icon: GraduationCap },
    { id: 'BANK_SOAL' as ActiveTab, label: 'Bank Soal & Kisi-Kisi', icon: BookOpen },
    {
      id: 'PENGAWAS' as ActiveTab,
      label: 'Pengawas Real-Time',
      icon: Laptop,
      badge: violationCount > 0 ? `${violationCount}` : undefined,
    },
    { id: 'KARTU_UJIAN' as ActiveTab, label: 'Validasi & Kartu Barcode', icon: CreditCard },
    { id: 'ANALITIK' as ActiveTab, label: 'Analitik & Pelaporan', icon: BarChart3 },
    { id: 'CONCURRENCY' as ActiveTab, label: 'Simulasi 1000 Peserta', icon: Zap },
  ];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md">
              SMK
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  CBT MANDIRI SMK
                </span>
                <span className="hidden sm:inline text-[10px] font-bold bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded-full">
                  v2.6 Kejuruan
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Sistem Ujian Online Anti-Kecurangan & Analitik Nilai
              </p>
            </div>
          </div>

          {/* Right Status Indicators */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isOnline
                  ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
              }`}
              title={isOnline ? 'Terhubung dengan Firebase & Local Sync' : 'Bekerja dalam mode offline'}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="text-[11px] hidden sm:inline">{isOnline ? 'Online Sync' : 'Offline Mode'}</span>
            </div>

            <button
              type="button"
              onClick={onResetData}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 text-xs flex items-center gap-1 transition"
              title="Kembalikan data sampel demo awal"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline text-[11px]">Reset Data Demo</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition relative ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-extrabold animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
