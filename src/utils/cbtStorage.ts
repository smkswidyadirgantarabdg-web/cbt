import { doc, setDoc, getDocs, collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Siswa, Question, ExamConfig, StudentAnswer, ExamIncident, BeritaAcaraData } from '../types/cbt';
import { INITIAL_STUDENTS, INITIAL_QUESTIONS, INITIAL_EXAM_CONFIG, INITIAL_BERITA_ACARA } from '../data/mockData';

import {
  persistAnswerToLocalStorage,
  restoreAnswersFromLocalStorage,
  persistExamProgress,
  restoreExamProgress,
  persistActiveSession,
  restoreActiveSession,
  clearActiveSession,
  ExamProgress,
  ActiveSession,
} from './autosave';

const STORAGE_KEYS = {
  STUDENTS: 'cbt_smk_students',
  QUESTIONS: 'cbt_smk_questions',
  CONFIG: 'cbt_smk_config',
  ANSWERS: 'cbt_smk_answers',
  INCIDENTS: 'cbt_smk_incidents',
  BERITA_ACARA: 'cbt_smk_berita_acara',
  OFFLINE_QUEUE: 'cbt_smk_offline_queue',
  ACTIVE_SESSION: 'cbt_smk_active_session',
  EXAM_PROGRESS: 'cbt_smk_exam_progress',
};

// Cross-tab broadcast channel for real-time local messaging
export const cbtChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('cbt_smk_realtime_channel')
  : null;

export class CBTStorage {
  static getStudents(): Siswa[] {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
      return INITIAL_STUDENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_STUDENTS;
    }
  }

  static saveStudents(students: Siswa[]): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
    cbtChannel?.postMessage({ type: 'STUDENTS_UPDATED', payload: students });

    // Sync to Firestore if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      students.forEach(s => {
        setDoc(doc(db, 'students', s.id), s, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.WRITE, `students/${s.id}`);
        });
      });
    }
  }

  static updateStudentStatus(studentId: string, status: Siswa['status'], updates?: Partial<Siswa>): void {
    const students = this.getStudents();
    const updated = students.map(s => {
      if (s.id === studentId) {
        return {
          ...s,
          status,
          ...updates,
          lastActive: new Date().toLocaleTimeString('id-ID'),
        };
      }
      return s;
    });
    this.saveStudents(updated);
  }

  static getQuestions(): Question[] {
    const raw = localStorage.getItem(STORAGE_KEYS.QUESTIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
      return INITIAL_QUESTIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_QUESTIONS;
    }
  }

  static saveQuestions(questions: Question[]): void {
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(questions));
    cbtChannel?.postMessage({ type: 'QUESTIONS_UPDATED', payload: questions });

    // Sync to Firestore if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      questions.forEach(q => {
        setDoc(doc(db, 'questions', q.id), q, { merge: true }).catch(err => {
          handleFirestoreError(err, OperationType.WRITE, `questions/${q.id}`);
        });
      });
    }
  }

  static getExamConfig(): ExamConfig {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(INITIAL_EXAM_CONFIG));
      return INITIAL_EXAM_CONFIG;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_EXAM_CONFIG;
    }
  }

  static saveExamConfig(config: ExamConfig): void {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    cbtChannel?.postMessage({ type: 'CONFIG_UPDATED', payload: config });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setDoc(doc(db, 'config', config.id), config, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `config/${config.id}`);
      });
    }
  }

  static getAnswers(studentId: string): Record<string, StudentAnswer> {
    return restoreAnswersFromLocalStorage(studentId);
  }

  static saveAnswer(studentId: string, answer: StudentAnswer): Record<string, StudentAnswer> {
    // 1. Immediately persist to LocalStorage so no keystroke or selection is lost on reload
    const currentAnswers = persistAnswerToLocalStorage(studentId, answer);

    // 2. Queue for offline sync or async save to Firestore without blocking the UI
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.addToOfflineQueue({ studentId, answer, timestamp: new Date().toISOString() });
    } else {
      setDoc(doc(db, 'answers', `${studentId}_${answer.questionId}`), { studentId, ...answer }, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `answers/${studentId}_${answer.questionId}`);
      });
    }

    // 3. Notify real-time proctor dashboard and active tabs
    cbtChannel?.postMessage({
      type: 'ANSWER_UPDATED',
      payload: { studentId, questionId: answer.questionId, answer },
    });

    return currentAnswers;
  }

  static getActiveSession(): ActiveSession | null {
    return restoreActiveSession();
  }

  static saveActiveSession(session: ActiveSession): void {
    persistActiveSession(session);
  }

  static clearActiveSession(): void {
    clearActiveSession();
  }

  static getExamProgress(studentId: string): ExamProgress | null {
    return restoreExamProgress(studentId);
  }

  static saveExamProgress(studentId: string, progress: Partial<ExamProgress>): ExamProgress {
    return persistExamProgress(studentId, progress);
  }

  static addToOfflineQueue(item: any): void {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(item);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  }

  static flushOfflineQueue(): number {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    if (!raw) return 0;
    try {
      const queue = JSON.parse(raw);
      const count = queue.length;
      localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return count;
    } catch {
      return 0;
    }
  }

  static getIncidents(): ExamIncident[] {
    const raw = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static recordIncident(incident: Omit<ExamIncident, 'id' | 'timestamp'>): ExamIncident {
    const current = this.getIncidents();
    const newIncident: ExamIncident = {
      ...incident,
      id: `inc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleTimeString('id-ID'),
    };
    const updated = [newIncident, ...current];
    localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(updated));

    // Increment violation on student record
    const students = this.getStudents();
    const student = students.find(s => s.id === incident.studentId);
    if (student) {
      const violationCount = (student.violationCount || 0) + 1;
      const status: Siswa['status'] = violationCount >= 3 ? 'TERINDIKASI_CURANG' : student.status;
      this.updateStudentStatus(incident.studentId, status, { violationCount });
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setDoc(doc(db, 'incidents', newIncident.id), newIncident).catch(err => {
        handleFirestoreError(err, OperationType.CREATE, `incidents/${newIncident.id}`);
      });
    }

    cbtChannel?.postMessage({
      type: 'INCIDENT_RECORDED',
      payload: newIncident,
    });

    return newIncident;
  }

  static getBeritaAcara(): BeritaAcaraData {
    const raw = localStorage.getItem(STORAGE_KEYS.BERITA_ACARA);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.BERITA_ACARA, JSON.stringify(INITIAL_BERITA_ACARA));
      return INITIAL_BERITA_ACARA;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_BERITA_ACARA;
    }
  }

  static saveBeritaAcara(data: BeritaAcaraData): void {
    localStorage.setItem(STORAGE_KEYS.BERITA_ACARA, JSON.stringify(data));
    cbtChannel?.postMessage({ type: 'BERITA_ACARA_UPDATED', payload: data });

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      setDoc(doc(db, 'beritaAcara', data.id), data, { merge: true }).catch(err => {
        handleFirestoreError(err, OperationType.WRITE, `beritaAcara/${data.id}`);
      });
    }
  }

  static resetToDefaults(): void {
    localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(INITIAL_STUDENTS));
    localStorage.setItem(STORAGE_KEYS.QUESTIONS, JSON.stringify(INITIAL_QUESTIONS));
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(INITIAL_EXAM_CONFIG));
    localStorage.setItem(STORAGE_KEYS.BERITA_ACARA, JSON.stringify(INITIAL_BERITA_ACARA));
    localStorage.removeItem(STORAGE_KEYS.INCIDENTS);
    localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    clearActiveSession();

    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('cbt_smk_answers_') || k.startsWith('cbt_smk_exam_progress_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }

    cbtChannel?.postMessage({ type: 'RESET_DONE' });
  }
}
