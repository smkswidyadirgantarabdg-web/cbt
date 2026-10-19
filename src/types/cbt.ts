/**
 * Type definitions for SMK CBT Application
 */

export type JurusanSMK = 'TKJ' | 'RPL' | 'DKV' | 'AKL' | 'TBSM' | 'OTKP';

export type FinancialStatus = 'LUNAS' | 'DISPENSASI' | 'BELUM_LUNAS';

export type ExamStatus = 'BELUM_MULAI' | 'SEDANG_MENGERJAKAN' | 'SELESAI' | 'TERINDIKASI_CURANG' | 'DIBLOKIR';

export interface Siswa {
  id: string;
  nisn: string;
  name: string;
  classRoom: string;
  major: JurusanSMK;
  financialStatus: FinancialStatus;
  password: string;
  photoUrl?: string;
  status: ExamStatus;
  startedAt?: string;
  finishedAt?: string;
  score?: number;
  violationCount: number;
  deviceInfo?: string;
  lastActive?: string;
}

export type QuestionType = 'PG' | 'ESSAI';
export type DifficultyLevel = 'MUDAH' | 'SEDANG' | 'SUKAR';

export interface EssayKeyword {
  keyword: string;
  weight: number; // e.g. 10 to 100
  synonymList?: string[];
}

export interface QuestionOption {
  key: 'A' | 'B' | 'C' | 'D' | 'E';
  text: string;
}

export interface Question {
  id: string;
  code: string;
  subject: string;
  major?: JurusanSMK | 'SEMUA';
  competencyStandard: string; // Standar Kompetensi / Capaian Pembelajaran
  indicator: string; // Indikator Soal
  type: QuestionType;
  difficulty: DifficultyLevel;
  questionText: string;
  imageUrl?: string;
  mathFormula?: string;
  arabicText?: string;
  options?: QuestionOption[];
  correctAnswer?: 'A' | 'B' | 'C' | 'D' | 'E';
  essayKeywords?: EssayKeyword[];
  maxScore: number;
  explanation?: string;
}

export interface StudentAnswer {
  questionId: string;
  selectedOption?: 'A' | 'B' | 'C' | 'D' | 'E';
  essayText?: string;
  isDoubtful: boolean;
  score: number;
  matchedKeywords?: string[];
  feedback?: string;
  updatedAt: string;
}

export interface ExamIncident {
  id: string;
  studentId: string;
  studentName: string;
  timestamp: string;
  type: 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'APP_BLUR' | 'KEY_RESTRICTED' | 'SUSPICIOUS_WINDOW';
  description: string;
  severity: 'WARNING' | 'CRITICAL';
}

export interface ExamConfig {
  id: string;
  title: string;
  subject: string;
  major: JurusanSMK | 'SEMUA';
  durationMinutes: number;
  passingGrade: number; // KKM (e.g. 75)
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReview: boolean;
  maxViolationsAllowed: number;
  examDate: string;
  roomName: string;
}

export interface BeritaAcaraAttendance {
  studentId: string;
  nisn: string;
  name: string;
  classRoom: string;
  attendance: 'HADIR' | 'TIDAK_HADIR' | 'DISPENSASI';
  signed: boolean;
  signedAt?: string;
}

export interface BeritaAcaraData {
  id: string;
  examId: string;
  examTitle: string;
  schoolName: string;
  date: string;
  startTime: string;
  endTime: string;
  room: string;
  proctorName: string;
  proctorNip: string;
  supervisorName: string;
  totalRegistered: number;
  totalPresent: number;
  totalAbsent: number;
  notes: string;
  proctorSignatureUrl?: string;
  attendanceList: BeritaAcaraAttendance[];
}

export interface CompetencyAnalytics {
  competency: string;
  totalQuestions: number;
  achievedScore: number;
  maxScore: number;
  percentage: number;
  masteryStatus: 'KOMPETEN' | 'CUKUP' | 'PERLU_BIMBINGAN';
}
