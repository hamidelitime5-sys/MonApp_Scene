import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Sun, Moon, Sparkles } from 'lucide-react';
import { useTheme, StageCircumstanceTheme } from '../context/ThemeContext';
import { STAGE_THEMES } from '../theme/theme';

interface StageCircumstancesSelectorProps {
  isStageView?: boolean;
  className?: string;
}

export const StageCircumstancesSelector: React.FC<StageCircumstancesSelectorProps> = ({
  isStageView = false,
  className = '',
}) => {
  const { theme, setTheme, themeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const themesList = Object.values(STAGE_THEMES);

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Main Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border shadow-xs ${
          isStageView
            ? 'bg-zinc-900 hover:bg-zinc-800 text-white border-zinc-700 hover:border-amber-500/60'
            : theme === 'stage_light'
            ? 'bg-white hover:bg-slate-100 text-black border-slate-300 shadow-sm'
            : theme === 'studio_slate'
            ? 'bg-slate-800/90 hover:bg-slate-700 text-sky-200 border-slate-700 shadow-sm'
            : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-100 border-zinc-800 shadow-sm'
        }`}
        title="Changer les Circonstances de Scène (Plein Soleil, Scène Sombre, Studio)"
      >
        <span className="text-sm leading-none">{themeConfig.emoji}</span>
        <span className="font-extrabold uppercase tracking-wider hidden sm:inline text-[11px]">
          {themeConfig.shortName}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl p-2.5 shadow-2xl z-50 animate-fade-in border ${
            theme === 'stage_light'
              ? 'bg-white border-slate-300 text-black shadow-slate-400/40'
              : theme === 'studio_slate'
              ? 'bg-slate-900 border-slate-700 text-white shadow-slate-950/80'
              : 'bg-[#18181c] border-zinc-800 text-white shadow-black/80'
          }`}
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-zinc-800/60 dark:border-zinc-800 mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400 dark:text-zinc-500">
              Circonstances de Scène
            </span>
            <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Live Ready
            </span>
          </div>

          {/* Theme Option Cards */}
          <div className="space-y-1.5">
            {themesList.map((item) => {
              const isSelected = theme === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTheme(item.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-start gap-3 border ${
                    isSelected
                      ? item.id === 'stage_light'
                        ? 'bg-amber-100 border-amber-400 text-black font-extrabold shadow-sm'
                        : item.id === 'studio_slate'
                        ? 'bg-sky-950/60 border-sky-500 text-white font-bold shadow-md shadow-sky-900/30'
                        : 'bg-amber-950/40 border-amber-500 text-white font-bold shadow-md shadow-amber-950/50'
                      : 'border-transparent hover:bg-zinc-800/40 dark:hover:bg-zinc-800/50 text-zinc-300'
                  }`}
                >
                  <span className="text-xl p-1 rounded-lg bg-black/20 flex-shrink-0">
                    {item.emoji}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black tracking-tight leading-tight">
                        {item.name}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                    </div>

                    <span className="text-[11px] block text-amber-500 dark:text-amber-400 font-semibold mt-0.5">
                      {item.subtitle}
                    </span>

                    <p className="text-[10px] opacity-75 mt-0.5 line-clamp-2 leading-tight text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer explanation */}
          <div className="mt-2 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-400 px-2 flex items-center justify-between">
            <span>Raccourci scène instantané</span>
            <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-300">
              Auto-mémorisé
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
