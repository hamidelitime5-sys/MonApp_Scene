import React from 'react';
import { ListMusic, Music, Play, Sliders, Clock, Upload, Download, Monitor } from 'lucide-react';
import { Setlist } from '../types';
import { StageCircumstancesSelector } from './StageCircumstancesSelector';

export type ActiveTab = 'setlists' | 'songs' | 'stage' | 'tools' | 'import';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  setlists: Setlist[];
  activeSetlistId: string | null;
  setActiveSetlistId: (id: string) => void;
  onLaunchStageMode: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal?: () => void;
  onOpenDesktopModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  setlists,
  activeSetlistId,
  setActiveSetlistId,
  onLaunchStageMode,
  onOpenImportModal,
  onOpenExportModal,
  onOpenDesktopModal,
}) => {
  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-900/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand with User's Chimera Creature in Grand Format */}
          <div className="flex items-center gap-3 sm:gap-4 cursor-pointer group" onClick={() => setActiveTab('setlists')}>
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-24 sm:w-28 rounded-xl bg-white border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden flex items-center justify-center p-1 group-hover:border-orange-500 transition-all">
                <img
                  src="/logo-wide.jpg"
                  alt="Hamide Litime Software Logo Grand Format"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.jpg';
                  }}
                />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-900 dark:text-white font-extrabold tracking-tight text-sm sm:text-base leading-tight group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    Hamide Litime Software
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 border border-orange-300/60 dark:border-orange-500/30">
                    Pro
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                  Stage Prompter &amp; Studio MIDI
                </span>
              </div>
            </div>

            {activeSetlist && (
              <>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-zinc-800 hidden md:block"></div>
                <div className="hidden md:flex flex-col">
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-widest">
                    Setlist Actuelle
                  </span>
                  <span className="text-xs text-slate-800 dark:text-white font-bold truncate max-w-[160px]">
                    {activeSetlist.name}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('setlists')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'setlists'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/40 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80'
              }`}
            >
              <ListMusic className="w-3.5 h-3.5 text-orange-500" />
              <span>Setlists</span>
            </button>

            <button
              onClick={() => setActiveTab('songs')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'songs'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/40 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80'
              }`}
            >
              <Music className="w-3.5 h-3.5 text-orange-500" />
              <span>Chansons</span>
            </button>

            <button
              onClick={() => setActiveTab('tools')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'tools'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/40 shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800/80'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-orange-500" />
              <span className="hidden md:inline">Outils & Métronome</span>
              <span className="md:hidden">Outils</span>
            </button>

            <button
              onClick={onOpenImportModal}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-500/40 hover:bg-orange-100 dark:hover:bg-orange-500/30 transition cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span className="hidden sm:inline">Importer (.msb/.pdf)</span>
              <span className="sm:hidden">Importer</span>
            </button>

            {onOpenExportModal && (
              <button
                onClick={onOpenExportModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-300 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-slate-900 dark:hover:text-white transition cursor-pointer shadow-xs"
                title="Exporter vos chansons et setlists vers MobileSheets (.msb / .msf)"
              >
                <Download className="w-3.5 h-3.5 text-orange-500" />
                <span className="hidden sm:inline">Exporter (.msb)</span>
                <span className="sm:hidden">Export</span>
              </button>
            )}

            {onOpenDesktopModal && (
              <button
                onClick={onOpenDesktopModal}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 hover:text-blue-900 dark:hover:text-white transition cursor-pointer shadow-xs"
                title="Application Native Desktop Windows 11 (Tauri v2)"
              >
                <Monitor className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Windows 11 (Tauri)</span>
                <span className="sm:hidden">Win 11</span>
              </button>
            )}
          </nav>

          {/* Stage Circumstances Selector (3 Themes) & Quick Stage View Trigger */}
          <div className="flex items-center gap-3">
            {/* Live Stage Circumstances Selector */}
            <StageCircumstancesSelector />

            {setlists.length > 0 && (
              <div className="hidden lg:flex items-center gap-2 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 px-2.5 py-1.5 rounded-lg shadow-xs">
                <Clock className="w-3.5 h-3.5 text-orange-500" />
                <select
                  value={activeSetlistId || ''}
                  onChange={(e) => setActiveSetlistId(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 dark:text-zinc-300 font-semibold focus:outline-none cursor-pointer"
                >
                  {setlists.map((s) => (
                    <option key={s.id} value={s.id} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                      {s.name} ({s.entries.length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={onLaunchStageMode}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md hover:shadow-lg active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>MODE SCÈNE</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

