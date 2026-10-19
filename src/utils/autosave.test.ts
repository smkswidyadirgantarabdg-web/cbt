import test from 'node:test';
import assert from 'node:assert/strict';
import {
  persistAnswerToLocalStorage,
  restoreAnswersFromLocalStorage,
  persistExamProgress,
  restoreExamProgress,
  persistActiveSession,
  restoreActiveSession,
  clearActiveSession,
  formatAutoSaveTime,
} from './autosave.ts';
import type { StudentAnswer } from '../types/cbt.ts';

// In-memory Storage mock for deterministic testing in Node.js
class MockStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

test('persistAnswerToLocalStorage saves multiple-choice answer and restores intact', () => {
  const mockStorage = new MockStorage();
  const studentId = 'siswa-001';

  const answer1: StudentAnswer = {
    questionId: 'q-1',
    selectedOption: 'B',
    score: 10,
    isDoubtful: false,
    updatedAt: new Date().toISOString(),
  };

  persistAnswerToLocalStorage(studentId, answer1, mockStorage);

  const restored = restoreAnswersFromLocalStorage(studentId, mockStorage);
  assert.ok(restored['q-1']);
  assert.equal(restored['q-1'].selectedOption, 'B');
  assert.equal(restored['q-1'].score, 10);
});

test('persistAnswerToLocalStorage saves essay text input and persists across simulated reload', () => {
  const mockStorage = new MockStorage();
  const studentId = 'siswa-002';

  // Simulating typing essay text
  const answerEssay: StudentAnswer = {
    questionId: 'q-essay-1',
    essayText: 'VLAN membagi broadcast domain switch secara logis.',
    score: 15,
    matchedKeywords: ['vlan', 'switch'],
    feedback: '2 dari 3 kata kunci terdeteksi',
    isDoubtful: false,
    updatedAt: new Date().toISOString(),
  };

  persistAnswerToLocalStorage(studentId, answerEssay, mockStorage);

  // Simulated browser reload: create fresh reader accessing same storage
  const restored = restoreAnswersFromLocalStorage(studentId, mockStorage);
  assert.ok(restored['q-essay-1']);
  assert.equal(restored['q-essay-1'].essayText, 'VLAN membagi broadcast domain switch secara logis.');
  assert.equal(restored['q-essay-1'].score, 15);
  assert.deepEqual(restored['q-essay-1'].matchedKeywords, ['vlan', 'switch']);
});

test('subsequent updates to answer overwrite previous value without losing other answers', () => {
  const mockStorage = new MockStorage();
  const studentId = 'siswa-003';

  // Answer 1
  persistAnswerToLocalStorage(studentId, {
    questionId: 'q-1',
    selectedOption: 'A',
    score: 0,
    isDoubtful: false,
    updatedAt: new Date().toISOString(),
  }, mockStorage);

  // Answer 2
  persistAnswerToLocalStorage(studentId, {
    questionId: 'q-2',
    selectedOption: 'C',
    score: 10,
    isDoubtful: true,
    updatedAt: new Date().toISOString(),
  }, mockStorage);

  // Student changes mind on question 1 to 'B'
  persistAnswerToLocalStorage(studentId, {
    questionId: 'q-1',
    selectedOption: 'B',
    score: 10,
    isDoubtful: false,
    updatedAt: new Date().toISOString(),
  }, mockStorage);

  const finalAnswers = restoreAnswersFromLocalStorage(studentId, mockStorage);
  assert.equal(Object.keys(finalAnswers).length, 2);
  assert.equal(finalAnswers['q-1'].selectedOption, 'B');
  assert.equal(finalAnswers['q-2'].selectedOption, 'C');
  assert.equal(finalAnswers['q-2'].isDoubtful, true);
});

test('persistExamProgress and restoreExamProgress maintain question index and timer countdown', () => {
  const mockStorage = new MockStorage();
  const studentId = 'siswa-004';

  persistExamProgress(studentId, {
    currentIndex: 8,
    timeRemaining: 2450,
  }, mockStorage);

  const restored = restoreExamProgress(studentId, mockStorage);
  assert.ok(restored);
  assert.equal(restored?.currentIndex, 8);
  assert.equal(restored?.timeRemaining, 2450);
  assert.ok(restored?.lastSavedAt);
});

test('active session persistence prevents losing exam room state on refresh', () => {
  const mockStorage = new MockStorage();

  persistActiveSession({
    studentId: 'siswa-001',
    step: 'EXAM',
  }, mockStorage);

  const active = restoreActiveSession(mockStorage);
  assert.ok(active);
  assert.equal(active?.studentId, 'siswa-001');
  assert.equal(active?.step, 'EXAM');

  clearActiveSession(mockStorage);
  assert.equal(restoreActiveSession(mockStorage), null);
});

test('formatAutoSaveTime safely formats timestamp', () => {
  const dateStr = '2026-10-18T10:30:45.000Z';
  const formatted = formatAutoSaveTime(dateStr);
  assert.ok(typeof formatted === 'string' && formatted.length > 0);
  assert.equal(formatAutoSaveTime(undefined), 'Baru saja');
  assert.equal(formatAutoSaveTime('invalid-date'), 'Baru saja');
});
