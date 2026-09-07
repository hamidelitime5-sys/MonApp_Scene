import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Youtube,
  Search,
  Volume2,
  Music,
  Sparkles,
  Disc,
  X,
  Bookmark,
  Radio,
  Sliders,
  Maximize2,
  Minimize2,
  Zap,
} from 'lucide-react';
import { Song } from '../types';
import { DRUM_GROOVES, DrumGrooveStyle, rhythmEngine } from '../utils/audioEngine';

interface JamTrackPlayerProps {
  currentSong?: Song;
  onSaveJamTrackToSong?: (jamTrackUrl: string, jamTrackStyle?: string) => void;
  onClose?: () => void;
  mode?: 'modal' | 'dock' | 'compact';
  isAutoScrolling?: boolean;
  onToggleAutoScroll?: () => void;
  onMasterPlayToggle?: (isPlaying: boolean) => void;
}

// Preset Jam Tracks on YouTube / Audio Streams
const JAM_TRACK_PRESETS = [
  {
    title: 'Couleur Café - Backing Track & Percussions (G / Sol)',
    key: 'G',
    bpm: 110,
    genre: 'Afro-Cubain / Chanson',
    youtubeId: 'qQ25Vq2wQio',
    url: 'https://www.youtube.com/watch?v=qQ25Vq2wQio',
    recommendedFor: 'Couleur Café',
  },
  {
    title: 'Slow Blues backing track en La mineur (Am)',
    key: 'Am',
    bpm: 72,
    genre: 'Blues',
    youtubeId: '333K162vK9Y',
    url: 'https://www.youtube.com/watch?v=333K162vK9Y',
  },
  {
    title: 'Funky Groovy Backing Track en Ré mineur (Dm)',
    key: 'Dm',
    bpm: 105,
    genre: 'Funk',
    youtubeId: 'W8fFzF8G8Qc',
    url: 'https://www.youtube.com/watch?v=W8fFzF8G8Qc',
  },
  {
    title: 'Acoustic Pop Ballad en Do majeur (C)',
    key: 'C',
    bpm: 85,
    genre: 'Pop / Acoustique',
    youtubeId: 'k4V3Mo61fJM',
    url: 'https://www.youtube.com/watch?v=k4V3Mo61fJM',
  },
  {
    title: 'Hard Rock Backing Track en Mi mineur (Em)',
    key: 'Em',
    bpm: 128,
    genre: 'Rock',
    youtubeId: 'r53m1K9Y0E0',
    url: 'https://www.youtube.com/watch?v=r53m1K9Y0E0',
  },
  {
    title: 'Jazz Swing II-V-I en Sol majeur (G)',
    key: 'G',
    bpm: 140,
    genre: 'Jazz',
    youtubeId: '2b7A6Bv0N2U',
    url: 'https://www.youtube.com/watch?v=2b7A6Bv0N2U',
  },
];

// Extract YouTube ID from URL or input string
function getYouTubeId(input: string): string | null {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
    return input.trim();
  }
  const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : null;
}

export const JamTrackPlayer: React.FC<JamTrackPlayerProps> = ({
  currentSong,
  onSaveJamTrackToSong,
  onClose,
  mode = 'modal',
  isAutoScrolling,
  onToggleAutoScroll,
  onMasterPlayToggle,
}) => {
  const [customInput, setCustomInput] = useState(currentSong?.jamTrackUrl || '');
  const [activeYoutubeId, setActiveYoutubeId] = useState<string | null>(() => {
    return getYouTubeId(currentSong?.jamTrackUrl || '') || JAM_TRACK_PRESETS[0].youtubeId;
  });
  const [activeStyleName, setActiveStyleName] = useState<string>(
    currentSong?.jamTrackStyle || 'Afro-Cubain / Latin'
  );

  // Tab: 'rhythm' (drum machine accompaniment) vs 'youtube' (internet backing track)
  const [activeTab, setActiveTab] = useState<'rhythm' | 'youtube'>('rhythm');

  // Rhythm accompaniment engine state
  const [isRhythmPlaying, setIsRhythmPlaying] = useState(false);
  const [selectedGroove, setSelectedGroove] = useState<DrumGrooveStyle>(() => {
    if (currentSong?.title?.toLowerCase().includes('café') || currentSong?.tags?.includes('Afro-Cubain')) {
      return 'latin_afrocuban';
    }
    return 'latin_afrocuban';
  });
  const [rhythmBpm, setRhythmBpm] = useState(currentSong?.bpm || 110);
  const [rhythmVolume, setRhythmVolume] = useState(0.8);
  const [currentStep, setCurrentStep] = useState<{ step: number; totalSteps: number; isAccent: boolean; beatNumber: number } | null>(null);

  // Sync engine settings
  useEffect(() => {
    rhythmEngine.setBpm(rhythmBpm);
  }, [rhythmBpm]);

  useEffect(() => {
    rhythmEngine.setStyle(selectedGroove);
  }, [selectedGroove]);

  useEffect(() => {
    rhythmEngine.setVolume(rhythmVolume);
  }, [rhythmVolume]);

  useEffect(() => {
    rhythmEngine.setStepCallback((step, totalSteps, isAccent, beatNumber) => {
      setCurrentStep({ step, totalSteps, isAccent, beatNumber });
    });
  }, []);

  // Update when current song changes
  useEffect(() => {
    if (currentSong) {
      if (currentSong.bpm) {
        setRhythmBpm(currentSong.bpm);
      }
      if (currentSong.jamTrackUrl) {
        const ytId = getYouTubeId(currentSong.jamTrackUrl);
        if (ytId) setActiveYoutubeId(ytId);
      }
      if (currentSong.title.toLowerCase().includes('café')) {
        setSelectedGroove('latin_afrocuban');
      }
    }
  }, [currentSong]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      rhythmEngine.stop();
    };
  }, []);

  const toggleRhythm = () => {
    const isPlaying = rhythmEngine.toggle();
    setIsRhythmPlaying(isPlaying);
    if (onMasterPlayToggle) {
      onMasterPlayToggle(isPlaying);
    }
  };

  const handleLoadCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const ytId = getYouTubeId(customInput);
    if (ytId) {
      setActiveYoutubeId(ytId);
      setActiveStyleName(`Jam Track (${currentSong?.title || 'Perso'})`);
    } else if (customInput.trim().length > 0) {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        customInput + ' backing track jam'
      )}`;
      window.open(searchUrl, '_blank');
    }
  };

  const handleSelectPreset = (preset: typeof JAM_TRACK_PRESETS[0]) => {
    setActiveYoutubeId(preset.youtubeId);
    setActiveStyleName(`${preset.genre} ${preset.key}`);
    setCustomInput(preset.url);
    if (preset.bpm) setRhythmBpm(preset.bpm);
  };

  const isDocked = mode === 'dock';

  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 text-zinc-300 shadow-2xl overflow-hidden flex flex-col ${
        isDocked
          ? 'h-full w-full rounded-none border-l'
          : 'rounded-xl max-w-4xl w-full mx-auto max-h-[90vh]'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between p-4 bg-zinc-950 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-orange-500/10 border border-orange-500/30 rounded flex items-center justify-center text-orange-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Jam Track & Accompagnement Rythmique
            </h3>
            <p className="text-[11px] text-zinc-400">
              {currentSong ? `${currentSong.title} (${currentSong.key} • ${rhythmBpm} BPM)` : 'Accompagnement en direct'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Tabs */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5">
            <button
              onClick={() => setActiveTab('rhythm')}
              className={`px-3 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 ${
                activeTab === 'rhythm'
                  ? 'bg-orange-500 text-black shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Batterie & Groove</span>
            </button>

            <button
              onClick={() => setActiveTab('youtube')}
              className={`px-3 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 ${
                activeTab === 'youtube'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span>Backing Track YouTube</span>
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded ml-2"
              title="Fermer le volet Jam Track"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
        
        {/* TAB 1: Real-time Audio Drum & Groove Engine */}
        {activeTab === 'rhythm' && (
          <div className="space-y-4">
            {/* Big Control Card */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-5 space-y-4 shadow-inner">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-400" /> Boîte à Rythmes & Battement Live
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Génère des percussions acoustiques & groove synchronisés au tempo de la chanson.
                  </p>
                </div>

                {/* 4-Beat Visual Metronome Indicators */}
                <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded">
                  {[1, 2, 3, 4].map((beat) => {
                    const isCurrentBeat = currentStep?.beatNumber === beat && isRhythmPlaying;
                    return (
                      <div
                        key={beat}
                        className={`w-4 h-6 rounded flex items-center justify-center font-mono font-bold text-[10px] transition-all duration-75 ${
                          isCurrentBeat
                            ? beat === 1
                              ? 'bg-orange-500 text-black scale-110 shadow-lg shadow-orange-500/50'
                              : 'bg-green-500 text-black scale-105 shadow'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {beat}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Master Play Button + Tempo Slider */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-1">
                <button
                  onClick={toggleRhythm}
                  className={`py-3.5 px-6 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 transition shadow-lg cursor-pointer ${
                    isRhythmPlaying
                      ? 'bg-red-500 hover:bg-red-400 text-white animate-pulse'
                      : 'bg-orange-500 hover:bg-orange-400 text-black font-extrabold'
                  }`}
                >
                  {isRhythmPlaying ? (
                    <>
                      <Pause className="w-5 h-5 fill-current" />
                      <span>Arrêter le Battement</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      <span>Lancer le Battement ({rhythmBpm} BPM)</span>
                    </>
                  )}
                </button>

                {/* BPM Tempo Controls */}
                <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-zinc-400">Tempo :</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setRhythmBpm((b) => Math.max(40, b - 5))}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-bold"
                    >
                      -5
                    </button>
                    <span className="font-mono text-sm font-bold text-orange-400 w-12 text-center">
                      {rhythmBpm}
                    </span>
                    <button
                      onClick={() => setRhythmBpm((b) => Math.min(260, b + 5))}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-bold"
                    >
                      +5
                    </button>
                  </div>
                </div>

                {/* Volume Slider */}
                <div className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-zinc-400" />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={rhythmVolume}
                    onChange={(e) => setRhythmVolume(parseFloat(e.target.value))}
                    className="w-full accent-orange-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono text-zinc-400 w-8">
                    {Math.round(rhythmVolume * 100)}%
                  </span>
                </div>
              </div>

              {/* Combined Autoscroll Sync Option */}
              {onToggleAutoScroll !== undefined && (
                <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 p-3 rounded-lg mt-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-orange-400" />
                    <span className="text-xs text-zinc-300 font-medium">
                      Défilement automatique de la partition synchronisé
                    </span>
                  </div>
                  <button
                    onClick={onToggleAutoScroll}
                    className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                      isAutoScrolling
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-700'
                    }`}
                  >
                    {isAutoScrolling ? '✓ Défilement Actif' : 'Activer Défilement'}
                  </button>
                </div>
              )}
            </div>

            {/* Rhythm Styles Grid */}
            <div className="space-y-2">
              <h5 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" /> Choisir un Style de Percussion & Accompagnement
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {DRUM_GROOVES.map((groove) => {
                  const isSelected = selectedGroove === groove.id;
                  return (
                    <button
                      key={groove.id}
                      onClick={() => {
                        setSelectedGroove(groove.id);
                      }}
                      className={`p-3 rounded-lg border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-orange-500/15 border-orange-500/60 shadow-md text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-bold ${isSelected ? 'text-orange-400' : 'text-zinc-200'}`}>
                          {groove.name}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm shadow-orange-500" />
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        {groove.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: YouTube Backing Track Player */}
        {activeTab === 'youtube' && (
          <div className="space-y-4">
            {/* Search or Paste URL Bar */}
            <form onSubmit={handleLoadCustomUrl} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Youtube className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-red-500" />
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Collez un lien YouTube (ex: https://youtube.com/watch?v=...) ou nom de morceau..."
                  className="w-full bg-zinc-950 border border-zinc-800 text-white pl-9 pr-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs rounded transition cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" /> Charger
              </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Embedded Player */}
              <div className="lg:col-span-2 space-y-2">
                {activeYoutubeId ? (
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden border border-zinc-800 shadow-2xl">
                    <iframe
                      src={`https://www.youtube-nocookie.com/embed/${activeYoutubeId}?autoplay=0&rel=0`}
                      title="Jam Track Backing Player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-zinc-950 border border-zinc-800 rounded-lg flex flex-col items-center justify-center text-zinc-500 p-6 text-center space-y-2">
                    <Disc className="w-10 h-10 text-zinc-700 animate-spin" />
                    <p className="text-xs">Aucune vidéo sélectionnée</p>
                  </div>
                )}

                {/* Save URL to Song */}
                {currentSong && onSaveJamTrackToSong && activeYoutubeId && (
                  <div className="flex items-center justify-between bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <span className="text-xs text-zinc-400">
                      Lier cette Jam Track à <strong className="text-white">{currentSong.title}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveJamTrackToSong(
                          `https://www.youtube.com/watch?v=${activeYoutubeId}`,
                          activeStyleName
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-1 bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 font-bold text-xs rounded transition"
                    >
                      <Bookmark className="w-3.5 h-3.5" /> Enregistrer
                    </button>
                  </div>
                )}
              </div>

              {/* Recommended Presets */}
              <div className="space-y-2">
                <h5 className="text-xs font-bold uppercase text-orange-400 tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Pistes Recommandées
                </h5>

                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {JAM_TRACK_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectPreset(p)}
                      className={`w-full text-left p-2 rounded border transition text-xs flex items-center justify-between gap-2 ${
                        activeYoutubeId === p.youtubeId
                          ? 'bg-orange-500/10 text-orange-300 border-orange-500/50 font-bold'
                          : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="truncate font-medium text-white">{p.title}</p>
                        <p className="text-[10px] text-zinc-500">{p.genre} • {p.bpm} BPM</p>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 text-orange-400 rounded font-bold">
                        {p.key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
