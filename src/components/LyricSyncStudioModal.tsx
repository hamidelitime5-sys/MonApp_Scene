import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Target,
  Wand2,
  FastForward,
  Rewind,
  Plus,
  Minus,
  Sparkles,
  Volume2,
  Trash2,
  ArrowDown,
  Music,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Song, NotationMode } from '../types';
import {
  formatTimeWithTenths,
  formatTimeMMSS,
  parseTimeStringToSeconds,
  extractLineTimestamp,
  setLineTimestamp,
} from '../utils/chordUtils';
import { midiAudioEngine, MidiPlaybackState } from '../utils/midiAudioEngine';

interface LyricSyncStudioModalProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
  onSaveSong: (updatedSong: Song) => void;
  notationMode?: NotationMode;
}

interface ParsedStudioLine {
  originalIndex: number;
  isLyric: boolean;
  sectionName?: string;
  isComment?: boolean;
  cleanText: string;
  hasChords: boolean;
  lyricIndex?: number;
  taggedSeconds?: number;
}

export const LyricSyncStudioModal: React.FC<LyricSyncStudioModalProps> = ({
  song,
  isOpen,
  onClose,
  onSaveSong,
}) => {
  const [midiState, setMidiState] = useState<MidiPlaybackState>(() => midiAudioEngine.getState());
  const [activeRecordingIndex, setActiveRecordingIndex] = useState<number>(0);
  const [isLiveRecording, setIsLiveRecording] = useState<boolean>(false);
  const [timingsMap, setTimingsMap] = useState<{ [lyricIndex: number]: number | undefined }>({});
  const [manualTimeInputs, setManualTimeInputs] = useState<{ [lyricIndex: number]: string }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shiftOffsetSec, setShiftOffsetSec] = useState<number>(0);

  const scrollListRef = useRef<HTMLDivElement>(null);
  const activeLineElemRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(null), 2000);
  };

  // Subscribe to MIDI Engine
  useEffect(() => {
    const unsub = midiAudioEngine.subscribe((state) => {
      setMidiState(state);
    });
    return () => unsub();
  }, []);

  // Parse lines and initialize timings from song's ChordPro content
  const parsedLines = useMemo(() => {
    if (!song) return [];
    const lines = song.chordProContent.split('\n');
    let lyricCounter = 0;

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const sectionMatch = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);

      if (isComment) {
        return {
          originalIndex: idx,
          isLyric: false,
          isComment: true,
          cleanText: line,
          hasChords: false,
        };
      }

      if (sectionMatch) {
        return {
          originalIndex: idx,
          isLyric: false,
          sectionName: trimmed.replace(/^\[|\]$/g, ''),
          cleanText: line,
          hasChords: false,
        };
      }

      if (trimmed.length === 0) {
        return {
          originalIndex: idx,
          isLyric: false,
          cleanText: '',
          hasChords: false,
        };
      }

      const { taggedSeconds, cleanLine } = extractLineTimestamp(trimmed);
      const parts = cleanLine.split(/(\[[^\]]+\])/g).filter(Boolean);
      const hasChords = parts.some((p) => p.startsWith('[') && p.endsWith(']'));
      const lIdx = lyricCounter++;

      return {
        originalIndex: idx,
        isLyric: true,
        lyricIndex: lIdx,
        taggedSeconds,
        cleanText: cleanLine,
        hasChords,
      };
    });
  }, [song]);

  const lyricLinesOnly = useMemo(() => {
    return parsedLines.filter((l) => l.isLyric && l.lyricIndex !== undefined);
  }, [parsedLines]);

  const totalLyricCount = lyricLinesOnly.length;

  // Initialize or reset timings map when modal opens
  useEffect(() => {
    if (isOpen && song) {
      const initialMap: { [lyricIndex: number]: number | undefined } = {};
      const initialInputs: { [lyricIndex: number]: string } = {};

      lyricLinesOnly.forEach((l) => {
        if (l.lyricIndex !== undefined && l.taggedSeconds !== undefined) {
          initialMap[l.lyricIndex] = l.taggedSeconds;
          initialInputs[l.lyricIndex] = formatTimeWithTenths(l.taggedSeconds);
        }
      });

      setTimingsMap(initialMap);
      setManualTimeInputs(initialInputs);
      setActiveRecordingIndex(0);
      setIsLiveRecording(false);
    }
  }, [isOpen, song, lyricLinesOnly]);

  // Handle keyboard shortcuts (SPACE to stamp current time, ARROWS to seek)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isLiveRecording) {
          handleStampCurrentLine();
        } else {
          togglePlay();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(e.shiftKey ? 5 : 2);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(e.shiftKey ? -5 : -2);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLiveRecording, activeRecordingIndex, midiState.currentTime]);

  // Auto-scroll list to active recording line
  useEffect(() => {
    if (isLiveRecording && activeLineElemRef.current && scrollListRef.current) {
      activeLineElemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeRecordingIndex, isLiveRecording]);

  if (!isOpen || !song) return null;

  const currentPlaybackSec = midiState.currentTime;
  const songDuration = midiState.duration > 0 ? midiState.duration : (song.durationSeconds || 180);

  // Toggle MIDI playback
  const togglePlay = () => {
    if (midiState.isPlaying) {
      midiAudioEngine.pause();
    } else {
      midiAudioEngine.play();
    }
  };

  const seekRelative = (deltaSec: number) => {
    const target = Math.max(0, Math.min(songDuration, midiState.currentTime + deltaSec));
    midiAudioEngine.seek(target);
  };

  // Stamp current line at current playback chronometer time
  const handleStampCurrentLine = () => {
    const timeToStamp = Number(midiState.currentTime.toFixed(1));
    const currentIdx = activeRecordingIndex;

    setTimingsMap((prev) => ({
      ...prev,
      [currentIdx]: timeToStamp,
    }));

    setManualTimeInputs((prev) => ({
      ...prev,
      [currentIdx]: formatTimeWithTenths(timeToStamp),
    }));

    showToast(`📍 Ligne ${currentIdx + 1} calée à ${formatTimeWithTenths(timeToStamp)}`);

    if (currentIdx < totalLyricCount - 1) {
      setActiveRecordingIndex(currentIdx + 1);
    } else {
      showToast('🎉 Fin de la chanson ! Vous pouvez enregistrer les repères.');
    }
  };

  // Set explicit time on a specific line index
  const handleSetSpecificLineTime = (lIdx: number, seconds: number | undefined) => {
    setTimingsMap((prev) => ({
      ...prev,
      [lIdx]: seconds,
    }));
    setManualTimeInputs((prev) => ({
      ...prev,
      [lIdx]: seconds !== undefined ? formatTimeWithTenths(seconds) : '',
    }));
  };

  // Adjust time of a specific line (+/- delta)
  const handleStepLineTime = (lIdx: number, delta: number) => {
    const currentVal = timingsMap[lIdx] ?? Number(midiState.currentTime.toFixed(1));
    const nextVal = Math.max(0, Number((currentVal + delta).toFixed(1)));
    handleSetSpecificLineTime(lIdx, nextVal);
  };

  // Jump playback to this line's timestamp
  const handleJumpToLineTime = (lIdx: number) => {
    const targetSec = timingsMap[lIdx];
    if (targetSec !== undefined) {
      midiAudioEngine.seek(targetSec);
      if (!midiState.isPlaying) {
        midiAudioEngine.play();
      }
      showToast(`▶️ Lecture à ${formatTimeWithTenths(targetSec)}`);
    } else {
      showToast('⚠️ Aucun temps défini sur cette ligne');
    }
  };

  // 1-Click Auto MIDI Melody Detection
  const handleAutoMelodyDetection = () => {
    const phrases = midiAudioEngine.getMelodicPhrases();
    if (phrases.length === 0) {
      showToast('⚠️ Aucune mélodie MIDI détectée pour ce morceau');
      return;
    }

    const newMap: { [lyricIndex: number]: number } = {};
    const newInputs: { [lyricIndex: number]: string } = {};

    lyricLinesOnly.forEach((line, i) => {
      if (line.lyricIndex === undefined) return;
      const phraseIdx = Math.min(phrases.length - 1, Math.floor((i / Math.max(1, totalLyricCount)) * phrases.length));
      const sec = Number(phrases[phraseIdx].time.toFixed(1));
      newMap[line.lyricIndex] = sec;
      newInputs[line.lyricIndex] = formatTimeWithTenths(sec);
    });

    setTimingsMap(newMap);
    setManualTimeInputs(newInputs);
    showToast(`⚡ ${totalLyricCount} lignes calées automatiquement sur la mélodie MIDI !`);
  };

  // 1-Click Auto Tempo (BPM) & Structure Sync
  const handleAutoTempoBpmSync = () => {
    if (totalLyricCount === 0) return;
    const bpm = song.bpm || 110;
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4; // 4/4
    const introSeconds = song.introDelaySeconds && song.introDelaySeconds > 0 ? song.introDelaySeconds : Number((secondsPerBar * 4).toFixed(1));

    const totalDuration = songDuration;
    const singingDuration = Math.max(30, totalDuration - introSeconds);
    const intervalPerLine = Math.max(2.0, singingDuration / totalLyricCount);

    const newMap: { [lyricIndex: number]: number } = {};
    const newInputs: { [lyricIndex: number]: string } = {};

    lyricLinesOnly.forEach((line, i) => {
      if (line.lyricIndex === undefined) return;
      const sec = Number((introSeconds + (i * intervalPerLine)).toFixed(1));
      newMap[line.lyricIndex] = sec;
      newInputs[line.lyricIndex] = formatTimeWithTenths(sec);
    });

    setTimingsMap(newMap);
    setManualTimeInputs(newInputs);
    showToast(`⚡ ${totalLyricCount} lignes calées au tempo ${bpm} BPM (Intro ${introSeconds}s) !`);
  };

  // Interpolate missing line timings between existing anchor points
  const handleInterpolateMissingTimings = () => {
    const existingIndices = Object.keys(timingsMap)
      .map(Number)
      .filter((idx) => timingsMap[idx] !== undefined)
      .sort((a, b) => a - b);

    if (existingIndices.length < 1) {
      handleAutoTempoBpmSync();
      return;
    }

    const newMap: { [lyricIndex: number]: number } = { ...timingsMap };
    const newInputs: { [lyricIndex: number]: string } = { ...manualTimeInputs };

    const firstTaggedIdx = existingIndices[0];
    const firstTaggedTime = timingsMap[firstTaggedIdx]!;
    const intro = song.introDelaySeconds || 0;

    // Fill before first
    if (firstTaggedIdx > 0) {
      for (let i = 0; i < firstTaggedIdx; i++) {
        const frac = i / firstTaggedIdx;
        const calcTime = Number((intro + frac * (firstTaggedTime - intro)).toFixed(1));
        newMap[i] = calcTime;
        newInputs[i] = formatTimeWithTenths(calcTime);
      }
    }

    // Fill between
    for (let k = 0; k < existingIndices.length - 1; k++) {
      const idxA = existingIndices[k];
      const idxB = existingIndices[k + 1];
      const timeA = timingsMap[idxA]!;
      const timeB = timingsMap[idxB]!;
      const span = idxB - idxA;
      const timeSpan = Math.max(0.2, timeB - timeA);

      for (let i = idxA + 1; i < idxB; i++) {
        const frac = (i - idxA) / span;
        const calcTime = Number((timeA + frac * timeSpan).toFixed(1));
        newMap[i] = calcTime;
        newInputs[i] = formatTimeWithTenths(calcTime);
      }
    }

    // Fill after last
    const lastTaggedIdx = existingIndices[existingIndices.length - 1];
    const lastTaggedTime = timingsMap[lastTaggedIdx]!;
    if (lastTaggedIdx < totalLyricCount - 1) {
      const remainCount = totalLyricCount - 1 - lastTaggedIdx;
      const remainTime = Math.max(remainCount * 2.5, songDuration - lastTaggedTime);
      for (let i = lastTaggedIdx + 1; i < totalLyricCount; i++) {
        const frac = (i - lastTaggedIdx) / (remainCount + 1);
        const calcTime = Number((lastTaggedTime + frac * remainTime).toFixed(1));
        newMap[i] = calcTime;
        newInputs[i] = formatTimeWithTenths(calcTime);
      }
    }

    setTimingsMap(newMap);
    setManualTimeInputs(newInputs);
    showToast(`✨ Lissage et interpolation calculés pour les ${totalLyricCount} lignes !`);
  };

  // Bulk shift all existing timestamps (+/- X seconds)
  const handleApplyGlobalShift = (offset: number) => {
    if (offset === 0) return;
    const newMap: { [lyricIndex: number]: number | undefined } = {};
    const newInputs: { [lyricIndex: number]: string } = {};

    Object.keys(timingsMap).forEach((key) => {
      const idx = parseInt(key, 10);
      const val = timingsMap[idx];
      if (val !== undefined) {
        const shifted = Math.max(0, Number((val + offset).toFixed(1)));
        newMap[idx] = shifted;
        newInputs[idx] = formatTimeWithTenths(shifted);
      }
    });

    setTimingsMap(newMap);
    setManualTimeInputs(newInputs);
    showToast(`⏱️ Tous les repères décalés de ${offset > 0 ? '+' : ''}${offset}s`);
  };

  // Clear all timings
  const handleClearAllTimings = () => {
    setTimingsMap({});
    setManualTimeInputs({});
    showToast('🗑️ Tous les repères ont été effacés');
  };

  // Save all timings into the song's ChordPro
  const handleSaveAndApply = () => {
    const lines = song.chordProContent.split('\n');
    let lyricCounter = 0;

    const updatedLines = lines.map((line) => {
      const trimmed = line.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const isSection = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);

      if (isComment || isSection || trimmed.length === 0) {
        return line;
      }

      const lIdx = lyricCounter++;
      const assignedSec = timingsMap[lIdx];
      return setLineTimestamp(line, assignedSec);
    });

    const firstTime = timingsMap[0];
    const updatedSong: Song = {
      ...song,
      chordProContent: updatedLines.join('\n'),
      introDelaySeconds: firstTime !== undefined ? firstTime : song.introDelaySeconds,
      updatedAt: Date.now(),
    };

    onSaveSong(updatedSong);
    showToast('💾 Partition synchronisée et sauvegardée avec succès !');
    setTimeout(() => onClose(), 600);
  };

  const taggedCount = Object.values(timingsMap).filter((v) => v !== undefined).length;
  const progressPercent = Math.min(100, Math.max(0, (currentPlaybackSec / Math.max(1, songDuration)) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Toast Notification */}
        {toastMessage && (
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-900 border border-orange-500/60 text-orange-200 px-4 py-2 rounded-xl text-xs font-bold shadow-xl shadow-orange-950/60 flex items-center gap-2 animate-fade-in">
            <Sparkles className="w-4 h-4 text-orange-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Studio Top Header */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-orange-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black text-white truncate flex items-center gap-2">
                <span>Studio de Calage & Chronomètre des Paroles</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/40">
                  {taggedCount} / {totalLyricCount} calées
                </span>
              </h2>
              <p className="text-xs text-zinc-400 truncate">
                Morceau : <span className="text-zinc-200 font-bold">{song.title}</span> • {song.artist} ({song.bpm} BPM)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSaveAndApply}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Sauvegarder la Partition</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Master Chronometer & Audio Control Bar */}
        <div className="p-4 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border-b border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Giant Digital Time Counter */}
          <div className="flex items-center gap-3">
            <div className="bg-zinc-950 border-2 border-orange-500/50 rounded-xl px-4 py-2 text-center shadow-inner">
              <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">CHRONOMÈTRE EN DIRECT</div>
              <div className="text-2xl sm:text-3xl font-black font-mono text-orange-400 tracking-wider drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]">
                {formatTimeWithTenths(currentPlaybackSec)}
              </div>
            </div>

            <div className="text-xs text-zinc-400 font-mono hidden sm:block">
              / {formatTimeMMSS(songDuration)}
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                midiAudioEngine.seek(0);
                setActiveRecordingIndex(0);
              }}
              className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition cursor-pointer"
              title="Remettre à zéro (00:00.0)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => seekRelative(-2)}
              className="py-2 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Reculer de 2 secondes (Flèche Gauche)"
            >
              <Rewind className="w-4 h-4" />
              <span>-2s</span>
            </button>

            <button
              onClick={togglePlay}
              className={`py-2.5 px-6 rounded-xl text-sm font-black transition flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                midiState.isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/40'
                  : 'bg-orange-500 hover:bg-orange-400 text-black shadow-orange-500/40'
              }`}
            >
              {midiState.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
              <span>{midiState.isPlaying ? 'PAUSE' : 'LECTURE'}</span>
            </button>

            <button
              onClick={() => seekRelative(2)}
              className="py-2 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Avancer de 2 secondes (Flèche Droite)"
            >
              <span>+2s</span>
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          {/* Scrub Slider */}
          <div className="w-full sm:w-64 space-y-1">
            <input
              type="range"
              min="0"
              max={songDuration}
              step="0.1"
              value={currentPlaybackSec}
              onChange={(e) => {
                const target = parseFloat(e.target.value);
                midiAudioEngine.seek(target);
              }}
              className="w-full accent-orange-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>00:00.0</span>
              <span>{Math.round(progressPercent)}%</span>
              <span>{formatTimeMMSS(songDuration)}</span>
            </div>
          </div>
        </div>

        {/* Live Tap-to-Record Mode Banner */}
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const nextState = !isLiveRecording;
                setIsLiveRecording(nextState);
                if (nextState && !midiState.isPlaying) {
                  midiAudioEngine.play();
                }
              }}
              className={`py-2 px-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer border shadow-md ${
                isLiveRecording
                  ? 'bg-red-600 text-white border-red-400 animate-pulse shadow-red-600/40'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
              }`}
            >
              <Target className="w-4 h-4 text-red-400" />
              <span>{isLiveRecording ? '🔴 Mode Enregistrement Actif' : '🎙️ Enregistrer en chantant (Tap)'}</span>
            </button>

            {isLiveRecording && (
              <button
                onClick={handleStampCurrentLine}
                className="py-2 px-4 bg-orange-500 hover:bg-orange-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-orange-500/40 cursor-pointer active:scale-95 animate-bounce"
              >
                <span>MARQUER CETTE LIGNE (Espace)</span>
              </button>
            )}
          </div>

          {/* Helper Tools */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={handleAutoTempoBpmSync}
              className="py-1.5 px-3 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
              title="Calage instantané basé sur le tempo (BPM) et la durée du morceau"
            >
              <Music className="w-3.5 h-3.5" />
              <span>⚡ Calage Auto BPM ({song.bpm || 110})</span>
            </button>

            <button
              onClick={handleInterpolateMissingTimings}
              className="py-1.5 px-3 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
              title="Calculer et lisser automatiquement toutes les lignes manquantes entre vos repères"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>✨ Lisser / Interpoler</span>
            </button>

            <button
              onClick={handleAutoMelodyDetection}
              className="py-1.5 px-3 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800/80 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              title="Scan intelligent des notes de la mélodie chantée dans le MIDI"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Auto-Scan MIDI</span>
            </button>

            {/* Global Shift Offset */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
              <button
                onClick={() => handleApplyGlobalShift(-0.5)}
                className="px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 rounded font-mono font-bold cursor-pointer"
                title="Décaler tous les repères de -0.5s"
              >
                -0.5s
              </button>
              <span className="text-[10px] text-zinc-500 px-1 font-bold">Décaler tout</span>
              <button
                onClick={() => handleApplyGlobalShift(0.5)}
                className="px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800 rounded font-mono font-bold cursor-pointer"
                title="Décaler tous les repères de +0.5s"
              >
                +0.5s
              </button>
            </div>

            <button
              onClick={handleClearAllTimings}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              title="Effacer tous les repères de temps"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lines Inspection & Calibration Table */}
        <div ref={scrollListRef} className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {parsedLines.map((item, idx) => {
            if (!item.isLyric || item.lyricIndex === undefined) {
              if (item.sectionName) {
                return (
                  <div key={idx} className="pt-4 pb-1">
                    <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-lg text-xs font-black uppercase tracking-wider">
                      {item.sectionName}
                    </span>
                  </div>
                );
              }
              return null;
            }

            const lIdx = item.lyricIndex;
            const currentVal = timingsMap[lIdx];
            const isRecordingFocus = isLiveRecording && activeRecordingIndex === lIdx;
            const isCurrentPlaying =
              currentVal !== undefined &&
              midiState.currentTime >= currentVal &&
              (lIdx === totalLyricCount - 1 || (timingsMap[lIdx + 1] !== undefined ? midiState.currentTime < timingsMap[lIdx + 1]! : true));

            return (
              <div
                key={idx}
                ref={isRecordingFocus ? activeLineElemRef : null}
                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isRecordingFocus
                    ? 'bg-red-950/40 border-2 border-red-500 shadow-xl shadow-red-900/30'
                    : isCurrentPlaying
                    ? 'bg-orange-500/10 border-orange-500/60 shadow-md'
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                {/* Left: Line Index & Lyric Content */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span
                    onClick={() => setActiveRecordingIndex(lIdx)}
                    className={`px-2 py-1 rounded text-[11px] font-black font-mono shrink-0 cursor-pointer ${
                      isRecordingFocus
                        ? 'bg-red-600 text-white'
                        : currentVal !== undefined
                        ? 'bg-zinc-800 text-orange-400 border border-orange-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    #{lIdx + 1}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-100 leading-snug break-words">
                      {item.cleanText}
                    </p>
                  </div>
                </div>

                {/* Right: Timestamp Stepper, Direct Time Box & Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  
                  {/* Stepper -0.5s */}
                  <button
                    onClick={() => handleStepLineTime(lIdx, -0.5)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-mono font-bold cursor-pointer"
                    title="Reculer de 0.5s"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  {/* Direct Time Input / Display */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="--:--.-"
                      value={manualTimeInputs[lIdx] ?? (currentVal !== undefined ? formatTimeWithTenths(currentVal) : '')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualTimeInputs((prev) => ({ ...prev, [lIdx]: val }));
                        const parsedSec = parseTimeStringToSeconds(val);
                        if (parsedSec !== undefined) {
                          setTimingsMap((prev) => ({ ...prev, [lIdx]: parsedSec }));
                        }
                      }}
                      onBlur={() => {
                        const val = manualTimeInputs[lIdx];
                        const parsedSec = val ? parseTimeStringToSeconds(val) : undefined;
                        handleSetSpecificLineTime(lIdx, parsedSec);
                      }}
                      className={`w-24 text-center font-mono font-bold text-xs py-1.5 px-2 rounded-lg border focus:outline-none transition ${
                        currentVal !== undefined
                          ? 'bg-zinc-950 text-orange-400 border-orange-500/40 focus:border-orange-400'
                          : 'bg-zinc-950 text-zinc-500 border-zinc-800 focus:border-zinc-600'
                      }`}
                    />
                  </div>

                  {/* Stepper +0.5s */}
                  <button
                    onClick={() => handleStepLineTime(lIdx, 0.5)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-mono font-bold cursor-pointer"
                    title="Avancer de 0.5s"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* 1-Click Stamp to current playback time */}
                  <button
                    onClick={() => {
                      const timeToStamp = Number(midiState.currentTime.toFixed(1));
                      handleSetSpecificLineTime(lIdx, timeToStamp);
                      showToast(`📍 Ligne #${lIdx + 1} calée à ${formatTimeWithTenths(timeToStamp)}`);
                    }}
                    className="py-1.5 px-2.5 bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-black border border-orange-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    title="Caler immédiatement cette ligne sur le temps actuel du lecteur"
                  >
                    <Target className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Caler au chrono</span>
                  </button>

                  {/* Listen at this timestamp */}
                  {currentVal !== undefined && (
                    <button
                      onClick={() => handleJumpToLineTime(lIdx)}
                      className="p-1.5 bg-zinc-800 hover:bg-emerald-600 text-zinc-300 hover:text-white rounded-lg transition cursor-pointer"
                      title="Écouter à ce repère"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}

                  {/* Delete Timestamp */}
                  {currentVal !== undefined && (
                    <button
                      onClick={() => handleSetSpecificLineTime(lIdx, undefined)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                      title="Retirer le temps de cette ligne"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Footer Action Bar */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
            <span>
              Astuce : Lancez la lecture et appuyez sur la <strong>Touche Espace</strong> pour marquer chaque ligne au moment précis où le chanteur chante !
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Annuler
            </button>
            <button
              onClick={handleSaveAndApply}
              className="py-2 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg shadow-orange-500/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Sauvegarder et Fermer</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
