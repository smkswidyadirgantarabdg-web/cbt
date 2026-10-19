import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeMultipleChoice,
  gradeEssayByKeywords,
  shuffleArrayWithSeed,
  checkFinancialEligibility,
  generateDynamicKisiKisi,
  calculateCompetencyAnalytics
} from './scoring.ts';
import type { Question, Siswa } from '../types/cbt.ts';

test('gradeMultipleChoice correctly evaluates correct and incorrect options', () => {
  assert.equal(gradeMultipleChoice('A', 'A', 10), 10);
  assert.equal(gradeMultipleChoice('b', 'B', 15), 15);
  assert.equal(gradeMultipleChoice('C', 'D', 10), 0);
  assert.equal(gradeMultipleChoice(undefined, 'A', 10), 0);
});

test('gradeEssayByKeywords computes score objectively based on keywords and synonyms', () => {
  const keywords = [
    { keyword: 'vlan', weight: 40, synonymList: ['virtual lan', 'virtual local area network'] },
    { keyword: 'switch', weight: 30, synonymList: ['saklar jaringan', 'managed switch'] },
    { keyword: 'isolasi', weight: 30, synonymList: ['memisahkan', 'segmentasi'] },
  ];

  const fullAnswer = 'VLAN adalah teknologi pada switch untuk melakukan isolasi dan segmentasi lalu lintas jaringan lokal.';
  const fullResult = gradeEssayByKeywords(fullAnswer, keywords, 20);
  assert.equal(fullResult.score, 20);
  assert.equal(fullResult.matchedKeywords.length, 3);

  const partialAnswer = 'Untuk segmentasi kita menggunakan switch jaringan.';
  const partialResult = gradeEssayByKeywords(partialAnswer, keywords, 20);
  assert.ok(partialResult.score > 0 && partialResult.score < 20);
  assert.ok(partialResult.matchedKeywords.includes('switch'));
  assert.ok(partialResult.matchedKeywords.includes('isolasi'));

  const emptyResult = gradeEssayByKeywords('', keywords, 20);
  assert.equal(emptyResult.score, 0);
});

test('shuffleArrayWithSeed produces deterministic shuffle per student seed', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const seedA = '20240101';
  const seedB = '20240102';

  const shuffledA1 = shuffleArrayWithSeed(items, seedA);
  const shuffledA2 = shuffleArrayWithSeed(items, seedA);
  const shuffledB = shuffleArrayWithSeed(items, seedB);

  // Consistency for same seed
  assert.deepEqual(shuffledA1, shuffledA2);
  // Content preservation
  assert.equal(shuffledA1.length, items.length);
  assert.deepEqual([...shuffledA1].sort((a, b) => a - b), items);
  // Different seeds differ
  assert.notDeepEqual(shuffledA1, shuffledB);
});

test('checkFinancialEligibility enforces SMK financial policy', () => {
  const studentLunas: Siswa = {
    id: 's1',
    nisn: '0012345',
    name: 'Ahmad Fauzi',
    classRoom: 'XII TKJ 1',
    major: 'TKJ',
    financialStatus: 'LUNAS',
    password: 'PASS1',
    status: 'BELUM_MULAI',
    violationCount: 0,
  };

  const studentDispensasi: Siswa = {
    ...studentLunas,
    id: 's2',
    financialStatus: 'DISPENSASI',
  };

  const studentBelum: Siswa = {
    ...studentLunas,
    id: 's3',
    financialStatus: 'BELUM_LUNAS',
  };

  assert.equal(checkFinancialEligibility(studentLunas).allowed, true);
  assert.equal(checkFinancialEligibility(studentDispensasi).allowed, true);
  assert.equal(checkFinancialEligibility(studentBelum).allowed, false);
});

test('generateDynamicKisiKisi groups questions by competency standard and indicator', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      code: 'TKJ-01',
      subject: 'Administrasi Infrastruktur Jaringan',
      competencyStandard: 'Mengevaluasi VLAN pada Jaringan Komputer',
      indicator: 'Menjelaskan konsep konfigurasi VLAN ID',
      type: 'PG',
      difficulty: 'MUDAH',
      questionText: 'Apa fungsi VLAN ID?',
      maxScore: 10,
    },
    {
      id: 'q2',
      code: 'TKJ-02',
      subject: 'Administrasi Infrastruktur Jaringan',
      competencyStandard: 'Mengevaluasi VLAN pada Jaringan Komputer',
      indicator: 'Menjelaskan konsep konfigurasi VLAN ID',
      type: 'ESSAI',
      difficulty: 'SEDANG',
      questionText: 'Jelaskan perbedaan Access port dan Trunk port!',
      maxScore: 20,
    },
    {
      id: 'q3',
      code: 'TKJ-03',
      subject: 'Administrasi Infrastruktur Jaringan',
      competencyStandard: 'Routing Statis',
      indicator: 'Mengkonfigurasi tabel routing statis',
      type: 'PG',
      difficulty: 'SUKAR',
      questionText: 'Tentukan next-hop ip address...',
      maxScore: 10,
    },
  ];

  const kisiKisi = generateDynamicKisiKisi(questions);
  assert.equal(kisiKisi.length, 2);

  const vlanKisi = kisiKisi.find(k => k.competencyStandard.includes('VLAN'));
  assert.ok(vlanKisi);
  assert.equal(vlanKisi.totalQuestions, 2);
  assert.equal(vlanKisi.totalPG, 1);
  assert.equal(vlanKisi.totalEssai, 1);
  assert.equal(vlanKisi.totalWeight, 30);
});

test('calculateCompetencyAnalytics calculates mastery status and percentages', () => {
  const questions: Question[] = [
    {
      id: 'q1',
      code: 'M-1',
      subject: 'Matematika Terapan',
      competencyStandard: 'Matriks & Transformasi',
      indicator: 'Determinan 2x2',
      type: 'PG',
      difficulty: 'SEDANG',
      questionText: 'Determinan matriks...',
      maxScore: 50,
    },
    {
      id: 'q2',
      code: 'M-2',
      subject: 'Matematika Terapan',
      competencyStandard: 'Statistika',
      indicator: 'Mean & Modus',
      type: 'PG',
      difficulty: 'MUDAH',
      questionText: 'Mean data...',
      maxScore: 50,
    },
  ];

  const scores = { q1: 45, q2: 20 };
  const analytics = calculateCompetencyAnalytics(questions, scores);

  assert.equal(analytics.length, 2);
  const matriks = analytics.find(a => a.competency.includes('Matriks'));
  assert.ok(matriks);
  assert.equal(matriks.percentage, 90);
  assert.equal(matriks.masteryStatus, 'KOMPETEN');

  const statistika = analytics.find(a => a.competency.includes('Statistika'));
  assert.ok(statistika);
  assert.equal(statistika.percentage, 40);
  assert.equal(statistika.masteryStatus, 'PERLU_BIMBINGAN');
});
