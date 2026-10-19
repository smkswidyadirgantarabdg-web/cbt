import React from 'react';

interface ArabicRendererProps {
  text: string;
  className?: string;
  translation?: string;
}

/**
 * High-quality Arabic and Quranic script renderer with Amiri font and full RTL typography
 */
export const ArabicRenderer: React.FC<ArabicRendererProps> = ({
  text,
  className = '',
  translation,
}) => {
  if (!text) return null;

  return (
    <div className={`my-3 p-4 bg-emerald-50/60 border border-emerald-200/90 rounded-xl ${className}`}>
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200/60 text-xs font-semibold uppercase tracking-wider text-emerald-800">
        <span className="flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          Naskah Ayat Al-Qur'an / Teks Arab
        </span>
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[11px]">Amiri Regular</span>
      </div>

      <div
        dir="rtl"
        className="font-arabic text-2xl md:text-3xl text-emerald-950 font-normal py-2 px-1 text-right selection:bg-emerald-200 leading-[2.4]"
      >
        {text}
      </div>

      {translation && (
        <div className="mt-2 pt-2 border-t border-emerald-200/50 text-xs italic text-emerald-900/80">
          Artinya: "{translation}"
        </div>
      )}
    </div>
  );
};
