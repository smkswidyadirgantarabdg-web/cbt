import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import type { Question, QuestionType, DifficultyLevel, JurusanSMK, EssayKeyword } from '../types/cbt.ts';

export interface ImportResult {
  success: boolean;
  questions: Question[];
  errors: string[];
  totalParsed: number;
}

/**
 * Parse an Excel/XLSX ArrayBuffer into Question objects
 */
export function parseXlsxBuffer(buffer: ArrayBuffer): ImportResult {
  const errors: string[] = [];
  const questions: Question[] = [];

  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { success: false, questions: [], errors: ['File Excel tidak memiliki lembar kerja (worksheet).'], totalParsed: 0 };
    }

    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON array of objects
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

    if (rows.length === 0) {
      return { success: false, questions: [], errors: ['Lembar kerja Excel kosong.'], totalParsed: 0 };
    }

    rows.forEach((row, index) => {
      const rowNum = index + 2; // +1 for 0-index, +1 for header
      const questionText = (row['Teks Soal'] || row['Soal'] || row['Pertanyaan'] || '').toString().trim();
      if (!questionText) {
        // Skip empty row or record notice
        return;
      }

      const typeRaw = (row['Bentuk Soal'] || row['Tipe'] || 'PG').toString().toUpperCase().trim();
      const type: QuestionType = typeRaw.includes('ESSAI') || typeRaw.includes('ESAI') ? 'ESSAI' : 'PG';

      const diffRaw = (row['Tingkat Kesukaran'] || row['Kesukaran'] || 'SEDANG').toString().toUpperCase().trim();
      let difficulty: DifficultyLevel = 'SEDANG';
      if (diffRaw.includes('MUDAH')) difficulty = 'MUDAH';
      else if (diffRaw.includes('SUKAR') || diffRaw.includes('SULIT')) difficulty = 'SUKAR';

      const code = (row['Kode Soal'] || `SOAL-IMP-${Date.now()}-${index + 1}`).toString().trim();
      const subject = (row['Mata Pelajaran'] || row['Mapel'] || 'Kejuruan SMK').toString().trim();
      const majorRaw = (row['Jurusan'] || 'SEMUA').toString().toUpperCase().trim() as JurusanSMK | 'SEMUA';
      const competency = (row['Standar Kompetensi'] || row['SK / CP'] || 'Kompetensi Kejuruan Terapan').toString().trim();
      const indicator = (row['Indikator'] || row['Indikator Soal'] || 'Menganalisis materi soal').toString().trim();
      const maxScore = Number(row['Bobot Nilai'] || row['Bobot']) || (type === 'PG' ? 10 : 20);

      const mathFormula = (row['Rumus Matematika'] || row['Rumus'] || '').toString().trim() || undefined;
      const arabicText = (row['Teks Arab'] || row['Arab'] || '').toString().trim() || undefined;
      const imageUrl = (row['URL Gambar'] || row['Gambar'] || '').toString().trim() || undefined;
      const explanation = (row['Pembahasan'] || row['Penjelasan'] || '').toString().trim() || undefined;

      const questionObj: Question = {
        id: `q-imp-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`,
        code,
        subject,
        major: majorRaw,
        competencyStandard: competency,
        indicator,
        type,
        difficulty,
        questionText,
        maxScore,
        mathFormula,
        arabicText,
        imageUrl,
        explanation,
      };

      if (type === 'PG') {
        const optA = (row['Pilihan A'] || row['A'] || '').toString().trim();
        const optB = (row['Pilihan B'] || row['B'] || '').toString().trim();
        const optC = (row['Pilihan C'] || row['C'] || '').toString().trim();
        const optD = (row['Pilihan D'] || row['D'] || '').toString().trim();
        const optE = (row['Pilihan E'] || row['E'] || '').toString().trim();

        if (!optA || !optB) {
          errors.push(`Baris ${rowNum}: Pilihan ganda minimal harus memiliki Pilihan A dan Pilihan B.`);
          return;
        }

        questionObj.options = [
          { key: 'A', text: optA },
          { key: 'B', text: optB },
          { key: 'C', text: optC || '-' },
          { key: 'D', text: optD || '-' },
          { key: 'E', text: optE || '-' },
        ];

        const keyRaw = (row['Kunci Jawaban PG'] || row['Kunci'] || 'A').toString().toUpperCase().trim();
        const validKey = ['A', 'B', 'C', 'D', 'E'].includes(keyRaw) ? (keyRaw as 'A' | 'B' | 'C' | 'D' | 'E') : 'A';
        questionObj.correctAnswer = validKey;
      } else {
        // Essay keywords: format "dijkstra:25; lsa:25; dr:25; bdr:25" or comma separated
        const keywordsRaw = (row['Kata Kunci Esai'] || row['Kata Kunci'] || '').toString().trim();
        const keywords: EssayKeyword[] = [];

        if (keywordsRaw) {
          const parts = keywordsRaw.split(/[,;]/);
          parts.forEach((part: string) => {
            const [kw, w] = part.split(':').map((s: string) => s.trim());
            if (kw) {
              const weight = Number(w) || Math.round(100 / parts.length);
              keywords.push({ keyword: kw, weight });
            }
          });
        }

        if (keywords.length === 0) {
          // Default keyword extracted from text if none provided
          keywords.push({ keyword: 'konsep', weight: 50 });
        }
        questionObj.essayKeywords = keywords;
      }

      questions.push(questionObj);
    });

    return {
      success: questions.length > 0,
      questions,
      errors,
      totalParsed: questions.length,
    };
  } catch (err) {
    return {
      success: false,
      questions: [],
      errors: [err instanceof Error ? err.message : 'Gagal memproses file Excel'],
      totalParsed: 0,
    };
  }
}

/**
 * Parse text from Word (.docx) or formatted text string into Question objects
 */
export function parseWordQuestionsText(rawText: string): ImportResult {
  const errors: string[] = [];
  const questions: Question[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return { success: false, questions: [], errors: ['Dokumen Word kosong atau tidak terbaca.'], totalParsed: 0 };
  }

  // Split by [SOAL] or [SOAL PG] or [SOAL ESSAI] or [SOAL ESAI]
  const blocks = rawText.split(/(?=\[SOAL|\bSOAL\s*\d+:)/i).filter(b => b.trim().length > 10);

  blocks.forEach((block, idx) => {
    try {
      const isEssay = /\[SOAL\s*ES+AI\]/i.test(block) || /\bBENTUK:\s*ES+AI/i.test(block) || /\bKATA\s*KUNCI:/i.test(block);
      const type: QuestionType = isEssay ? 'ESSAI' : 'PG';

      // Helper to extract fields using regex
      const getField = (regex: RegExp, fallback = '') => {
        const match = block.match(regex);
        return match ? match[1].trim() : fallback;
      };

      const code = getField(/\bKODE:\s*([^\n\r]+)/i, `SOAL-DOCX-${Date.now()}-${idx + 1}`);
      const subject = getField(/\bMAPEL:\s*([^\n\r]+)/i, 'Kejuruan SMK');
      const majorRaw = getField(/\bJURUSAN:\s*([^\n\r]+)/i, 'SEMUA') as JurusanSMK | 'SEMUA';
      const competency = getField(/\bSK:\s*([^\n\r]+)/i, 'Kompetensi Kejuruan SMK');
      const indicator = getField(/\bINDIKATOR:\s*([^\n\r]+)/i, 'Menganalisis konsep soal');

      const diffRaw = getField(/\bKESUKARAN:\s*([^\n\r]+)/i, 'SEDANG').toUpperCase();
      let difficulty: DifficultyLevel = 'SEDANG';
      if (diffRaw.includes('MUDAH')) difficulty = 'MUDAH';
      else if (diffRaw.includes('SUKAR') || diffRaw.includes('SULIT')) difficulty = 'SUKAR';

      const maxScore = Number(getField(/\bBOBOT:\s*(\d+)/i, type === 'PG' ? '10' : '20')) || (type === 'PG' ? 10 : 20);

      // Question Text: Between PERTANYAAN: and options or end
      let questionText = '';
      const qMatch = block.match(/(?:PERTANYAAN|TEKS SOAL|SOAL):\s*([\s\S]+?)(?=(?:\r?\n[A-E]:|\r?\nKATA KUNCI:|\r?\nRUMUS:|\r?\nARAB:|\r?\n\[SELESAI\]|$))/i);
      if (qMatch) {
        questionText = qMatch[1].trim();
      } else {
        // Fallback: take first non-meta paragraph
        const lines = block.split(/\r?\n/).filter(l => l.trim() && !l.match(/^(?:\[SOAL|KODE|MAPEL|JURUSAN|SK|INDIKATOR|KESUKARAN|BOBOT)/i));
        questionText = lines[0] || `Butir Soal #${idx + 1}`;
      }

      const mathFormula = getField(/\bRUMUS:\s*([^\n\r]+)/i) || undefined;
      const arabicText = getField(/\bARAB:\s*([^\n\r]+)/i) || undefined;
      const imageUrl = getField(/\bGAMBAR:\s*([^\n\r]+)/i) || undefined;
      const explanation = getField(/\bPEMBAHASAN:\s*([^\n\r]+)/i) || undefined;

      const questionObj: Question = {
        id: `q-docx-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        code,
        subject,
        major: majorRaw,
        competencyStandard: competency,
        indicator,
        type,
        difficulty,
        questionText,
        maxScore,
        mathFormula,
        arabicText,
        imageUrl,
        explanation,
      };

      if (type === 'PG') {
        const optA = getField(/\bA:\s*([^\n\r]+)/i, '');
        const optB = getField(/\bB:\s*([^\n\r]+)/i, '');
        const optC = getField(/\bC:\s*([^\n\r]+)/i, '');
        const optD = getField(/\bD:\s*([^\n\r]+)/i, '');
        const optE = getField(/\bE:\s*([^\n\r]+)/i, '');

        questionObj.options = [
          { key: 'A', text: optA || 'Opsi A' },
          { key: 'B', text: optB || 'Opsi B' },
          { key: 'C', text: optC || 'Opsi C' },
          { key: 'D', text: optD || 'Opsi D' },
          { key: 'E', text: optE || 'Opsi E' },
        ];

        const keyRaw = getField(/\bKUNCI:\s*([A-E])/i, 'A').toUpperCase();
        questionObj.correctAnswer = ['A', 'B', 'C', 'D', 'E'].includes(keyRaw) ? (keyRaw as any) : 'A';
      } else {
        const keywordsRaw = getField(/\bKATA KUNCI:\s*([^\n\r]+)/i, '');
        const keywords: EssayKeyword[] = [];
        if (keywordsRaw) {
          const parts = keywordsRaw.split(/[,;]/);
          parts.forEach((part: string) => {
            const [kw, w] = part.split(':').map((s: string) => s.trim());
            if (kw) {
              keywords.push({ keyword: kw, weight: Number(w) || 25 });
            }
          });
        }
        if (keywords.length === 0) {
          keywords.push({ keyword: 'konsep', weight: 50 });
        }
        questionObj.essayKeywords = keywords;
      }

      questions.push(questionObj);
    } catch (e) {
      errors.push(`Blok soal ke-${idx + 1} tidak dapat diproses: ${e instanceof Error ? e.message : 'Format tidak sesuai'}`);
    }
  });

  return {
    success: questions.length > 0,
    questions,
    errors,
    totalParsed: questions.length,
  };
}

/**
 * Parse an uploaded Word .docx ArrayBuffer into Questions using mammoth
 */
export async function parseDocxBuffer(buffer: ArrayBuffer): Promise<ImportResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const rawText = result.value;
    return parseWordQuestionsText(rawText);
  } catch (err) {
    return {
      success: false,
      questions: [],
      errors: [err instanceof Error ? err.message : 'Gagal mengekstrak dokumen Word .docx'],
      totalParsed: 0,
    };
  }
}

/**
 * Generate and download downloadable Excel (.xlsx) Template for Teachers
 */
export function downloadXlsxTemplate(): void {
  const headers = [
    'No',
    'Kode Soal',
    'Mata Pelajaran',
    'Jurusan',
    'Standar Kompetensi',
    'Indikator',
    'Bentuk Soal',
    'Tingkat Kesukaran',
    'Teks Soal',
    'Rumus Matematika',
    'Teks Arab',
    'URL Gambar',
    'Pilihan A',
    'Pilihan B',
    'Pilihan C',
    'Pilihan D',
    'Pilihan E',
    'Kunci Jawaban PG',
    'Kata Kunci Esai',
    'Bobot Nilai',
    'Pembahasan',
  ];

  const sampleRows = [
    [
      1,
      'TKJ-WAN-01',
      'Teknologi Jaringan Berbasis Luas',
      'TKJ',
      'Menganalisis Jaringan WAN dan Serat Optik',
      'Menentukan jenis kabel fiber optik untuk jarak 12 Km',
      'PG',
      'SEDANG',
      'Dalam perancangan jaringan WAN antar-gedung kampus SMK dengan jarak 12 Kilometer, teknisi jaringan membutuhkan media transmisi dengan redaman rendah dan bandwidth sangat tinggi tanpa terpengaruh interferensi elektromagnetik. Jenis kabel serat optik manakah yang paling tepat digunakan?',
      '',
      '',
      '',
      'Multi-mode Fiber Optic (MMF) dengan inti 50/125 µm',
      'Single-mode Fiber Optic (SMF) dengan inti 9/125 µm',
      'Unshielded Twisted Pair (UTP) Cat 6A Outdoor',
      'Shielded Foiled Twisted Pair (SFTP) Cat 7',
      'Coaxial RG-58 Thicknet',
      'B',
      '',
      10,
      'Single-mode fiber memiliki core sangat kecil sekitar 9 µm yang memungkinkan jangkauan puluhan kilometer.',
    ],
    [
      2,
      'MAT-SMK-01',
      'Matematika Terapan Kejuruan',
      'SEMUA',
      'Menerapkan Konsep Matriks pada Perhitungan Sinyal',
      'Menghitung determinan matriks 2x2',
      'PG',
      'MUDAH',
      'Sebuah matriks transformasi penguatan sinyal dinyatakan sebagai A. Tentukan nilai determinan dari matriks A berikut:',
      'A = \\begin{pmatrix} 6 & 4 \\\\ 3 & 5 \\end{pmatrix}',
      '',
      '',
      '18',
      '22',
      '30',
      '42',
      '12',
      'A',
      '',
      10,
      'Determinan = (6 * 5) - (4 * 3) = 30 - 12 = 18.',
    ],
    [
      3,
      'PAI-SMK-01',
      'Pendidikan Agama & Budi Pekerti',
      'SEMUA',
      'Memahami Makna Bekerja Keras dan Tanggung Jawab Kejuruan',
      'Mengidentifikasi ayat Al-Quran etos kerja',
      'PG',
      'SEDANG',
      'Perhatikan potongan ayat suci Al-Qur\'an Surat At-Taubah ayat 105 tentang etos kerja dan profesionalisme seorang mukmin:',
      '',
      'وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ',
      '',
      'Perintah untuk senantiasa bekerja dan beramal secara profesional',
      'Anjuran bersabar menghadapi cobaan',
      'Larangan bersikap takabur',
      'Perintah shalat tepat waktu',
      'Ketentuan zakat perniagaan',
      'A',
      '',
      10,
      'Surat At-Taubah 105 mengajarkan profesionalisme dan etos kerja.',
    ],
    [
      4,
      'TKJ-WAN-ESSAY-01',
      'Teknologi Jaringan Berbasis Luas',
      'TKJ',
      'Mengkonfigurasi Routing Dinamis OSPF',
      'Menjelaskan mekanisme protokol OSPF',
      'ESSAI',
      'SEDANG',
      'Jelaskan mekanisme kerja protokol routing Open Shortest Path First (OSPF) dalam membentuk tabel routing! Sebutkan peran algoritma Dijkstra, paket LSA, serta fungsi DR dan BDR.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      'dijkstra:25; lsa:25; dr:25; bdr:25',
      20,
      'OSPF menggunakan algoritma Dijkstra SPF untuk menghitung rute dan menyebarkan paket LSA.',
    ],
  ];

  const wsData = [headers, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 }, // No
    { wch: 15 }, // Kode
    { wch: 25 }, // Mapel
    { wch: 10 }, // Jurusan
    { wch: 30 }, // SK
    { wch: 30 }, // Indikator
    { wch: 12 }, // Bentuk Soal
    { wch: 15 }, // Kesukaran
    { wch: 50 }, // Teks Soal
    { wch: 25 }, // Rumus
    { wch: 25 }, // Teks Arab
    { wch: 20 }, // Gambar
    { wch: 30 }, // A
    { wch: 30 }, // B
    { wch: 30 }, // C
    { wch: 30 }, // D
    { wch: 30 }, // E
    { wch: 15 }, // Kunci
    { wch: 35 }, // Kata Kunci Esai
    { wch: 10 }, // Bobot
    { wch: 35 }, // Pembahasan
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Bank Soal SMK');
  XLSX.writeFile(wb, 'Template_Bank_Soal_CBT_SMK.xlsx');
}

/**
 * Generate and download downloadable Microsoft Word (.docx / .doc compatible) Template for Teachers
 */
export function downloadWordTemplate(): void {
  const content = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Template Bank Soal CBT SMK</title>
<style>
  body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.5; color: #111; margin: 30px; }
  h1 { font-size: 16pt; color: #1e3a8a; text-align: center; margin-bottom: 4px; text-transform: uppercase; }
  h2 { font-size: 12pt; color: #475569; text-align: center; margin-top: 0; margin-bottom: 25px; }
  .box { border: 1px solid #cbd5e1; background: #f8fafc; padding: 12px; margin-bottom: 20px; border-radius: 6px; }
  .tag { font-weight: bold; color: #1d4ed8; }
  hr { border: 0; border-top: 1px dashed #94a3b8; margin: 20px 0; }
  .sample { background: #ffffff; border-left: 4px solid #3b82f6; padding: 10px 15px; margin-bottom: 20px; }
</style>
</head>
<body>

<h1>Template Bank Soal CBT Mandiri SMK</h1>
<h2>Panduan Format Dokumen Microsoft Word (.docx)</h2>

<div class="box">
  <strong>PETUNJUK PENGISIAN SOAL:</strong>
  <ul>
    <li>Setiap butir soal diawali dengan tanda <code>[SOAL PG]</code> untuk Pilihan Ganda atau <code>[SOAL ESSAI]</code> untuk Esai.</li>
    <li>Gunakan tag standar: <code>KODE:</code>, <code>MAPEL:</code>, <code>JURUSAN:</code>, <code>SK:</code>, <code>INDIKATOR:</code>, <code>KESUKARAN:</code>, <code>BOBOT:</code>, <code>PERTANYAAN:</code>.</li>
    <li>Untuk Pilihan Ganda, tulis opsi <code>A:</code>, <code>B:</code>, <code>C:</code>, <code>D:</code>, <code>E:</code> dan kunci jawaban <code>KUNCI:</code>.</li>
    <li>Untuk Esai, cantumkan kata kunci dan bobot: <code>KATA KUNCI: kata1:25; kata2:25; kata3:50</code>.</li>
    <li>Jika memiliki rumus matematika atau teks Arab, gunakan tag <code>RUMUS:</code> atau <code>ARAB:</code>.</li>
    <li>Akhiri setiap butir soal dengan tanda <code>[SELESAI]</code>.</li>
  </ul>
</div>

<hr/>

<div class="sample">
[SOAL PG]<br/>
KODE: TKJ-WAN-01<br/>
MAPEL: Teknologi Jaringan Berbasis Luas<br/>
JURUSAN: TKJ<br/>
SK: Menganalisis Jaringan WAN dan Media Serat Optik<br/>
INDIKATOR: Menentukan media transmisi serat optik untuk konektivitas jarak 12 Km<br/>
KESUKARAN: SEDANG<br/>
BOBOT: 10<br/>
PERTANYAAN: Dalam perancangan jaringan WAN antar-gedung kampus SMK dengan jarak 12 Kilometer, teknisi jaringan membutuhkan media transmisi dengan redaman rendah dan bandwidth sangat tinggi tanpa terpengaruh interferensi elektromagnetik. Jenis kabel serat optik manakah yang paling tepat digunakan?<br/>
RUMUS:<br/>
ARAB:<br/>
GAMBAR:<br/>
A: Multi-mode Fiber Optic (MMF) dengan inti 50/125 µm<br/>
B: Single-mode Fiber Optic (SMF) dengan inti 9/125 µm<br/>
C: Unshielded Twisted Pair (UTP) Cat 6A Outdoor<br/>
D: Shielded Foiled Twisted Pair (SFTP) Cat 7<br/>
E: Coaxial RG-58 Thicknet<br/>
KUNCI: B<br/>
PEMBAHASAN: Single-mode fiber (SMF) memiliki ukuran core yang sangat kecil sekitar 9 µm sehingga dispersi modal rendah dan mampu menjangkau jarak puluhan kilometer.<br/>
[SELESAI]
</div>

<div class="sample">
[SOAL PG]<br/>
KODE: MAT-SMK-01<br/>
MAPEL: Matematika Terapan Kejuruan<br/>
JURUSAN: SEMUA<br/>
SK: Menerapkan Konsep Matriks pada Transformasi Koordinat<br/>
INDIKATOR: Menghitung determinan matriks ordo 2x2<br/>
KESUKARAN: MUDAH<br/>
BOBOT: 10<br/>
PERTANYAAN: Sebuah matriks transformasi penguatan sinyal dinyatakan sebagai A. Tentukan nilai determinan dari matriks A berikut:<br/>
RUMUS: A = \\begin{pmatrix} 6 & 4 \\\\ 3 & 5 \\end{pmatrix}<br/>
ARAB:<br/>
GAMBAR:<br/>
A: 18<br/>
B: 22<br/>
C: 30<br/>
D: 42<br/>
E: 12<br/>
KUNCI: A<br/>
PEMBAHASAN: Determinan = (6 * 5) - (4 * 3) = 30 - 12 = 18.<br/>
[SELESAI]
</div>

<div class="sample">
[SOAL ESSAI]<br/>
KODE: TKJ-WAN-ESSAY-01<br/>
MAPEL: Teknologi Jaringan Berbasis Luas<br/>
JURUSAN: TKJ<br/>
SK: Mengkonfigurasi Routing Dinamis OSPF pada Jaringan Skala Besar<br/>
INDIKATOR: Menjelaskan mekanisme kerja protokol OSPF dan pemilihan DR/BDR<br/>
KESUKARAN: SEDANG<br/>
BOBOT: 20<br/>
PERTANYAAN: Jelaskan mekanisme kerja protokol routing Open Shortest Path First (OSPF) dalam membentuk tabel routing! Sebutkan peran algoritma Dijkstra, paket Link State Advertisement (LSA), serta fungsi Designated Router (DR) dan Backup Designated Router (BDR) dalam jaringan multi-access.<br/>
KATA KUNCI: dijkstra:25; lsa:25; dr:25; bdr:25<br/>
PEMBAHASAN: OSPF menggunakan algoritma Dijkstra SPF untuk menghitung rute terpendek dan menyebarkan paket LSA, dengan DR/BDR mengatur hubungan ketetanggaan.<br/>
[SELESAI]
</div>

</body>
</html>
  `.trim();

  // Create a blob with Word document mime type
  const blob = new Blob(['\ufeff', content], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Bank_Soal_CBT_SMK.doc';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
