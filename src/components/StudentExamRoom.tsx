import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  Send,
  Sparkles,
  BookOpen,
  ZoomIn,
  Save,
} from 'lucide-react';
import { Siswa, Question, ExamConfig, StudentAnswer } from '../types/cbt';
import { CBTStorage } from '../utils/cbtStorage';
import { formatAutoSaveTime } from '../utils/autosave';
import {
  shuffleArrayWithSeed,
  gradeMultipleChoice,
  gradeEssayByKeywords,
} from '../utils/scoring';
import { MathRenderer } from './MathRenderer';
import { ArabicRenderer } from './ArabicRenderer';
import { AntiCheatSystem } from './AntiCheatSystem';

interface StudentExamRoomProps {
  student: Siswa;
  rawQuestions: Question[];
  examConfig: ExamConfig;
  onFinishExam: (finalScore: number, answers: Record<string, StudentAnswer>) => void;
}

export const StudentExamRoom: React.FC<StudentExamRoomProps> = ({
  student,
  rawQuestions,
  examConfig,
  onFinishExam,
}) => {
  // Deterministic shuffle per student ID
  const questions = useMemo(() => {
    if (!examConfig.shuffleQuestions) return rawQuestions;
    return shuffleArrayWithSeed(rawQuestions, student.nisn || student.id);
  }, [rawQuestions, examConfig.shuffleQuestions, student.nisn, student.id]);

  // Load existing exam progress (question index, remaining time) from LocalStorage
  const savedProgress = useMemo(() => CBTStorage.getExamProgress(student.id), [student.id]);

  const [currentIndex, setCurrentIndex] = useState<number>(() => {
    if (savedProgress && typeof savedProgress.currentIndex === 'number') {
      return Math.min(Math.max(0, savedProgress.currentIndex), Math.max(0, rawQuestions.length - 1));
    }
    return 0;
  });

  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>(() => {
    return CBTStorage.getAnswers(student.id);
  });

  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [timeRemaining, setTimeRemaining] = useState<number>(() => {
    if (savedProgress && typeof savedProgress.timeRemaining === 'number' && savedProgress.timeRemaining > 0) {
      return savedProgress.timeRemaining;
    }
    return examConfig.durationMinutes * 60;
  });

  const [showConfirmFinish, setShowConfirmFinish] = useState<boolean>(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);

  // Auto-Save notification & status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>(() => {
    if (savedProgress?.lastSavedAt) {
      return formatAutoSaveTime(savedProgress.lastSavedAt);
    }
    return new Date().toLocaleTimeString('id-ID');
  });

  const [restoredBanner, setRestoredBanner] = useState<string | null>(() => {
    const existingCount = Object.keys(CBTStorage.getAnswers(student.id)).length;
    if (existingCount > 0) {
      return `${existingCount} jawaban sebelumnya berhasil dipulihkan otomatis dari LocalStorage. Pekerjaan tidak hilang saat refresh!`;
    }
    return null;
  });

  // Keep ref to latest states for beforeunload
  const stateRef = useRef({ currentIndex, timeRemaining, answers });
  useEffect(() => {
    stateRef.current = { currentIndex, timeRemaining, answers };
  }, [currentIndex, timeRemaining, answers]);

  // Online / Offline synchronization listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      const syncedCount = CBTStorage.flushOfflineQueue();
      if (syncedCount > 0) {
        console.log(`[Offline Sync] Berhasil mensinkronisasi ${syncedCount} jawaban tertunda.`);
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Save current question index on change so reload stays on exact same question
  useEffect(() => {
    CBTStorage.saveExamProgress(student.id, { currentIndex });
  }, [currentIndex, student.id]);

  // Exam timer countdown + periodic LocalStorage autosave
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        const updated = prev - 1;
        // Autosave remaining time every 5 seconds to LocalStorage
        if (updated % 5 === 0) {
          CBTStorage.saveExamProgress(student.id, {
            timeRemaining: updated,
            currentIndex: stateRef.current.currentIndex,
          });
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [student.id]);

  // Persist latest state on browser refresh / window close
  useEffect(() => {
    const handleBeforeUnload = () => {
      CBTStorage.saveExamProgress(student.id, {
        currentIndex: stateRef.current.currentIndex,
        timeRemaining: stateRef.current.timeRemaining,
        lastSavedAt: new Date().toISOString(),
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [student.id]);

  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;

  // Options shuffling (deterministic per question + student seed)
  const currentOptions = useMemo(() => {
    if (!currentQuestion?.options) return [];
    if (!examConfig.shuffleOptions) return currentQuestion.options;
    return shuffleArrayWithSeed(
      currentQuestion.options,
      `${student.nisn}_${currentQuestion.id}`
    );
  }, [currentQuestion, examConfig.shuffleOptions, student.nisn]);

  // Handle saving multiple-choice answer - persists immediately to LocalStorage
  const handleSelectOption = (optionKey: 'A' | 'B' | 'C' | 'D' | 'E') => {
    if (!currentQuestion) return;

    setSaveStatus('saving');
    const score = gradeMultipleChoice(
      optionKey,
      currentQuestion.correctAnswer,
      currentQuestion.maxScore
    );

    const nowIso = new Date().toISOString();
    const updatedAnswer: StudentAnswer = {
      questionId: currentQuestion.id,
      selectedOption: optionKey,
      isDoubtful: currentAnswer?.isDoubtful || false,
      score,
      updatedAt: nowIso,
    };

    const newAnswers = { ...answers, [currentQuestion.id]: updatedAnswer };
    setAnswers(newAnswers);

    // Instant persistence to LocalStorage
    CBTStorage.saveAnswer(student.id, updatedAnswer);
    CBTStorage.saveExamProgress(student.id, {
      currentIndex,
      timeRemaining,
      lastSavedAt: nowIso,
    });

    setLastSavedTime(formatAutoSaveTime(nowIso));
    setSaveStatus('saved');
  };

  // Handle saving essay answer with instant keyword analysis and immediate LocalStorage persistence
  const handleEssayChange = (text: string) => {
    if (!currentQuestion) return;

    setSaveStatus('saving');
    const evalResult = gradeEssayByKeywords(
      text,
      currentQuestion.essayKeywords,
      currentQuestion.maxScore
    );

    const nowIso = new Date().toISOString();
    const updatedAnswer: StudentAnswer = {
      questionId: currentQuestion.id,
      essayText: text,
      isDoubtful: currentAnswer?.isDoubtful || false,
      score: evalResult.score,
      matchedKeywords: evalResult.matchedKeywords,
      feedback: evalResult.feedback,
      updatedAt: nowIso,
    };

    const newAnswers = { ...answers, [currentQuestion.id]: updatedAnswer };
    setAnswers(newAnswers);

    // Instant persistence to LocalStorage on every keystroke
    CBTStorage.saveAnswer(student.id, updatedAnswer);
    CBTStorage.saveExamProgress(student.id, {
      currentIndex,
      timeRemaining,
      lastSavedAt: nowIso,
    });

    setLastSavedTime(formatAutoSaveTime(nowIso));
    setSaveStatus('saved');
  };

  // Toggle doubtful flag - persists to LocalStorage
  const toggleDoubtful = () => {
    if (!currentQuestion) return;
    setSaveStatus('saving');
    const isDoubtful = !currentAnswer?.isDoubtful;
    const nowIso = new Date().toISOString();
    const updatedAnswer: StudentAnswer = {
      ...(currentAnswer || {
        questionId: currentQuestion.id,
        score: 0,
        updatedAt: nowIso,
      }),
      isDoubtful,
      updatedAt: nowIso,
    };

    const newAnswers = { ...answers, [currentQuestion.id]: updatedAnswer };
    setAnswers(newAnswers);
    CBTStorage.saveAnswer(student.id, updatedAnswer);
    CBTStorage.saveExamProgress(student.id, {
      currentIndex,
      timeRemaining,
      lastSavedAt: nowIso,
    });

    setLastSavedTime(formatAutoSaveTime(nowIso));
    setSaveStatus('saved');
  };

  // Calculate final score
  const handleFinalSubmit = () => {
    let totalScore = 0;
    let maxPossibleScore = 0;

    for (const q of rawQuestions) {
      maxPossibleScore += q.maxScore;
      const ans = answers[q.id];
      if (ans) {
        totalScore += ans.score || 0;
      }
    }

    // Normalized to 0-100 scale
    const normalizedScore = maxPossibleScore > 0
      ? Math.round((totalScore / maxPossibleScore) * 100)
      : 0;

    CBTStorage.updateStudentStatus(student.id, 'SELESAI', {
      score: normalizedScore,
      finishedAt: new Date().toLocaleTimeString('id-ID'),
    });

    onFinishExam(normalizedScore, answers);
  };

  const handleAutoSubmit = () => {
    handleFinalSubmit();
  };

  // Stats for review
  const answeredCount = Object.values(answers).filter(
    a => a.selectedOption || (a.essayText && a.essayText.trim().length > 0)
  ).length;
  const doubtfulCount = Object.values(answers).filter(a => a.isDoubtful).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Real-time Anti-Cheat Enforcement Layer */}
      <AntiCheatSystem
        student={student}
        isActive={true}
        maxViolations={examConfig.maxViolationsAllowed}
        onViolationLimitReached={() => {
          console.warn('Violation threshold exceeded! Marking for proctor inspection.');
        }}
      />

      {/* Connectivity Alert Banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white px-4 py-2 text-xs flex items-center justify-between font-medium animate-pulse">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>Koneksi internet terputus. Ujian tetap berjalan lancar secara offline! Jawaban tersimpan di memori perangkat dan akan disinkronkan otomatis saat kembali terhubung.</span>
          </div>
          <span className="bg-amber-800 px-2 py-0.5 rounded text-[11px] font-bold">MODE OFFLINE AKTIF</span>
        </div>
      )}

      {/* Top Exam Navigation Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-sm shadow-xs">
            CBT
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">
              {examConfig.title}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {examConfig.subject} • {student.name} ({student.classRoom})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          {/* Auto-Save real-time status badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs"
            title="Auto-Save aktif: Setiap pilihan opsi atau ketikan esai langsung tersimpan ke LocalStorage perangkat"
          >
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${saveStatus === 'saving' ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${saveStatus === 'saving' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
            </span>
            <Save className={`w-3.5 h-3.5 ${saveStatus === 'saving' ? 'text-amber-600 animate-spin' : 'text-emerald-600'}`} />
            <span className="hidden md:inline font-bold">Auto-Save:</span>
            <span className="text-[11px] font-mono">
              {saveStatus === 'saving' ? (
                <span className="text-amber-700 font-sans font-bold">Menyimpan...</span>
              ) : (
                <span>{lastSavedTime}</span>
              )}
            </span>
          </div>

          {/* Real-time Offline/Online status badge */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            isOnline ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Sinkron Online' : 'Offline Sinkron'}</span>
          </div>

          {/* Countdown Timer */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold shadow-xs border ${
            timeRemaining < 300
              ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
              : 'bg-indigo-50 text-indigo-900 border-indigo-200'
          }`}>
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>{formatTimer(timeRemaining)}</span>
          </div>
        </div>
      </header>

      {/* Restored Work Notification Banner */}
      {restoredBanner && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex items-center justify-between font-medium shadow-xs">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
            <span className="flex-1">{restoredBanner}</span>
            <button
              type="button"
              onClick={() => setRestoredBanner(null)}
              className="bg-emerald-800 hover:bg-emerald-900 text-white px-2.5 py-0.5 rounded text-[11px] font-bold transition ml-2"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Question Body & Sidebar Drawer */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Active Question Workspace */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 md:p-7 flex flex-col justify-between flex-1">
            {/* Question Header & Meta */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="bg-indigo-700 text-white font-extrabold text-sm px-3 py-1 rounded-lg">
                    Soal No. {currentIndex + 1}
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                    {currentQuestion?.type === 'PG' ? 'Pilihan Ganda' : 'Esai Mandiri'}
                  </span>
                  <span className="text-xs text-slate-500 hidden md:inline">
                    Bobot: {currentQuestion?.maxScore} Poin
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">
                    Standar Kompetensi:
                  </span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium max-w-[200px] truncate" title={currentQuestion?.competencyStandard}>
                    {currentQuestion?.competencyStandard}
                  </span>
                </div>
              </div>

              {/* Question Text */}
              <div className="text-slate-800 text-base md:text-lg leading-relaxed space-y-3 font-medium">
                <p>{currentQuestion?.questionText}</p>

                {/* Optional Image */}
                {currentQuestion?.imageUrl && (
                  <div className="my-3">
                    <div className="relative inline-block border border-slate-200 rounded-xl overflow-hidden group shadow-xs">
                      <img
                        src={currentQuestion.imageUrl}
                        alt="Ilustrasi Soal"
                        className="max-h-72 w-auto object-cover rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedImageModal(currentQuestion.imageUrl || null)}
                        className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1.5 rounded-lg text-xs flex items-center gap-1 backdrop-blur-xs transition"
                      >
                        <ZoomIn className="w-3.5 h-3.5" /> Perbesar Gambar
                      </button>
                    </div>
                  </div>
                )}

                {/* Optional Mathematical Formula */}
                {currentQuestion?.mathFormula && (
                  <div className="my-2">
                    <MathRenderer formula={currentQuestion.mathFormula} />
                  </div>
                )}

                {/* Optional Arabic / Quranic verses */}
                {currentQuestion?.arabicText && (
                  <ArabicRenderer text={currentQuestion.arabicText} />
                )}
              </div>

              {/* Answer Interface */}
              <div className="mt-8 pt-5 border-t border-slate-100">
                {currentQuestion?.type === 'PG' ? (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Pilihan Jawaban (Klik salah satu):
                    </p>
                    {currentOptions.map(option => {
                      const isSelected = currentAnswer?.selectedOption === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => handleSelectOption(option.key)}
                          className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3.5 ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-600 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70'
                          }`}
                        >
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            {option.key}
                          </span>
                          <span className={`text-sm md:text-base leading-relaxed ${isSelected ? 'text-indigo-950 font-semibold' : 'text-slate-800'}`}>
                            {option.text}
                          </span>
                        </button>
                      );
                    })}

                    {/* Auto-save status feedback for PG */}
                    <div className="mt-4 flex items-center justify-between text-xs bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${currentAnswer?.selectedOption ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="font-medium text-slate-700">
                          {currentAnswer?.selectedOption
                            ? `Pilihan (${currentAnswer.selectedOption}) tersimpan otomatis ke LocalStorage`
                            : 'Pilih opsi di atas. Jawaban otomatis tersimpan ke memori perangkat tanpa harus menekan tombol simpan.'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono shrink-0">
                        <Save className="w-3.5 h-3.5 text-slate-400" />
                        <span>{currentAnswer?.updatedAt ? new Date(currentAnswer.updatedAt).toLocaleTimeString('id-ID') : 'Auto-Save Siap'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        Tuliskan Lembar Jawaban Esai Anda:
                      </label>
                      <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5" /> Koreksi Otomatis Kata Kunci Aktif
                      </span>
                    </div>

                    <textarea
                      rows={6}
                      value={currentAnswer?.essayText || ''}
                      onChange={e => handleEssayChange(e.target.value)}
                      placeholder="Ketik uraian jawaban secara lengkap, objektif, dan sistematis sesuai kompetensi teknis..."
                      className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-sm leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1 pt-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 font-medium ${
                          saveStatus === 'saving' ? 'text-amber-700 font-semibold' : 'text-emerald-700'
                        }`}>
                          <Save className="w-3.5 h-3.5" />
                          {saveStatus === 'saving' ? 'Menyimpan teks esai ke LocalStorage...' : 'Uraian esai tersimpan otomatis di LocalStorage'}
                        </span>
                        <span>•</span>
                        <span>
                          {(currentAnswer?.essayText || '').trim().split(/\s+/).filter(Boolean).length} kata ({(currentAnswer?.essayText || '').length} karakter)
                        </span>
                      </div>
                      {currentAnswer?.matchedKeywords && currentAnswer.matchedKeywords.length > 0 && (
                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ {currentAnswer.matchedKeywords.length} Kata Kunci Terdeteksi
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions: Previous, Doubtful Flag, Next */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" /> Soal Sebelumnya
              </button>

              <button
                type="button"
                onClick={toggleDoubtful}
                className={`px-4 py-2.5 rounded-xl font-semibold text-xs inline-flex items-center gap-2 border transition ${
                  currentAnswer?.isDoubtful
                    ? 'bg-amber-500 border-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                {currentAnswer?.isDoubtful ? 'Tandai Selesai (Batal Ragu-ragu)' : 'Ragu-ragu'}
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs transition"
                >
                  Soal Berikutnya <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowConfirmFinish(true)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-xs transition"
                >
                  <CheckCircle2 className="w-4 h-4" /> Selesaikan Ujian
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Navigation Grid Drawer */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3 pb-2 border-b border-slate-100 flex items-center justify-between">
              <span>Nomor Soal</span>
              <span className="text-xs font-normal text-slate-500">
                {answeredCount} / {questions.length} Dijawab
              </span>
            </h3>

            {/* Grid of question buttons */}
            <div className="grid grid-cols-4 gap-2.5 max-h-80 overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const ans = answers[q.id];
                const hasAnswered = !!(ans?.selectedOption || (ans?.essayText && ans.essayText.trim().length > 0));
                const isDoubtful = !!ans?.isDoubtful;
                const isCurrent = currentIndex === idx;

                let btnBg = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
                if (isDoubtful) {
                  btnBg = 'bg-amber-400 text-amber-950 border-amber-500 font-bold';
                } else if (hasAnswered) {
                  btnBg = 'bg-emerald-500 text-white border-emerald-600 font-bold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-11 rounded-xl text-xs flex flex-col items-center justify-center border transition relative ${btnBg} ${
                      isCurrent ? 'ring-2 ring-indigo-600 ring-offset-2' : ''
                    }`}
                  >
                    <span>{idx + 1}</span>
                    {ans?.selectedOption && (
                      <span className="text-[10px] font-mono leading-none opacity-90">
                        {ans.selectedOption}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-emerald-500 shrink-0"></div>
                <span className="text-slate-600">Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-amber-400 shrink-0"></div>
                <span className="text-slate-600">Ragu-ragu ({doubtfulCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-slate-200 shrink-0"></div>
                <span className="text-slate-600">Belum Dijawab ({unansweredCount})</span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmFinish(true)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" /> Konfirmasi Akhir Ujian
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal to Finish Exam */}
      {showConfirmFinish && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-indigo-700 mb-3">
              <div className="p-2.5 bg-indigo-50 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                Konfirmasi Penyelesaian Ujian
              </h3>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Apakah Anda yakin ingin mengakhiri ujian ini? Nilai akhir akan dihitung secara otomatis dan hasil analisis kemampuan Anda akan langsung diterbitkan.
            </p>

            <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-700 mb-4 border border-slate-200">
              <div className="flex justify-between">
                <span>Total Soal:</span>
                <span className="font-bold">{questions.length} Butir</span>
              </div>
              <div className="flex justify-between">
                <span>Sudah Dijawab:</span>
                <span className="font-bold text-emerald-600">{answeredCount} Butir</span>
              </div>
              <div className="flex justify-between">
                <span>Ragu-ragu:</span>
                <span className="font-bold text-amber-600">{doubtfulCount} Butir</span>
              </div>
              <div className="flex justify-between">
                <span>Belum Dijawab:</span>
                <span className={`font-bold ${unansweredCount > 0 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {unansweredCount} Butir
                </span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>Masih ada {unansweredCount} soal belum terisi!</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmFinish(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
              >
                Kembali Periksa
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmFinish(false);
                  handleFinalSubmit();
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              >
                Ya, Selesaikan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImageModal(null)}
        >
          <div className="max-w-3xl w-full bg-white rounded-2xl p-2 overflow-hidden shadow-2xl">
            <img
              src={selectedImageModal}
              alt="Preview Besar"
              className="w-full max-h-[80vh] object-contain rounded-xl"
            />
            <p className="text-center text-xs text-slate-500 py-2">
              Klik di mana saja untuk menutup tampilan
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
