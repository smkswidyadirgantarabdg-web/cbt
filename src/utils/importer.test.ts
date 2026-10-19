import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWordQuestionsText } from './importer.ts';

test('parseWordQuestionsText correctly parses PG and ESSAY questions from text format', () => {
  const sampleDoc = `
[SOAL PG]
KODE: TEST-01
MAPEL: Pemrograman Dasar
JURUSAN: RPL
SK: Struktur Algoritma Percabangan
INDIKATOR: Menganalisis kondisi IF-ELSE
KESUKARAN: MUDAH
BOBOT: 10
PERTANYAAN: Tipe data manakah yang digunakan untuk nilai logika TRUE atau FALSE?
A: Integer
B: Float
C: Boolean
D: String
E: Char
KUNCI: C
PEMBAHASAN: Tipe data Boolean hanya bernilai true atau false.
[SELESAI]

[SOAL ESSAI]
KODE: TEST-02
MAPEL: Pemrograman Dasar
JURUSAN: RPL
SK: Array dan Koleksi Data
INDIKATOR: Menguraikan indeks array
KESUKARAN: SEDANG
BOBOT: 20
PERTANYAAN: Jelaskan apa yang dimaksud dengan array 1 dimensi dan berikan contoh deklarasinya dalam bahasa pemrograman!
KATA KUNCI: indeks:30; tipe data:30; elemen:40
PEMBAHASAN: Array adalah kumpulan elemen bertipe sama yang diakses dengan indeks.
[SELESAI]
  `;

  const result = parseWordQuestionsText(sampleDoc);
  assert.equal(result.success, true);
  assert.equal(result.questions.length, 2);

  // Question 1: PG
  const q1 = result.questions[0];
  assert.equal(q1.code, 'TEST-01');
  assert.equal(q1.type, 'PG');
  assert.equal(q1.correctAnswer, 'C');
  assert.equal(q1.options?.length, 5);
  assert.equal(q1.options?.[2].text, 'Boolean');

  // Question 2: Essay
  const q2 = result.questions[1];
  assert.equal(q2.code, 'TEST-02');
  assert.equal(q2.type, 'ESSAI');
  assert.equal(q2.essayKeywords?.length, 3);
  assert.equal(q2.maxScore, 20);
});

test('parseWordQuestionsText gracefully handles empty document', () => {
  const result = parseWordQuestionsText('');
  assert.equal(result.success, false);
  assert.equal(result.questions.length, 0);
  assert.ok(result.errors.length > 0);
});
