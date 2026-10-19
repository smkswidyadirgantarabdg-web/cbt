import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  FileText,
  Printer,
  RotateCcw,
  CheckCircle,
  Eye,
  Lock,
  Send,
  UserX,
  Clock,
  Laptop,
  Volume2,
  VolumeX,
  BellRing,
  X,
  Zap
} from 'lucide-react';
import { Siswa, ExamIncident, BeritaAcaraData, ExamConfig } from '../types/cbt';
import { CBTStorage, cbtChannel } from '../utils/cbtStorage';
import { SignaturePad } from './SignaturePad';

interface ProctorDashboardProps {
  students: Siswa[];
  examConfig: ExamConfig;
  onUpdateStudents: (updated: Siswa[]) => void;
}

export interface ActiveViolationAlert {
  id: string;
  incident: ExamIncident;
  student?: Siswa;
  receivedAt: string;
}

// Sound chime using browser Web Audio API
function playViolationChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
    osc.frequency.setValueAtTime(440, ctx.currentTime + 0.22); // A4
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch (e) {
    // Audio context may be restricted before interaction
  }
}

export const ProctorDashboard: React.FC<ProctorDashboardProps> = ({
  students,
  examConfig,
  onUpdateStudents,
}) => {
  const [activeTab, setActiveTab] = useState<'MONITOR' | 'INCIDENTS' | 'BERITA_ACARA'>('MONITOR');
  const [incidents, setIncidents] = useState<ExamIncident[]>(() => CBTStorage.getIncidents());
  const [beritaAcara, setBeritaAcara] = useState<BeritaAcaraData>(() => CBTStorage.getBeritaAcara());
  const [activeAlerts, setActiveAlerts] = useState<ActiveViolationAlert[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Listen to cross-tab broadcast events in real-time
  useEffect(() => {
    if (!cbtChannel) return;

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'INCIDENT_RECORDED') {
        const newIncident: ExamIncident = e.data.payload;
        setIncidents(prev => [newIncident, ...prev]);

        // Find associated student
        const currentStudents = CBTStorage.getStudents();
        const student = currentStudents.find(s => s.id === newIncident.studentId);
        onUpdateStudents(currentStudents);

        // Trigger rich violation toast alert
        triggerViolationToast(newIncident, student);
      } else if (e.data?.type === 'STUDENTS_UPDATED') {
        onUpdateStudents(e.data.payload);
      }
    };

    cbtChannel.addEventListener('message', handleMessage);
    return () => {
      cbtChannel?.removeEventListener('message', handleMessage);
    };
  }, [soundEnabled]);

  const triggerViolationToast = (incident: ExamIncident, student?: Siswa) => {
    if (soundEnabled) {
      playViolationChime();
    }

    const alertItem: ActiveViolationAlert = {
      id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      incident,
      student,
      receivedAt: new Date().toLocaleTimeString('id-ID'),
    };

    setActiveAlerts(prev => [alertItem, ...prev.slice(0, 3)]); // Keep max 4 concurrent alerts

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setActiveAlerts(prev => prev.filter(a => a.id !== alertItem.id));
    }, 10000);
  };

  const dismissAlert = (alertId: string) => {
    setActiveAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleTestSimulateViolation = () => {
    // Pick an active or sample student
    const activeStudent = students.find(s => s.status === 'SEDANG_MENGERJAKAN') || students[0];
    if (!activeStudent) return;

    const violationTypes: Array<'TAB_SWITCH' | 'APP_BLUR' | 'FULLSCREEN_EXIT'> = [
      'TAB_SWITCH',
      'APP_BLUR',
      'FULLSCREEN_EXIT',
    ];
    const pickedType = violationTypes[Math.floor(Math.random() * violationTypes.length)];
    const desc = pickedType === 'TAB_SWITCH'
      ? 'Peserta terdeteksi berpindah tab browser saat ujian aktif!'
      : pickedType === 'APP_BLUR'
      ? 'Peserta terdeteksi memindahkan fokus ke aplikasi pihak ketiga (Chat/Browser/Notepad)!'
      : 'Peserta terdeteksi keluar dari mode layar penuh!';

    const incident = CBTStorage.recordIncident({
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      type: pickedType,
      description: desc,
      severity: (activeStudent.violationCount || 0) >= 2 ? 'CRITICAL' : 'WARNING',
    });

    const refreshedStudents = CBTStorage.getStudents();
    onUpdateStudents(refreshedStudents);
    const updatedStudent = refreshedStudents.find(s => s.id === activeStudent.id);
    triggerViolationToast(incident, updatedStudent);
  };

  const handleWarnStudent = (student: Siswa) => {
    const inc = CBTStorage.recordIncident({
      studentId: student.id,
      studentName: student.name,
      type: 'TAB_SWITCH',
      description: 'Peringatan manual dikirimkan oleh Pengawas Ruang ujian.',
      severity: 'WARNING',
    });
    setIncidents(CBTStorage.getIncidents());
    const refreshed = CBTStorage.getStudents();
    onUpdateStudents(refreshed);
    triggerViolationToast(inc, refreshed.find(s => s.id === student.id));
  };

  const handleResetSession = (student: Siswa) => {
    if (confirm(`Reset sesi login untuk ${student.name}? Ini memungkinkan siswa login ulang jika perangkat bermasalah.`)) {
      CBTStorage.updateStudentStatus(student.id, 'BELUM_MULAI', {
        violationCount: 0,
      });
      onUpdateStudents(CBTStorage.getStudents());
    }
  };

  const handleForceSubmit = (student: Siswa) => {
    if (confirm(`Paksa kumpulkan ujian peserta ${student.name}? Jawaban tersimpan akan dikunci.`)) {
      CBTStorage.updateStudentStatus(student.id, 'SELESAI', {
        finishedAt: new Date().toLocaleTimeString('id-ID'),
      });
      onUpdateStudents(CBTStorage.getStudents());
    }
  };

  const handleSaveSignature = (dataUrl: string) => {
    const updated: BeritaAcaraData = {
      ...beritaAcara,
      proctorSignatureUrl: dataUrl,
    };
    setBeritaAcara(updated);
    CBTStorage.saveBeritaAcara(updated);
  };

  const handleSaveBeritaAcara = (e: React.FormEvent) => {
    e.preventDefault();
    CBTStorage.saveBeritaAcara(beritaAcara);
  };

  const stats = {
    total: students.length,
    active: students.filter(s => s.status === 'SEDANG_MENGERJAKAN').length,
    finished: students.filter(s => s.status === 'SELESAI').length,
    flagged: students.filter(s => s.status === 'TERINDIKASI_CURANG' || (s.violationCount && s.violationCount > 0)).length,
  };

  return (
    <div className="space-y-6 relative">
      {/* Real-Time Violation Toast Alert Stack (Top-Right Floating) */}
      <div className="fixed top-20 right-4 z-50 flex flex-col space-y-3 max-w-md w-full pointer-events-none no-print">
        {activeAlerts.map(alert => {
          const isCritical = alert.incident.severity === 'CRITICAL' || (alert.student?.violationCount || 0) >= 3;

          return (
            <div
              key={alert.id}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl border-2 transition-all duration-300 animate-in slide-in-from-right-6 fade-in ${
                isCritical
                  ? 'bg-rose-900/95 text-white border-rose-500 backdrop-blur-md shadow-rose-900/40'
                  : 'bg-slate-900/95 text-white border-amber-500 backdrop-blur-md shadow-amber-900/30'
              }`}
            >
              {/* Alert Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15 text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                  </span>
                  <span className="font-extrabold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                    <BellRing className="w-3.5 h-3.5 animate-bounce" />
                    Peringatan Instan Pelanggaran Layar!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400">{alert.receivedAt}</span>
                  <button
                    type="button"
                    onClick={() => dismissAlert(alert.id)}
                    className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
                    title="Tutup Notifikasi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Alert Body */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-black text-sm text-white leading-tight">
                      {alert.incident.studentName}
                    </h4>
                    <p className="text-slate-300 text-[11px]">
                      {alert.student?.classRoom || 'Kelas Peserta'} • {alert.student?.major || 'SMK'} • NISN: {alert.student?.nisn || '-'}
                    </p>
                  </div>
                  <span
                    className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-md ${
                      isCritical ? 'bg-rose-500 text-white animate-pulse' : 'bg-amber-500 text-slate-950 font-bold'
                    }`}
                  >
                    {alert.student?.violationCount || 1}x Peringatan
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-black/30 border border-white/10 text-[11px] leading-relaxed text-slate-200">
                  <span className="font-bold text-amber-300 block mb-0.5">
                    Jenis Pelanggaran: {alert.incident.type}
                  </span>
                  {alert.incident.description}
                </div>

                {/* Instant Actions on Toast */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  {alert.student && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          handleWarnStudent(alert.student!);
                          dismissAlert(alert.id);
                        }}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition"
                      >
                        Kirim Teguran
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleForceSubmit(alert.student!);
                          dismissAlert(alert.id);
                        }}
                        className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white transition"
                      >
                        Kunci Ujian
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => dismissAlert(alert.id)}
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold text-slate-300 hover:bg-white/10 transition"
                  >
                    Abaikan
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Laptop className="w-5 h-5 text-indigo-600" />
              Dashboard Pengawas Ujian Real-Time (Proctor Center)
            </h2>
            {/* Audio Alarm Toggle */}
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playViolationChime();
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition border ${
                soundEnabled
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-500 border-slate-300'
              }`}
              title="Aktifkan / Bisukan suara alarm notifikasi pelanggaran"
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{soundEnabled ? 'Alarm Suara: Aktif' : 'Alarm: Bisu'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Notifikasi instan saat siswa berpindah tab/layar, deteksi kecurangan otomatis, dan pengesahan Berita Acara
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Simulation Trigger Button for Teacher/Demo */}
          <button
            type="button"
            onClick={handleTestSimulateViolation}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition shadow-xs flex items-center gap-1.5"
            title="Uji coba notifikasi toast dan suara peringatan pelanggaran siswa secara instan"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Simulasi Pelanggaran Siswa</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MONITOR')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'MONITOR'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Daftar Peserta Aktif ({students.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INCIDENTS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 relative ${
              activeTab === 'INCIDENTS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Log Insiden ({incidents.length})
            {incidents.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1 right-1"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BERITA_ACARA')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'BERITA_ACARA'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Berita Acara & Absensi
          </button>
        </div>
      </div>

      {/* Real-time KPI Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Total Peserta Terdaftar</span>
            <span className="font-mono text-2xl font-black text-slate-900 mt-1 block">
              {stats.total}
            </span>
          </div>
          <Users className="w-8 h-8 text-indigo-500 opacity-30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Sedang Mengerjakan</span>
            <span className="font-mono text-2xl font-black text-indigo-600 mt-1 block">
              {stats.active}
            </span>
          </div>
          <Clock className="w-8 h-8 text-indigo-600 opacity-30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Ujian Selesai</span>
            <span className="font-mono text-2xl font-black text-emerald-600 mt-1 block">
              {stats.finished}
            </span>
          </div>
          <CheckCircle className="w-8 h-8 text-emerald-500 opacity-30" />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 block text-[11px]">Terindikasi Curang</span>
            <span className="font-mono text-2xl font-black text-rose-600 mt-1 block">
              {stats.flagged}
            </span>
          </div>
          <ShieldAlert className="w-8 h-8 text-rose-600 opacity-40 animate-pulse" />
        </div>
      </div>

      {/* TAB 1: LIVE PARTICIPANTS MONITOR */}
      {activeTab === 'MONITOR' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Pemantauan Koneksi & Layar Peserta Secara Langsung</span>
            </div>
            <span className="text-xs text-slate-500">
              Ruang: <strong>{examConfig.roomName}</strong>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3.5">NISN & Nama Peserta</th>
                  <th className="p-3.5">Kelas / Jurusan</th>
                  <th className="p-3.5">Status Pengerjaan</th>
                  <th className="p-3.5">Perangkat & IP</th>
                  <th className="p-3.5 text-center">Teguran Layar</th>
                  <th className="p-3.5 text-center">Nilai Sementara</th>
                  <th className="p-3.5 text-right">Tindakan Pengawas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map(s => {
                  let statusBadge = (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                      Belum Mulai
                    </span>
                  );
                  if (s.status === 'SEDANG_MENGERJAKAN') {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
                        Mengerjakan ({s.startedAt})
                      </span>
                    );
                  } else if (s.status === 'SELESAI') {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Selesai ({s.finishedAt || 'Lengkap'})
                      </span>
                    );
                  } else if (s.status === 'TERINDIKASI_CURANG') {
                    statusBadge = (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 animate-pulse border border-rose-300">
                        Terindikasi Curang
                      </span>
                    );
                  }

                  return (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900">{s.name}</div>
                        <div className="font-mono text-slate-500 text-[11px]">{s.nisn}</div>
                      </td>
                      <td className="p-3.5 font-medium text-slate-700">
                        {s.classRoom} • <span className="font-bold text-indigo-700">{s.major}</span>
                      </td>
                      <td className="p-3.5">{statusBadge}</td>
                      <td className="p-3.5 text-slate-500 text-[11px]">
                        {s.deviceInfo || 'Browser Client'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                            s.violationCount === 0
                              ? 'bg-slate-100 text-slate-600'
                              : s.violationCount < 3
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800 font-extrabold border border-rose-400'
                          }`}
                        >
                          {s.violationCount}x
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                        {s.score !== undefined ? `${s.score}` : '-'}
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleWarnStudent(s)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition"
                            title="Kirim teguran ke layar siswa"
                          >
                            Tegur
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetSession(s)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                            title="Reset sesi login peserta"
                          >
                            Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForceSubmit(s)}
                            className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                            title="Kumpulkan ujian sekarang"
                          >
                            Kunci
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: REAL-TIME INCIDENT STREAM */}
      {activeTab === 'INCIDENTS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                Catatan Insiden & Pelanggaran Sistem Anti-Kecurangan
              </h3>
              <p className="text-xs text-slate-500">
                Peringatan tab switch, jendela blur, pemotongan layar, dan keluar dari layar penuh
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem('cbt_smk_incidents');
                setIncidents([]);
              }}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Bersihkan Riwayat Log
            </button>
          </div>

          {incidents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Belum ada insiden kecurangan yang terdeteksi. Sistem berjalan normal dan aman.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {incidents.map(inc => (
                <div
                  key={inc.id}
                  className={`p-3.5 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
                    inc.severity === 'CRITICAL'
                      ? 'bg-rose-50/80 border-rose-300 text-rose-950'
                      : 'bg-amber-50/80 border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                      inc.severity === 'CRITICAL' ? 'text-rose-600' : 'text-amber-600'
                    }`} />
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        <span>{inc.studentName}</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-black/10">
                          {inc.type}
                        </span>
                      </div>
                      <p className="text-slate-700 mt-0.5 leading-relaxed">{inc.description}</p>
                    </div>
                  </div>

                  <span className="font-mono text-[11px] text-slate-500 shrink-0 font-medium">
                    {inc.timestamp}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFICIAL BERITA ACARA & ABSENSI PESERTA (PRINTABLE) */}
      {activeTab === 'BERITA_ACARA' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex items-center justify-between no-print">
            <span className="text-xs text-slate-500">
              Format Berita Acara & Daftar Hadir Resmi SMK sesuai Permendikbudristek
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition"
            >
              <Printer className="w-4 h-4" /> Cetak / Unduh Dokumen PDF
            </button>
          </div>

          {/* Document Body (Printable Area) */}
          <div className="bg-white border-2 border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm print-area max-w-4xl mx-auto space-y-6 font-serif text-slate-900">
            {/* Kop Surat Resmi */}
            <div className="border-b-4 border-double border-slate-900 pb-4 text-center">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                PEMERINTAH DAERAH PROVINSI JAWA BARAT - DINAS PENDIDIKAN
              </h4>
              <h2 className="text-lg md:text-xl font-black uppercase text-slate-900 tracking-tight mt-0.5">
                {beritaAcara.schoolName}
              </h2>
              <p className="text-[11px] text-slate-600 font-sans">
                Jalan Dirgantara No. 45, Bandung • Telp (022) 7891234 • Email: cbt@smkwidyadirgantara.sch.id
              </p>
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-base md:text-lg uppercase tracking-wide underline underline-offset-4 font-sans">
                BERITA ACARA PELAKSANAAN UJIAN CBT
              </h3>
              <p className="text-xs font-sans text-slate-600">
                Tahun Ajaran 2025/2026 • Nomor: 421.5/BA-CBT/{examConfig.id}
              </p>
            </div>

            {/* Narasi Berita Acara */}
            <div className="text-xs md:text-sm font-sans leading-relaxed text-slate-800 space-y-2">
              <p>
                Pada hari ini <strong>Selasa</strong> tanggal <strong>{beritaAcara.date}</strong>, telah diselenggarakan Ujian Berbasis Komputer (CBT) Mandiri untuk:
              </p>
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-300 font-mono text-xs">
                <div>
                  <span className="text-slate-500">Mata Pelajaran:</span>{' '}
                  <strong className="text-slate-900">{examConfig.subject}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Ruang / Lab:</span>{' '}
                  <strong className="text-slate-900">{beritaAcara.room}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Waktu Ujian:</span>{' '}
                  <strong className="text-slate-900">{beritaAcara.startTime} s.d. {beritaAcara.endTime}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Status Keamanan:</span>{' '}
                  <strong className="text-emerald-700">Anti-Kecurangan & Kunci Layar Aktif</strong>
                </div>
              </div>
            </div>

            {/* Attendance & Participant Breakdown */}
            <div className="space-y-3 font-sans">
              <h4 className="font-bold text-xs uppercase tracking-wide text-slate-800">
                I. Absensi dan Kehadiran Peserta Ujian:
              </h4>

              <div className="overflow-x-auto border border-slate-300 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-bold border-b border-slate-300">
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5">NISN</th>
                      <th className="p-2.5">Nama Lengkap Siswa</th>
                      <th className="p-2.5">Kelas</th>
                      <th className="p-2.5 text-center">Kehadiran</th>
                      <th className="p-2.5 text-center">Status Tanda Tangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {beritaAcara.attendanceList.map((item, idx) => (
                      <tr key={item.studentId}>
                        <td className="p-2 text-center text-slate-500">{idx + 1}</td>
                        <td className="p-2 font-mono font-bold">{item.nisn}</td>
                        <td className="p-2 font-semibold text-slate-900">{item.name}</td>
                        <td className="p-2">{item.classRoom}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.attendance === 'HADIR'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {item.attendance}
                          </span>
                        </td>
                        <td className="p-2 text-center font-mono text-[11px] text-slate-600">
                          {item.signed ? '✓ Terverifikasi Digital' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Notes / Special Incidents */}
            <div className="space-y-1.5 font-sans text-xs">
              <h4 className="font-bold uppercase tracking-wide text-slate-800">
                II. Catatan Khusus Kejadian Ujian & Pelanggaran:
              </h4>
              <textarea
                rows={2}
                value={beritaAcara.notes}
                onChange={e => setBeritaAcara({ ...beritaAcara, notes: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs"
              />
            </div>

            {/* Signature Block (Proctor & Supervisor) */}
            <div className="grid grid-cols-2 gap-8 pt-4 font-sans text-xs border-t border-slate-300">
              <div className="text-center space-y-2">
                <span className="text-slate-600 block">Mengetahui / Penanggung Jawab,</span>
                <span className="font-bold text-slate-800 block">Ketua Panitia Ujian SMK</span>
                <div className="h-20 flex items-center justify-center italic text-slate-400">
                  (Tertanda Panitia)
                </div>
                <div className="font-bold underline text-slate-900">
                  {beritaAcara.supervisorName}
                </div>
                <div className="text-[10px] text-slate-500">NIP. 19780315 200501 2 004</div>
              </div>

              <div className="text-center space-y-2">
                <span className="text-slate-600 block">Bandung, {beritaAcara.date}</span>
                <span className="font-bold text-slate-800 block">Pengawas Ruang Ujian</span>

                {/* Digital Signature Display / Pad */}
                <div className="h-24 flex items-center justify-center">
                  {beritaAcara.proctorSignatureUrl ? (
                    <img
                      src={beritaAcara.proctorSignatureUrl}
                      alt="Tanda Tangan Pengawas"
                      className="max-h-20 object-contain mx-auto"
                    />
                  ) : (
                    <div className="border border-dashed border-slate-300 rounded-lg p-2 text-slate-400 text-[10px] no-print">
                      Silakan goreskan tanda tangan pada panel di bawah
                    </div>
                  )}
                </div>

                <div className="font-bold underline text-slate-900">
                  {beritaAcara.proctorName}
                </div>
                <div className="text-[10px] text-slate-500">NIP. {beritaAcara.proctorNip}</div>
              </div>
            </div>

            {/* Direct Screen Signature Pad Input */}
            <div className="no-print pt-4 border-t border-slate-200">
              <SignaturePad
                initialSignature={beritaAcara.proctorSignatureUrl}
                onSave={handleSaveSignature}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
