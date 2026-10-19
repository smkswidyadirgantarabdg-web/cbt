import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Award,
  Download,
  Printer,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  Users
} from 'lucide-react';
import { Siswa, Question, ExamConfig } from '../types/cbt';
import { calculateCompetencyAnalytics } from '../utils/scoring';

interface AnalyticsDashboardProps {
  students: Siswa[];
  questions: Question[];
  examConfig: ExamConfig;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  students,
  questions,
  examConfig,
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');

  // Calculate scores
  const scoredStudents = students.filter(s => s.score !== undefined);
  const scores = scoredStudents.map(s => s.score || 0);

  const totalScored = scores.length;
  const avgScore = totalScored > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / totalScored) * 10) / 10 : 0;
  const maxScore = totalScored > 0 ? Math.max(...scores) : 0;
  const minScore = totalScored > 0 ? Math.min(...scores) : 0;
  const passCount = scores.filter(s => s >= examConfig.passingGrade).length;
  const passRate = totalScored > 0 ? Math.round((passCount / totalScored) * 100) : 0;

  // Selected student analysis
  const activeStudent = students.find(s => s.id === selectedStudentId) || students[0];

  // Competency mastery aggregate across all questions
  const aggregateScores: Record<string, number> = {};
  for (const q of questions) {
    aggregateScores[q.id] = (q.maxScore * avgScore) / 100;
  }
  const schoolCompetencies = calculateCompetencyAnalytics(questions, aggregateScores);

  const handleExportCSV = () => {
    const headers = ['NISN', 'Nama Peserta', 'Kelas', 'Jurusan', 'Status Keuangan', 'Nilai CBT', 'Status KKM', 'Pelanggaran'];
    const rows = students.map(s => [
      `"${s.nisn}"`,
      `"${s.name}"`,
      `"${s.classRoom}"`,
      `"${s.major}"`,
      `"${s.financialStatus}"`,
      s.score !== undefined ? s.score : 'Belum Ujian',
      (s.score || 0) >= examConfig.passingGrade ? 'TUNTAS' : 'BELUM TUNTAS',
      s.violationCount || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rekap_Nilai_CBT_${examConfig.subject.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3 no-print">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Laporan Analitik Nilai & Penguasaan Kompetensi Real-Time
          </h2>
          <p className="text-xs text-slate-500">
            Analisis kemampuan personal siswa dan agregasi daya serap per Capaian Pembelajaran SMK
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" /> Unduh File CSV / Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak Laporan PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Rata-Rata Nilai</span>
            <span className="font-mono text-2xl font-black text-indigo-600 mt-1 block">
              {avgScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
            </span>
          </div>
          <TrendingUp className="w-7 h-7 text-indigo-500 opacity-30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Tingkat Ketuntasan (KKM {examConfig.passingGrade})</span>
            <span className="font-mono text-2xl font-black text-emerald-600 mt-1 block">
              {passRate}%
            </span>
          </div>
          <CheckCircle2 className="w-7 h-7 text-emerald-500 opacity-30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Nilai Tertinggi</span>
            <span className="font-mono text-2xl font-black text-amber-600 mt-1 block">
              {maxScore}
            </span>
          </div>
          <Award className="w-7 h-7 text-amber-500 opacity-30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Nilai Terendah</span>
            <span className="font-mono text-2xl font-black text-rose-600 mt-1 block">
              {minScore}
            </span>
          </div>
          <AlertCircle className="w-7 h-7 text-rose-500 opacity-30" />
        </div>
      </div>

      {/* Two columns: Competency Breakdown & Student Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: School Competency Mastery Bars */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 uppercase">
                Daya Serap Kompetensi Standar Industri (SMK)
              </h3>
              <p className="text-xs text-slate-500">
                Pencapaian peserta didik per elemen materi pembelajaran kejuruan
              </p>
            </div>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full">
              Kurikulum Merdeka
            </span>
          </div>

          <div className="space-y-4 pt-1">
            {schoolCompetencies.map(comp => (
              <div key={comp.competency} className="space-y-1.5 p-3 rounded-2xl bg-slate-50/70 border border-slate-200/60 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 max-w-sm truncate">
                    {comp.competency}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-700">
                      {comp.percentage}% Ketuntasan
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                        comp.percentage >= 75
                          ? 'bg-emerald-100 text-emerald-800'
                          : comp.percentage >= 60
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {comp.masteryStatus}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      comp.percentage >= 75 ? 'bg-emerald-500' : comp.percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, comp.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Individual Student Profile Quick View */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase">
              Rekomendasi Personal Siswa
            </h3>
            <p className="text-xs text-slate-500">Pilih peserta untuk analisis mendalam</p>
          </div>

          <select
            value={selectedStudentId}
            onChange={e => setSelectedStudentId(e.target.value)}
            className="w-full p-2.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.classRoom}) - {s.score !== undefined ? `${s.score} Poin` : 'Belum Ujian'}
              </option>
            ))}
          </select>

          {activeStudent && (
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-slate-900">{activeStudent.name}</h4>
                  <p className="text-slate-500 font-mono">{activeStudent.nisn}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black text-indigo-700 block">
                    {activeStudent.score !== undefined ? activeStudent.score : '-'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">NILAI CBT</span>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-indigo-100 text-slate-700 text-[11px]">
                <div className="flex justify-between">
                  <span>Kelas & Kejuruan:</span>
                  <span className="font-bold">{activeStudent.classRoom} ({activeStudent.major})</span>
                </div>
                <div className="flex justify-between">
                  <span>Status Kesiapan UKK:</span>
                  <span className={`font-bold ${
                    (activeStudent.score || 0) >= 80 ? 'text-emerald-700' : 'text-amber-700'
                  }`}>
                    {(activeStudent.score || 0) >= 80 ? 'Sangat Siap Sertifikasi' : 'Perlu Pengayaan Mandiri'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Catatan Pengawasan:</span>
                  <span className="font-semibold text-slate-600">
                    {activeStudent.violationCount === 0 ? 'Tertib & Disiplin' : `${activeStudent.violationCount}x Peringatan Layar`}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full Students Score Ranking Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden print-area">
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800">
            Peringkat dan Rekapitulasi Nilai Akhir Seluruh Peserta Ujian
          </span>
          <span className="text-xs text-slate-500">
            KKM: <strong>{examConfig.passingGrade}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                <th className="p-3.5 w-12 text-center">Rank</th>
                <th className="p-3.5">NISN</th>
                <th className="p-3.5">Nama Peserta Didik</th>
                <th className="p-3.5">Kelas / Jurusan</th>
                <th className="p-3.5 text-center">Status Administrasi</th>
                <th className="p-3.5 text-center font-mono">Nilai CBT</th>
                <th className="p-3.5 text-center">Ketuntasan</th>
                <th className="p-3.5 text-center">Teguran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...students]
                .sort((a, b) => (b.score || 0) - (a.score || 0))
                .map((student, rank) => {
                  const hasScore = student.score !== undefined;
                  const isPass = (student.score || 0) >= examConfig.passingGrade;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 text-center font-bold text-slate-400">
                        {rank + 1}
                      </td>
                      <td className="p-3.5 font-mono font-medium text-slate-600">{student.nisn}</td>
                      <td className="p-3.5 font-bold text-slate-900">{student.name}</td>
                      <td className="p-3.5">{student.classRoom} • {student.major}</td>
                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          student.financialStatus === 'LUNAS'
                            ? 'bg-emerald-100 text-emerald-800'
                            : student.financialStatus === 'DISPENSASI'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {student.financialStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-base font-black text-slate-900">
                        {hasScore ? student.score : '-'}
                      </td>
                      <td className="p-3.5 text-center">
                        {hasScore ? (
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {isPass ? 'TUNTAS' : 'REMIDI'}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">Belum Ujian</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-600">
                        {student.violationCount || 0}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
