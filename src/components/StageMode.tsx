import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  X,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ListMusic,
  ZoomIn,
  ZoomOut,
  Radio,
  Sliders,
  Columns,
  Square,
  Zap,
  Gauge,
  Piano,
  Music,
  ChevronUp,
  ChevronDown,
  Clock,
  Sparkles,
  SlidersHorizontal,
  FastForward,
  Mic2,
  Flame,
  Target,
  Wand2,
  Check,
  Plus,
  Minus,
  Trash2,
  Edit3,
  ScrollText,
  Guitar,
} from 'lucide-react';
import { NotationMode, Setlist, Song } from '../types';
import {
  transposeChordPro,
  formatTimeWithTenths,
  formatTimeMMSS,
  extractLineTimestamp,
  setLineTimestamp,
} from '../utils/chordUtils';
import { metronomeEngine, rhythmEngine, DRUM_GROOVES, DrumGrooveStyle } from '../utils/audioEngine';
import { midiAudioEngine, MidiPlaybackState } from '../utils/midiAudioEngine';
import { webMidiController } from '../utils/webMidiController';
import { JamTrackPlayer } from './JamTrackPlayer';
import { MidiMultiTrackPlayer } from './MidiMultiTrackPlayer';
import { LyricSyncStudioModal } from './LyricSyncStudioModal';
import { GuitarStageStudio } from './GuitarStageStudio';
import { VSamplerPatchManagerModal } from './VSamplerPatchManagerModal';
import { useTheme } from '../context/ThemeContext';
import { StageCircumstancesSelector } from './StageCircumstancesSelector';

interface StageModeProps {
  setlist?: Setlist;
  singleSong?: Song;
  songs: Song[];
  onExitStageMode: () => void;
  onOpenChordModal: (chordName: string) => void;
  onUpdateSong?: (updatedSong: Song) => void;
}

export type ScrollSyncMode = 'midi_realtime' | 'tempo_duration' | 'manual';

export const StageMode: React.FC<StageModeProps> = ({
  setlist,
  singleSong,
  songs,
  onExitStageMode,
  onOpenChordModal,
  onUpdateSong,
}) => {
  // If setlist provided, get all valid song tracks
  const trackEntries = setlist
    ? setlist.entries.filter((e) => e.type === 'song')
    : singleSong
    ? [{ id: 'single', type: 'song', songId: singleSong.id, targetKey: singleSong.key }]
    : [];

  const [currentIndex, setCurrentIndex] = useState(0);

  const currentEntry = trackEntries[currentIndex];
  const currentSong = currentEntry ? songs.find((s) => s.id === currentEntry.songId) || singleSong : singleSong;
  const targetKey = currentEntry?.targetKey || currentSong?.key || 'C';
  const { theme, themeConfig } = useTheme();

  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(5.0); // Fine px per second (1.0 to 60.0)
  const [scrollSyncMode, setScrollSyncMode] = useState<ScrollSyncMode>('tempo_duration');
  const [scrollProgressPercent, setScrollProgressPercent] = useState(0);
  const [isSpeedPanelOpen, setIsSpeedPanelOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const [fontSize, setFontSize] = useState(1.25); // rem
  const [notationMode] = useState<NotationMode>('standard');
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [isRhythmPlaying, setIsRhythmPlaying] = useState(false);
  const [rhythmStyle, setRhythmStyle] = useState<DrumGrooveStyle>('latin_afrocuban');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isJamDockOpen, setIsJamDockOpen] = useState(false); // Side-by-Side Jam Track view
  const [dockViewMode, setDockViewMode] = useState<'midi' | 'backing'>('midi');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeBeat, setActiveBeat] = useState<{ beat: number; isAccent: boolean } | null>(null);
  const [isGuitarStudioOpen, setIsGuitarStudioOpen] = useState(false); // Guitar Stage Tuner & Guitar Rig 7 Modal
  const [isVSamplerModalOpen, setIsVSamplerModalOpen] = useState(false); // VSampler 3 Patch Router Modal

  // Karaoke Real-Time Illumination States (Default to FALSE for simple, rock-solid continuous auto-scrolling)
  const [isKaraokeMode, setIsKaraokeMode] = useState(false);
  const [karaokeColor, setKaraokeColor] = useState<'orange' | 'cyan' | 'gold' | 'emerald'>('orange');
  const [autoCenterKaraoke, setAutoCenterKaraoke] = useState(false);
  const [customIntroSeconds, setCustomIntroSeconds] = useState<number>(() => currentSong?.introDelaySeconds || 0);
  const [isStudioSyncModalOpen, setIsStudioSyncModalOpen] = useState(false);
  const [showInlineTimeControls, setShowInlineTimeControls] = useState(false);
  const [prompterAnticipationSec, setPrompterAnticipationSec] = useState<number>(0.8);

  // Live Tap-to-Sync Calibration Recorder States
  const [isTapSyncRecording, setIsTapSyncRecording] = useState(false);
  const [tapSyncLineIndex, setTapSyncLineIndex] = useState(0);
  const [recordedLineTimings, setRecordedLineTimings] = useState<{ [lyricIndex: number]: number }>({});

  const [midiPlaybackState, setMidiPlaybackState] = useState<MidiPlaybackState>(() => midiAudioEngine.getState());

  const contentRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 1800);
  };

  // Setup metronome & rhythm engine callbacks
  useEffect(() => {
    metronomeEngine.setBeatCallback((beat, isAccent) => {
      setActiveBeat({ beat: beat + 1, isAccent });
      setTimeout(() => setActiveBeat(null), 120);
    });

    rhythmEngine.setStepCallback((_step, _totalSteps, isAccent, beatNumber) => {
      setActiveBeat({ beat: beatNumber, isAccent });
      setTimeout(() => setActiveBeat(null), 120);
    });
  }, []);

  // Subscribe to MIDI Engine state
  useEffect(() => {
    const unsubscribe = midiAudioEngine.subscribe((state) => {
      setMidiPlaybackState(state);

      // Realtime MIDI follow mode (only if not handled by karaoke auto-centering)
      if (scrollSyncMode === 'midi_realtime' && state.duration > 0 && contentRef.current && (!isKaraokeMode || !autoCenterKaraoke)) {
        const totalHeight = contentRef.current.scrollHeight;
        const visibleHeight = contentRef.current.clientHeight;
        const maxScroll = Math.max(0, totalHeight - visibleHeight);

        if (state.isPlaying) {
          setIsScrolling(true);
          const progressFraction = Math.min(1, Math.max(0, state.currentTime / state.duration));
          contentRef.current.scrollTop = progressFraction * maxScroll;
        } else if (!state.isPlaying && isScrolling && state.currentTime === 0) {
          setIsScrolling(false);
        }
      }
    });

    return () => unsubscribe();
  }, [scrollSyncMode, isScrolling, isKaraokeMode, autoCenterKaraoke]);

  // Recalculate optimal scroll speed based on partition height and duration
  const recalculateTempoScrollSpeed = useCallback((song: Song) => {
    if (!contentRef.current) return;
    const totalHeight = contentRef.current.scrollHeight || 1000;
    const visibleHeight = contentRef.current.clientHeight || 600;
    const scrollDistance = Math.max(40, totalHeight - visibleHeight);

    // Duration in seconds (use MIDI duration if available, else song duration or estimate)
    const midiDur = midiPlaybackState.duration > 0 ? midiPlaybackState.duration : null;
    const duration = midiDur || song.durationSeconds || Math.max(90, Math.min(360, (120 / (song.bpm || 110)) * 160));
    
    const calculatedSpeed = Math.max(1.0, Math.min(45.0, Number((scrollDistance / duration).toFixed(1))));

    if (scrollSyncMode === 'tempo_duration') {
      setScrollSpeed(calculatedSpeed);
    }
  }, [scrollSyncMode, midiPlaybackState.duration]);

  // Update engines and recalculate speed when song changes
  useEffect(() => {
    if (currentSong) {
      const bpm = currentSong.bpm || 110;
      metronomeEngine.setBpm(bpm);
      rhythmEngine.setBpm(bpm);

      // Reset / sync karaoke state for current song
      setCustomIntroSeconds(currentSong.introDelaySeconds || 0);
      setRecordedLineTimings({});
      setIsTapSyncRecording(false);
      setTapSyncLineIndex(0);

      // Auto-pick appropriate groove style for known songs
      if (currentSong.title.toLowerCase().includes('café') || currentSong.tags?.includes('Afro-Cubain')) {
        setRhythmStyle('latin_afrocuban');
        rhythmEngine.setStyle('latin_afrocuban');
      } else {
        rhythmEngine.setStyle(rhythmStyle);
      }

      // If song has MIDI data, load into midiAudioEngine and prefer midi_realtime mode
      if (currentSong.midiData) {
        try {
          const binaryString = atob(currentSong.midiData);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          midiAudioEngine.loadMidi(bytes.buffer, currentSong.midiFileName || `${currentSong.title}.mid`);
          setScrollSyncMode('midi_realtime');
          if (currentSong.tags?.includes('Karaoké') || currentSong.chordProContent.includes('{time:')) {
            setIsKaraokeMode(true);
            setAutoCenterKaraoke(true);
          }
        } catch (err) {
          console.warn('Could not auto-load song MIDI data in StageMode:', err);
        }
      } else if (currentSong.title.toLowerCase().includes('café') || currentSong.title.toLowerCase().includes('couleur')) {
        // Auto-generate Gainsbourg Couleur Café multi-track demo in midiAudioEngine
        midiAudioEngine.generateDemoMultiTrackMidi('couleur_cafe');
        setScrollSyncMode('midi_realtime');
      }

      // Auto-trigger VSampler 3 preset / instrument configuration for currentSong
      try {
        const customFile =
          currentSong.fichier_sampler ||
          currentSong.vSamplerConfig?.fichier_sampler ||
          currentSong.fichier_instrument ||
          currentSong.vSamplerConfig?.fichier_instrument;
        if (customFile && customFile.trim().length > 0) {
          const fileName = customFile.split(/[/\\]/).pop() || customFile;
          showToast(`🎹 VSampler 3 : Appel de "${fileName}" (Disque D:)...`);
          midiAudioEngine.loadSongVSamplerSetup(currentSong).then((res) => {
            if (res.success) {
              showToast(`🎹 VSampler 3 : ${res.message}`);
            }
          }).catch((err) => {
            console.warn('VSampler file preset load error:', err);
          });
        } else {
          let vConfig = currentSong.vSamplerConfig;
          if (!vConfig && currentSong.simpleInstruments) {
            vConfig = midiAudioEngine.parseSimpleInstrumentsConfig(currentSong.title, currentSong.simpleInstruments);
          }
          if (!vConfig) {
            const savedConfigs = localStorage.getItem('hamide_vsampler_song_configs');
            if (savedConfigs) {
              const map = JSON.parse(savedConfigs);
              if (map[currentSong.id]) {
                vConfig = map[currentSong.id];
              }
            }
          }
          if (!vConfig) {
            vConfig = midiAudioEngine.generateDefaultVSamplerConfig(currentSong.title, midiAudioEngine.getState().tracks);
          }

          if (vConfig && vConfig.enabled !== false) {
            midiAudioEngine.sendSongVSamplerConfig(vConfig).then((res) => {
              if (res.success && res.channelsCount > 0) {
                showToast(`🎹 VSampler 3 : ${res.channelsCount} instruments configurés pour "${currentSong.title}"`);
              }
            }).catch((err) => {
              console.warn('VSampler auto-send error:', err);
            });
          }
        }
      } catch (err) {
        console.warn('Error applying VSampler 3 auto-config:', err);
      }

      // Auto-trigger Guitar Rig 7 preset if mapped for currentSong
      try {
        const savedPresets = localStorage.getItem('hamide_guitarrig_song_presets');
        if (savedPresets) {
          const map = JSON.parse(savedPresets);
          if (map[currentSong.id] !== undefined) {
            webMidiController.sendProgramChange(map[currentSong.id]);
            showToast(`🎸 Son Guitar Rig #${map[currentSong.id] + 1} envoyé`);
          }
        }
      } catch {
        // ignore
      }

      // Delay slightly for DOM render to compute scrollHeight accurately
      setTimeout(() => {
        recalculateTempoScrollSpeed(currentSong);
      }, 150);
    }
  }, [currentSong, rhythmStyle, recalculateTempoScrollSpeed]);

  // Handle scroll progress update
  const handleScroll = () => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    const maxScroll = scrollHeight - clientHeight;
    if (maxScroll > 0) {
      const pct = Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
      setScrollProgressPercent(pct);
    }
  };

  // Jump to click position on progress bar
  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !contentRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
    contentRef.current.scrollTop = clickRatio * maxScroll;

    // If in MIDI realtime mode and MIDI loaded, seek MIDI too
    if (scrollSyncMode === 'midi_realtime' && midiPlaybackState.duration > 0) {
      midiAudioEngine.seek(clickRatio * midiPlaybackState.duration);
    }
  };

  // Toggle Metronome Click
  const toggleMetronome = () => {
    if (isRhythmPlaying) {
      rhythmEngine.stop();
      setIsRhythmPlaying(false);
    }
    const isPlaying = metronomeEngine.toggle();
    setIsMetronomePlaying(isPlaying);
  };

  // Toggle Rhythm / Drum Beat Accompaniment
  const toggleRhythm = () => {
    if (isMetronomePlaying) {
      metronomeEngine.stop();
      setIsMetronomePlaying(false);
    }
    const isPlaying = rhythmEngine.toggle();
    setIsRhythmPlaying(isPlaying);
  };

  // Master Play: Toggle both Auto-Scroll, Accompaniment Beat and MIDI
  const handleMasterPlayToggle = () => {
    if (isScrolling || isRhythmPlaying || midiPlaybackState.isPlaying) {
      setIsScrolling(false);
      rhythmEngine.stop();
      setIsRhythmPlaying(false);
      if (midiPlaybackState.isPlaying) midiAudioEngine.pause();
    } else {
      setIsScrolling(true);
      rhythmEngine.start();
      setIsRhythmPlaying(true);
      if (currentSong?.midiData && !midiPlaybackState.isPlaying) {
        midiAudioEngine.play();
      }
    }
  };

  // Toggle Auto Scroll with MIDI sync
  const toggleAutoScroll = () => {
    const nextScrolling = !isScrolling;
    setIsScrolling(nextScrolling);

    // If in MIDI sync mode, start/stop MIDI playback in sync
    if (scrollSyncMode === 'midi_realtime' && currentSong?.midiData) {
      if (nextScrolling && !midiPlaybackState.isPlaying) {
        midiAudioEngine.play();
      } else if (!nextScrolling && midiPlaybackState.isPlaying) {
        midiAudioEngine.pause();
      }
    }
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isTapSyncRecording) {
          handleTapSyncAdvance();
        } else {
          toggleAutoScroll();
        }
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        setScrollSpeed((prev) => {
          const next = Math.min(60, Number((prev + (e.shiftKey ? 2 : 0.5)).toFixed(1)));
          showToast(`⚡ Vitesse : ${next} px/s`);
          return next;
        });
        setScrollSyncMode('manual');
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        setScrollSpeed((prev) => {
          const next = Math.max(1, Number((prev - (e.shiftKey ? 2 : 0.5)).toFixed(1)));
          showToast(`⚡ Vitesse : ${next} px/s`);
          return next;
        });
        setScrollSyncMode('manual');
      } else if (e.code === 'Home' || e.code === 'KeyR') {
        e.preventDefault();
        if (contentRef.current) contentRef.current.scrollTop = 0;
        if (midiPlaybackState.duration > 0) midiAudioEngine.seek(0);
        showToast('⏮️ Début de la partition');
      } else if (e.code === 'PageDown') {
        e.preventDefault();
        if (contentRef.current) {
          contentRef.current.scrollBy({ top: contentRef.current.clientHeight * 0.75, behavior: 'smooth' });
          showToast('📄 Page Suivante (Pédalier)');
        }
      } else if (e.code === 'PageUp') {
        e.preventDefault();
        if (contentRef.current) {
          contentRef.current.scrollBy({ top: -contentRef.current.clientHeight * 0.75, behavior: 'smooth' });
          showToast('📄 Page Précédente (Pédalier)');
        }
      } else if (e.code === 'ArrowRight' || e.code === 'KeyN') {
        e.preventDefault();
        handleNextSong();
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyP') {
        e.preventDefault();
        handlePrevSong();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        toggleRhythm();
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setDockViewMode('midi');
        setIsJamDockOpen((prev) => !prev);
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        setDockViewMode('backing');
        setIsJamDockOpen((prev) => !prev);
      } else if (e.code === 'Escape') {
        onExitStageMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      metronomeEngine.stop();
      rhythmEngine.stop();
    };
  }, [currentIndex, trackEntries.length, isScrolling, isRhythmPlaying, scrollSyncMode, midiPlaybackState.isPlaying, midiPlaybackState.duration, currentSong]);

  // Smooth Auto-Scrolling loop (for 'manual' and 'tempo_duration' modes)
  useEffect(() => {
    let animationFrameId: number;
    let lastTime: number | null = null;

    const scrollStep = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // Only perform time-delta scrolling if not in realtime MIDI mode or karaoke auto-centering mode
      if (isScrolling && contentRef.current && scrollSyncMode !== 'midi_realtime' && (!isKaraokeMode || !autoCenterKaraoke)) {
        contentRef.current.scrollTop += scrollSpeed * delta;
      }

      if (isScrolling) {
        animationFrameId = requestAnimationFrame(scrollStep);
      }
    };

    if (isScrolling) {
      animationFrameId = requestAnimationFrame(scrollStep);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isScrolling, scrollSpeed, scrollSyncMode]);

  const handleNextSong = () => {
    if (currentIndex < trackEntries.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsScrolling(false);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      if (midiPlaybackState.isPlaying) midiAudioEngine.stop();
    }
  };

  const handlePrevSong = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsScrolling(false);
      if (contentRef.current) contentRef.current.scrollTop = 0;
      if (midiPlaybackState.isPlaying) midiAudioEngine.stop();
    }
  };

  const toggleFullscreenMode = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (!currentSong) {
    return (
      <div className="fixed inset-0 z-50 bg-neutral-950 text-white flex flex-col items-center justify-center p-6">
        <h2 className="text-xl font-bold mb-4">Aucune chanson sélectionnée pour le Mode Scène</h2>
        <button onClick={onExitStageMode} className="px-5 py-2 bg-orange-500 text-black font-bold rounded-lg cursor-pointer">
          Quitter le Mode Scène
        </button>
      </div>
    );
  }

  // Next song preview title
  const nextEntry = trackEntries[currentIndex + 1];
  const nextSong = nextEntry ? songs.find((s) => s.id === nextEntry.songId) : null;

  // Format seconds to mm:ss.d with tenths
  const formatTime = (secs: number) => {
    return formatTimeWithTenths(secs);
  };

  // Parse transposed ChordPro content into structured lines for Karaoke Tracking
  const parsedChordProLines = useMemo(() => {
    if (!currentSong) return [];
    const transposed = transposeChordPro(currentSong.chordProContent, 0, notationMode, targetKey);
    const rawLines = transposed.split('\n');
    let lyricCounter = 0;

    return rawLines.map((line, originalIndex) => {
      const trimmed = line.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const sectionMatch = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);

      if (isComment) {
        return { type: 'comment' as const, originalIndex, text: line };
      }
      if (sectionMatch) {
        return {
          type: 'section' as const,
          originalIndex,
          sectionName: trimmed.replace(/^\[|\]$/g, ''),
          text: line,
        };
      }
      if (trimmed.length === 0) {
        return { type: 'empty' as const, originalIndex, text: '' };
      }

      // Check for timestamp tags like {time: 01:23.5} using helper
      const { taggedSeconds, cleanLine } = extractLineTimestamp(trimmed);
      const parts = cleanLine.split(/(\[[^\]]+\])/g).filter(Boolean);
      const hasChords = parts.some((p) => p.startsWith('[') && p.endsWith(']'));
      const lyricIndex = lyricCounter++;

      return {
        type: 'lyric' as const,
        originalIndex,
        lyricIndex,
        hasChords,
        parts: parts.map((part) => ({
          isChord: part.startsWith('[') && part.endsWith(']'),
          text: part.startsWith('[') && part.endsWith(']') ? part.slice(1, -1) : part,
        })),
        taggedSeconds,
        text: cleanLine,
      };
    });
  }, [currentSong, notationMode, targetKey]);

  const totalLyricLines = useMemo(() => {
    return parsedChordProLines.filter((l) => l.type === 'lyric').length || 1;
  }, [parsedChordProLines]);

  // Total song playback duration
  const activeSongDuration = useMemo(() => {
    if (midiPlaybackState.duration > 0) return midiPlaybackState.duration;
    if (currentSong?.durationSeconds && currentSong.durationSeconds > 0) return currentSong.durationSeconds;
    return Math.max(60, (120 / (currentSong?.bpm || 110)) * 160);
  }, [midiPlaybackState.duration, currentSong]);

  // Current playback progress fraction (0.0 to 1.0)
  const currentProgressFraction = useMemo(() => {
    if (midiPlaybackState.duration > 0) {
      return Math.max(0, Math.min(1, midiPlaybackState.currentTime / midiPlaybackState.duration));
    }
    return Math.max(0, Math.min(1, scrollProgressPercent / 100));
  }, [midiPlaybackState.currentTime, midiPlaybackState.duration, scrollProgressPercent]);

  // Detect Lead Vocal / Melodic Phrases directly from MIDI playback tracks
  const detectedMidiPhrases = useMemo(() => {
    if (midiPlaybackState.tracks.length > 0) {
      return midiAudioEngine.getMelodicPhrases();
    }
    return [];
  }, [midiPlaybackState.tracks]);

  // Detected or configured Intro Duration in seconds
  const detectedIntroDuration = useMemo(() => {
    if (detectedMidiPhrases.length > 0) {
      return Number(detectedMidiPhrases[0].time.toFixed(1));
    }
    return 0;
  }, [detectedMidiPhrases]);

  const effectiveIntroSeconds = customIntroSeconds > 0 ? customIntroSeconds : detectedIntroDuration;
  const isIntroActive = midiPlaybackState.duration > 0 && midiPlaybackState.currentTime < effectiveIntroSeconds && effectiveIntroSeconds > 0.8;
  const introRemainingSeconds = Math.max(0, effectiveIntroSeconds - midiPlaybackState.currentTime);

  // Continuous & Musical Line Timing Map for ALL lyric lines
  const computedLineTimings = useMemo(() => {
    if (totalLyricLines <= 0) return [];

    // 1. Gather all explicit timestamped anchors (ChordPro {time: ...} or TapSync recordings)
    const anchors: { index: number; time: number }[] = [];
    parsedChordProLines.forEach((line) => {
      if (line.type === 'lyric' && line.lyricIndex !== undefined) {
        const timeVal = line.taggedSeconds !== undefined ? line.taggedSeconds : recordedLineTimings[line.lyricIndex];
        if (timeVal !== undefined && !isNaN(timeVal)) {
          anchors.push({ index: line.lyricIndex, time: timeVal });
        }
      }
    });

    // Sort anchors by line index
    anchors.sort((a, b) => a.index - b.index);

    const introTime = effectiveIntroSeconds > 0 ? effectiveIntroSeconds : 0;
    const totalDuration = activeSongDuration;
    const result: number[] = new Array(totalLyricLines).fill(0);

    // Case A: No explicit anchors -> smooth interpolation across song duration
    if (anchors.length === 0) {
      if (detectedMidiPhrases.length > 0) {
        for (let i = 0; i < totalLyricLines; i++) {
          const phraseIdx = Math.min(
            detectedMidiPhrases.length - 1,
            Math.floor((i / Math.max(1, totalLyricLines)) * detectedMidiPhrases.length)
          );
          result[i] = detectedMidiPhrases[phraseIdx].time;
        }
        return result;
      }

      const singingDuration = Math.max(10, totalDuration - introTime);
      for (let i = 0; i < totalLyricLines; i++) {
        result[i] = Number((introTime + (i / Math.max(1, totalLyricLines)) * singingDuration).toFixed(2));
      }
      return result;
    }

    // Case B: Anchors exist -> Interpolate smoothly and continuously between anchors
    // 1. Fill before first anchor
    const firstAnchor = anchors[0];
    if (firstAnchor.index > 0) {
      for (let i = 0; i < firstAnchor.index; i++) {
        const frac = i / firstAnchor.index;
        result[i] = Number((introTime + frac * (firstAnchor.time - introTime)).toFixed(2));
      }
    }
    result[firstAnchor.index] = firstAnchor.time;

    // 2. Fill between consecutive anchors
    for (let a = 0; a < anchors.length - 1; a++) {
      const curA = anchors[a];
      const nextA = anchors[a + 1];
      result[curA.index] = curA.time;

      const lineSpan = nextA.index - curA.index;
      const timeSpan = Math.max(0.2, nextA.time - curA.time);

      for (let i = curA.index + 1; i < nextA.index; i++) {
        const frac = (i - curA.index) / lineSpan;
        result[i] = Number((curA.time + frac * timeSpan).toFixed(2));
      }
    }

    // 3. Fill after last anchor
    const lastAnchor = anchors[anchors.length - 1];
    result[lastAnchor.index] = lastAnchor.time;
    if (lastAnchor.index < totalLyricLines - 1) {
      const remainingLines = totalLyricLines - 1 - lastAnchor.index;
      const remainingTime = Math.max(remainingLines * 2.5, totalDuration - lastAnchor.time);
      for (let i = lastAnchor.index + 1; i < totalLyricLines; i++) {
        const frac = (i - lastAnchor.index) / (remainingLines + 1);
        result[i] = Number((lastAnchor.time + frac * remainingTime).toFixed(2));
      }
    }

    return result;
  }, [totalLyricLines, parsedChordProLines, recordedLineTimings, effectiveIntroSeconds, activeSongDuration, detectedMidiPhrases]);

  // Active Karaoke Line Index with precision interpolation & anticipation
  const activeKaraokeLyricIndex = useMemo(() => {
    if (totalLyricLines <= 0) return 0;

    // 1. In Live TapSync recording mode, show current line being recorded
    if (isTapSyncRecording) {
      return tapSyncLineIndex;
    }

    const currentTime = midiPlaybackState.currentTime;
    const effectiveTime = currentTime + prompterAnticipationSec;

    // Intro check
    if (effectiveTime < computedLineTimings[0] && effectiveIntroSeconds > 0.5 && currentTime < effectiveIntroSeconds) {
      return 0;
    }

    // Find the current active line in computedLineTimings
    let activeIdx = 0;
    for (let i = 0; i < computedLineTimings.length; i++) {
      if (computedLineTimings[i] <= effectiveTime) {
        activeIdx = i;
      } else {
        break;
      }
    }

    return Math.min(totalLyricLines - 1, Math.max(0, activeIdx));
  }, [
    totalLyricLines,
    midiPlaybackState.currentTime,
    prompterAnticipationSec,
    computedLineTimings,
    effectiveIntroSeconds,
    isTapSyncRecording,
    tapSyncLineIndex,
  ]);

  // Active line internal progression (0.0 to 1.0) for live underline progress fill
  const activeLineProgress = useMemo(() => {
    if (isIntroActive) {
      return Math.min(1, Math.max(0, midiPlaybackState.currentTime / Math.max(0.1, effectiveIntroSeconds)));
    }

    if (computedLineTimings.length === 0) return 0;

    const effectiveTime = midiPlaybackState.currentTime + prompterAnticipationSec;
    const curLineTime = computedLineTimings[activeKaraokeLyricIndex] || 0;
    const nextLineTime = activeKaraokeLyricIndex < totalLyricLines - 1
      ? computedLineTimings[activeKaraokeLyricIndex + 1]
      : activeSongDuration;

    if (nextLineTime > curLineTime) {
      const prog = (effectiveTime - curLineTime) / (nextLineTime - curLineTime);
      return Math.max(0, Math.min(1, prog));
    }

    return 0.5;
  }, [
    isIntroActive,
    midiPlaybackState.currentTime,
    prompterAnticipationSec,
    computedLineTimings,
    activeKaraokeLyricIndex,
    totalLyricLines,
    activeSongDuration,
    effectiveIntroSeconds,
  ]);

  // 1-Click Automatic Calibration using Song BPM & Structure
  const handleAutoSyncWithTempo = useCallback(() => {
    if (!currentSong) return;
    const bpm = currentSong.bpm || 110;
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4; // 4/4
    const lines = currentSong.chordProContent.split('\n');

    let lyricCount = 0;
    const lyricLineIndices: number[] = [];
    lines.forEach((l, idx) => {
      const trimmed = l.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const isSection = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);
      if (!isComment && !isSection && trimmed.length > 0) {
        lyricLineIndices.push(idx);
        lyricCount++;
      }
    });

    if (lyricCount === 0) {
      showToast('⚠️ Aucune ligne de chant trouvée dans le morceau');
      return;
    }

    const introSeconds = customIntroSeconds > 0 ? customIntroSeconds : Number((secondsPerBar * 4).toFixed(1));
    const newLines = [...lines];

    const availableSingingDuration = Math.max(30, activeSongDuration - introSeconds);
    const calculatedIntervalPerLine = Math.max(2.0, availableSingingDuration / lyricCount);

    lyricLineIndices.forEach((lineIdx, i) => {
      const targetSeconds = Number((introSeconds + (i * calculatedIntervalPerLine)).toFixed(1));
      const m = Math.floor(targetSeconds / 60);
      const s = (targetSeconds % 60).toFixed(1);
      const formattedTime = `{time: ${m < 10 ? '0' : ''}${m}:${Number(s) < 10 ? '0' : ''}${s}}`;

      let cleaned = newLines[lineIdx].replace(/\{time:\s*[\d:.]+\}\s*/gi, '');
      newLines[lineIdx] = `${formattedTime} ${cleaned}`;
    });

    const updatedSong: Song = {
      ...currentSong,
      chordProContent: newLines.join('\n'),
      introDelaySeconds: introSeconds,
    };

    if (onUpdateSong) {
      onUpdateSong(updatedSong);
    }
    setCustomIntroSeconds(introSeconds);
    showToast(`⚡ Calage parfait au tempo ${bpm} BPM appliqué sur ${lyricCount} lignes !`);
  }, [currentSong, customIntroSeconds, activeSongDuration, onUpdateSong]);

  // Direct line timing update from Stage Mode
  const handleUpdateLineTimeDirectly = (lyricIndex: number, newTime: number | undefined) => {
    if (!currentSong) return;
    const lines = currentSong.chordProContent.split('\n');
    let lyricCounter = 0;

    const newLines = lines.map((l) => {
      const trimmed = l.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const isSection = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);
      if (isComment || isSection || trimmed.length === 0) return l;

      const currentLyricIdx = lyricCounter++;
      if (currentLyricIdx === lyricIndex) {
        return setLineTimestamp(l, newTime);
      }
      return l;
    });

    const updatedSong: Song = {
      ...currentSong,
      chordProContent: newLines.join('\n'),
    };

    if (onUpdateSong) {
      onUpdateSong(updatedSong);
    }
    setRecordedLineTimings((prev) => {
      const next = { ...prev };
      if (newTime !== undefined) {
        next[lyricIndex] = newTime;
      } else {
        delete next[lyricIndex];
      }
      return next;
    });
    if (newTime !== undefined) {
      showToast(`⏱️ Ligne #${lyricIndex + 1} calée à ${formatTimeWithTenths(newTime)}`);
    } else {
      showToast(`🗑️ Repère retiré de la ligne #${lyricIndex + 1}`);
    }
  };

  // 1-Click Automatic MIDI Calibration: parses melodic notes & embeds {time: mm:ss} into ChordPro
  const handleAutoSyncWithMidi = useCallback(() => {
    if (!currentSong) return;
    const phrases = detectedMidiPhrases.length > 0 ? detectedMidiPhrases : midiAudioEngine.getMelodicPhrases();
    const introTime = detectedIntroDuration;
    const lines = currentSong.chordProContent.split('\n');

    let lyricCount = 0;
    const lyricLineIndices: number[] = [];
    lines.forEach((l, idx) => {
      const trimmed = l.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const isSection = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);
      if (!isComment && !isSection && trimmed.length > 0) {
        lyricLineIndices.push(idx);
        lyricCount++;
      }
    });

    if (lyricCount === 0) {
      showToast('⚠️ Aucune ligne de chant trouvée dans le morceau');
      return;
    }

    const newLines = [...lines];

    lyricLineIndices.forEach((lineIdx, i) => {
      let targetSeconds = 0;
      if (phrases.length > 0) {
        const phraseIdx = Math.min(phrases.length - 1, Math.floor((i / Math.max(1, lyricCount)) * phrases.length));
        targetSeconds = phrases[phraseIdx].time;
      } else {
        const remainingTime = Math.max(10, activeSongDuration - introTime);
        targetSeconds = introTime + (i / Math.max(1, lyricCount)) * remainingTime;
      }

      const m = Math.floor(targetSeconds / 60);
      const s = (targetSeconds % 60).toFixed(1);
      const formattedTime = `{time: ${m < 10 ? '0' : ''}${m}:${Number(s) < 10 ? '0' : ''}${s}}`;

      // Clean existing {time: ...}
      let cleaned = newLines[lineIdx].replace(/\{time:\s*[\d:.]+\}\s*/gi, '');
      newLines[lineIdx] = `${formattedTime} ${cleaned}`;
    });

    const updatedChordPro = newLines.join('\n');
    const updatedSong: Song = {
      ...currentSong,
      chordProContent: updatedChordPro,
      introDelaySeconds: introTime,
    };

    if (onUpdateSong) {
      onUpdateSong(updatedSong);
    }
    showToast(`⚡ Synchronisation MIDI réussie : ${lyricCount} lignes calées sur la mélodie !`);
  }, [currentSong, detectedMidiPhrases, detectedIntroDuration, activeSongDuration, onUpdateSong]);

  // TapSync: Mark current line with current MIDI time & jump to next
  const handleTapSyncAdvance = () => {
    if (!isTapSyncRecording) return;
    const currentSec = Number(midiPlaybackState.currentTime.toFixed(1));

    setRecordedLineTimings((prev) => ({
      ...prev,
      [tapSyncLineIndex]: currentSec,
    }));

    showToast(`📍 Ligne ${tapSyncLineIndex + 1} marquée à ${formatTime(currentSec)}`);

    if (tapSyncLineIndex < totalLyricLines - 1) {
      setTapSyncLineIndex((prev) => prev + 1);
    } else {
      showToast('🎉 Toutes les lignes ont été marquées ! Cliquez sur Sauvegarder.');
    }
  };

  // TapSync: Save all recorded timings permanently into song's ChordPro
  const handleSaveTapSyncToSong = () => {
    if (!currentSong) return;
    const lines = currentSong.chordProContent.split('\n');
    let lyricCounter = 0;

    const newLines = lines.map((l) => {
      const trimmed = l.trim();
      const isComment = (trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.startsWith('#');
      const isSection = trimmed.match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);

      if (isComment || isSection || trimmed.length === 0) {
        return l;
      }

      const lIdx = lyricCounter++;
      const timeSec = recordedLineTimings[lIdx];
      let cleaned = l.replace(/\{time:\s*[\d:.]+\}\s*/gi, '');

      if (timeSec !== undefined) {
        const m = Math.floor(timeSec / 60);
        const s = (timeSec % 60).toFixed(1);
        const formattedTime = `{time: ${m < 10 ? '0' : ''}${m}:${Number(s) < 10 ? '0' : ''}${s}}`;
        return `${formattedTime} ${cleaned}`;
      }
      return cleaned;
    });

    const updatedSong: Song = {
      ...currentSong,
      chordProContent: newLines.join('\n'),
      introDelaySeconds: recordedLineTimings[0] !== undefined ? recordedLineTimings[0] : customIntroSeconds,
    };

    if (onUpdateSong) {
      onUpdateSong(updatedSong);
    }
    setIsTapSyncRecording(false);
    showToast('💾 Repères de calage sauvegardés dans la partition !');
  };

  // Reset all timestamps from song
  const handleResetKaraokeTimings = () => {
    if (!currentSong) return;
    const lines = currentSong.chordProContent.split('\n');
    const cleaned = lines.map((l) => l.replace(/\{time:\s*[\d:.]+\}\s*/gi, '')).join('\n');
    const updatedSong: Song = {
      ...currentSong,
      chordProContent: cleaned,
      introDelaySeconds: 0,
    };
    if (onUpdateSong) {
      onUpdateSong(updatedSong);
    }
    setRecordedLineTimings({});
    setCustomIntroSeconds(0);
    showToast('🔄 Repères de temps réinitialisés');
  };

  // Auto-centering effect when Karaoke is active and song is playing
  useEffect(() => {
    if (isKaraokeMode && autoCenterKaraoke && (midiPlaybackState.isPlaying || isScrolling)) {
      if (activeLineRef.current && contentRef.current) {
        const container = contentRef.current;
        const lineElem = activeLineRef.current;
        const containerRect = container.getBoundingClientRect();
        const lineRect = lineElem.getBoundingClientRect();

        const targetScrollTop = container.scrollTop + (lineRect.top - containerRect.top) - (container.clientHeight * 0.35);

        container.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth',
        });
      }
    }
  }, [activeKaraokeLyricIndex, isKaraokeMode, autoCenterKaraoke, midiPlaybackState.isPlaying, isScrolling]);

  // Interactive Click on a Lyric Line to Jump/Seek in Song
  const handleSeekToLyricLine = (lyricIndex: number) => {
    const lineItem = parsedChordProLines.find((l) => l.type === 'lyric' && l.lyricIndex === lyricIndex);
    let targetSeconds: number;
    if (lineItem?.taggedSeconds !== undefined) {
      targetSeconds = lineItem.taggedSeconds;
    } else if (recordedLineTimings[lyricIndex] !== undefined) {
      targetSeconds = recordedLineTimings[lyricIndex];
    } else {
      const fraction = Math.max(0, Math.min(1, lyricIndex / Math.max(1, totalLyricLines)));
      targetSeconds = fraction * activeSongDuration;
    }

    if (midiPlaybackState.duration > 0) {
      midiAudioEngine.seek(targetSeconds);
      showToast(`🎯 Karaoké sauté à ${formatTimeWithTenths(targetSeconds)}`);
    } else {
      showToast(`🎯 Ligne ${lyricIndex + 1}/${totalLyricLines}`);
    }

    if (contentRef.current) {
      const fraction = Math.max(0, Math.min(1, lyricIndex / Math.max(1, totalLyricLines)));
      const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight;
      if (maxScroll > 0) {
        contentRef.current.scrollTo({
          top: fraction * maxScroll,
          behavior: 'smooth',
        });
      }
    }
  };

  const getKaraokeTheme = () => {
    switch (karaokeColor) {
      case 'cyan':
        return {
          name: 'Bleu Cyan Néon',
          badge: 'bg-cyan-500 text-black shadow-cyan-500/50',
          border: 'border-cyan-400',
          bgGradient: 'from-cyan-950/80 via-cyan-900/30 to-transparent',
          textGlow: 'text-cyan-100 font-bold drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]',
          progressBar: 'bg-gradient-to-r from-cyan-400 to-teal-300 shadow-sm shadow-cyan-400/50',
          chordActive: 'bg-cyan-400 text-black border-cyan-300 shadow-md shadow-cyan-400/60 font-black scale-105',
          activeIndicator: 'bg-cyan-400',
        };
      case 'gold':
        return {
          name: 'Or Scène & Étoiles',
          badge: 'bg-amber-400 text-black shadow-amber-400/50',
          border: 'border-amber-400',
          bgGradient: 'from-amber-950/80 via-amber-900/30 to-transparent',
          textGlow: 'text-amber-100 font-bold drop-shadow-[0_0_12px_rgba(251,191,36,0.8)]',
          progressBar: 'bg-gradient-to-r from-amber-400 to-yellow-300 shadow-sm shadow-amber-400/50',
          chordActive: 'bg-amber-400 text-black border-amber-300 shadow-md shadow-amber-400/60 font-black scale-105',
          activeIndicator: 'bg-amber-400',
        };
      case 'emerald':
        return {
          name: 'Vert Émeraude Laser',
          badge: 'bg-emerald-500 text-black shadow-emerald-500/50',
          border: 'border-emerald-400',
          bgGradient: 'from-emerald-950/80 via-emerald-900/30 to-transparent',
          textGlow: 'text-emerald-100 font-bold drop-shadow-[0_0_12px_rgba(16,185,129,0.8)]',
          progressBar: 'bg-gradient-to-r from-emerald-400 to-teal-300 shadow-sm shadow-emerald-400/50',
          chordActive: 'bg-emerald-400 text-black border-emerald-300 shadow-md shadow-emerald-400/60 font-black scale-105',
          activeIndicator: 'bg-emerald-400',
        };
      case 'orange':
      default:
        return {
          name: 'Orange Flamboyant',
          badge: 'bg-orange-500 text-black shadow-orange-500/50',
          border: 'border-orange-400',
          bgGradient: 'from-orange-950/80 via-amber-950/30 to-transparent',
          textGlow: 'text-orange-100 font-bold drop-shadow-[0_0_12px_rgba(249,115,22,0.8)]',
          progressBar: 'bg-gradient-to-r from-orange-400 to-amber-300 shadow-sm shadow-orange-400/50',
          chordActive: 'bg-orange-500 text-black border-orange-300 shadow-md shadow-orange-500/60 font-black scale-105',
          activeIndicator: 'bg-orange-400',
        };
    }
  };

  const currentTheme = getKaraokeTheme();

  return (
    <div
      style={{
        backgroundColor: themeConfig.colors.stageBg,
        color: themeConfig.colors.stageText,
      }}
      className={`stage-mode-container fixed inset-0 z-50 flex flex-col select-none overflow-hidden font-sans ${
        theme === 'stage_light' ? 'theme-stage-light text-black' : theme === 'studio_slate' ? 'theme-studio-slate text-slate-100' : 'theme-stage-dark text-white'
      }`}
    >
      
      {/* Toast Notification for Speed Adjustment */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-zinc-900/95 text-orange-400 border border-orange-500/50 shadow-2xl px-4 py-2 rounded-full text-xs font-bold font-mono animate-fade-in flex items-center gap-2 pointer-events-none">
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Stage Bar (HUD) */}
      <header
        style={{
          backgroundColor: themeConfig.colors.bgHeader,
          borderColor: themeConfig.colors.border,
        }}
        className="px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0 relative border-b transition-colors"
      >
        
        {/* Song Info & Index & Brand with Grand Format Logo */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-24 sm:w-28 rounded-lg bg-white border border-zinc-700 flex items-center justify-center p-1 overflow-hidden shadow-md hidden sm:flex flex-shrink-0" title="Hamide Litime Software">
            <img
              src="/logo-wide.jpg"
              alt="Hamide Litime Software Logo"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpg';
              }}
            />
          </div>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-orange-400 rounded border border-zinc-700 flex items-center gap-2 cursor-pointer transition"
            title="Ouvrir le menu de la setlist"
          >
            <ListMusic className="w-4 h-4" />
            {setlist && (
              <span className="text-xs font-mono font-bold hidden md:inline">
                {currentIndex + 1}/{trackEntries.length}
              </span>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1
                style={{ color: themeConfig.colors.textPrimary }}
                className="text-sm sm:text-base font-black leading-tight tracking-tight"
              >
                {currentSong.title}
              </h1>
              <span className="px-2 py-0.5 bg-orange-500 text-black rounded text-xs font-bold font-mono">
                {targetKey}
              </span>
            </div>
            <p
              style={{ color: themeConfig.colors.textMuted }}
              className="text-[11px] font-semibold truncate max-w-[180px] sm:max-w-xs"
            >
              {currentSong.artist}
            </p>
          </div>
        </div>

        {/* Center: BPM & Beat accompaniment buttons */}
        <div className="flex items-center gap-2">
          {/* Visual 4-beat pulse indicators */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 px-2.5 py-1.5 rounded">
            <span className="text-[10px] text-zinc-400 font-bold uppercase">BPM</span>
            <span className="text-xs font-bold font-mono text-orange-400">{currentSong.bpm}</span>
            <div className="flex items-center gap-0.5 ml-1">
              {[1, 2, 3, 4].map((b) => {
                const isActive = activeBeat?.beat === b;
                return (
                  <div
                    key={b}
                    className={`w-2 h-3.5 rounded-sm transition-all duration-75 ${
                      isActive
                        ? b === 1
                          ? 'bg-orange-400 scale-110 shadow-md shadow-orange-400'
                          : 'bg-green-400 scale-105'
                        : 'bg-zinc-800'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Quick Rhythm / Drum Beat Button */}
          <button
            onClick={toggleRhythm}
            className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isRhythmPlaying
                ? 'bg-orange-500 text-black border-orange-400 shadow-md animate-pulse font-extrabold'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700'
            }`}
            title="Activer/Désactiver le battement d'accompagnement batterie (Raccourci: B)"
          >
            <Zap className={`w-3.5 h-3.5 ${isRhythmPlaying ? 'fill-current' : 'text-orange-400'}`} />
            <span className="hidden sm:inline">{isRhythmPlaying ? 'Battement Actif' : 'Battement'}</span>
          </button>

          {/* Simple Metronome Click Button */}
          <button
            onClick={toggleMetronome}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isMetronomePlaying
                ? 'bg-amber-500 text-black border-amber-400 shadow'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
            title="Activer/Désactiver le clic métronome"
          >
            {isMetronomePlaying ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">Clic</span>
          </button>

          {/* MIDI Multi-Track & SF2 Player Toggle Button */}
          <button
            onClick={() => {
              setDockViewMode('midi');
              setIsJamDockOpen((prev) => (!isJamDockOpen || dockViewMode !== 'midi' ? true : false));
            }}
            className={`px-3 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isJamDockOpen && dockViewMode === 'midi'
                ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/30'
                : 'bg-purple-950/40 text-purple-300 border-purple-800 hover:bg-purple-900/40'
            }`}
            title="Ouvrir le Lecteur MIDI Multi-pistes & VSampler 3 (Raccourci: M)"
          >
            <Piano className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Lecteur MIDI</span>
            {midiPlaybackState.isPlaying && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            )}
          </button>

          {/* Mode Switcher: Défilement Continu (Auto-Scroll) vs Karaoké */}
          <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
            <button
              onClick={() => {
                setIsKaraokeMode(false);
                setShowInlineTimeControls(false);
                showToast('📜 Mode Défilement Continu (100% Automatique & Fluide)');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                !isKaraokeMode
                  ? 'bg-orange-500 text-black shadow font-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Défilement automatique continu fluide sans prise de tête (Recommandé)"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Défilement Continu</span>
            </button>

            <button
              onClick={() => {
                setIsKaraokeMode(true);
                showToast('✨ Mode Karaoké Lumineux Activé');
              }}
              className={`px-2.5 py-1.5 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                isKaraokeMode
                  ? `${currentTheme.badge} shadow font-black`
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Surlignage ligne par ligne de chant synchronisé"
            >
              <Mic2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Karaoké</span>
            </button>
          </div>

          {/* Quick Clean Repères Button if song has {time:...} tags */}
          {parsedChordProLines.some((l) => l.taggedSeconds !== undefined) && (
            <button
              onClick={handleResetKaraokeTimings}
              className="px-2 py-1.5 bg-zinc-900 hover:bg-red-950/80 text-zinc-400 hover:text-red-300 border border-zinc-800 hover:border-red-800 rounded text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
              title="Supprimer tous les repères {time:...} du morceau pour un texte 100% propre"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Nettoyer Partition</span>
            </button>
          )}

          {/* Jam Track Video/Audio Toggle Button */}
          <button
            onClick={() => {
              setDockViewMode('backing');
              setIsJamDockOpen((prev) => (!isJamDockOpen || dockViewMode !== 'backing' ? true : false));
            }}
            className={`px-2.5 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isJamDockOpen && dockViewMode === 'backing'
                ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
            }`}
            title="Afficher la vidéo ou backing track YouTube (Raccourci: J)"
          >
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Vidéo / Jam</span>
          </button>

          {/* Guitar Stage Tuner & Guitar Rig 7 Remote Button */}
          <button
            onClick={() => setIsGuitarStudioOpen((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isGuitarStudioOpen
                ? 'bg-orange-500 text-black border-orange-400 shadow-lg shadow-orange-500/30'
                : 'bg-zinc-800 text-orange-400 border-zinc-700 hover:text-white'
            }`}
            title="Accordeur Guitare & Télécommande Guitar Rig 7"
          >
            <Guitar className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Guitare / Rig</span>
          </button>

          {/* VSampler 3 Multi-Timbral Auto-Routing Button */}
          <button
            onClick={() => setIsVSamplerModalOpen((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              isVSamplerModalOpen
                ? 'bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-500/30'
                : 'bg-purple-950/40 text-purple-300 border-purple-800 hover:text-white hover:bg-purple-900/50'
            }`}
            title="Routeur VSampler 3 (Envoi automatique des instruments sur les 16 ports)"
          >
            <Piano className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">VSampler 3</span>
          </button>
        </div>

        {/* Stage Teleprompter Controls: Fine Scroll & Font Zoom */}
        <div className="flex items-center gap-2">
          
          {/* Rich Fine-Tuned Scroll & Karaoke Options Widget */}
          <div className="relative">
            <button
              onClick={() => setIsSpeedPanelOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold border transition cursor-pointer ${
                isSpeedPanelOpen
                  ? 'bg-orange-500 text-black border-orange-400 shadow'
                  : 'bg-zinc-950 text-orange-400 border-zinc-800 hover:border-orange-500/50'
              }`}
              title="Ouvrir les réglages de défilement et de Karaoké"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="font-mono">{scrollSpeed} px/s</span>
              <span className="text-[10px] opacity-75 font-sans hidden sm:inline">
                {scrollSyncMode === 'midi_realtime' ? '(MIDI)' : scrollSyncMode === 'tempo_duration' ? '(Auto)' : '(Man)'}
              </span>
            </button>

            {/* Expanded Fine-Tuning Dropdown Panel */}
            {isSpeedPanelOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-700 rounded-xl p-4 shadow-2xl z-50 space-y-3.5 animate-fade-in text-xs max-h-[85vh] overflow-y-auto">
                
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" /> Réglages Scène & Karaoké
                  </span>
                  <button
                    onClick={() => setIsSpeedPanelOpen(false)}
                    className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Section Karaoké Lumineux & Synchronisation Avancée */}
                <div className="space-y-2.5 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Mic2 className="w-4 h-4 text-orange-400" />
                      <span className="font-bold text-white">Illumination Karaoké</span>
                    </div>
                    <button
                      onClick={() => setIsKaraokeMode((k) => !k)}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                        isKaraokeMode ? 'bg-orange-500 text-black font-extrabold shadow' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isKaraokeMode ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
                    </button>
                  </div>

                  {isKaraokeMode && (
                    <div className="space-y-3 pt-1 border-t border-zinc-800/80">
                      <div>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase">Couleur d'illumination :</span>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                          {[
                            { id: 'orange', label: 'Orange', bg: 'bg-orange-500' },
                            { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
                            { id: 'gold', label: 'Or Scène', bg: 'bg-amber-400' },
                            { id: 'emerald', label: 'Émeraude', bg: 'bg-emerald-500' },
                          ].map((col) => (
                            <button
                              key={col.id}
                              onClick={() => setKaraokeColor(col.id as any)}
                              className={`py-1 px-1.5 rounded text-[10px] font-bold border transition text-center cursor-pointer ${
                                karaokeColor === col.id
                                  ? `${col.bg} text-black font-black border-white shadow`
                                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                              }`}
                            >
                              {col.label}
                            </button>
                          ))}
                        </div>
                      </div>

                        {/* Outils de Synchronisation */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                          <span className="text-[10px] text-zinc-400 font-bold uppercase">Calage & Vitesse Musicale :</span>
                          
                          <button
                            onClick={handleAutoSyncWithTempo}
                            className="w-full py-2 px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/30 cursor-pointer"
                            title="Calage instantané basé sur le tempo (BPM) et la durée du morceau pour toutes les lignes"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>⚡ Caler Automatiquement au Tempo ({currentSong?.bpm || 110} BPM)</span>
                          </button>

                          <button
                            onClick={handleAutoSyncWithMidi}
                            className="w-full py-1.5 px-3 bg-purple-950 hover:bg-purple-900 text-purple-200 border border-purple-800 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                            title="Analyse la piste mélodique du MIDI pour caler automatiquement chaque ligne au chant"
                          >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>⚡ Détection Automatique Notes MIDI</span>
                          </button>

                          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                            <button
                              onClick={() => {
                                setIsTapSyncRecording((prev) => !prev);
                                setTapSyncLineIndex(0);
                                if (!midiPlaybackState.isPlaying) {
                                  midiAudioEngine.play();
                                }
                              }}
                              className={`py-1.5 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                                isTapSyncRecording
                                  ? 'bg-red-600 text-white border-red-400 animate-pulse'
                                  : 'bg-zinc-900 text-zinc-200 border-zinc-700 hover:bg-zinc-800'
                              }`}
                              title="Calibrez chaque ligne au rythme en appuyant sur la touche Espace pendant la lecture"
                            >
                              <Target className="w-3.5 h-3.5 text-red-400" />
                              <span>{isTapSyncRecording ? 'Arrêter Tap-Sync' : '🎙️ Enregistrer direct'}</span>
                            </button>

                            <button
                              onClick={handleResetKaraokeTimings}
                              className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                              title="Effacer tous les repères de temps {time:...}"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Effacer repères</span>
                            </button>
                          </div>
                        </div>

                        {/* Prompter Anticipation (Avance de lecture chant) */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-300 font-medium">Anticipation Prompteur (Avance chant) :</span>
                            <span className="text-xs font-bold font-mono text-amber-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                              +{prompterAnticipationSec.toFixed(1)}s
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="3"
                              step="0.1"
                              value={prompterAnticipationSec}
                              onChange={(e) => setPrompterAnticipationSec(parseFloat(e.target.value))}
                              className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                            />
                          </div>
                          <div className="grid grid-cols-4 gap-1">
                            {[
                              { label: '0s (Réel)', val: 0.0 },
                              { label: '+0.5s', val: 0.5 },
                              { label: '+0.8s (Idéal)', val: 0.8 },
                              { label: '+1.5s', val: 1.5 },
                            ].map((opt) => (
                              <button
                                key={opt.val}
                                onClick={() => setPrompterAnticipationSec(opt.val)}
                                className={`py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  Math.abs(prompterAnticipationSec - opt.val) < 0.05
                                    ? 'bg-amber-500 text-black border-white font-black'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Playback Tempo Speed Multiplier */}
                        <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-zinc-300 font-medium">Vitesse / Tempo de Lecture :</span>
                            <span className="text-xs font-bold font-mono text-orange-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                              {midiPlaybackState.tempoMultiplier.toFixed(2)}x
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {[0.75, 0.9, 1.0, 1.1, 1.25].map((mult) => (
                              <button
                                key={mult}
                                onClick={() => {
                                  midiAudioEngine.setTempoMultiplier(mult);
                                  setMidiPlaybackState(midiAudioEngine.getState());
                                  showToast(`⚡ Vitesse de lecture réglée à ${mult}x`);
                                }}
                                className={`py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                                  Math.abs(midiPlaybackState.tempoMultiplier - mult) < 0.03
                                    ? 'bg-orange-500 text-black border-white font-black shadow'
                                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                                }`}
                              >
                                {mult}x
                              </button>
                            ))}
                          </div>
                        </div>

                      {/* Intro Delay Slider */}
                      <div className="space-y-1.5 pt-1 border-t border-zinc-900">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-300 font-medium">Délai d'Intro (début du chant) :</span>
                          <span className="text-xs font-bold font-mono text-orange-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                            {effectiveIntroSeconds.toFixed(1)}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0"
                            max="60"
                            step="0.5"
                            value={effectiveIntroSeconds}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setCustomIntroSeconds(val);
                            }}
                            className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                          />
                          {detectedIntroDuration > 0 && (
                            <button
                              onClick={() => {
                                setCustomIntroSeconds(detectedIntroDuration);
                                showToast(`⚡ Intro calée sur le MIDI (${detectedIntroDuration}s)`);
                              }}
                              className="px-1.5 py-0.5 bg-purple-950 text-purple-300 hover:text-white border border-purple-800 rounded text-[10px] font-bold cursor-pointer"
                              title="Utiliser l'intro détectée dans le MIDI"
                            >
                              Auto ({detectedIntroDuration}s)
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-zinc-300">Centrage automatique sur le texte :</span>
                        <input
                          type="checkbox"
                          checked={autoCenterKaraoke}
                          onChange={(e) => setAutoCenterKaraoke(e.target.checked)}
                          className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Synchronization Modes */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase">Mode de Synchronisation :</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    
                    <button
                      onClick={() => {
                        setScrollSyncMode('midi_realtime');
                        showToast('⚡ Défilement asservi en temps réel au MIDI');
                      }}
                      className={`p-2 rounded border text-center transition cursor-pointer ${
                        scrollSyncMode === 'midi_realtime'
                          ? 'bg-purple-950 border-purple-500 text-purple-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Suit directement le timing et la lecture du fichier MIDI"
                    >
                      <div className="text-sm">⚡</div>
                      <div className="text-[10px] mt-0.5">Sync MIDI</div>
                    </button>

                    <button
                      onClick={() => {
                        setScrollSyncMode('tempo_duration');
                        if (currentSong) recalculateTempoScrollSpeed(currentSong);
                        showToast('⏱️ Défilement calibré sur la durée du morceau');
                      }}
                      className={`p-2 rounded border text-center transition cursor-pointer ${
                        scrollSyncMode === 'tempo_duration'
                          ? 'bg-orange-950 border-orange-500 text-orange-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Calcule la vitesse exacte pour arriver en bas à la fin du morceau"
                    >
                      <div className="text-sm">⏱️</div>
                      <div className="text-[10px] mt-0.5">Sync Durée</div>
                    </button>

                    <button
                      onClick={() => {
                        setScrollSyncMode('manual');
                        showToast('🎚️ Mode Vitesse Libre');
                      }}
                      className={`p-2 rounded border text-center transition cursor-pointer ${
                        scrollSyncMode === 'manual'
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                      title="Vitesse fixe personnalisée avec réglage fin au pixel près"
                    >
                      <div className="text-sm">🎚️</div>
                      <div className="text-[10px] mt-0.5">Manuel</div>
                    </button>

                  </div>
                </div>

                {/* Fine Precision Slider & Steppers */}
                <div className="space-y-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-300 font-medium">Vitesse de Défilement :</span>
                    <span className="text-xs font-bold font-mono text-orange-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-700">
                      {scrollSpeed} px/s
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setScrollSyncMode('manual');
                        setScrollSpeed((prev) => Math.max(1, Number((prev - 0.5).toFixed(1))));
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-bold cursor-pointer"
                      title="-0.5 px/s"
                    >
                      -
                    </button>

                    <input
                      type="range"
                      min="1.0"
                      max="40.0"
                      step="0.5"
                      value={scrollSpeed}
                      onChange={(e) => {
                        setScrollSyncMode('manual');
                        setScrollSpeed(Number(Number(e.target.value).toFixed(1)));
                      }}
                      className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
                    />

                    <button
                      onClick={() => {
                        setScrollSyncMode('manual');
                        setScrollSpeed((prev) => Math.min(60, Number((prev + 0.5).toFixed(1))));
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-bold cursor-pointer"
                      title="+0.5 px/s"
                    >
                      +
                    </button>
                  </div>

                  {/* Quick Preset Speed Buttons */}
                  <div className="flex items-center justify-between gap-1 pt-1">
                    {[
                      { label: '🐢 2', val: 2.0, desc: 'Très Lent' },
                      { label: '🚶 5', val: 5.0, desc: 'Lent (3-4 min)' },
                      { label: '🎵 9', val: 9.0, desc: 'Moyen' },
                      { label: '⚡ 15', val: 15.0, desc: 'Dynamique' },
                      { label: '🚀 25', val: 25.0, desc: 'Rapide' },
                    ].map((p) => (
                      <button
                        key={p.val}
                        onClick={() => {
                          setScrollSyncMode('manual');
                          setScrollSpeed(p.val);
                        }}
                        className={`px-1.5 py-1 text-[10px] font-bold rounded transition flex-1 text-center cursor-pointer ${
                          scrollSpeed === p.val
                            ? 'bg-orange-500 text-black font-extrabold shadow'
                            : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                        title={`${p.desc} (${p.val} px/s)`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Recalculate Button */}
                <button
                  onClick={() => {
                    setScrollSyncMode('tempo_duration');
                    if (currentSong) recalculateTempoScrollSpeed(currentSong);
                    showToast('🎯 Vitesse recalculée selon la partition');
                  }}
                  className="w-full py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-zinc-700"
                >
                  <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                  <span>Calculer vitesse idéale pour ce morceau</span>
                </button>

                <p className="text-[10px] text-zinc-500">
                  💡 <em>Astuce Karaoké :</em> Cliquez sur <strong>n'importe quelle ligne de paroles</strong> pour sauter instantanément à cet endroit dans la chanson !
                </p>

              </div>
            )}
          </div>

          {/* Font Zoom */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded">
            <button
              onClick={() => setFontSize((f) => Math.max(0.9, f - 0.15))}
              className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              title="Diminuer la taille du texte"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold px-1 text-orange-400">
              {(fontSize * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setFontSize((f) => Math.min(2.2, f + 0.15))}
              className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
              title="Agrandir la taille du texte"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          
          {/* Live Stage Circumstances Selector (Dark Stage / Plein Soleil / Studio) */}
          <StageCircumstancesSelector isStageView={true} />

          <button
            onClick={toggleFullscreenMode}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-zinc-700 cursor-pointer"
            title="Plein Écran"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onExitStageMode}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded transition cursor-pointer"
            title="Quitter le Mode Scène"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </header>

      {/* Interactive Top Teleprompter Progress Bar */}
      <div
        ref={progressBarRef}
        onClick={handleProgressBarClick}
        className="w-full h-2 bg-zinc-950 hover:h-3.5 border-b border-zinc-800 transition-all cursor-pointer relative group flex-shrink-0"
        title="Cliquez pour sauter directement dans la partition"
      >
        <div
          className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-400 transition-all duration-100"
          style={{ width: `${scrollProgressPercent}%` }}
        />
        
        {/* Progress Tooltip / Indicator */}
        <div className="absolute left-2 top-0 bottom-0 flex items-center opacity-0 group-hover:opacity-100 transition text-[9px] font-mono text-zinc-300 pointer-events-none">
          <span>Défilement : {scrollProgressPercent.toFixed(0)}%</span>
          {midiPlaybackState.duration > 0 && (
            <span className="ml-2 text-orange-400">
              • {formatTime(midiPlaybackState.currentTime)} / {formatTime(midiPlaybackState.duration)}
            </span>
          )}
        </div>
      </div>

      {/* Main Workspace (Partition + Optional Side Dock Jam Track) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Main Lyrics & Chords Teleprompter Canvas */}
        <main
          ref={contentRef}
          onScroll={handleScroll}
          className={`flex-1 overflow-y-auto p-6 sm:p-10 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 transition-all ${
            isJamDockOpen ? 'md:w-3/5 lg:w-2/3' : 'max-w-5xl mx-auto w-full'
          }`}
          style={{ fontSize: `${fontSize}rem` }}
        >
          {/* Live Tap-to-Sync Calibration Recorder Toolbar */}
          {isTapSyncRecording && (
            <div className="sticky top-0 z-40 bg-gradient-to-r from-red-950 via-zinc-900 to-red-950 border-2 border-red-500 rounded-xl p-4 shadow-2xl shadow-red-900/50 mb-6 animate-pulse">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-red-300">
                      🔴 Enregistrement du calage en direct (Tap-Sync)
                    </div>
                    <div className="text-[11px] text-zinc-300">
                      Ligne {tapSyncLineIndex + 1} sur {totalLyricLines} • Timing MIDI : <span className="font-mono text-orange-400 font-bold">{formatTime(midiPlaybackState.currentTime)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleTapSyncAdvance}
                    className="flex-1 sm:flex-none py-2 px-4 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-lg text-xs tracking-wider uppercase shadow-lg shadow-red-600/40 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    title="Valider la ligne actuelle et passer à la suivante (Touche ESPACE)"
                  >
                    <Target className="w-4 h-4" />
                    <span>MARQUER CETTE LIGNE (Espace)</span>
                  </button>

                  <button
                    onClick={handleSaveTapSyncToSong}
                    className="py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                    title="Enregistrer définitivement tous les repères dans la partition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Sauvegarder</span>
                  </button>

                  <button
                    onClick={() => setIsTapSyncRecording(false)}
                    className="py-2 px-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs cursor-pointer"
                    title="Fermer sans sauvegarder"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Intro Musicale Countdown Banner */}
          {isKaraokeMode && isIntroActive && (
            <div className="p-4 bg-gradient-to-r from-purple-950/80 via-indigo-950/60 to-purple-950/80 border border-purple-500/50 rounded-xl mb-6 shadow-xl shadow-purple-950/40 text-center space-y-2 animate-fade-in">
              <div className="flex items-center justify-center gap-2 text-purple-200 text-xs sm:text-sm font-extrabold tracking-wider uppercase">
                <Music className="w-4 h-4 text-purple-400 animate-spin" />
                <span>⏳ INTRO MUSICALE EN COURS • Début du chant dans {Math.ceil(introRemainingSeconds)}s</span>
              </div>
              <div className="w-full h-1.5 bg-purple-950 rounded-full overflow-hidden border border-purple-800/60 max-w-md mx-auto">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.max(0, (midiPlaybackState.currentTime / effectiveIntroSeconds) * 100))}%` }}
                />
              </div>
              <div className="text-[10px] text-purple-300 font-mono">
                {formatTime(midiPlaybackState.currentTime)} / {formatTime(effectiveIntroSeconds)} • Tenez-vous prêt(e) pour la 1ère ligne !
              </div>
            </div>
          )}

          {/* Performance Notes Banner */}
          {currentSong.notes && (
            <div className="p-3.5 bg-orange-500/10 border-l-2 border-orange-500 text-orange-200 text-xs font-semibold rounded-r mb-6">
              💡 {currentSong.notes}
            </div>
          )}

          {/* Karaoke Transposed Chord Chart */}
          <div className="space-y-3">
            {parsedChordProLines.map((item, idx) => {
              if (item.type === 'comment' || item.type === 'empty') return null;

              if (item.type === 'section') {
                return (
                  <div key={`sec-${idx}`} className="pt-6 pb-2 flex items-center gap-3">
                    <span className="px-3.5 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-black font-extrabold rounded-md text-xs tracking-wider uppercase font-mono shadow-md shadow-orange-500/20 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 fill-black" />
                      <span>{item.sectionName}</span>
                    </span>
                    <div className="flex-1 h-px bg-zinc-800/80"></div>
                  </div>
                );
              }

              // Lyric / Chord Line
              const isActive = isKaraokeMode && item.lyricIndex === activeKaraokeLyricIndex && !isIntroActive;
              const isNext = isKaraokeMode && item.lyricIndex === activeKaraokeLyricIndex + 1;
              const isPast = isKaraokeMode && item.lyricIndex !== undefined && item.lyricIndex < activeKaraokeLyricIndex;
              const hasExplicitTime = item.taggedSeconds !== undefined || (item.lyricIndex !== undefined && recordedLineTimings[item.lyricIndex] !== undefined);
              const displayTimeSec = item.taggedSeconds !== undefined ? item.taggedSeconds : (item.lyricIndex !== undefined ? recordedLineTimings[item.lyricIndex] : undefined);

              return (
                <div
                  key={`line-${idx}`}
                  ref={isActive ? activeLineRef : undefined}
                  onClick={() => item.lyricIndex !== undefined && handleSeekToLyricLine(item.lyricIndex)}
                  className={`relative rounded-r-xl transition-all duration-200 cursor-pointer group px-3 py-2 ${
                    isActive
                      ? theme === 'stage_light'
                        ? 'bg-amber-100/95 border-l-4 border-amber-600 shadow-md scale-[1.01] my-2'
                        : theme === 'studio_slate'
                        ? 'bg-sky-950/60 border-l-4 border-sky-400 shadow-2xl scale-[1.01] my-2'
                        : `bg-gradient-to-r ${currentTheme.bgGradient} border-l-4 ${currentTheme.border} shadow-2xl scale-[1.01] my-2`
                      : isNext
                      ? theme === 'stage_light'
                        ? 'border-l-2 border-slate-400 bg-slate-100/80 hover:bg-slate-200/80'
                        : 'border-l-2 border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900/60'
                      : isPast
                      ? theme === 'stage_light'
                        ? 'opacity-70 hover:opacity-100 border-l-2 border-transparent hover:border-slate-400'
                        : 'opacity-60 hover:opacity-100 border-l-2 border-transparent hover:border-zinc-700 hover:bg-zinc-900/40'
                      : theme === 'stage_light'
                      ? 'hover:bg-slate-100/80 border-l-2 border-transparent hover:border-slate-300'
                      : 'hover:bg-zinc-900/40 border-l-2 border-transparent hover:border-zinc-700'
                  }`}
                  title="Cliquer pour caler le Karaoké / MIDI directement sur cette ligne"
                >
                  {/* Live Karaoke Progression Underline Bar */}
                  {isActive && (
                    <div className="absolute left-0 bottom-0 h-1 bg-zinc-800 w-full rounded-full overflow-hidden">
                      <div
                        className={`h-full ${currentTheme.progressBar} transition-all duration-75`}
                        style={{ width: `${Math.min(100, Math.max(0, activeLineProgress * 100))}%` }}
                      />
                    </div>
                  )}

                  {/* Active Indicator & Line Time Tag & Calibration Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    {isActive ? (
                      <div className="flex items-center gap-2 animate-fade-in">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${currentTheme.badge}`}>
                          <Mic2 className="w-3 h-3 fill-current" />
                          <span>Chantez</span>
                        </span>
                        {midiPlaybackState.duration > 0 && (
                          <span className="text-[10px] font-mono font-bold text-zinc-400">
                            ⏱️ {formatTime(midiPlaybackState.currentTime)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Interactive Line Timestamp and Calibration Steppers */}
                    {showInlineTimeControls && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {displayTimeSec !== undefined ? (
                          <div className="flex items-center bg-zinc-950/90 border border-amber-500/40 rounded-lg px-2 py-0.5 gap-1 shadow-sm">
                            <span
                              onClick={() => item.lyricIndex !== undefined && handleSeekToLyricLine(item.lyricIndex)}
                              className="text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
                              title="Cliquer pour sauter à ce moment"
                            >
                              ⏱️ {formatTime(displayTimeSec)}
                            </span>
                            
                            {/* Stepper -0.5s */}
                            <button
                              type="button"
                              onClick={() => item.lyricIndex !== undefined && handleUpdateLineTimeDirectly(item.lyricIndex, Math.max(0, Number((displayTimeSec - 0.5).toFixed(1))))}
                              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                              title="Avancer de -0.5s"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>

                            {/* Stepper +0.5s */}
                            <button
                              type="button"
                              onClick={() => item.lyricIndex !== undefined && handleUpdateLineTimeDirectly(item.lyricIndex, Number((displayTimeSec + 0.5).toFixed(1)))}
                              className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                              title="Reculer de +0.5s"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>

                            {/* Delete Timestamp */}
                            <button
                              type="button"
                              onClick={() => item.lyricIndex !== undefined && handleUpdateLineTimeDirectly(item.lyricIndex, undefined)}
                              className="p-1 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 rounded transition cursor-pointer"
                              title="Supprimer ce repère de temps"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : null}

                        {/* 1-Click "Caler sur Chrono Actuel" button */}
                        <button
                          type="button"
                          onClick={() => {
                            if (item.lyricIndex !== undefined) {
                              handleUpdateLineTimeDirectly(item.lyricIndex, Number(midiPlaybackState.currentTime.toFixed(1)));
                            }
                          }}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                            isActive
                              ? 'bg-amber-500 text-black border-amber-400 hover:bg-amber-400 shadow'
                              : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-amber-500 opacity-0 group-hover:opacity-100'
                          }`}
                          title={`Caler cette ligne exactement sur le temps de lecture actuel (${formatTime(midiPlaybackState.currentTime)})`}
                        >
                          <Target className="w-3 h-3 text-amber-500" />
                          <span>📍 Caler à {formatTime(midiPlaybackState.currentTime)}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Lyrics Content without Chords */}
                  {!item.hasChords ? (
                    <p
                      style={{
                        color:
                          theme === 'stage_light'
                            ? isActive
                              ? '#000000'
                              : isNext
                              ? '#1e293b'
                              : isPast
                              ? '#475569'
                              : '#000000'
                            : theme === 'studio_slate'
                            ? isActive
                              ? '#38bdf8'
                              : isNext
                              ? '#cbd5e1'
                              : isPast
                              ? '#64748b'
                              : '#f8fafc'
                            : isActive
                            ? '#ffffff'
                            : isNext
                            ? '#f8fafc'
                            : isPast
                            ? '#94a3b8'
                            : '#ffffff',
                      }}
                      className={`font-sans leading-relaxed min-h-[1.5em] transition-colors ${
                        isActive
                          ? theme === 'stage_light'
                            ? 'font-black text-[1.15em] tracking-tight'
                            : `${currentTheme.textGlow} font-black text-[1.12em]`
                          : isNext
                          ? theme === 'stage_light'
                            ? 'font-extrabold text-[1.02em]'
                            : 'font-bold'
                          : isPast
                          ? theme === 'stage_light'
                            ? 'font-semibold'
                            : 'font-medium'
                          : theme === 'stage_light'
                          ? 'font-extrabold'
                          : 'font-semibold'
                      }`}
                    >
                      {item.text}
                    </p>
                  ) : (
                    /* Lyrics Content with Chords */
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-2 py-0.5">
                      {item.parts?.map((part, pIdx) => {
                        if (part.isChord) {
                          return (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenChordModal(part.text);
                              }}
                              style={{
                                backgroundColor:
                                  theme === 'stage_light'
                                    ? isActive
                                      ? '#f59e0b'
                                      : '#fef08a'
                                    : theme === 'studio_slate'
                                    ? isActive
                                      ? '#0284c7'
                                      : '#1e293b'
                                    : isActive
                                    ? '#f97316'
                                    : '#1e1e24',
                                color:
                                  theme === 'stage_light'
                                    ? '#000000'
                                    : theme === 'studio_slate'
                                    ? isActive
                                      ? '#ffffff'
                                      : '#38bdf8'
                                    : isActive
                                    ? '#000000'
                                    : '#fb923c',
                                border:
                                  theme === 'stage_light'
                                    ? '2px solid #000000'
                                    : theme === 'studio_slate'
                                    ? '1px solid #0ea5e9'
                                    : undefined,
                              }}
                              className={`px-3 py-1 font-mono font-black rounded-md text-xs transition cursor-pointer shadow-md ${
                                isActive
                                  ? currentTheme.chordActive
                                  : 'hover:opacity-90'
                              }`}
                            >
                              {part.text}
                            </button>
                          );
                        }

                        return (
                          <span
                            key={pIdx}
                            style={{
                              color:
                                theme === 'stage_light'
                                  ? isActive
                                    ? '#000000'
                                    : isNext
                                    ? '#1e293b'
                                    : isPast
                                    ? '#475569'
                                    : '#000000'
                                  : theme === 'studio_slate'
                                  ? isActive
                                    ? '#38bdf8'
                                    : isNext
                                    ? '#cbd5e1'
                                    : isPast
                                    ? '#64748b'
                                    : '#f8fafc'
                                  : isActive
                                  ? '#ffffff'
                                  : isNext
                                  ? '#f8fafc'
                                  : isPast
                                  ? '#94a3b8'
                                  : '#ffffff',
                            }}
                            className={`font-sans transition-colors ${
                              isActive
                                ? theme === 'stage_light'
                                  ? 'font-black text-[1.15em] tracking-tight'
                                  : `${currentTheme.textGlow} font-black text-[1.12em]`
                                : isNext
                                ? theme === 'stage_light'
                                  ? 'font-extrabold text-[1.02em]'
                                  : 'font-bold'
                                : isPast
                                ? theme === 'stage_light'
                                  ? 'font-semibold'
                                  : 'font-medium'
                                : theme === 'stage_light'
                                ? 'font-extrabold'
                                : 'font-semibold'
                            }`}
                          >
                            {part.text}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Hover Jump Tooltip */}
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition text-[10px] font-mono text-zinc-400 bg-zinc-950 px-2 py-1 rounded border border-zinc-800 pointer-events-none">
                    🎯 Caler Karaoké ici
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Spacing Buffer for smooth scrolling past end */}
          <div className="h-96" />
        </main>

        {/* Side-by-Side Docked Accompaniment View (MIDI Multi-Tracks with SF2 or Jam Video) */}
        {isJamDockOpen && (
          <aside className="w-full md:w-2/5 lg:w-[42%] border-t md:border-t-0 md:border-l border-zinc-800 bg-zinc-950 flex flex-col h-96 md:h-auto overflow-hidden animate-fade-in shadow-2xl flex-shrink-0">
            {/* Dock Top Tabs Switcher */}
            <div className="flex items-center justify-between p-2 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-1 bg-zinc-950 p-0.5 rounded border border-zinc-800">
                <button
                  onClick={() => setDockViewMode('midi')}
                  className={`px-3 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                    dockViewMode === 'midi'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Piano className="w-3.5 h-3.5" />
                  <span>Lecteur MIDI & VSampler 3</span>
                </button>

                <button
                  onClick={() => setDockViewMode('backing')}
                  className={`px-3 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                    dockViewMode === 'backing'
                      ? 'bg-orange-600 text-white shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span>Vidéo / Audio Jam</span>
                </button>
              </div>

              <button
                onClick={() => setIsJamDockOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
                title="Fermer le volet latéral"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Active Dock Component */}
            <div className="flex-1 overflow-hidden">
              {dockViewMode === 'midi' ? (
                <MidiMultiTrackPlayer
                  currentSong={currentSong}
                  mode="dock"
                  onClose={() => setIsJamDockOpen(false)}
                  isAutoScrolling={isScrolling}
                  onToggleAutoScroll={toggleAutoScroll}
                  onSaveMidiToSong={(base64, fileName) => {
                    if (currentSong && onUpdateSong) {
                      onUpdateSong({
                        ...currentSong,
                        midiData: base64,
                        midiFileName: fileName,
                        updatedAt: Date.now(),
                      });
                    }
                  }}
                />
              ) : (
                <JamTrackPlayer
                  currentSong={currentSong}
                  mode="dock"
                  onClose={() => setIsJamDockOpen(false)}
                  isAutoScrolling={isScrolling}
                  onToggleAutoScroll={toggleAutoScroll}
                />
              )}
            </div>
          </aside>
        )}

      </div>

      {/* Bottom Stage Control Dock */}
      <footer className="bg-zinc-900 border-t border-zinc-800 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
        
        {/* Song Switchers */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevSong}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs rounded border border-zinc-700 transition cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
            <span className="hidden sm:inline">Précédent</span>
          </button>

          <button
            onClick={handleNextSong}
            disabled={currentIndex === trackEntries.length - 1}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-white font-bold text-xs rounded border border-zinc-700 transition cursor-pointer"
          >
            <span className="hidden sm:inline">Suivant</span>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Play / Pause Controls (Auto-Scroll & Master Play) */}
        <div className="flex items-center gap-2.5">
          
          <button
            onClick={() => {
              if (contentRef.current) contentRef.current.scrollTop = 0;
              if (midiPlaybackState.duration > 0) midiAudioEngine.seek(0);
              showToast('⏮️ Début');
            }}
            className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
            title="Remonter au début de la partition (Raccourci: R ou Origine)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Autoscroll Only Button */}
          <button
            onClick={toggleAutoScroll}
            className={`flex items-center gap-2 px-4 py-2.5 rounded font-bold text-xs uppercase tracking-wider transition shadow cursor-pointer ${
              isScrolling
                ? 'bg-orange-500 text-black hover:bg-orange-400 shadow-orange-500/30'
                : 'bg-zinc-800 text-orange-400 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            {isScrolling ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isScrolling ? 'Pause Défilement' : 'Défilement Auto'}</span>
          </button>

          {/* Master Play Button: Défilement + Battement ensemble */}
          <button
            onClick={handleMasterPlayToggle}
            className={`hidden sm:flex items-center gap-2 px-3.5 py-2.5 rounded font-bold text-xs uppercase tracking-wider transition shadow cursor-pointer ${
              isScrolling && isRhythmPlaying
                ? 'bg-red-500 text-white hover:bg-red-400'
                : 'bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30'
            }`}
            title="Lancer le défilement et la batterie d'accompagnement en même temps"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{isScrolling && isRhythmPlaying ? 'Tout Arrêter' : 'Défilement + Batterie'}</span>
          </button>
        </div>

        {/* Right: Quick speed stepper & Next Song Badge */}
        <div className="flex items-center gap-2">
          
          {/* Quick Fine-Tuning Steppers in Footer */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-2 py-1 gap-1">
            <button
              onClick={() => {
                setScrollSyncMode('manual');
                setScrollSpeed((prev) => {
                  const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
                  showToast(`⚡ Vitesse : ${next} px/s`);
                  return next;
                });
              }}
              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              title="Ralentir (-0.5 px/s)"
            >
              -
            </button>

            <button
              onClick={() => setIsSpeedPanelOpen((prev) => !prev)}
              className="text-xs font-mono font-bold text-orange-400 px-1 cursor-pointer hover:underline"
              title="Cliquer pour configurer la vitesse"
            >
              {scrollSpeed} px/s
            </button>

            <button
              onClick={() => {
                setScrollSyncMode('manual');
                setScrollSpeed((prev) => {
                  const next = Math.min(60, Number((prev + 0.5).toFixed(1)));
                  showToast(`⚡ Vitesse : ${next} px/s`);
                  return next;
                });
              }}
              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              title="Accélérer (+0.5 px/s)"
            >
              +
            </button>
          </div>

          {/* Next Song Preview Badge */}
          <div className="hidden lg:flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded text-xs">
            <span className="text-zinc-500 font-bold uppercase text-[10px]">Suivant :</span>
            {nextSong ? (
              <span className="text-orange-400 font-bold font-mono text-xs truncate max-w-[130px]">
                {nextSong.title}
              </span>
            ) : (
              <span className="text-zinc-500 font-medium text-xs">Fin du Set</span>
            )}
          </div>
        </div>

      </footer>

      {/* Floating High-Precision Chronometer & Live Sync Bar (Only in Karaoke Mode) */}
      {isKaraokeMode && (
        <div className="fixed bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 bg-zinc-950/95 backdrop-blur-md border border-zinc-700/80 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center gap-3 max-w-[95vw] sm:max-w-none animate-fade-in">
          <div className="flex items-center gap-2 pr-3 border-r border-zinc-800">
            <Clock className="w-4 h-4 text-orange-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold">Chronomètre Chant</span>
              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-base sm:text-lg font-black text-orange-400">
                  {formatTime(midiPlaybackState.currentTime)}
                </span>
                <span className="text-xs text-zinc-500 font-semibold">
                  / {formatTime(activeSongDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* Playback Controls & Quick Jumps */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => midiAudioEngine.seek(Math.max(0, midiPlaybackState.currentTime - 2))}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold font-mono border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
              title="Reculer de 2 secondes"
            >
              -2s
            </button>

            <button
              onClick={() => {
                if (midiPlaybackState.isPlaying) {
                  midiAudioEngine.pause();
                  setIsScrolling(false);
                } else {
                  midiAudioEngine.play();
                  setIsScrolling(true);
                }
              }}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                midiPlaybackState.isPlaying
                  ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-md'
                  : 'bg-orange-600 text-white hover:bg-orange-500 shadow-md'
              }`}
              title={midiPlaybackState.isPlaying ? 'Mettre en pause' : 'Lancer la lecture'}
            >
              {midiPlaybackState.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => midiAudioEngine.seek(Math.min(activeSongDuration, midiPlaybackState.currentTime + 2))}
              className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold font-mono border border-zinc-800 hover:border-zinc-700 transition cursor-pointer"
              title="Avancer de 2 secondes"
            >
              +2s
            </button>
          </div>

          <div className="h-6 w-px bg-zinc-800 hidden sm:block" />

          {/* Quick Caler la Ligne Active */}
          <button
            onClick={() => {
              if (activeKaraokeLyricIndex !== undefined) {
                handleUpdateLineTimeDirectly(activeKaraokeLyricIndex, Number(midiPlaybackState.currentTime.toFixed(1)));
              }
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer active:scale-95"
            title="Caler la ligne actuellement chantée sur le temps exact du chronomètre"
          >
            <Target className="w-3.5 h-3.5 fill-black" />
            <span>Caler #{activeKaraokeLyricIndex + 1}</span>
          </button>

          {/* 1-Click Auto Tempo BPM Sync */}
          <button
            onClick={handleAutoSyncWithTempo}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/80 rounded-xl text-xs font-bold transition shadow cursor-pointer active:scale-95"
            title="Caler instantanément toutes les lignes sur le tempo BPM"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-300" />
            <span>Caler BPM ({currentSong?.bpm || 110})</span>
          </button>

          {/* Anticipation Prompter Selector */}
          <div className="hidden xl:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1">
            <span className="text-[10px] text-zinc-400 font-bold">Avance chant :</span>
            <button
              onClick={() => {
                const nextVal = prompterAnticipationSec === 0 ? 0.5 : prompterAnticipationSec === 0.5 ? 0.8 : prompterAnticipationSec === 0.8 ? 1.5 : 0;
                setPrompterAnticipationSec(nextVal);
                showToast(`⚡ Anticipation prompteur : +${nextVal}s`);
              }}
              className="text-xs font-mono font-black text-amber-400 hover:underline cursor-pointer"
              title="Cliquez pour changer le temps d'anticipation avant chaque ligne"
            >
              +{prompterAnticipationSec.toFixed(1)}s
            </button>
          </div>

          {/* Playback Tempo Speed Multiplier */}
          <div className="hidden md:flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1 gap-1">
            <span className="text-[10px] text-zinc-400 font-bold">Vitesse :</span>
            <button
              onClick={() => {
                const speeds = [0.75, 0.9, 1.0, 1.1, 1.25];
                const curIdx = speeds.findIndex((s) => Math.abs(s - midiPlaybackState.tempoMultiplier) < 0.03);
                const nextSpeed = speeds[(curIdx + 1) % speeds.length];
                midiAudioEngine.setTempoMultiplier(nextSpeed);
                setMidiPlaybackState(midiAudioEngine.getState());
                showToast(`⚡ Vitesse de lecture : ${nextSpeed}x`);
              }}
              className="text-xs font-mono font-black text-orange-400 hover:underline cursor-pointer"
              title="Cliquez pour cycler la vitesse de lecture"
            >
              {midiPlaybackState.tempoMultiplier.toFixed(2)}x
            </button>
          </div>

          {/* Toggle inline badges visibility */}
          <button
            onClick={() => setShowInlineTimeControls((prev) => !prev)}
            className={`p-1.5 rounded-xl border transition text-xs font-bold cursor-pointer ${
              showInlineTimeControls
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-zinc-900 text-zinc-500 border-zinc-800'
            }`}
            title="Afficher/Masquer les outils de calage sur chaque ligne"
          >
            ⏱️
          </button>

          {/* Open Full Studio Button */}
          <button
            onClick={() => setIsStudioSyncModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-700 rounded-xl text-xs font-bold transition shadow cursor-pointer"
            title="Ouvrir le Studio complet de calage par repères"
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-300" />
            <span className="hidden md:inline">Studio de Calage</span>
          </button>
        </div>
      )}

      {/* Full Lyric Sync Studio Modal */}
      {isStudioSyncModalOpen && currentSong && (
        <LyricSyncStudioModal
          song={currentSong}
          onClose={() => setIsStudioSyncModalOpen(false)}
          onSaveSong={(updatedSong) => {
            if (onUpdateSong) {
              onUpdateSong(updatedSong);
            }
            showToast('💾 Repères temporels enregistrés avec succès !');
          }}
        />
      )}

      {/* Setlist Drawer Overlay */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-start animate-fade-in">
          <div className="w-80 bg-zinc-900 border-r border-zinc-800 text-white p-6 flex flex-col h-full shadow-2xl">
            {/* Grand Format Logo in Drawer */}
            <div className="mb-4 bg-white rounded-xl p-2 border border-zinc-700 shadow-md flex items-center justify-center h-16">
              <img
                src="/logo-wide.jpg"
                alt="Hamide Litime Software"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpg';
                }}
              />
            </div>

            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h3 className="font-bold text-sm text-orange-400 flex items-center gap-2">
                <ListMusic className="w-4 h-4" /> Programme du Concert
              </h3>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1 text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {trackEntries.map((entry, idx) => {
                const s = songs.find((song) => song.id === entry.songId);
                if (!s) return null;
                const isCurrent = idx === currentIndex;

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsDrawerOpen(false);
                      if (contentRef.current) contentRef.current.scrollTop = 0;
                    }}
                    className={`p-2.5 rounded border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-orange-500 text-black border-orange-400 font-bold shadow'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-xs font-mono font-bold w-5">{idx + 1}.</span>
                      <span className="text-xs font-bold truncate">{s.title}</span>
                    </div>

                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${isCurrent ? 'bg-black/20 text-black font-bold' : 'bg-black/30 text-orange-300'}`}>
                      {entry.targetKey || s.key}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stage Guitar Tuner & Guitar Rig Floating Modal */}
      {isGuitarStudioOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <GuitarStageStudio
              isCompactMode={true}
              onCloseCompact={() => setIsGuitarStudioOpen(false)}
              songs={songs}
            />
          </div>
        </div>
      )}

      {/* VSampler 3 16-Channel Multi-Timbral Routing Modal */}
      <VSamplerPatchManagerModal
        isOpen={isVSamplerModalOpen}
        onClose={() => setIsVSamplerModalOpen(false)}
        currentSong={currentSong || null}
        onUpdateSong={onUpdateSong}
        onShowToast={showToast}
      />

    </div>
  );
};

