import React, { useState, useRef } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  BookOpen,
  FileSpreadsheet,
  Sparkles,
  Search,
  Filter,
  Check,
  Printer,
  ChevronDown,
  Layers,
  HelpCircle,
  Calculator,
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle2,
  FileType
} from 'lucide-react';
import { Question, QuestionType, DifficultyLevel, EssayKeyword, JurusanSMK } from '../types/cbt';
import { generateDynamicKisiKisi, gradeEssayByKeywords } from '../utils/scoring';
import {
  downloadXlsxTemplate,
  downloadWordTemplate,
  parseXlsxBuffer,
  parseDocxBuffer,
  parseWordQuestionsText,
  ImportResult
} from '../utils/importer';
import { MathRenderer } from './MathRenderer';
import { ArabicRenderer } from './ArabicRenderer';

interface QuestionBankManagerProps {
  questions: Question[];
  onSaveQuestions: (updated: Question[]) => void;
}

export const QuestionBankManager: React.FC<QuestionBankManagerProps> = ({
  questions,
  onSaveQuestions,
}) => {
  const [activeTab, setActiveTab] = useState<'LIST' | 'KISI_KISI' | 'ESSAY_TESTER'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterDifficulty, setFilterDifficulty] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Form State for Question
  const [formCode, setFormCode] = useState('');
  const [formSubject, setFormSubject] = useState('Teknologi Jaringan Berbasis Luas');
  const [formMajor, setFormMajor] = useState<JurusanSMK | 'SEMUA'>('TKJ');
  const [formCompetency, setFormCompetency] = useState('');
  const [formIndicator, setFormIndicator] = useState('');
  const [formType, setFormType] = useState<QuestionType>('PG');
  const [formDifficulty, setFormDifficulty] = useState<DifficultyLevel>('SEDANG');
  const [formQuestionText, setFormQuestionText] = useState('');
  const [formMathFormula, setFormMathFormula] = useState('');
  const [formArabicText, setFormArabicText] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formMaxScore, setFormMaxScore] = useState<number>(10);
  const [formExplanation, setFormExplanation] = useState('');

  // Options state
  const [formOptions, setFormOptions] = useState<{ key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }[]>([
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
    { key: 'E', text: '' },
  ]);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');

  // Essay Keywords State
  const [formKeywords, setFormKeywords] = useState<EssayKeyword[]>([
    { keyword: '', weight: 50, synonymList: [] },
  ]);

  // Interactive Essay Tester Playground State
  const [sampleQuestionIndex, setSampleQuestionIndex] = useState(0);
  const [testAnswerInput, setTestAnswerInput] = useState(
    'OSPF menggunakan algoritma dijkstra spf untuk menghitung rute, lalu menyebarkan paket LSA, serta memilih DR dan BDR pada switch.'
  );

  const essayQuestions = questions.filter(q => q.type === 'ESSAI');
  const currentTestQuestion = essayQuestions[sampleQuestionIndex] || essayQuestions[0];
  const testGradeResult = currentTestQuestion
    ? gradeEssayByKeywords(testAnswerInput, currentTestQuestion.essayKeywords, currentTestQuestion.maxScore)
    : null;

  // Filtered Questions
  const filteredQuestions = questions.filter(q => {
    const matchesSearch =
      q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.competencyStandard.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || q.type === filterType;
    const matchesDiff = filterDifficulty === 'ALL' || q.difficulty === filterDifficulty;
    return matchesSearch && matchesType && matchesDiff;
  });

  const dynamicKisiKisi = generateDynamicKisiKisi(questions);

  // Import Modal State & Handlers
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importTab, setImportTab] = useState<'FILE' | 'PASTE'>('FILE');
  const [importMode, setImportMode] = useState<'APPEND' | 'REPLACE'>('APPEND');
  const [parsedResult, setParsedResult] = useState<ImportResult | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [pasteDocText, setPasteDocText] = useState('');
  const [importStatusMsg, setImportStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportStatusMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileName = file.name.toLowerCase();

      let result: ImportResult;
      if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        result = parseXlsxBuffer(arrayBuffer);
      } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
        result = await parseDocxBuffer(arrayBuffer);
      } else {
        result = {
          success: false,
          questions: [],
          errors: ['Format file tidak didukung. Harap unggah berkas Excel (.xlsx / .xls) atau Word (.docx / .doc).'],
          totalParsed: 0,
        };
      }

      setParsedResult(result);
    } catch (err) {
      setParsedResult({
        success: false,
        questions: [],
        errors: [err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses berkas import.'],
        totalParsed: 0,
      });
    } finally {
      setImportLoading(false);
    }
  };

  const handleParsePastedText = () => {
    if (!pasteDocText.trim()) return;
    setImportLoading(true);
    const result = parseWordQuestionsText(pasteDocText);
    setParsedResult(result);
    setImportLoading(false);
  };

  const handleApplyImport = () => {
    if (!parsedResult || parsedResult.questions.length === 0) return;

    let updatedQuestions: Question[];
    if (importMode === 'REPLACE') {
      updatedQuestions = parsedResult.questions;
    } else {
      updatedQuestions = [...parsedResult.questions, ...questions];
    }

    onSaveQuestions(updatedQuestions);
    setImportStatusMsg(`Berhasil mengimpor ${parsedResult.questions.length} butir soal ke dalam Bank Soal CBT!`);
    setTimeout(() => {
      setIsImportModalOpen(false);
      setParsedResult(null);
      setImportStatusMsg(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 1500);
  };

  const openAddModal = () => {
    setEditingQuestion(null);
    setFormCode(`SOAL-${questions.length + 1}`);
    setFormSubject('Teknologi Jaringan Berbasis Luas');
    setFormMajor('TKJ');
    setFormCompetency('Menganalisis Perangkat Jaringan Nirkabel dan Fiber Optik');
    setFormIndicator('Menentukan konfigurasi perangkat sesuai kebutuhan');
    setFormType('PG');
    setFormDifficulty('SEDANG');
    setFormQuestionText('');
    setFormMathFormula('');
    setFormArabicText('');
    setFormImageUrl('');
    setFormMaxScore(10);
    setFormExplanation('');
    setFormOptions([
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' },
      { key: 'E', text: '' },
    ]);
    setFormCorrectAnswer('A');
    setFormKeywords([{ keyword: '', weight: 50, synonymList: [] }]);
    setIsModalOpen(true);
  };

  const openEditModal = (q: Question) => {
    setEditingQuestion(q);
    setFormCode(q.code);
    setFormSubject(q.subject);
    setFormMajor(q.major || 'SEMUA');
    setFormCompetency(q.competencyStandard);
    setFormIndicator(q.indicator);
    setFormType(q.type);
    setFormDifficulty(q.difficulty);
    setFormQuestionText(q.questionText);
    setFormMathFormula(q.mathFormula || '');
    setFormArabicText(q.arabicText || '');
    setFormImageUrl(q.imageUrl || '');
    setFormMaxScore(q.maxScore);
    setFormExplanation(q.explanation || '');
    if (q.options) {
      setFormOptions(q.options);
    }
    if (q.correctAnswer) {
      setFormCorrectAnswer(q.correctAnswer);
    }
    if (q.essayKeywords) {
      setFormKeywords(q.essayKeywords);
    } else {
      setFormKeywords([{ keyword: '', weight: 50, synonymList: [] }]);
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Yakin ingin menghapus butir soal ini dari bank soal?')) {
      const updated = questions.filter(q => q.id !== id);
      onSaveQuestions(updated);
    }
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestionText.trim()) {
      alert('Teks soal wajib diisi!');
      return;
    }

    const newQuestion: Question = {
      id: editingQuestion ? editingQuestion.id : `q-${Date.now()}`,
      code: formCode || `SOAL-${Date.now()}`,
      subject: formSubject,
      major: formMajor,
      competencyStandard: formCompetency,
      indicator: formIndicator,
      type: formType,
      difficulty: formDifficulty,
      questionText: formQuestionText,
      maxScore: Number(formMaxScore) || 10,
      mathFormula: formMathFormula.trim() || undefined,
      arabicText: formArabicText.trim() || undefined,
      imageUrl: formImageUrl.trim() || undefined,
      explanation: formExplanation.trim() || undefined,
    };

    if (formType === 'PG') {
      newQuestion.options = formOptions;
      newQuestion.correctAnswer = formCorrectAnswer;
    } else {
      newQuestion.essayKeywords = formKeywords.filter(k => k.keyword.trim().length > 0);
    }

    let updatedList: Question[];
    if (editingQuestion) {
      updatedList = questions.map(q => (q.id === editingQuestion.id ? newQuestion : q));
    } else {
      updatedList = [newQuestion, ...questions];
    }

    onSaveQuestions(updatedList);
    setIsModalOpen(false);
  };

  const addKeywordRow = () => {
    setFormKeywords(prev => [...prev, { keyword: '', weight: 25, synonymList: [] }]);
  };

  const removeKeywordRow = (index: number) => {
    setFormKeywords(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('LIST')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'LIST'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Bank Butir Soal ({questions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('KISI_KISI')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'KISI_KISI'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Kisi-Kisi Ujian Dinamis ({dynamicKisiKisi.length} SK)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ESSAY_TESTER')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'ESSAY_TESTER'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Uji Koreksi Esai Otomatis
          </button>
        </div>

        {/* Action Controls for Bank Soal */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download Templates Group */}
          <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white p-0.5 shadow-xs">
            <button
              type="button"
              onClick={downloadXlsxTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
              title="Unduh format tabel Excel (.xlsx) untuk penyusunan soal SMK"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Template Excel</span>
            </button>
            <div className="h-4 w-px bg-slate-200"></div>
            <button
              type="button"
              onClick={downloadWordTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-lg transition"
              title="Unduh format dokumen Word (.doc/.docx) untuk penyusunan soal SMK"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Template Word</span>
            </button>
          </div>

          {/* Import Questions Button */}
          <button
            type="button"
            onClick={() => {
              setParsedResult(null);
              setIsImportModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Soal (Excel / Word)</span>
          </button>

          {/* Manual Input Button */}
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Input Manual Soal</span>
          </button>
        </div>
      </div>

      {/* TAB 1: LIST SOAL */}
      {activeTab === 'LIST' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari teks soal, standar kompetensi, atau kode..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700"
              >
                <option value="ALL">Semua Tipe Soal</option>
                <option value="PG">Pilihan Ganda (PG)</option>
                <option value="ESSAI">Esai Terstruktur</option>
              </select>

              <select
                value={filterDifficulty}
                onChange={e => setFilterDifficulty(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-xl bg-white text-slate-700"
              >
                <option value="ALL">Semua Tingkat Kesukaran</option>
                <option value="MUDAH">Mudah</option>
                <option value="SEDANG">Sedang</option>
                <option value="SUKAR">Sukar</option>
              </select>
            </div>
          </div>

          {/* Question Cards */}
          <div className="space-y-3">
            {filteredQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 transition space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700">
                      #{idx + 1} • {q.code}
                    </span>
                    <span className="font-semibold text-slate-700">{q.subject}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                      {q.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        q.difficulty === 'MUDAH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.difficulty === 'SEDANG'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {q.difficulty}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-500 font-semibold">
                      Bobot: {q.maxScore} Poin
                    </span>
                    <button
                      type="button"
                      onClick={() => openEditModal(q)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      title="Edit Butir Soal"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Hapus Soal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="text-xs text-indigo-900 bg-indigo-50/50 p-2 rounded-xl">
                  <strong>Standar Kompetensi:</strong> {q.competencyStandard}
                  <br />
                  <strong>Indikator:</strong> {q.indicator}
                </div>

                <p className="text-sm text-slate-800 font-medium leading-relaxed">
                  {q.questionText}
                </p>

                {q.imageUrl && (
                  <img src={q.imageUrl} alt="Ilustrasi" className="h-28 rounded-lg object-cover border" />
                )}

                {q.mathFormula && <MathRenderer formula={q.mathFormula} />}
                {q.arabicText && <ArabicRenderer text={q.arabicText} />}

                {/* Specific details */}
                {q.type === 'PG' && q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                    {q.options.map(opt => (
                      <div
                        key={opt.key}
                        className={`flex items-start gap-2 p-1 rounded ${
                          opt.key === q.correctAnswer ? 'font-bold text-emerald-800 bg-emerald-100/60' : ''
                        }`}
                      >
                        <span className="font-mono font-bold">{opt.key}.</span>
                        <span>{opt.text}</span>
                        {opt.key === q.correctAnswer && (
                          <span className="ml-auto text-[10px] bg-emerald-600 text-white px-1.5 rounded">
                            KUNCI
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {q.type === 'ESSAI' && q.essayKeywords && (
                  <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80 text-xs">
                    <span className="font-bold text-emerald-900 block mb-1">
                      Kamus Kata Kunci Penilaian Otomatis ({q.essayKeywords.length} Kata Kunci):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {q.essayKeywords.map((kw, i) => (
                        <span
                          key={i}
                          className="bg-white border border-emerald-300 text-emerald-800 px-2.5 py-1 rounded-lg text-xs"
                        >
                          <strong>{kw.keyword}</strong> ({kw.weight}%)
                          {kw.synonymList && kw.synonymList.length > 0 && (
                            <span className="text-slate-500 text-[10px]"> [Sinonim: {kw.synonymList.join(', ')}]</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: KISI-KISI UJIAN DINAMIS */}
      {activeTab === 'KISI_KISI' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4 print-area">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 uppercase">
                Kisi-Kisi Ujian SMK Standar Kompetensi Kejuruan
              </h2>
              <p className="text-xs text-slate-500">
                Terbentuk secara dinamis dari bank butir soal aktif sesuai Kurikulum Merdeka & Standar Industri
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-xs no-print"
            >
              <Printer className="w-4 h-4" /> Cetak / Export PDF Kisi-Kisi
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-300">
                  <th className="p-3 border-r border-slate-200 w-10 text-center">No</th>
                  <th className="p-3 border-r border-slate-200">Standar Kompetensi / Capaian Pembelajaran</th>
                  <th className="p-3 border-r border-slate-200">Indikator Soal</th>
                  <th className="p-3 border-r border-slate-200 text-center">Bentuk Soal</th>
                  <th className="p-3 border-r border-slate-200 text-center">Tingkat Kesukaran</th>
                  <th className="p-3 border-r border-slate-200 text-center">Jumlah Soal</th>
                  <th className="p-3 text-center">Total Bobot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dynamicKisiKisi.map((kisi, i) => (
                  <tr key={kisi.id} className="hover:bg-slate-50/60">
                    <td className="p-3 text-center font-bold text-slate-500 border-r border-slate-200">
                      {i + 1}
                    </td>
                    <td className="p-3 font-semibold text-slate-900 border-r border-slate-200">
                      {kisi.competencyStandard}
                    </td>
                    <td className="p-3 text-slate-700 border-r border-slate-200">
                      {kisi.indicator}
                    </td>
                    <td className="p-3 text-center border-r border-slate-200">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                        {kisi.totalPG > 0 && `${kisi.totalPG} PG`}
                        {kisi.totalPG > 0 && kisi.totalEssai > 0 && ' & '}
                        {kisi.totalEssai > 0 && `${kisi.totalEssai} Esai`}
                      </span>
                    </td>
                    <td className="p-3 text-center border-r border-slate-200">
                      <div className="flex items-center justify-center gap-1 text-[10px]">
                        {kisi.easyCount > 0 && <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{kisi.easyCount} Mudah</span>}
                        {kisi.mediumCount > 0 && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">{kisi.mediumCount} Sedang</span>}
                        {kisi.hardCount > 0 && <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold">{kisi.hardCount} Sukar</span>}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-indigo-700 border-r border-slate-200">
                      {kisi.totalQuestions}
                    </td>
                    <td className="p-3 text-center font-mono font-bold text-slate-800">
                      {kisi.totalWeight} Poin
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ESSAY KEYWORD AUTO-CORRECTOR TESTER */}
      {activeTab === 'ESSAY_TESTER' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                Simulasi Mesin Penilaian Esai Otomatis Berbasis Kata Kunci
              </h2>
              <p className="text-xs text-slate-500">
                Uji langsung akurasi penilaian objektif algoritma tokenisasi kata kunci dan sinonim
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-semibold">Pilih Soal Esai:</span>
              <select
                value={sampleQuestionIndex}
                onChange={e => setSampleQuestionIndex(Number(e.target.value))}
                className="px-3 py-1.5 border border-slate-300 rounded-xl bg-white font-medium"
              >
                {essayQuestions.map((eq, i) => (
                  <option key={eq.id} value={i}>
                    {eq.code} - {eq.competencyStandard}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {currentTestQuestion ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Question Specs & Defined Keywords */}
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-2 text-xs">
                  <span className="font-extrabold text-indigo-900 uppercase block tracking-wider">
                    {currentTestQuestion.code} ({currentTestQuestion.subject})
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {currentTestQuestion.questionText}
                  </p>
                  <p className="text-slate-500">
                    Bobot Maksimal Soal: <strong>{currentTestQuestion.maxScore} Poin</strong>
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    Aturan Kata Kunci & Bobot Persentase:
                  </h4>
                  <div className="space-y-2">
                    {currentTestQuestion.essayKeywords?.map((kw, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50 border border-slate-200"
                      >
                        <div>
                          <span className="font-bold text-indigo-900">{kw.keyword}</span>
                          {kw.synonymList && kw.synonymList.length > 0 && (
                            <span className="text-slate-500 text-[11px] block">
                              Sinonim: {kw.synonymList.join(', ')}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                          {kw.weight}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input Area & Live Auto-Correction Result */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Ketik / Tempel Jawaban Sampel Siswa:
                  </label>
                  <textarea
                    rows={6}
                    value={testAnswerInput}
                    onChange={e => setTestAnswerInput(e.target.value)}
                    className="w-full p-3.5 border border-slate-300 rounded-2xl text-xs leading-relaxed focus:ring-2 focus:ring-indigo-500"
                    placeholder="Masukkan jawaban siswa untuk menguji penilaian otomatis..."
                  />
                </div>

                {/* Live Result Box */}
                {testGradeResult && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                        Hasil Evaluasi Objektif:
                      </span>
                      <span className="font-mono text-2xl font-black text-emerald-800">
                        {testGradeResult.score} / {currentTestQuestion.maxScore} Poin
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex justify-between text-slate-700">
                        <span>Kata Kunci Ditemukan:</span>
                        <span className="font-bold text-emerald-700">
                          {testGradeResult.matchedKeywords.length} Kata ({testGradeResult.matchedKeywords.join(', ') || 'Nihil'})
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Catatan Sistem:</span>
                        <span className="font-semibold text-slate-800">{testGradeResult.feedback}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Tidak ada soal bertipe esai.</p>
          )}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-base text-slate-900">
                {editingQuestion ? 'Edit Butir Soal CBT' : 'Tambah Butir Soal Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Kode Soal</label>
                  <input
                    type="text"
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mata Pelajaran</label>
                  <input
                    type="text"
                    value={formSubject}
                    onChange={e => setFormSubject(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Jurusan SMK</label>
                  <select
                    value={formMajor}
                    onChange={e => setFormMajor(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="SEMUA">Semua Jurusan</option>
                    <option value="TKJ">TKJ (Teknik Komputer Jaringan)</option>
                    <option value="RPL">RPL (Rekayasa Perangkat Lunak)</option>
                    <option value="DKV">DKV (Desain Komunikasi Visual)</option>
                    <option value="AKL">AKL (Akuntansi)</option>
                    <option value="TBSM">TBSM (Sepeda Motor)</option>
                    <option value="OTKP">OTKP (Perkantoran)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Standar Kompetensi / Capaian Pembelajaran
                  </label>
                  <input
                    type="text"
                    value={formCompetency}
                    onChange={e => setFormCompetency(e.target.value)}
                    placeholder="Contoh: Mengkonfigurasi VLAN dan Routing Dinamis"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Indikator Soal</label>
                  <input
                    type="text"
                    value={formIndicator}
                    onChange={e => setFormIndicator(e.target.value)}
                    placeholder="Contoh: Menganalisis parameter tabel routing"
                    className="w-full p-2.5 border border-slate-300 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bentuk Soal</label>
                  <select
                    value={formType}
                    onChange={e => setFormType(e.target.value as QuestionType)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold text-indigo-700"
                  >
                    <option value="PG">Pilihan Ganda (PG)</option>
                    <option value="ESSAI">Esai (Koreksi Otomatis)</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tingkat Kesukaran</label>
                  <select
                    value={formDifficulty}
                    onChange={e => setFormDifficulty(e.target.value as DifficultyLevel)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl bg-white"
                  >
                    <option value="MUDAH">Mudah</option>
                    <option value="SEDANG">Sedang</option>
                    <option value="SUKAR">Sukar</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Bobot Nilai Maksimal</label>
                  <input
                    type="number"
                    value={formMaxScore}
                    onChange={e => setFormMaxScore(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold"
                    min={1}
                    max={100}
                    required
                  />
                </div>
              </div>

              {/* Question Text */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Teks Utama Butir Soal</label>
                <textarea
                  rows={4}
                  value={formQuestionText}
                  onChange={e => setFormQuestionText(e.target.value)}
                  placeholder="Ketik narasi atau studi kasus soal secara jelas..."
                  className="w-full p-3 border border-slate-300 rounded-xl text-xs leading-relaxed"
                  required
                />
              </div>

              {/* Formula & Arabic text helpers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                    Rumus Matematika (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formMathFormula}
                    onChange={e => setFormMathFormula(e.target.value)}
                    placeholder="Contoh: A = \begin{pmatrix} 6 & 4 \\ 3 & 5 \end{pmatrix} atau U_n = a \cdot r^{n-1}"
                    className="w-full p-2 border border-slate-300 rounded-lg font-mono text-[11px]"
                  />
                  {formMathFormula && <MathRenderer formula={formMathFormula} className="mt-1" />}
                </div>

                <div>
                  <label className="font-bold text-slate-700 flex items-center gap-1 mb-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    Naskah Arab / Ayat Al-Qur'an (Opsional)
                  </label>
                  <input
                    type="text"
                    value={formArabicText}
                    onChange={e => setFormArabicText(e.target.value)}
                    placeholder="Contoh: وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ"
                    className="w-full p-2 border border-slate-300 rounded-lg text-[11px]"
                    dir="rtl"
                  />
                  {formArabicText && <ArabicRenderer text={formArabicText} className="mt-1 p-2" />}
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">URL Gambar Soal (Opsional)</label>
                <input
                  type="text"
                  value={formImageUrl}
                  onChange={e => setFormImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-[11px]"
                />
              </div>

              {/* Conditional: PG Options vs Essay Keywords */}
              {formType === 'PG' ? (
                <div className="space-y-2 border-t pt-3">
                  <label className="font-bold text-slate-700 block">
                    Pilihan Jawaban & Kunci Jawaban Resmi:
                  </label>
                  {formOptions.map((opt, i) => (
                    <div key={opt.key} className="flex items-center gap-2">
                      <span className="w-6 font-bold text-slate-700 text-center">{opt.key}.</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => {
                          const updated = [...formOptions];
                          updated[i].text = e.target.value;
                          setFormOptions(updated);
                        }}
                        placeholder={`Teks pilihan ${opt.key}...`}
                        className="flex-1 p-2 border border-slate-300 rounded-xl"
                        required
                      />
                      <label className="inline-flex items-center gap-1 text-slate-600 font-semibold cursor-pointer">
                        <input
                          type="radio"
                          name="correctKey"
                          checked={formCorrectAnswer === opt.key}
                          onChange={() => setFormCorrectAnswer(opt.key)}
                          className="text-indigo-600"
                        />
                        <span>Kunci</span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-700 block">
                      Kata Kunci Esai & Pembobotan Otomatis:
                    </label>
                    <button
                      type="button"
                      onClick={addKeywordRow}
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      + Tambah Kata Kunci
                    </button>
                  </div>

                  {formKeywords.map((kw, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border">
                      <input
                        type="text"
                        value={kw.keyword}
                        onChange={e => {
                          const updated = [...formKeywords];
                          updated[i].keyword = e.target.value;
                          setFormKeywords(updated);
                        }}
                        placeholder="Kata kunci utama (misal: dijkstra)..."
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs"
                        required
                      />
                      <input
                        type="text"
                        value={kw.synonymList?.join(', ') || ''}
                        onChange={e => {
                          const updated = [...formKeywords];
                          updated[i].synonymList = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setFormKeywords(updated);
                        }}
                        placeholder="Sinonim dipisahkan koma..."
                        className="flex-1 p-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <div className="flex items-center gap-1 w-24">
                        <input
                          type="number"
                          value={kw.weight}
                          onChange={e => {
                            const updated = [...formKeywords];
                            updated[i].weight = Number(e.target.value);
                            setFormKeywords(updated);
                          }}
                          className="w-16 p-2 border border-slate-300 rounded-lg font-bold text-center"
                          min={1}
                          max={100}
                        />
                        <span>%</span>
                      </div>
                      {formKeywords.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeKeywordRow(i)}
                          className="text-rose-600 p-1 hover:bg-rose-50 rounded"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Explanation */}
              <div className="border-t pt-3">
                <label className="font-bold text-slate-700 block mb-1">
                  Penjelasan / Pembahasan Soal (Tampil saat Siswa Selesai)
                </label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={e => setFormExplanation(e.target.value)}
                  placeholder="Uraikan dasar teori atau kunci pembahasannya..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  Simpan Butir Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Import Modal (XLSX, Word, Text Paste) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Import Bank Soal (Microsoft Excel & Word)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mendukung berkas <strong>.xlsx, .xls, .docx, .doc</strong> atau tempel teks Word langsung
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setParsedResult(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Template Download Banner */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-indigo-600" />
                  Format Template Baku Soal SMK
                </span>
                <p className="text-[11px] text-indigo-700">
                  Gunakan template resmi kami agar seluruh butir soal, opsi A-E, dan kata kunci terbaca sempurna.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={downloadXlsxTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition shadow-2xs text-[11px]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Download Template Excel</span>
                </button>
                <button
                  type="button"
                  onClick={downloadWordTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 transition shadow-2xs text-[11px]"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  <span>Download Template Word</span>
                </button>
              </div>
            </div>

            {/* Sub-tabs: Upload File vs Paste Text */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setImportTab('FILE')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                  importTab === 'FILE'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileType className="w-3.5 h-3.5" />
                <span>1. Unggah Berkas File (.xlsx / .docx)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportTab('PASTE')}
                className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                  importTab === 'PASTE'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>2. Tempel Teks Word (Copy-Paste)</span>
              </button>
            </div>

            {/* TAB 1: File Upload Dropzone */}
            {importTab === 'FILE' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls, .docx, .doc"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-indigo-50/20 cursor-pointer transition flex flex-col items-center justify-center space-y-2"
                >
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-extrabold text-sm text-slate-800 block">
                      Klik untuk Memilih File atau Tarik Berkas ke Sini
                    </span>
                    <span className="text-xs text-slate-500">
                      Mendukung Microsoft Excel (.xlsx, .xls) dan Microsoft Word (.docx, .doc)
                    </span>
                  </div>
                  <span className="inline-block mt-2 px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs">
                    Pilih Berkas dari Komputer
                  </span>
                </div>
              </div>
            )}

            {/* TAB 2: Direct Paste Word Text */}
            {importTab === 'PASTE' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">
                    Tempel Teks Soal Format Word di Sini:
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPasteDocText(`[SOAL PG]
KODE: TKJ-IMP-01
MAPEL: Administrasi Server
JURUSAN: TKJ
SK: Menganalisis DNS Server
INDIKATOR: Menentukan fungsi record DNS
KESUKARAN: SEDANG
BOBOT: 10
PERTANYAAN: Record DNS manakah yang digunakan untuk memetakan domain ke alamat IPv4?
A: A Record
B: AAAA Record
C: MX Record
D: CNAME Record
E: PTR Record
KUNCI: A
PEMBAHASAN: A record memetakan nama domain ke alamat IPv4 32-bit.
[SELESAI]

[SOAL ESSAI]
KODE: TKJ-IMP-02
MAPEL: Administrasi Server
JURUSAN: TKJ
SK: Menganalisis DNS Server
INDIKATOR: Menguraikan zona forward dan reverse
KESUKARAN: SEDANG
BOBOT: 20
PERTANYAAN: Jelaskan perbedaan fungsi antara Forward Lookup Zone dan Reverse Lookup Zone pada server DNS BIND9!
KATA KUNCI: forward:30; reverse:30; ip address:20; domain:20
PEMBAHASAN: Forward mengubah domain ke IP, reverse mengubah IP ke domain.
[SELESAI]`);
                    }}
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Isi Contoh Soal Otomatis
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={pasteDocText}
                  onChange={e => setPasteDocText(e.target.value)}
                  placeholder="[SOAL PG]&#10;KODE: SOAL-01&#10;PERTANYAAN: Teks pertanyaan...&#10;A: Pilihan A&#10;B: Pilihan B&#10;KUNCI: A&#10;[SELESAI]"
                  className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleParsePastedText}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition"
                  >
                    Ekstrak & Parse Teks Soal
                  </button>
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {importLoading && (
              <div className="p-4 text-center text-xs text-indigo-700 font-semibold bg-indigo-50 rounded-2xl animate-pulse">
                Sedang memproses dan mengekstrak butir soal dari berkas...
              </div>
            )}

            {/* Status Message */}
            {importStatusMsg && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{importStatusMsg}</span>
              </div>
            )}

            {/* Parsed Result Preview */}
            {parsedResult && (
              <div className="space-y-4 pt-3 border-t border-slate-200 text-xs">
                {/* Result Summary Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800">
                      Hasil Analisis Berkas:
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold">
                      {parsedResult.totalParsed} Butir Terbaca
                    </span>
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-medium">
                      {parsedResult.questions.filter(q => q.type === 'PG').length} PG
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                      {parsedResult.questions.filter(q => q.type === 'ESSAI').length} Esai
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-slate-700">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'APPEND'}
                        onChange={() => setImportMode('APPEND')}
                        className="text-indigo-600"
                      />
                      <span>Tambahkan ke Bank Soal</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-rose-700">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'REPLACE'}
                        onChange={() => setImportMode('REPLACE')}
                        className="text-rose-600"
                      />
                      <span>Gantikan Seluruh Soal</span>
                    </label>
                  </div>
                </div>

                {/* Error warning if any */}
                {parsedResult.errors.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                    <span className="font-bold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Catatan Parser:
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {parsedResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Question List Preview */}
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {parsedResult.questions.map((q, i) => (
                    <div
                      key={q.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl space-y-1 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-indigo-700">
                          #{i + 1} • {q.code} ({q.subject})
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono text-[10px] font-bold">
                            {q.type}
                          </span>
                          <span className="font-mono text-slate-500">Bobot: {q.maxScore}</span>
                        </div>
                      </div>
                      <p className="text-slate-800 text-xs font-medium line-clamp-2">
                        {q.questionText}
                      </p>
                      {q.type === 'PG' && q.options && (
                        <div className="text-[11px] text-slate-500 flex gap-2">
                          <span>Kunci: <strong className="text-emerald-700">{q.correctAnswer}</strong></span>
                          <span>• {q.options.length} Opsi Pilihan</span>
                        </div>
                      )}
                      {q.type === 'ESSAI' && q.essayKeywords && (
                        <div className="text-[11px] text-emerald-800">
                          Kata Kunci: {q.essayKeywords.map(k => k.keyword).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Commit Action */}
                <div className="pt-3 border-t flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setParsedResult(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Batal Pilih Berkas
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyImport}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Terapkan & Simpan {parsedResult.questions.length} Butir Soal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
