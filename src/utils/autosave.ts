import type { StudentAnswer } from '../types/cbt.ts';

export const AUTOSAVE_STORAGE_KEYS = {
  ANSWERS: 'cbt_smk_answers',
  ACTIVE_SESSION: 'cbt_smk_active_session',
  EXAM_PROGRESS: 'cbt_smk_exam_progress',
};

export interface ExamProgress {
  studentId: string;
  currentIndex: number;
  timeRemaining: number;
  lastSavedAt: string;
}

export interface ActiveSession {
  studentId: string;
  step: 'LOGIN' | 'EXAM' | 'RESULT';
}

/**
 * Persists a student answer immediately into storage.
 * Works with any Storage implementation (window.localStorage or mock storage in tests).
 */
export function persistAnswerToLocalStorage(
  studentId: string,
  answer: StudentAnswer,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): Record<string, StudentAnswer> {
  if (!studentId || !storage || typeof storage.getItem !== 'function') {
    return {};
  }

  const key = `${AUTOSAVE_STORAGE_KEYS.ANSWERS}_${studentId}`;
  let currentAnswers: Record<string, StudentAnswer> = {};

  try {
    const raw = storage.getItem(key);
    if (raw) {
      currentAnswers = JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading existing answers from storage:', err);
    currentAnswers = {};
  }

  const updatedAnswer: StudentAnswer = {
    ...answer,
    updatedAt: answer.updatedAt || new Date().toISOString(),
  };

  currentAnswers[answer.questionId] = updatedAnswer;

  try {
    storage.setItem(key, JSON.stringify(currentAnswers));
  } catch (err) {
    console.error('Error writing answer to storage:', err);
  }

  return currentAnswers;
}

/**
 * Retrieves all stored answers for a student from LocalStorage.
 */
export function restoreAnswersFromLocalStorage(
  studentId: string,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): Record<string, StudentAnswer> {
  if (!studentId || !storage || typeof storage.getItem !== 'function') {
    return {};
  }

  const key = `${AUTOSAVE_STORAGE_KEYS.ANSWERS}_${studentId}`;
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error parsing answers from storage:', err);
    return {};
  }
}

/**
 * Saves current student exam navigation and timer progress.
 */
export function persistExamProgress(
  studentId: string,
  progress: Partial<ExamProgress>,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): ExamProgress {
  if (!studentId || !storage || typeof storage.getItem !== 'function') {
    return {
      studentId,
      currentIndex: progress.currentIndex ?? 0,
      timeRemaining: progress.timeRemaining ?? 0,
      lastSavedAt: new Date().toISOString(),
    };
  }

  const key = `${AUTOSAVE_STORAGE_KEYS.EXAM_PROGRESS}_${studentId}`;
  let current: ExamProgress = {
    studentId,
    currentIndex: 0,
    timeRemaining: 0,
    lastSavedAt: new Date().toISOString(),
  };

  try {
    const raw = storage.getItem(key);
    if (raw) {
      current = { ...current, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }

  const updated: ExamProgress = {
    ...current,
    ...progress,
    studentId,
    lastSavedAt: new Date().toISOString(),
  };

  try {
    storage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving exam progress:', err);
  }

  return updated;
}

/**
 * Retrieves stored exam navigation and timer progress.
 */
export function restoreExamProgress(
  studentId: string,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): ExamProgress | null {
  if (!studentId || !storage || typeof storage.getItem !== 'function') {
    return null;
  }

  const key = `${AUTOSAVE_STORAGE_KEYS.EXAM_PROGRESS}_${studentId}`;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Saves active session to prevent losing exam state on page reload.
 */
export function persistActiveSession(
  session: ActiveSession,
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): void {
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(AUTOSAVE_STORAGE_KEYS.ACTIVE_SESSION, JSON.stringify(session));
  } catch (err) {
    console.error('Error persisting active session:', err);
  }
}

/**
 * Restores active session on page reload.
 */
export function restoreActiveSession(
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): ActiveSession | null {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEYS.ACTIVE_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clears active session upon exam submission or logout.
 */
export function clearActiveSession(
  storage: Storage = typeof window !== 'undefined' ? window.localStorage : ({} as Storage)
): void {
  if (!storage || typeof storage.removeItem !== 'function') return;
  try {
    storage.removeItem(AUTOSAVE_STORAGE_KEYS.ACTIVE_SESSION);
  } catch {
    // ignore
  }
}

/**
 * Formats timestamp for display in the auto-save UI badge.
 */
export function formatAutoSaveTime(isoStringOrDate?: string | Date): string {
  if (!isoStringOrDate) return 'Baru saja';
  try {
    const date = typeof isoStringOrDate === 'string' ? new Date(isoStringOrDate) : isoStringOrDate;
    if (isNaN(date.getTime())) return 'Baru saja';
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return 'Baru saja';
  }
}
