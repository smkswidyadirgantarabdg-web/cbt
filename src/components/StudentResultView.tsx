import React from 'react';
import {
  Award,
  CheckCircle,
  XCircle,
  BarChart3,
  BookOpen,
  Printer,
  RotateCcw,
  ShieldCheck,
  Target,
  Sparkles
} from 'lucide-react';
import { Siswa, Question, ExamConfig, StudentAnswer } from '../types/cbt';
import { calculateCompetencyAnalytics } from '../utils/scoring';
import { MathRenderer } from './MathRenderer';
import { ArabicRenderer } from './ArabicRenderer';

interface StudentResultViewProps {
  student: Siswa;
  questions: Question[];
  examConfig: ExamConfig;
  answers: Record<string, StudentAnswer>;
  onResetExam: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  student,
  questions,
  examConfig,
  answers,
  onResetExam,
}) => {
  // Calculate question scores map
  const questionScores: Record<string, number> = {};
  let totalAchieved = 0;
  let totalMax = 0;
  let pgAchieved = 0;
  let pgMax = 0;
  let essayAchieved = 0;
  let essayMax = 0;

  for (const q of questions) {
    const ans = answers[q.id];
    const score = ans ? ans.score : 0;
    questionScores[q.id] = score;
    totalAchieved += score;
    totalMax += q.maxScore;

    if (q.type === 'PG') {
      pgAchieved += score;
      pgMax += q.maxScore;
    } else {
      essayAchieved += score;
      essayMax += q.maxScore;
    }
  }

  const finalScore = totalMax > 0 ? Math.round((totalAchieved / totalMax) * 100) : 0;
  const isPassed = finalScore >= examConfig.passingGrade;
  const competencyStats = calculateCompetencyAnalytics(questions, questionScores);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Banner Card */}
      <div className={`p-6 md:p-8 rounded-3xl border shadow-sm ${
        isPassed ? 'bg-gradient-to-br from-emerald-900 to-indigo-950 text-white border-emerald-700/50' : 'bg-gradient-to-br from-slate-900 to-rose-950 text-white border-rose-800/40'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 backdrop-blur-xs text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Hasil Ujian Tervalidasi & Anti-Kecurangan Terverifikasi
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {student.name}
            </h1>
            <p className="text-slate-300 text-sm">
              NISN: <span className="font-mono font-semibold">{student.nisn}</span> • Kelas: {student.classRoom} • {student.major}
            </p>
            <p className="text-slate-400 text-xs">
              Mata Pelajaran: {examConfig.subject} ({examConfig.title})
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end justify-center">
            <div className="flex items-baseline gap-1">
              <span className="text-5xl md:text-6xl font-black font-mono tracking-tight text-white">
                {finalScore}
              </span>
              <span className="text-xl text-slate-400 font-bold">/100</span>
            </div>
            <div className={`mt-2 px-3.5 py-1 rounded-xl text-xs font-extrabold flex items-center gap-1.5 ${
              isPassed ? 'bg-emerald-500 text-emerald-950' : 'bg-rose-500 text-white'
            }`}>
              {isPassed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {isPassed ? `TUNTAS KKM (${examConfig.passingGrade})` : `BELUM TUNTAS KKM (${examConfig.passingGrade})`}
            </div>
          </div>
        </div>

        {/* Detailed Score Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Nilai Pilihan Ganda (PG)</span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">
              {pgAchieved} <span className="text-xs text-slate-400">/ {pgMax} Poin</span>
            </span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Koreksi Esai Kata Kunci
            </span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">
              {essayAchieved} <span className="text-xs text-slate-400">/ {essayMax} Poin</span>
            </span>
          </div>
          <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
            <span className="text-slate-400 block text-[11px]">Integritas & Keamanan</span>
            <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
              {student.violationCount === 0 ? 'Bersih (0 Teguran)' : `${student.violationCount} Kali Teguran`}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between no-print">
        <button
          type="button"
          onClick={onResetExam}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs"
        >
          <RotateCcw className="w-4 h-4 text-indigo-600" /> Ulangi Ujian (Reset Sesi)
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-xs"
        >
          <Printer className="w-4 h-4" /> Cetak Transkrip Nilai & Analitik
        </button>
      </div>

      {/* Deep Competency Radar / Progress Breakdown */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Analisis Capaian Kompetensi Siswa (Kurikulum Merdeka SMK)
              </h2>
              <p className="text-xs text-slate-500">
                Evaluasi tingkat penguasaan per elemen kompetensi kejuruan dan umum
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
            Standar Industri & UKK
          </span>
        </div>

        <div className="space-y-4 pt-2">
          {competencyStats.map(stat => (
            <div key={stat.competency} className="space-y-1.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-200/60">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 max-w-md truncate">
                  {stat.competency}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-700">
                    {stat.achievedScore}/{stat.maxScore} Poin ({stat.percentage}%)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      stat.masteryStatus === 'KOMPETEN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : stat.masteryStatus === 'CUKUP'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {stat.masteryStatus}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stat.percentage >= 75
                      ? 'bg-emerald-500'
                      : stat.percentage >= 60
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.min(100, stat.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Item-by-item Detailed Review */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Pembahasan & Evaluasi Jawaban Per Butir Soal
        </h3>

        <div className="space-y-6 pt-2">
          {questions.map((q, idx) => {
            const ans = answers[q.id];
            const isCorrect = q.type === 'PG'
              ? ans?.selectedOption === q.correctAnswer
              : (ans?.score || 0) >= q.maxScore * 0.7;

            return (
              <div
                key={q.id}
                className={`p-4 md:p-5 rounded-2xl border transition ${
                  isCorrect ? 'bg-emerald-50/20 border-emerald-200' : 'bg-rose-50/20 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold px-2.5 py-0.5 rounded-md bg-slate-900 text-white text-[11px]">
                      No. {idx + 1}
                    </span>
                    <span className="text-slate-500">{q.subject}</span>
                    <span className="text-slate-400">• {q.code}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">
                      Nilai: {ans?.score || 0} / {q.maxScore}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {isCorrect ? 'Tepat' : 'Kurang Tepat'}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-800 font-medium leading-relaxed mb-3">
                  {q.questionText}
                </p>

                {q.mathFormula && <MathRenderer formula={q.mathFormula} />}
                {q.arabicText && <ArabicRenderer text={q.arabicText} />}

                {/* Multiple choice response review */}
                {q.type === 'PG' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs my-3">
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-slate-500 block text-[10px]">Jawaban Anda:</span>
                      <span className={`font-bold mt-0.5 block ${isCorrect ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {ans?.selectedOption || '(Tidak Dijawab)'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200">
                      <span className="text-indigo-600 block text-[10px]">Kunci Jawaban Resmi:</span>
                      <span className="font-bold text-indigo-900 mt-0.5 block">
                        {q.correctAnswer}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-xs my-3">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 font-semibold block text-[11px] mb-1">
                        Uraian Jawaban Siswa:
                      </span>
                      <p className="text-slate-800 italic leading-relaxed">
                        "{ans?.essayText || '(Jawaban Kosong)'}"
                      </p>
                    </div>

                    {ans?.matchedKeywords && ans.matchedKeywords.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                        <span className="text-emerald-800 font-medium">
                          Kata Kunci Teridentifikasi: <strong>{ans.matchedKeywords.join(', ')}</strong>
                        </span>
                        <span className="text-emerald-700 text-[11px] font-semibold">
                          {ans.feedback}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Pedagogical explanation */}
                {q.explanation && (
                  <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-950">
                    <span className="font-bold block mb-0.5">Penjelasan Soal:</span>
                    <p className="leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
