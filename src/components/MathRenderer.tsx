import React from 'react';

interface MathRendererProps {
  formula: string;
  className?: string;
}

/**
 * Clean Mathematical Formula Formatter
 * Beautifully formats matrix, superscripts, fractions, square roots and variables
 */
export const MathRenderer: React.FC<MathRendererProps> = ({ formula, className = '' }) => {
  if (!formula) return null;

  // Render 2x2 matrix if matrix syntax detected
  if (formula.includes('\\begin{pmatrix}')) {
    const matrixMatch = formula.match(/\\begin{pmatrix}\s*([^\\]+)\\\\\s*([^\\]+)\s*\\end{pmatrix}/);
    if (matrixMatch) {
      const row1 = matrixMatch[1].split('&').map(s => s.trim());
      const row2 = matrixMatch[2].split('&').map(s => s.trim());
      const prefix = formula.split('=')[0]?.trim() || 'A';

      return (
        <div className={`inline-flex items-center gap-3 my-2 px-4 py-2 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-indigo-950 font-serif text-lg ${className}`}>
          <span className="font-semibold italic">{prefix} =</span>
          <div className="inline-flex items-stretch">
            <span className="text-3xl font-light text-indigo-700 leading-none select-none">[</span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-2 text-center font-bold">
              <span>{row1[0]}</span>
              <span>{row1[1]}</span>
              <span>{row2[0]}</span>
              <span>{row2[1]}</span>
            </div>
            <span className="text-3xl font-light text-indigo-700 leading-none select-none">]</span>
          </div>
        </div>
      );
    }
  }

  // Format fractions or standard equations
  const formatted = formula
    .replace(/\\cdot/g, ' · ')
    .replace(/\\quad/g, '   ')
    .replace(/\\text{([^}]+)}/g, '$1')
    .replace(/\\times/g, ' × ')
    .replace(/\\approx/g, ' ≈ ')
    .replace(/\\le/g, ' ≤ ')
    .replace(/\\ge/g, ' ≥ ')
    .replace(/\\neq/g, ' ≠ ')
    .replace(/_([a-zA-Z0-9]+)/g, '<sub>$1</sub>')
    .replace(/\^([a-zA-Z0-9\+\-]+)/g, '<sup>$1</sup>')
    .replace(/\^{([^}]+)}/g, '<sup>$1</sup>')
    .replace(/\\sqrt{([^}]+)}/g, '√($1)');

  return (
    <div
      className={`inline-block my-2 px-3 py-1.5 bg-slate-100/90 border border-slate-300 rounded-md font-serif text-slate-800 text-lg tracking-wide ${className}`}
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  );
};
