import React, { useState } from 'react';
import {
  CreditCard,
  KeyRound,
  Printer,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Filter,
  Sparkles,
  Users
} from 'lucide-react';
import { Siswa, ExamConfig, FinancialStatus } from '../types/cbt';
import { generateExamPassword, checkFinancialEligibility } from '../utils/scoring';
import { BarcodeCard } from './BarcodeCard';
import { CBTStorage } from '../utils/cbtStorage';

interface StudentCardsManagerProps {
  students: Siswa[];
  examConfig: ExamConfig;
  onUpdateStudents: (updated: Siswa[]) => void;
}

export const StudentCardsManager: React.FC<StudentCardsManagerProps> = ({
  students,
  examConfig,
  onUpdateStudents,
}) => {
  const [activeTab, setActiveTab] = useState<'FINANCIAL_ADMIN' | 'PRINT_CARDS'>('FINANCIAL_ADMIN');
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterFinancial, setFilterFinancial] = useState<string>('ALL');

  const classes = Array.from(new Set(students.map(s => s.classRoom)));

  const filteredStudents = students.filter(s => {
    const matchClass = filterClass === 'ALL' || s.classRoom === filterClass;
    const matchFin = filterFinancial === 'ALL' || s.financialStatus === filterFinancial;
    return matchClass && matchFin;
  });

  const handleSetFinancialStatus = (studentId: string, status: FinancialStatus) => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return { ...s, financialStatus: status };
      }
      return s;
    });
    CBTStorage.saveStudents(updated);
    onUpdateStudents(updated);
  };

  const handleGenerateAllPasswords = () => {
    if (confirm('Generate password baru secara massal untuk seluruh peserta ujian?')) {
      const updated = students.map(s => ({
        ...s,
        password: generateExamPassword(6),
      }));
      CBTStorage.saveStudents(updated);
      onUpdateStudents(updated);
    }
  };

  const handleGenerateIndividualPassword = (studentId: string) => {
    const updated = students.map(s => {
      if (s.id === studentId) {
        return { ...s, password: generateExamPassword(6) };
      }
      return s;
    });
    CBTStorage.saveStudents(updated);
    onUpdateStudents(updated);
  };

  const lunasCount = students.filter(s => s.financialStatus === 'LUNAS').length;
  const dispensasiCount = students.filter(s => s.financialStatus === 'DISPENSASI').length;
  const belumCount = students.filter(s => s.financialStatus === 'BELUM_LUNAS').length;

  return (
    <div className="space-y-6">
      {/* Sub-tabs & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 no-print">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            Validasi Keuangan & Cetak Kartu Ujian Ber-Barcode
          </h2>
          <p className="text-xs text-slate-500">
            Penyaringan hak akses CBT berdasarkan administrasi SPP dan generate token sandi masuk
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('FINANCIAL_ADMIN')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'FINANCIAL_ADMIN'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Validasi Administrasi ({students.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PRINT_CARDS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'PRINT_CARDS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Printer className="w-4 h-4" />
            Cetak Kartu Peserta ({filteredStudents.length})
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs no-print">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-[11px] block">Administrasi Lunas (Berhak Ujian)</span>
            <span className="font-mono text-2xl font-black text-emerald-600 mt-1 block">
              {lunasCount} <span className="text-xs text-slate-400 font-normal">Siswa</span>
            </span>
          </div>
          <CheckCircle className="w-7 h-7 text-emerald-500 opacity-30" />
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-[11px] block">Dispensasi Resmi Sekolah</span>
            <span className="font-mono text-2xl font-black text-amber-600 mt-1 block">
              {dispensasiCount} <span className="text-xs text-slate-400 font-normal">Siswa</span>
            </span>
          </div>
          <AlertTriangle className="w-7 h-7 text-amber-500 opacity-30" />
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-[11px] block">Belum Terpenuhi (Ditangguhkan)</span>
            <span className="font-mono text-2xl font-black text-rose-600 mt-1 block">
              {belumCount} <span className="text-xs text-slate-400 font-normal">Siswa</span>
            </span>
          </div>
          <XCircle className="w-7 h-7 text-rose-500 opacity-30" />
        </div>
      </div>

      {/* TAB 1: FINANCIAL VALIDATION TABLE */}
      {activeTab === 'FINANCIAL_ADMIN' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden no-print">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <select
                value={filterClass}
                onChange={e => setFilterClass(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-medium"
              >
                <option value="ALL">Semua Kelas</option>
                {classes.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={filterFinancial}
                onChange={e => setFilterFinancial(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-medium"
              >
                <option value="ALL">Semua Status Keuangan</option>
                <option value="LUNAS">Lunas</option>
                <option value="DISPENSASI">Dispensasi</option>
                <option value="BELUM_LUNAS">Belum Lunas</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateAllPasswords}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
            >
              <KeyRound className="w-3.5 h-3.5" /> Generate Password Massal
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3.5">NISN & Nama Lengkap</th>
                  <th className="p-3.5">Kelas / Jurusan</th>
                  <th className="p-3.5">Status Administrasi SPP</th>
                  <th className="p-3.5">Kelayakan Ikut CBT</th>
                  <th className="p-3.5 font-mono">Password Ujian</th>
                  <th className="p-3.5 text-right">Ubah Status Administrasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(student => {
                  const eligibility = checkFinancialEligibility(student);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{student.name}</div>
                        <div className="font-mono text-slate-500 text-[11px]">{student.nisn}</div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-slate-800">{student.classRoom}</span>
                        <span className="text-slate-400 block text-[10px] font-bold">{student.major}</span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            student.financialStatus === 'LUNAS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : student.financialStatus === 'DISPENSASI'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {student.financialStatus}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`font-semibold text-xs flex items-center gap-1 ${
                            eligibility.allowed ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {eligibility.allowed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {eligibility.allowed ? 'Berhak Ujian' : 'Akses Dikunci'}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {student.password}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleGenerateIndividualPassword(student.id)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                            title="Generate Ulang Sandi"
                          >
                            <KeyRound className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSetFinancialStatus(student.id, 'LUNAS')}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition"
                          >
                            Lunas
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetFinancialStatus(student.id, 'DISPENSASI')}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition"
                          >
                            Dispensasi
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetFinancialStatus(student.id, 'BELUM_LUNAS')}
                            className="px-2 py-1 rounded text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                          >
                            Kunci
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRINTABLE EXAM CARDS GRID */}
      {activeTab === 'PRINT_CARDS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between no-print bg-indigo-50 p-4 rounded-2xl border border-indigo-200">
            <div>
              <h3 className="font-bold text-xs text-indigo-950">
                Pratinjau Cetak Kartu Peserta Ujian (Format 2 Kolom Kertas A4)
              </h3>
              <p className="text-[11px] text-indigo-700">
                Memuat Barcode akses masuk, foto peserta, jadwal ruang, dan verifikasi stempel resmi.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Printer className="w-4 h-4" /> Cetak Seluruh Kartu (Print / PDF)
            </button>
          </div>

          {/* Cards Printable Area */}
          <div className="print-area grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredStudents.map(student => (
              <BarcodeCard key={student.id} student={student} examConfig={examConfig} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
