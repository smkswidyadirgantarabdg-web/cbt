import React, { useState } from 'react';
import {
  Lock,
  UserCheck,
  CreditCard,
  ShieldCheck,
  AlertCircle,
  Eye,
  ArrowRight,
  Printer,
  Barcode
} from 'lucide-react';
import { Siswa, ExamConfig } from '../types/cbt';
import { checkFinancialEligibility } from '../utils/scoring';
import { BarcodeCard } from './BarcodeCard';
import { CBTStorage } from '../utils/cbtStorage';

interface StudentLoginScreenProps {
  students: Siswa[];
  examConfig: ExamConfig;
  onLoginSuccess: (student: Siswa) => void;
}

export const StudentLoginScreen: React.FC<StudentLoginScreenProps> = ({
  students,
  examConfig,
  onLoginSuccess,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [inputNisn, setInputNisn] = useState<string>(students[0]?.nisn || '');
  const [inputPassword, setInputPassword] = useState<string>(students[0]?.password || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCardModal, setShowCardModal] = useState<boolean>(false);

  // Sync inputs when selecting sample student
  const handleSelectSample = (id: string) => {
    setSelectedStudentId(id);
    const found = students.find(s => s.id === id);
    if (found) {
      setInputNisn(found.nisn);
      setInputPassword(found.password);
      setErrorMsg(null);
    }
  };

  const currentStudent = students.find(s => s.id === selectedStudentId) || students[0];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const found = students.find(
      s => s.nisn.trim() === inputNisn.trim() && s.password.trim() === inputPassword.trim()
    );

    if (!found) {
      setErrorMsg('NISN atau Password Ujian tidak sesuai! Silakan periksa kartu peserta ujian Anda.');
      return;
    }

    // Financial validation gate
    const eligibility = checkFinancialEligibility(found);
    if (!eligibility.allowed) {
      setErrorMsg(`AKSES DITOLAK: ${eligibility.reason}`);
      return;
    }

    // Set started at if not set
    CBTStorage.updateStudentStatus(found.id, 'SEDANG_MENGERJAKAN', {
      startedAt: found.startedAt || new Date().toLocaleTimeString('id-ID'),
    });

    onLoginSuccess(found);
  };

  return (
    <div className="max-w-2xl mx-auto my-6 p-4">
      {/* School Card Box */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Banner Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-6 md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center font-black text-xl border border-white/20">
                SMK
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tight">
                  SMK WIDYA DIRGANTARA
                </h2>
                <p className="text-xs text-indigo-200 font-medium">
                  Portal Masuk Siswa • Computer Based Test (CBT) Mandiri 2026
                </p>
              </div>
            </div>

            <div className="hidden sm:block text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30">
                Online Server Ready
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-indigo-100">
            <div>
              <span className="text-slate-400 block text-[10px]">Ujian Aktif:</span>
              <span className="font-bold">{examConfig.title}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block text-[10px]">Durasi:</span>
              <span className="font-bold">{examConfig.durationMinutes} Menit</span>
            </div>
          </div>
        </div>

        {/* Demo Fast Selector Helper */}
        <div className="p-4 bg-indigo-50/70 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-indigo-900 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-indigo-600" />
            Pilih Sampel Akun Siswa (Uji Coba Cepat):
          </span>
          <select
            value={selectedStudentId}
            onChange={e => handleSelectSample(e.target.value)}
            className="px-3 py-1.5 border border-indigo-200 rounded-xl bg-white text-xs font-semibold text-indigo-950 focus:ring-2 focus:ring-indigo-500"
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.classRoom}) - {s.financialStatus}
              </option>
            ))}
          </select>
        </div>

        {/* Login Form */}
        <div className="p-6 md:p-8 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                <span className="font-bold block text-rose-950 mb-0.5">Pemberitahuan Sistem:</span>
                {errorMsg}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                Nomor Induk Siswa Nasional (NISN)
              </label>
              <input
                type="text"
                value={inputNisn}
                onChange={e => setInputNisn(e.target.value)}
                placeholder="Masukkan 10 digit NISN..."
                className="w-full p-3.5 border border-slate-300 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 font-bold"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 block">Password / Token Ujian</label>
                <button
                  type="button"
                  onClick={() => setShowCardModal(true)}
                  className="text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <Barcode className="w-3.5 h-3.5" /> Lihat Kartu Ujian Barcode
                </button>
              </div>
              <input
                type="text"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                placeholder="Masukkan token password pada kartu ujian..."
                className="w-full p-3.5 border border-slate-300 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700 tracking-wider"
                required
              />
            </div>

            {/* Financial Status Summary pill */}
            {currentStudent && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px]">Validasi Administrasi Keuangan:</span>
                  <span className="font-bold text-slate-800">{currentStudent.name}</span>
                </div>
                <span
                  className={`px-3 py-1 rounded-xl text-xs font-bold ${
                    currentStudent.financialStatus === 'LUNAS'
                      ? 'bg-emerald-100 text-emerald-800'
                      : currentStudent.financialStatus === 'DISPENSASI'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {currentStudent.financialStatus}
                </span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                <span>Masuk & Mulai Mengerjakan CBT</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Security Features Checklist */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Anti-Kecurangan Layar Aktif</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Sinkronisasi Offline Tersedia</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Koreksi Esai Kata Kunci Otomatis</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Pengawasan Real-Time Pengawas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal View Student Card */}
      {showCardModal && currentStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-extrabold text-sm text-slate-900">Kartu Peserta Ujian Resmi</h3>
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex justify-center">
              <BarcodeCard student={currentStudent} examConfig={examConfig} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Cetak Kartu
              </button>
              <button
                type="button"
                onClick={() => setShowCardModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
