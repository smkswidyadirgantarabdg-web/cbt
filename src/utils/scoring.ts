import type { Question, EssayKeyword, CompetencyAnalytics, Siswa } from '../types/cbt.ts';

/**
 * Normalizes text for keyword matching:
 * removes accents, punctuation, lowercases and trims.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Grade multiple choice answer
 */
export function gradeMultipleChoice(
  selectedOption: string | undefined,
  correctAnswer: string | undefined,
  maxScore: number
): number {
  if (!selectedOption || !correctAnswer) return 0;
  return selectedOption.trim().toUpperCase() === correctAnswer.trim().toUpperCase() ? maxScore : 0;
}

/**
 * Objective automatic keyword-based essay scoring:
 * Matches required core keywords and their synonyms within student response.
 * Calculates score proportionally according to keyword weight.
 */
export function gradeEssayByKeywords(
  studentAnswer: string,
  keywords: EssayKeyword[] | undefined,
  maxScore: number
): { score: number; matchedKeywords: string[]; feedback: string } {
  if (!studentAnswer || !keywords || keywords.length === 0) {
    return {
      score: 0,
      matchedKeywords: [],
      feedback: 'Jawaban kosong atau tidak ada kata kunci yang ditentukan.',
    };
  }

  const normalizedResponse = normalizeText(studentAnswer);
  if (normalizedResponse.length < 3) {
    return {
      score: 0,
      matchedKeywords: [],
      feedback: 'Jawaban terlalu singkat.',
    };
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  const matchedKeywords: string[] = [];

  for (const item of keywords) {
    const weight = item.weight > 0 ? item.weight : 10;
    totalWeight += weight;

    const termsToMatch = [item.keyword, ...(item.synonymList || [])]
      .map(k => normalizeText(k))
      .filter(Boolean);

    // Check if any synonym or the keyword exists in student text
    const matched = termsToMatch.some(term => {
      // Word boundary match or includes if phrase
      if (term.includes(' ')) {
        return normalizedResponse.includes(term);
      }
      const regex = new RegExp(`\\b${term}\\b`, 'i');
      return regex.test(normalizedResponse) || normalizedResponse.includes(term);
    });

    if (matched) {
      earnedWeight += weight;
      matchedKeywords.push(item.keyword);
    }
  }

  if (totalWeight === 0) totalWeight = 100;
  const ratio = Math.min(1, earnedWeight / totalWeight);
  const finalScore = Math.round(ratio * maxScore * 10) / 10;

  let feedback = '';
  if (ratio >= 0.85) {
    feedback = `Sangat Baik. Menguasai ${matchedKeywords.length} dari ${keywords.length} kata kunci esensial.`;
  } else if (ratio >= 0.5) {
    feedback = `Cukup. Teridentifikasi kata kunci: ${matchedKeywords.join(', ')}.`;
  } else if (matchedKeywords.length > 0) {
    feedback = `Perlu pendalaman. Hanya memuat sebagian kecil kata kunci: ${matchedKeywords.join(', ')}.`;
  } else {
    feedback = 'Tidak ditemukan kata kunci relevan dalam jawaban esai.';
  }

  return {
    score: finalScore,
    matchedKeywords,
    feedback,
  };
}

/**
 * Deterministic pseudo-random number generator for seeded shuffling
 */
function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate a numeric hash from string for seeding
 */
export function stringToHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Shuffle array deterministically based on student ID / seed
 * Ensures every student has an individual randomized order while keeping results reproducible!
 */
export function shuffleArrayWithSeed<T>(array: T[], seedInput: string | number): T[] {
  const result = [...array];
  let seed = typeof seedInput === 'number' ? seedInput : stringToHash(seedInput);

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Generate Kisi-Kisi Standar Kompetensi dynamically from question bank
 */
export interface KisiKisiItem {
  id: string;
  competencyStandard: string;
  indicator: string;
  totalQuestions: number;
  totalPG: number;
  totalEssai: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  totalWeight: number;
}

export function generateDynamicKisiKisi(questions: Question[]): KisiKisiItem[] {
  const map = new Map<string, KisiKisiItem>();

  for (const q of questions) {
    const key = `${q.competencyStandard}___${q.indicator}`;
    let item = map.get(key);
    if (!item) {
      item = {
        id: `kisi-${map.size + 1}`,
        competencyStandard: q.competencyStandard,
        indicator: q.indicator,
        totalQuestions: 0,
        totalPG: 0,
        totalEssai: 0,
        easyCount: 0,
        mediumCount: 0,
        hardCount: 0,
        totalWeight: 0,
      };
      map.set(key, item);
    }

    item.totalQuestions += 1;
    if (q.type === 'PG') item.totalPG += 1;
    else item.totalEssai += 1;

    if (q.difficulty === 'MUDAH') item.easyCount += 1;
    else if (q.difficulty === 'SEDANG') item.mediumCount += 1;
    else if (q.difficulty === 'SUKAR') item.hardCount += 1;

    item.totalWeight += q.maxScore;
  }

  return Array.from(map.values());
}

/**
 * Computes deep student competency mastery analytics
 */
export function calculateCompetencyAnalytics(
  questions: Question[],
  questionScores: Record<string, number>
): CompetencyAnalytics[] {
  const competencyMap = new Map<string, { achieved: number; max: number; count: number }>();

  for (const q of questions) {
    const comp = q.competencyStandard || 'Umum';
    const current = competencyMap.get(comp) || { achieved: 0, max: 0, count: 0 };
    current.max += q.maxScore;
    current.achieved += questionScores[q.id] || 0;
    current.count += 1;
    competencyMap.set(comp, current);
  }

  const results: CompetencyAnalytics[] = [];
  for (const [competency, stats] of competencyMap.entries()) {
    const percentage = stats.max > 0 ? Math.round((stats.achieved / stats.max) * 100) : 0;
    let masteryStatus: 'KOMPETEN' | 'CUKUP' | 'PERLU_BIMBINGAN' = 'PERLU_BIMBINGAN';
    if (percentage >= 75) {
      masteryStatus = 'KOMPETEN';
    } else if (percentage >= 60) {
      masteryStatus = 'CUKUP';
    }

    results.push({
      competency,
      totalQuestions: stats.count,
      achievedScore: Math.round(stats.achieved * 10) / 10,
      maxScore: stats.max,
      percentage,
      masteryStatus,
    });
  }

  return results;
}

/**
 * Validates whether student is eligible to enter CBT exam based on financial administration
 */
export function checkFinancialEligibility(student: Siswa): {
  allowed: boolean;
  reason: string;
} {
  if (student.financialStatus === 'LUNAS') {
    return {
      allowed: true,
      reason: 'Administrasi keuangan lunas. Berhak mengikuti ujian CBT.',
    };
  }
  if (student.financialStatus === 'DISPENSASI') {
    return {
      allowed: true,
      reason: 'Mendapat surat dispensasi keuangan resmi dari Kepala Sekolah/Tata Usaha.',
    };
  }
  return {
    allowed: false,
    reason: 'Administrasi keuangan belum terpenuhi. Silakan hubungi bagian Tata Usaha / Keuangan sekolah.',
  };
}

/**
 * Generates clean, high-entropy exam tokens/passwords for student cards
 */
export function generateExamPassword(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
