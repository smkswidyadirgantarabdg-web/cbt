import React, { useState, useEffect } from 'react';
import { Siswa, Question, ExamConfig, StudentAnswer } from './types/cbt';
import { CBTStorage, cbtChannel } from './utils/cbtStorage';
import { Navbar, ActiveTab } from './components/Navbar';
import { StudentLoginScreen } from './components/StudentLoginScreen';
import { StudentExamRoom } from './components/StudentExamRoom';
import { StudentResultView } from './components/StudentResultView';
import { QuestionBankManager } from './components/QuestionBankManager';
import { ProctorDashboard } from './components/ProctorDashboard';
import { StudentCardsManager } from './components/StudentCardsManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { ConcurrencySimulator } from './components/ConcurrencySimulator';

export default function App() {
  const [students, setStudents] = useState<Siswa[]>(() => CBTStorage.getStudents());
  const [questions, setQuestions] = useState<Question[]>(() => CBTStorage.getQuestions());
  const [examConfig, setExamConfig] = useState<ExamConfig>(() => CBTStorage.getExamConfig());

  // Check saved session on reload
  const savedSession = CBTStorage.getActiveSession();
  const initialStudent = savedSession
    ? students.find(s => s.id === savedSession.studentId) || students[0]
    : students[0];

  const initialStep: 'LOGIN' | 'EXAM' | 'RESULT' = (savedSession && savedSession.step === 'EXAM' && initialStudent.status !== 'SELESAI')
    ? 'EXAM'
    : (savedSession && savedSession.step === 'RESULT')
    ? 'RESULT'
    : 'LOGIN';

  const [activeTab, setActiveTab] = useState<ActiveTab>('SISWA');
  const [examStep, setExamStep] = useState<'LOGIN' | 'EXAM' | 'RESULT'>(initialStep);
  const [currentStudent, setCurrentStudent] = useState<Siswa>(initialStudent);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, StudentAnswer>>(() => {
    return CBTStorage.getAnswers(initialStudent.id);
  });

  // Auto-start query param check
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('autostart') === '1') {
      const eligibleStudent = students.find(s => s.financialStatus === 'LUNAS') || students[0];
      if (eligibleStudent) {
        setCurrentStudent(eligibleStudent);
        CBTStorage.saveActiveSession({ studentId: eligibleStudent.id, step: 'EXAM' });
        setExamStep('EXAM');
      }
    }
  }, []);

  // Real-time synchronization listener across tabs
  useEffect(() => {
    if (!cbtChannel) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'STUDENTS_UPDATED') {
        setStudents(e.data.payload);
      } else if (e.data?.type === 'QUESTIONS_UPDATED') {
        setQuestions(e.data.payload);
      } else if (e.data?.type === 'CONFIG_UPDATED') {
        setExamConfig(e.data.payload);
      } else if (e.data?.type === 'RESET_DONE') {
        setStudents(CBTStorage.getStudents());
        setQuestions(CBTStorage.getQuestions());
        setExamConfig(CBTStorage.getExamConfig());
      }
    };

    cbtChannel.addEventListener('message', handleMessage);
    return () => {
      cbtChannel?.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleResetData = () => {
    if (confirm('Kembalikan semua data ujian, butir soal, dan nilai ke data awal simulasi?')) {
      CBTStorage.resetToDefaults();
      setStudents(CBTStorage.getStudents());
      setQuestions(CBTStorage.getQuestions());
      setExamConfig(CBTStorage.getExamConfig());
      setExamStep('LOGIN');
      setCurrentStudent(CBTStorage.getStudents()[0]);
      setCurrentAnswers({});
    }
  };

  const handleLoginSuccess = (student: Siswa) => {
    setCurrentStudent(student);
    // If student already finished, go to result directly
    if (student.status === 'SELESAI') {
      const savedAnswers = CBTStorage.getAnswers(student.id);
      setCurrentAnswers(savedAnswers);
      CBTStorage.saveActiveSession({ studentId: student.id, step: 'RESULT' });
      setExamStep('RESULT');
    } else {
      CBTStorage.saveActiveSession({ studentId: student.id, step: 'EXAM' });
      const currentSavedAnswers = CBTStorage.getAnswers(student.id);
      setCurrentAnswers(currentSavedAnswers);
      setExamStep('EXAM');
    }
  };

  const handleFinishExam = (finalScore: number, answers: Record<string, StudentAnswer>) => {
    setCurrentAnswers(answers);
    CBTStorage.saveActiveSession({ studentId: currentStudent.id, step: 'RESULT' });
    setExamStep('RESULT');
    // Refresh student list with new score
    setStudents(CBTStorage.getStudents());
  };

  const handleSaveQuestions = (updated: Question[]) => {
    CBTStorage.saveQuestions(updated);
    setQuestions(updated);
  };

  const handleUpdateStudents = (updated: Siswa[]) => {
    CBTStorage.saveStudents(updated);
    setStudents(updated);
  };

  // Total violations for navbar badge
  const totalViolations = students.reduce((acc, s) => acc + (s.violationCount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onChangeTab={tab => setActiveTab(tab)}
        onResetData={handleResetData}
        violationCount={totalViolations}
      />

      {/* Main Tab Content */}
      <main className="flex-1">
        {activeTab === 'SISWA' && (
          <div>
            {examStep === 'LOGIN' && (
              <StudentLoginScreen
                students={students}
                examConfig={examConfig}
                onLoginSuccess={handleLoginSuccess}
              />
            )}

            {examStep === 'EXAM' && currentStudent && (
              <StudentExamRoom
                student={currentStudent}
                rawQuestions={questions}
                examConfig={examConfig}
                onFinishExam={handleFinishExam}
              />
            )}

            {examStep === 'RESULT' && currentStudent && (
              <StudentResultView
                student={currentStudent}
                questions={questions}
                examConfig={examConfig}
                answers={currentAnswers}
                onResetExam={() => {
                  CBTStorage.clearActiveSession();
                  CBTStorage.updateStudentStatus(currentStudent.id, 'BELUM_MULAI', {
                    score: undefined,
                    violationCount: 0,
                  });
                  setStudents(CBTStorage.getStudents());
                  setExamStep('LOGIN');
                }}
              />
            )}
          </div>
        )}

        {activeTab === 'BANK_SOAL' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <QuestionBankManager
              questions={questions}
              onSaveQuestions={handleSaveQuestions}
            />
          </div>
        )}

        {activeTab === 'PENGAWAS' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <ProctorDashboard
              students={students}
              examConfig={examConfig}
              onUpdateStudents={handleUpdateStudents}
            />
          </div>
        )}

        {activeTab === 'KARTU_UJIAN' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <StudentCardsManager
              students={students}
              examConfig={examConfig}
              onUpdateStudents={handleUpdateStudents}
            />
          </div>
        )}

        {activeTab === 'ANALITIK' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <AnalyticsDashboard
              students={students}
              questions={questions}
              examConfig={examConfig}
            />
          </div>
        )}

        {activeTab === 'CONCURRENCY' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-6">
            <ConcurrencySimulator />
          </div>
        )}
      </main>
    </div>
  );
}
