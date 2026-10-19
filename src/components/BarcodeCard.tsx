import React from 'react';
import { Siswa, ExamConfig } from '../types/cbt';

interface BarcodeCardProps {
  student: Siswa;
  examConfig: ExamConfig;
  onPrint?: () => void;
}

/**
 * Generate a deterministic SVG Code128 style barcode based on student NISN
 */
export const BarcodeSvg: React.FC<{ value: string; className?: string }> = ({ value, className = '' }) => {
  // Generate consistent bar widths based on value char codes
  const bars: { width: number; isBlack: boolean }[] = [];
  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 2, isBlack: false });
  bars.push({ width: 2, isBlack: true });
  bars.push({ width: 1, isBlack: false });

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const pattern = [(code % 3) + 1, ((code >> 1) % 2) + 1, ((code >> 2) % 3) + 1, 1];
    pattern.forEach((w, idx) => {
      bars.push({ width: w * 1.5, isBlack: idx % 2 === 0 });
    });
  }

  bars.push({ width: 3, isBlack: true });
  bars.push({ width: 1, isBlack: false });
  bars.push({ width: 3, isBlack: true });

  let currentX = 10;
  const height = 40;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg className="h-10 w-44" viewBox="0 0 180 40">
        {bars.map((bar, idx) => {
          const x = currentX;
          currentX += bar.width;
          if (!bar.isBlack) return null;
          return <rect key={idx} x={x} y={0} width={bar.width} height={height} fill="#1e293b" />;
        })}
      </svg>
      <span className="font-mono text-[11px] tracking-widest text-slate-700 font-bold mt-0.5">
        *{value}*
      </span>
    </div>
  );
};

export const BarcodeCard: React.FC<BarcodeCardProps> = ({ student, examConfig }) => {
  const isLunas = student.financialStatus === 'LUNAS';
  const isDispensasi = student.financialStatus === 'DISPENSASI';

  return (
    <div className="bg-white border-2 border-slate-700 rounded-lg p-3 text-slate-800 shadow-sm relative overflow-hidden flex flex-col justify-between max-w-sm w-full font-sans print:shadow-none print:border-black print:m-1">
      {/* Header Kop Kartu */}
      <div className="border-b-2 border-slate-800 pb-2 mb-2 flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-indigo-700 text-white flex items-center justify-center font-bold text-xs shrink-0 border border-slate-900">
          SMK
        </div>
        <div className="leading-tight flex-1">
          <h4 className="font-extrabold text-[12px] uppercase tracking-tight text-slate-900">
            SMK WIDYA DIRGANTARA
          </h4>
          <p className="text-[10px] text-slate-600 font-medium">KARTU PESERTA CBT ONLINE 2026</p>
          <p className="text-[9px] text-indigo-700 font-bold uppercase">{examConfig.title}</p>
        </div>
      </div>

      {/* Body: Photo & Details */}
      <div className="grid grid-cols-3 gap-2 text-[11px] my-1">
        <div className="col-span-1 flex flex-col items-center justify-center bg-slate-100 rounded border border-slate-300 p-1">
          <div className="w-16 h-20 bg-slate-200 border border-slate-300 rounded flex flex-col items-center justify-center text-slate-400 text-[10px] text-center overflow-hidden">
            <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            <span className="text-[8px] text-slate-500 font-semibold mt-0.5">FOTO 3x4</span>
          </div>
          <span className="text-[9px] font-bold text-indigo-800 mt-1">{student.major}</span>
        </div>

        <div className="col-span-2 space-y-1">
          <div>
            <span className="text-[9px] text-slate-500 block">Nama Peserta:</span>
            <span className="font-bold text-[12px] text-slate-900 leading-tight block truncate">
              {student.name}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div>
              <span className="text-[9px] text-slate-500 block">NISN:</span>
              <span className="font-mono font-bold text-slate-800">{student.nisn}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block">Kelas:</span>
              <span className="font-bold text-slate-800">{student.classRoom}</span>
            </div>
          </div>
          <div className="bg-slate-50 p-1.5 rounded border border-slate-200 mt-1">
            <div className="flex justify-between items-center text-[10px]">
              <span className="text-slate-500">Password CBT:</span>
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1 rounded border border-indigo-200">
                {student.password}
              </span>
            </div>
            <div className="flex justify-between items-center text-[9px] mt-1">
              <span className="text-slate-500">Status Keuangan:</span>
              <span
                className={`font-bold px-1 rounded text-[8px] ${
                  isLunas
                    ? 'bg-emerald-100 text-emerald-800'
                    : isDispensasi
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {student.financialStatus}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode & Security Stempel */}
      <div className="mt-2 pt-2 border-t border-dashed border-slate-300 flex items-center justify-between">
        <BarcodeSvg value={student.nisn} />
        <div className="text-right">
          <div className="w-12 h-12 border-2 border-indigo-600 rounded-full flex flex-col items-center justify-center text-[7px] text-indigo-700 font-bold rotate-[-12deg] opacity-80 select-none">
            <span>VERIFIED</span>
            <span>CBT SMK</span>
            <span>2026</span>
          </div>
        </div>
      </div>
    </div>
  );
};
