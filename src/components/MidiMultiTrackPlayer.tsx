import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Upload,
  Download,
  Music,
  Sliders,
  Disc,
  X,
  FileAudio,
  FolderOpen,
  Sparkles,
  Zap,
  Bookmark,
  Check,
  Headphones,
  Maximize2,
  Minimize2,
  Piano,
  Layers,
  ChevronDown,
  Radio,
  RefreshCw,
  AlertTriangle,
  Send,
  HelpCircle,
  Plus,
  Trash2,
  Copy,
  Edit3,
  Search,
  Settings2,
  CheckCircle2,
} from 'lucide-react';
import { Song } from '../types';
import {
  midiAudioEngine,
  MidiPlaybackState,
  MidiTrackInfo,
  MidiOutputRoutingMode,
  GM_INSTRUMENTS,
  GM_CATEGORIES,
  TRACK_COLORS,
} from '../utils/midiAudioEngine';
import { MixerFader } from './MixerFader';
import { RotaryKnob } from './RotaryKnob';
import { useTheme } from '../context/ThemeContext';

interface MidiMultiTrackPlayerProps {
  currentSong?: Song;
  onSaveMidiToSong?: (midiBase64: string, midiFileName: string) => void;
  onClose?: () => void;
  mode?: 'modal' | 'dock' | 'standalone';
  isAutoScrolling?: boolean;
  onToggleAutoScroll?: () => void;
  onMasterPlayToggle?: (isPlaying: boolean) => void;
}

export const MidiMultiTrackPlayer: React.FC<MidiMultiTrackPlayerProps> = ({
  currentSong,
  onSaveMidiToSong,
  onClose,
  mode = 'dock',
  isAutoScrolling,
  onToggleAutoScroll,
  onMasterPlayToggle,
}) => {
  const { theme, themeConfig } = useTheme();
  const [playbackState, setPlaybackState] = useState<MidiPlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    progressPercent: 0,
    bpm: 110,
    tempoMultiplier: 1.0,
    transposeSemitones: 0,
    title: 'Aucun fichier MIDI',
    tracks: [],
    soundFontInfo: null,
    isWebMidiSupported: true,
    isWebMidiConnected: false,
    midiOutputs: [],
    selectedMidiOutputId: 'all',
    outputMode: 'web_midi',
    midiActivityTx: false,
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const [isSf2Loading, setIsSf2Loading] = useState(false);
  const [sf2SuccessMsg, setSf2SuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'mixer' | 'vsampler' | 'soundfont' | 'demos'>('mixer');
  const [lastSavedMidi, setLastSavedMidi] = useState<string | null>(null);
  const [isSavedFeedback, setIsSavedFeedback] = useState(false);
  const [testNoteFeedback, setTestNoteFeedback] = useState<number | null>(null);
  const [vsamplerSyncMsg, setVsamplerSyncMsg] = useState<string | null>(null);

  // Track Creation Modal State
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [newTrackName, setNewTrackName] = useState('');
  const [newTrackChannel, setNewTrackChannel] = useState(0);
  const [newTrackProgram, setNewTrackProgram] = useState(0);
  const [newTrackPattern, setNewTrackPattern] = useState<
    'empty' | 'bass_roots' | 'chords_strum' | 'drums_4_4' | 'drums_reggae' | 'piano_arpeggio' | 'strings_pad'
  >('empty');

  // Track Instrument Picker Modal State
  const [editingInstrumentTrackId, setEditingInstrumentTrackId] = useState<number | null>(null);
  const [searchGmQuery, setSearchGmQuery] = useState('');
  const [selectedGmFamily, setSelectedGmFamily] = useState<number | null>(null);

  // In-line Renaming Track State
  const [renamingTrackId, setRenamingTrackId] = useState<number | null>(null);
  const [tempTrackName, setTempTrackName] = useState('');

  const midiFileInputRef = useRef<HTMLInputElement>(null);
  const sf2FileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to MIDI Engine updates
  useEffect(() => {
    midiAudioEngine.setListener((state) => {
      setPlaybackState(state);
    });

    // Auto-detect Web MIDI ports
    midiAudioEngine.initWebMidi().catch(() => {});

    // Auto-load song's saved MIDI if present, or load genre-appropriate demo
    if (currentSong?.midiData) {
      try {
        const binaryString = atob(currentSong.midiData);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        midiAudioEngine.loadMidi(bytes.buffer, currentSong.midiFileName || `${currentSong.title}.mid`);
      } catch (err) {
        console.warn('Could not parse stored midi data, generating default backing:', err);
        loadDefaultSongBacking(currentSong);
      }
    } else {
      loadDefaultSongBacking(currentSong);
    }
  }, [currentSong?.id]);

  const loadDefaultSongBacking = (song?: Song) => {
    const title = song?.title?.toLowerCase() || '';
    const artist = song?.artist?.toLowerCase() || '';
    if (title.includes('woman') || title.includes('cry') || artist.includes('marley') || song?.tags?.includes('Reggae')) {
      midiAudioEngine.generateDemoMultiTrackMidi('no_woman_no_cry');
    } else if (title.includes('machine') || title.includes('amour') || artist.includes('souchon')) {
      midiAudioEngine.generateDemoMultiTrackMidi('amour_machine');
    } else if (title.includes('café') || song?.tags?.includes('Afro-Cubain')) {
      midiAudioEngine.generateDemoMultiTrackMidi('couleur_cafe');
    } else if (song?.key?.includes('m') || song?.tags?.includes('Blues')) {
      midiAudioEngine.generateDemoMultiTrackMidi('blues');
    } else {
      midiAudioEngine.generateDemoMultiTrackMidi('no_woman_no_cry');
    }
  };

  // Handle MIDI File Upload
  const handleMidiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    await processMidiFile(file);
  };

  const processMidiFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      await midiAudioEngine.loadMidi(arrayBuffer, file.name);

      // Convert to base64 for saving
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      setLastSavedMidi(base64);

      if (onSaveMidiToSong) {
        onSaveMidiToSong(base64, file.name);
        setIsSavedFeedback(true);
        setTimeout(() => setIsSavedFeedback(false), 3000);
      }
    } catch (err) {
      alert(`Erreur de lecture du fichier MIDI: ${(err as Error).message}`);
    }
  };

  // Handle SF2 File Upload
  const handleSf2FileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsSf2Loading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await midiAudioEngine.loadSf2(arrayBuffer);
      setSf2SuccessMsg(`SoundFont "${result.name}" chargée (${result.samplesCount} échantillons, ${result.totalSizeMb} Mo)`);
      setTimeout(() => setSf2SuccessMsg(null), 5000);
    } catch (err) {
      alert(`Erreur d'import de la SoundFont SF2: ${(err as Error).message}`);
    } finally {
      setIsSf2Loading(false);
    }
  };

  const togglePlay = () => {
    const isPlaying = midiAudioEngine.toggle();
    if (onMasterPlayToggle) {
      onMasterPlayToggle(isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSeconds = (parseFloat(e.target.value) / 100) * playbackState.duration;
    midiAudioEngine.seek(targetSeconds);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSaveToCurrentSong = () => {
    const b64 = midiAudioEngine.exportMidiBase64();
    if (b64 && currentSong && onSaveMidiToSong) {
      onSaveMidiToSong(b64, playbackState.title + '.mid');
      setIsSavedFeedback(true);
      setTimeout(() => setIsSavedFeedback(false), 3000);
    }
  };

  const triggerTestNote = (channel: number = 0) => {
    setTestNoteFeedback(channel);
    midiAudioEngine.sendMidiNoteOn(channel, 60, 0.9);
    setTimeout(() => {
      midiAudioEngine.sendMidiNoteOff(channel, 60);
      setTestNoteFeedback(null);
    }, 350);
  };

  const handleSyncVSampler3 = async () => {
    try {
      if (currentSong?.vSamplerConfig) {
        const res = await midiAudioEngine.sendSongVSamplerConfig(currentSong.vSamplerConfig);
        setVsamplerSyncMsg(`✅ ${res.channelsCount} instruments envoyés sur VSampler 3 pour "${currentSong.title}" !`);
      } else {
        const config = midiAudioEngine.generateDefaultVSamplerConfig(currentSong?.title || 'Chanson', playbackState.tracks);
        const res = await midiAudioEngine.sendSongVSamplerConfig(config);
        setVsamplerSyncMsg(`✅ ${res.channelsCount} instruments synchronisés sur VSampler 3 !`);
      }
    } catch {
      const result = midiAudioEngine.syncVSampler3Setup();
      setVsamplerSyncMsg(`✅ ${result.syncedTracks} instruments synchronisés sur VSampler 3 !`);
    }
    setTimeout(() => setVsamplerSyncMsg(null), 5000);
  };

  const handleOpenAddTrack = () => {
    // Pick first unused channel
    const used = new Set(playbackState.tracks.map((t) => t.channel));
    let defaultCh = 0;
    for (let i = 0; i < 16; i++) {
      if (i !== 9 && !used.has(i)) {
        defaultCh = i;
        break;
      }
    }
    setNewTrackName(`Nouvelle Piste ${playbackState.tracks.length + 1}`);
    setNewTrackChannel(defaultCh);
    setNewTrackProgram(0);
    setNewTrackPattern('empty');
    setIsAddTrackOpen(true);
  };

  const handleCreateTrackSubmit = () => {
    midiAudioEngine.addTrack({
      name: newTrackName.trim() || `Piste ${playbackState.tracks.length + 1}`,
      channel: newTrackChannel,
      program: newTrackChannel === 9 ? 0 : newTrackProgram,
      isPercussion: newTrackChannel === 9,
      pattern: newTrackPattern,
    });
    setIsAddTrackOpen(false);
  };

  const handleStartRename = (track: MidiTrackInfo) => {
    setRenamingTrackId(track.id);
    setTempTrackName(track.name);
  };

  const handleSaveRename = (trackId: number) => {
    if (tempTrackName.trim().length > 0) {
      midiAudioEngine.setTrackName(trackId, tempTrackName.trim());
    }
    setRenamingTrackId(null);
  };

  const isDocked = mode === 'dock';

  // Filtered GM instruments for picker
  const filteredGmInstruments = GM_INSTRUMENTS.map((name, index) => ({ name, index })).filter((inst) => {
    if (selectedGmFamily !== null) {
      const cat = GM_CATEGORIES[selectedGmFamily];
      if (cat && (inst.index < cat.start || inst.index > cat.end)) {
        return false;
      }
    }
    if (searchGmQuery.trim().length > 0) {
      return inst.name.toLowerCase().includes(searchGmQuery.toLowerCase()) || `${inst.index + 1}`.includes(searchGmQuery);
    }
    return true;
  });

  return (
    <div
      className={`bg-zinc-950 border border-zinc-800 text-zinc-300 shadow-2xl overflow-hidden flex flex-col ${
        isDocked
          ? 'h-full w-full rounded-none border-l'
          : 'rounded-xl max-w-5xl w-full mx-auto max-h-[92vh]'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.name.toLowerCase().endsWith('.sf2')) {
            setIsSf2Loading(true);
            try {
              const buffer = await file.arrayBuffer();
              const res = await midiAudioEngine.loadSf2(buffer);
              setSf2SuccessMsg(`SoundFont "${res.name}" importée avec succès !`);
              setTimeout(() => setSf2SuccessMsg(null), 5000);
            } catch (err) {
              alert(`Erreur SF2: ${(err as Error).message}`);
            } finally {
              setIsSf2Loading(false);
            }
          } else {
            await processMidiFile(file);
          }
        }
      }}
    >
      {/* Hidden File Inputs */}
      <input
        ref={midiFileInputRef}
        type="file"
        accept=".mid,.midi,.kar"
        onChange={handleMidiFileChange}
        className="hidden"
      />
      <input
        ref={sf2FileInputRef}
        type="file"
        accept=".sf2"
        onChange={handleSf2FileChange}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex items-center justify-between p-3.5 sm:p-4 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-500/10 border border-purple-500/30 rounded flex items-center justify-center text-purple-400">
            <Piano className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-xs">
                {playbackState.title}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded font-bold">
                {playbackState.tracks.length} Piste{playbackState.tracks.length > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {currentSong ? `Lié à ${currentSong.title} (${currentSong.key})` : 'Lecteur & Mixeur MIDI / VSampler 3'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Action Tabs */}
          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded p-0.5">
            <button
              onClick={() => setActiveTab('mixer')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'mixer'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mixeur ({playbackState.tracks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('vsampler')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'vsampler'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden sm:inline">Routage VSampler 3</span>
              {playbackState.midiOutputs.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('soundfont')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'soundfont'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Banque SF2</span>
            </button>

            <button
              onClick={() => setActiveTab('demos')}
              className={`px-2.5 py-1 text-xs font-bold rounded transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'demos'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Démos</span>
            </button>
          </div>

          {/* Export / Download MIDI */}
          <button
            onClick={() => midiAudioEngine.exportMidiFile()}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
            title="Exporter & Télécharger le fichier .MID complet"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Import MIDI / KAR Button */}
          <button
            onClick={() => midiFileInputRef.current?.click()}
            className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
            title="Importer un fichier Karaoké ou MIDI (.kar, .mid)"
          >
            <Upload className="w-4 h-4" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Global Sync Feedback Toast */}
      {vsamplerSyncMsg && (
        <div className="bg-emerald-950/90 border-b border-emerald-500/50 px-4 py-2 flex items-center justify-between text-xs text-emerald-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{vsamplerSyncMsg}</span>
          </div>
          <button onClick={() => setVsamplerSyncMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Playback Progress Bar & Master Transport Bar */}
      <div className="bg-zinc-900/60 p-4 border-b border-zinc-800 space-y-3">
        {/* Timeline seeker */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-400">
            <span className="text-purple-400">{formatTime(playbackState.currentTime)}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 font-sans font-normal">Avancement</span>
              <span className="text-zinc-300">{formatTime(playbackState.duration)}</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={playbackState.progressPercent}
            onChange={handleSeek}
            className="w-full h-1.5 bg-zinc-800 rounded appearance-none cursor-pointer accent-purple-500"
          />
        </div>

        {/* Master Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Play / Pause */}
            <button
              onClick={togglePlay}
              className={`px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition shadow cursor-pointer ${
                playbackState.isPlaying
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/40 animate-pulse'
                  : 'bg-purple-500 hover:bg-purple-400 text-black font-extrabold'
              }`}
            >
              {playbackState.isPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Lecture MIDI</span>
                </>
              )}
            </button>

            {/* Stop & Reset */}
            <button
              onClick={() => midiAudioEngine.stop()}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
              title="Arrêter et revenir au début"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Sync VSampler 3 Quick Button */}
            <button
              onClick={handleSyncVSampler3}
              className="px-3 py-2 bg-gradient-to-r from-purple-900/60 to-indigo-900/60 hover:from-purple-800 hover:to-indigo-800 text-purple-200 border border-purple-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Envoyer tous les Program Changes et Banks vers VSampler 3 pour assigner immédiatement chaque instrument au bon canal !"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Sync VSampler 3</span>
            </button>

            {/* Add Track Button */}
            <button
              onClick={handleOpenAddTrack}
              className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Ajouter Piste</span>
            </button>

            {/* Panic Button */}
            <button
              onClick={() => midiAudioEngine.sendAllNotesOff()}
              className="px-2.5 py-2 bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/60 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Panique MIDI : coupe toutes les notes immédiatement"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Panique</span>
            </button>

            {/* Save to Song */}
            {currentSong && onSaveMidiToSong && (
              <button
                onClick={handleSaveToCurrentSong}
                className={`flex items-center gap-1.5 px-3 py-2 rounded text-xs font-bold border transition cursor-pointer ${
                  isSavedFeedback
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                }`}
                title="Enregistrer ce fichier MIDI dans les données du morceau"
              >
                {isSavedFeedback ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5 text-purple-400" />}
                <span className="hidden sm:inline">{isSavedFeedback ? 'Enregistré !' : 'Lier au Morceau'}</span>
              </button>
            )}
          </div>

          {/* Tempo Multiplier & Pitch Transpose */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Speed Multiplier */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-2 py-1 gap-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Tempo:</span>
              <button
                onClick={() => midiAudioEngine.setTempoMultiplier(Math.max(0.5, playbackState.tempoMultiplier - 0.1))}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              >
                -
              </button>
              <span className="font-mono text-xs font-bold text-purple-400 w-12 text-center">
                {Math.round(playbackState.bpm)} BPM
              </span>
              <button
                onClick={() => midiAudioEngine.setTempoMultiplier(Math.min(2.0, playbackState.tempoMultiplier + 0.1))}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              >
                +
              </button>
            </div>

            {/* Pitch Transpose */}
            <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded px-2 py-1 gap-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase">Tonalité:</span>
              <button
                onClick={() => midiAudioEngine.setTranspose(playbackState.transposeSemitones - 1)}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              >
                -1
              </button>
              <span className="font-mono text-xs font-bold text-purple-400 w-8 text-center">
                {playbackState.transposeSemitones > 0 ? `+${playbackState.transposeSemitones}` : playbackState.transposeSemitones}
              </span>
              <button
                onClick={() => midiAudioEngine.setTranspose(playbackState.transposeSemitones + 1)}
                className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-[10px] font-bold cursor-pointer"
              >
                +1
              </button>
            </div>

            {/* Autoscroll sync toggle */}
            {onToggleAutoScroll !== undefined && (
              <button
                onClick={onToggleAutoScroll}
                className={`px-3 py-1.5 rounded text-xs font-bold transition border cursor-pointer ${
                  isAutoScrolling
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
                title="Défilement automatique des paroles synchronisé"
              >
                {isAutoScrolling ? '✓ Défilement Actif' : 'Sync Défilement'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Workspace Tabs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: Multi-Track Mixer */}
        {activeTab === 'mixer' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  Pistes du Morceau ({playbackState.tracks.length})
                </span>
                <span className="px-2 py-0.5 bg-purple-950/60 border border-purple-800/40 text-purple-300 text-[10px] rounded font-medium">
                  Sortie : {playbackState.outputMode === 'web_midi' ? 'VSampler 3 (Web MIDI)' : playbackState.outputMode === 'web_audio' ? 'Synthé WebAudio' : 'Double (MIDI + Audio)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenAddTrack}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition shadow"
                >
                  <Plus className="w-3 h-3" /> Ajouter une Piste
                </button>

                <button
                  onClick={() => setActiveTab('vsampler')}
                  className="text-[11px] text-purple-400 hover:text-purple-300 underline flex items-center gap-1 cursor-pointer"
                >
                  <Radio className="w-3 h-3" /> Matrice VSampler 3
                </button>
              </div>
            </div>

            {playbackState.tracks.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center space-y-3">
                <FileAudio className="w-12 h-12 text-purple-400/50 mx-auto" />
                <h4 className="text-sm font-bold text-white">Aucune piste MIDI chargée</h4>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                  Glissez-déposez vos fichiers <strong>.mid</strong> ou cliquez ci-dessous pour créer votre première piste.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={handleOpenAddTrack}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Créer une Piste
                  </button>
                  <button
                    onClick={() => midiFileInputRef.current?.click()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg cursor-pointer transition"
                  >
                    Importer un fichier .MID
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {playbackState.tracks.map((track) => {
                  const isSounding = track.activeNotes.length > 0;
                  const isRenaming = renamingTrackId === track.id;

                  return (
                    <div
                      key={track.id}
                      className={`p-3 rounded-lg border transition-all ${
                        track.isMuted
                          ? 'bg-zinc-950/60 border-zinc-900 opacity-60'
                          : track.isSolo
                          ? 'bg-purple-950/30 border-purple-500/60 shadow-md'
                          : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Track Header & Visualizer */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Color bar */}
                          <div
                            className="w-1.5 h-10 rounded-full flex-shrink-0 cursor-pointer"
                            style={{ backgroundColor: track.color }}
                            title="Couleur de la piste"
                          />

                          {/* Sounding visualizer meter */}
                          <div
                            className={`w-3 h-3 rounded-full transition-all duration-75 flex-shrink-0 ${
                              isSounding
                                ? 'bg-purple-400 scale-125 shadow-lg shadow-purple-400 animate-ping'
                                : 'bg-zinc-800'
                            }`}
                            title={isSounding ? `Notes actives: ${track.activeNotes.join(', ')}` : 'Inactif'}
                          />

                          <div className="min-w-0 flex-1">
                            {/* Track Name + Edit */}
                            <div className="flex items-center gap-2">
                              {isRenaming ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={tempTrackName}
                                    onChange={(e) => setTempTrackName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(track.id)}
                                    autoFocus
                                    className="px-1.5 py-0.5 text-xs bg-zinc-950 border border-purple-500 text-white rounded focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleSaveRename(track.id)}
                                    className="p-1 bg-purple-600 text-white rounded text-[10px] cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 group">
                                  <h5 className="text-xs font-bold text-white truncate">{track.name}</h5>
                                  <button
                                    onClick={() => handleStartRename(track)}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-white transition cursor-pointer"
                                    title="Renommer la piste"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* MIDI Channel Selector Dropdown */}
                              <select
                                value={track.channel}
                                onChange={(e) => midiAudioEngine.setTrackChannel(track.id, parseInt(e.target.value, 10))}
                                className="text-xs font-mono font-black px-2 py-0.5 bg-zinc-950 border border-purple-800/80 text-amber-300 rounded cursor-pointer focus:outline-none hover:border-amber-400 shadow-sm"
                                title="Changer le canal MIDI / Slot VSampler 3"
                              >
                                {Array.from({ length: 16 }, (_, i) => (
                                  <option key={i} value={i}>
                                    CH {i + 1} {i === 9 ? '🥁 (Drums)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Instrument Selector Pill */}
                            <div className="flex items-center gap-2 mt-0.5">
                              <button
                                onClick={() => {
                                  setEditingInstrumentTrackId(track.id);
                                  setSelectedGmFamily(null);
                                  setSearchGmQuery('');
                                }}
                                className="text-[10px] text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/40 px-2 py-0.5 rounded flex items-center gap-1 transition cursor-pointer"
                                title="Changer l'instrument General MIDI"
                              >
                                <Music className="w-2.5 h-2.5 text-purple-400" />
                                <span className="truncate max-w-[180px] sm:max-w-xs">
                                  {track.isPercussion ? '🥁 Batterie General MIDI (Canal 10)' : `${track.program + 1}. ${track.instrumentName}`}
                                </span>
                                <ChevronDown className="w-2.5 h-2.5 text-purple-400" />
                              </button>

                              <span className="text-[10px] text-zinc-500 font-mono">
                                {track.notesCount} notes
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Track Mixer Controls */}
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                          {/* Test track button */}
                          <button
                            onClick={() => triggerTestNote(track.channel)}
                            className={`p-1.5 rounded text-[10px] font-mono transition border cursor-pointer ${
                              testNoteFeedback === track.channel
                                ? 'bg-emerald-500 text-black border-emerald-400 shadow'
                                : 'bg-zinc-950 hover:bg-purple-950 text-zinc-400 hover:text-purple-300 border-zinc-800'
                            }`}
                            title={`Tester le canal MIDI ${track.channel + 1}`}
                          >
                            <Send className="w-3 h-3" />
                          </button>

                          {/* Solo Button (S) with LED glow */}
                          <button
                            onClick={() => midiAudioEngine.setTrackSolo(track.id, !track.isSolo)}
                            className={`w-7 h-7 rounded text-xs font-mono font-bold flex items-center justify-center transition border cursor-pointer ${
                              track.isSolo
                                ? 'led-solo-active font-black'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-amber-300 hover:border-zinc-700'
                            }`}
                            title="Solo (Isoler cette piste)"
                          >
                            S
                          </button>

                          {/* Mute Button (M) with LED glow */}
                          <button
                            onClick={() => midiAudioEngine.setTrackMute(track.id, !track.isMuted)}
                            className={`w-7 h-7 rounded text-xs font-mono font-bold flex items-center justify-center transition border cursor-pointer ${
                              track.isMuted
                                ? 'led-mute-active font-black'
                                : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-red-400 hover:border-zinc-700'
                            }`}
                            title="Mute (Couper le son de cette piste)"
                          >
                            M
                          </button>

                          {/* Hardware Rotary Pan (CC 10) */}
                          <div className="hidden lg:flex items-center justify-center">
                            <RotaryKnob
                              value={track.pan}
                              min={-1}
                              max={1}
                              step={0.1}
                              defaultValue={0}
                              label="PAN"
                              size="sm"
                              color="amber"
                              onChange={(val) => midiAudioEngine.setTrackPan(track.id, val)}
                              formatValue={(val) =>
                                val === 0 ? 'C' : val < 0 ? `L${Math.abs(Math.round(val * 10))}` : `R${Math.round(val * 10)}`
                              }
                            />
                          </div>

                          {/* Hardware Volume Fader with LED Gauge (CC 7) */}
                          <div className="flex items-center">
                            <MixerFader
                              value={track.volume}
                              min={0}
                              max={1.5}
                              step={0.02}
                              isSounding={isSounding}
                              onChange={(val) => midiAudioEngine.setTrackVolume(track.id, val)}
                            />
                          </div>

                          {/* Duplicate Track Button */}
                          <button
                            onClick={() => midiAudioEngine.duplicateTrack(track.id)}
                            className="p-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded text-xs transition cursor-pointer"
                            title="Dupliquer cette piste"
                          >
                            <Copy className="w-3 h-3" />
                          </button>

                          {/* Delete Track Button */}
                          <button
                            onClick={() => {
                              if (confirm(`Supprimer la piste "${track.name}" ?`)) {
                                midiAudioEngine.deleteTrack(track.id);
                              }
                            }}
                            className="p-1.5 bg-zinc-950 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 border border-zinc-800 rounded text-xs transition cursor-pointer"
                            title="Supprimer cette piste"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VSampler 3 & Web MIDI Output Routing Matrix */}
        {activeTab === 'vsampler' && (
          <div className="space-y-4">
            {/* Top configuration box */}
            <div className="bg-zinc-900 border border-purple-900/50 rounded-lg p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-purple-400" /> Routage & Assignation VSampler 3
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Synchronisez vos <strong>16 slots VSampler 3</strong> avec les Program Changes, les banques SF2 et les volumes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSyncVSampler3}
                    className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition shadow cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Synchroniser VSampler 3</span>
                  </button>

                  <button
                    onClick={() => midiAudioEngine.initWebMidi()}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-lg transition border border-zinc-700 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
                    <span>Rafraîchir Ports</span>
                  </button>
                </div>
              </div>

              {/* Web MIDI Routing Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300">Mode de Sortie Audio & MIDI :</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => midiAudioEngine.setOutputMode('web_midi')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      playbackState.outputMode === 'web_midi'
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">🎹 Sortie MIDI VSampler 3</span>
                      {playbackState.outputMode === 'web_midi' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Envoie vers <strong>VSampler 3</strong> via loopMIDI / VST. Coupe le synthé navigateur.
                    </p>
                  </button>

                  <button
                    onClick={() => midiAudioEngine.setOutputMode('web_audio')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      playbackState.outputMode === 'web_audio'
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">🔊 Audio Navigateur Web</span>
                      {playbackState.outputMode === 'web_audio' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Joue avec le synthétiseur Web Audio et la banque SF2 importée.
                    </p>
                  </button>

                  <button
                    onClick={() => midiAudioEngine.setOutputMode('both')}
                    className={`p-3 rounded-lg border text-left transition cursor-pointer ${
                      playbackState.outputMode === 'both'
                        ? 'bg-purple-950/60 border-purple-500 text-white shadow-lg'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">🔀 Sortie Double</span>
                      {playbackState.outputMode === 'both' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Émet simultanément sur VSampler 3 ET dans les haut-parleurs du navigateur.
                    </p>
                  </button>
                </div>
              </div>

              {/* Port Selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                    <span>Port MIDI Sortie Détecté :</span>
                    <span className="text-[10px] text-purple-400 font-mono">
                      {playbackState.midiOutputs.length} périphérique(s)
                    </span>
                  </label>

                  <select
                    value={playbackState.selectedMidiOutputId}
                    onChange={(e) => midiAudioEngine.setSelectedMidiOutput(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded px-3 py-2 text-xs text-white cursor-pointer font-mono"
                  >
                    <option value="all">⚡ Émettre sur TOUTES les sorties MIDI (Recommandé)</option>
                    {playbackState.midiOutputs.map((out) => (
                      <option key={out.id} value={out.id}>
                        🎹 {out.name} {out.manufacturer ? `(${out.manufacturer})` : ''}
                      </option>
                    ))}
                    {playbackState.midiOutputs.length === 0 && (
                      <option value="none">⚠️ Aucun port MIDI virtuel ou matériel détecté</option>
                    )}
                  </select>

                  {playbackState.midiOutputs.length === 0 && (
                    <p className="text-[11px] text-amber-400/90 flex items-center gap-1 mt-1">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Lancez <strong>loopMIDI</strong> sur votre PC pour connecter VSampler 3.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-300">Test Rapide de Connexion :</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => triggerTestNote(0)}
                      className={`flex-1 py-2 px-3 rounded text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                        testNoteFeedback !== null
                          ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg'
                          : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border-purple-500/50'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{testNoteFeedback !== null ? 'Signal Transmis ! ⚡' : 'Tester Signal (Canal 1 / C4)'}</span>
                    </button>

                    <button
                      onClick={() => midiAudioEngine.sendAllNotesOff()}
                      className="px-3 py-2 bg-zinc-950 hover:bg-red-950/60 text-red-300 border border-zinc-800 rounded text-xs font-bold transition cursor-pointer"
                    >
                      Silence
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Vérifiez que les voyants d'activité de VSampler 3 réagissent au clic.
                  </p>
                </div>
              </div>
            </div>

            {/* 16-Channel VSampler 3 Assignment Matrix */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" /> Matrice des 16 Slots / Canaux VSampler 3
                </h5>
                <span className="text-[10px] text-zinc-500">
                  Chaque ligne correspond à un slot d'instrument dans VSampler 3
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Array.from({ length: 16 }, (_, chIdx) => {
                  const assignedTrack = playbackState.tracks.find((t) => t.channel === chIdx);
                  const isDrums = chIdx === 9;

                  return (
                    <div
                      key={chIdx}
                      className={`p-2.5 rounded border flex items-center justify-between gap-2 transition ${
                        assignedTrack
                          ? 'bg-zinc-900 border-zinc-700'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-[10px] flex-shrink-0 ${
                            assignedTrack
                              ? 'bg-purple-600 text-white'
                              : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                          }`}
                        >
                          {chIdx + 1}
                        </div>

                        <div className="min-w-0">
                          {assignedTrack ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h6 className="text-xs font-bold text-white truncate">{assignedTrack.name}</h6>
                                <span className="text-[9px] font-mono px-1 py-0.2 bg-purple-950 text-purple-300 rounded border border-purple-800/40">
                                  PC #{assignedTrack.isPercussion ? 0 : assignedTrack.program + 1}
                                </span>
                              </div>
                              <p className="text-[10px] text-purple-300/80 truncate">
                                {assignedTrack.isPercussion ? '🥁 Kit Percussions Standard GM' : assignedTrack.instrumentName}
                              </p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-xs text-zinc-500 italic">
                                {isDrums ? 'Canal 10 (Réservé Batterie GM)' : `Slot ${chIdx + 1} Libre`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {assignedTrack ? (
                          <>
                            <button
                              onClick={() => triggerTestNote(chIdx)}
                              className="p-1.5 bg-zinc-950 hover:bg-purple-950 text-zinc-400 hover:text-purple-300 border border-zinc-800 rounded text-[10px] transition cursor-pointer"
                              title={`Tester le son du slot ${chIdx + 1}`}
                            >
                              <Send className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingInstrumentTrackId(assignedTrack.id);
                                setSelectedGmFamily(null);
                                setSearchGmQuery('');
                              }}
                              className="p-1.5 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded text-[10px] transition cursor-pointer"
                              title="Modifier l'instrument GM"
                            >
                              <Settings2 className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setNewTrackName(`Piste Canal ${chIdx + 1}`);
                              setNewTrackChannel(chIdx);
                              setNewTrackProgram(0);
                              setNewTrackPattern('empty');
                              setIsAddTrackOpen(true);
                            }}
                            className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded text-[10px] font-bold transition cursor-pointer"
                          >
                            + Assigner
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step-by-Step Guide */}
            <div className="bg-zinc-950 border border-purple-900/40 rounded-lg p-4 space-y-3">
              <h5 className="text-xs font-bold text-purple-300 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-purple-400" /> Guide : Comment VSampler 3 charge les bons instruments ?
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-zinc-900/90 p-3 rounded border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded">1. Canal MIDI</span>
                  <h6 className="font-bold text-white text-xs mt-1">Canaux 1 à 16</h6>
                  <p className="text-[11px] text-zinc-400">
                    Chaque piste est routée vers son propre canal (ex: Canal 1 Piano, Canal 2 Basse, Canal 10 Batterie).
                  </p>
                </div>

                <div className="bg-zinc-900/90 p-3 rounded border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded">2. Program Change</span>
                  <h6 className="font-bold text-white text-xs mt-1">Numéro GM (1-128)</h6>
                  <p className="text-[11px] text-zinc-400">
                    Le bouton <strong>« Sync VSampler 3 »</strong> envoie l'ordre de sélection du preset exact dans votre banque SF2.
                  </p>
                </div>

                <div className="bg-zinc-900/90 p-3 rounded border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded">3. Bank Select</span>
                  <h6 className="font-bold text-white text-xs mt-1">MSB 0 & LSB 0</h6>
                  <p className="text-[11px] text-zinc-400">
                    L'application configure automatiquement les banques mélodiques et la banque 127 pour la batterie.
                  </p>
                </div>

                <div className="bg-zinc-900/90 p-3 rounded border border-zinc-800 space-y-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-600 text-white rounded">4. Volume & Pan</span>
                  <h6 className="font-bold text-white text-xs mt-1">CC 7 et CC 10</h6>
                  <p className="text-[11px] text-zinc-400">
                    Les curseurs de volume et panoramique sont envoyés en temps réel vers les faders de VSampler 3.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SoundFont 2 (SF2) Import & Status */}
        {activeTab === 'soundfont' && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" /> Banque de Sons Interne SoundFont 2 (SF2)
                  </h4>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Si vous n'utilisez pas VSampler 3, vous pouvez également charger directement vos fichiers .SF2 dans le navigateur.
                  </p>
                </div>

                <button
                  onClick={() => sf2FileInputRef.current?.click()}
                  disabled={isSf2Loading}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isSf2Loading ? 'Décodage SF2...' : 'Importer fichier .SF2'}</span>
                </button>
              </div>

              {/* Current SoundFont Status Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Moteur Sonore Navigateur</span>
                  <p className="text-xs font-bold text-purple-400 truncate mt-1">
                    {playbackState.soundFontInfo?.name || 'Générateur GM Haute Définition'}
                  </p>
                </div>

                <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Échantillons PCM</span>
                  <p className="text-xs font-bold text-white font-mono mt-1">
                    {playbackState.soundFontInfo?.samplesCount || 128} instruments/échantillons
                  </p>
                </div>

                <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Origine</span>
                  <p className="text-xs font-bold text-zinc-300 mt-1">
                    {playbackState.soundFontInfo?.isCustom ? (
                      <span className="text-emerald-400">SF2 Importée par l'utilisateur</span>
                    ) : (
                      'Synthétiseur Intégré Web Audio'
                    )}
                  </p>
                </div>
              </div>

              {playbackState.soundFontInfo?.isCustom && (
                <div className="flex justify-end">
                  <button
                    onClick={() => midiAudioEngine.resetToDefaultSoundFont()}
                    className="text-xs text-red-400 hover:underline cursor-pointer"
                  >
                    Rétablir le synthétiseur par défaut
                  </button>
                </div>
              )}
            </div>

            <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-4 text-xs text-zinc-400 space-y-2">
              <p className="font-bold text-zinc-200">ℹ️ Comment fonctionnent les SoundFonts SF2 ?</p>
              <p>
                Le format <strong>SoundFont 2 (.sf2)</strong> contient les enregistrements réels d'instruments de musique acoustiques et électroniques. Lorsque vous utilisez VSampler 3, vous profitez de sa puissance native en le pilotant directement via l'onglet <strong>Routage VSampler 3</strong>.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Preloaded MIDI Demos */}
        {activeTab === 'demos' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Démos Multi-Pistes & Morceaux Inclus
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* No Woman No Cry - Bob Marley */}
              <div className="p-3.5 bg-gradient-to-br from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/50 rounded-lg text-left transition space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">No Woman No Cry</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 rounded font-bold">6 Pistes</span>
                  </div>
                  <p className="text-[11px] text-emerald-300/90 font-medium mt-0.5">Bob Marley & The Wailers (78 BPM, C)</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Batterie One-Drop (Carlton Barrett), basse Roots (Aston Barrett), skank guitare, orgue Hammond B3, piano et chant Bob Marley.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-emerald-900/40">
                  <button
                    onClick={() => midiAudioEngine.generateDemoMultiTrackMidi('no_woman_no_cry')}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold text-center transition cursor-pointer"
                  >
                    Charger & Jouer
                  </button>
                  <button
                    onClick={() => {
                      midiAudioEngine.generateDemoMultiTrackMidi('no_woman_no_cry');
                      setTimeout(() => {
                        midiAudioEngine.exportMidiFile('Bob_Marley_No_Woman_No_Cry.mid');
                      }, 50);
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-500/40 rounded transition cursor-pointer"
                    title="Télécharger fichier .MID"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* L'amour à la machine - Alain Souchon */}
              <div className="p-3.5 bg-gradient-to-br from-purple-950/40 via-zinc-900 to-zinc-900 border border-purple-500/50 rounded-lg text-left transition space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">L'amour à la machine</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/30 text-purple-300 border border-purple-500/50 rounded font-bold">6 Pistes</span>
                  </div>
                  <p className="text-[11px] text-purple-300/90 font-medium mt-0.5">Alain Souchon (118 BPM, Em)</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Batterie pop complète, basse ronde Em-G-C-D, guitare 12 cordes, riffs lead clean Voulzy, nappe Rhodes et guide chant vocal.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-purple-900/40">
                  <button
                    onClick={() => midiAudioEngine.generateDemoMultiTrackMidi('amour_machine')}
                    className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold text-center transition cursor-pointer"
                  >
                    Charger & Jouer
                  </button>
                  <button
                    onClick={() => {
                      midiAudioEngine.generateDemoMultiTrackMidi('amour_machine');
                      setTimeout(() => {
                        midiAudioEngine.exportMidiFile('Alain_Souchon_L_amour_a_la_machine.mid');
                      }, 50);
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-purple-500/40 rounded transition cursor-pointer"
                    title="Télécharger fichier .MID"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/60 rounded-lg text-left transition space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Couleur Café</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-bold">5 Pistes</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Serge Gainsbourg (110 BPM, G)</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Percussions congas/clave, basse chaloupée afro-cubaine, piano montuno syncopé, section cuivres et guitare skank.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => midiAudioEngine.generateDemoMultiTrackMidi('couleur_cafe')}
                    className="flex-1 py-1.5 bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 rounded text-xs font-bold text-center transition cursor-pointer"
                  >
                    Charger & Jouer
                  </button>
                  <button
                    onClick={() => {
                      midiAudioEngine.generateDemoMultiTrackMidi('couleur_cafe');
                      setTimeout(() => {
                        midiAudioEngine.exportMidiFile('Couleur_Cafe_Gainsbourg.mid');
                      }, 50);
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-zinc-700 rounded transition cursor-pointer"
                    title="Télécharger fichier .MID"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-3.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-purple-500/60 rounded-lg text-left transition space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Slow Blues en La</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-bold">4 Pistes</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-medium mt-0.5">Standard Blues (75 BPM, Am)</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Batterie shuffle acoustique, walking bass feutrée, piano Rhodes vintage et solo guitare blues expressif.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => midiAudioEngine.generateDemoMultiTrackMidi('blues')}
                    className="flex-1 py-1.5 bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 rounded text-xs font-bold text-center transition cursor-pointer"
                  >
                    Charger & Jouer
                  </button>
                  <button
                    onClick={() => {
                      midiAudioEngine.generateDemoMultiTrackMidi('blues');
                      setTimeout(() => {
                        midiAudioEngine.exportMidiFile('Blues_MultiTrack_Am.mid');
                      }, 50);
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-purple-300 border border-zinc-700 rounded transition cursor-pointer"
                    title="Télécharger fichier .MID"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD NEW TRACK */}
      {isAddTrackOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/40 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" /> Ajouter une Nouvelle Piste MIDI
              </h4>
              <button
                onClick={() => setIsAddTrackOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Track Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Nom de la Piste :</label>
                <input
                  type="text"
                  value={newTrackName}
                  onChange={(e) => setNewTrackName(e.target.value)}
                  placeholder="Ex: Guitare Solo, Nappe Violons, Saxophone..."
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded px-3 py-2 text-xs text-white"
                />
              </div>

              {/* MIDI Channel Selector */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Canal MIDI / Slot VSampler :</label>
                  <select
                    value={newTrackChannel}
                    onChange={(e) => setNewTrackChannel(parseInt(e.target.value, 10))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded px-3 py-2 text-xs text-white font-mono"
                  >
                    {Array.from({ length: 16 }, (_, i) => {
                      const isUsed = playbackState.tracks.some((t) => t.channel === i);
                      return (
                        <option key={i} value={i}>
                          Canal {i + 1} {i === 9 ? '(Batterie)' : isUsed ? '(Occupé)' : '(Libre)'}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Instrument GM Dropdown if not channel 10 */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Instrument General MIDI :</label>
                  {newTrackChannel === 9 ? (
                    <div className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-purple-300">
                      🥁 Kit Batterie GM
                    </div>
                  ) : (
                    <select
                      value={newTrackProgram}
                      onChange={(e) => setNewTrackProgram(parseInt(e.target.value, 10))}
                      className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded px-3 py-2 text-xs text-white"
                    >
                      {GM_INSTRUMENTS.map((name, idx) => (
                        <option key={idx} value={idx}>
                          {idx + 1}. {name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Pattern Generator */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300">Modèle de génération musicale :</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewTrackPattern('empty')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition ${
                      newTrackPattern === 'empty'
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block">📭 Piste Vierge</span>
                    <span className="text-[10px] text-zinc-500">Piste vide prête pour VSampler 3</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTrackPattern('bass_roots')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition ${
                      newTrackPattern === 'bass_roots'
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block">🎸 Ligne de Basse Ronde</span>
                    <span className="text-[10px] text-zinc-500">Basse tonique & quinte sur le tempo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTrackPattern('chords_strum')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition ${
                      newTrackPattern === 'chords_strum'
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block">🎹 Accords & Strum Guitare</span>
                    <span className="text-[10px] text-zinc-500">Rythmique en contre-temps harmoniques</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTrackPattern('strings_pad')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition ${
                      newTrackPattern === 'strings_pad'
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block">🎻 Nappe / Pad Cordes</span>
                    <span className="text-[10px] text-zinc-500">Grandes nappes chaudes et amples</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewTrackPattern('piano_arpeggio')}
                    className={`p-2.5 rounded border text-left cursor-pointer transition ${
                      newTrackPattern === 'piano_arpeggio'
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block">🎹 Arpèges Piano Fluides</span>
                    <span className="text-[10px] text-zinc-500">Arpèges mélodiques en croches</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewTrackPattern('drums_4_4');
                      setNewTrackChannel(9);
                    }}
                    className={`p-2.5 rounded border text-left cursor-pointer transition ${
                      newTrackPattern === 'drums_4_4'
                        ? 'bg-purple-950 border-purple-500 text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold block">🥁 Batterie Pop/Rock 4/4</span>
                    <span className="text-[10px] text-zinc-500">Kick, snare, hi-hats (Canal 10)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsAddTrackOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateTrackSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition shadow flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Créer la Piste</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: GENERAL MIDI INSTRUMENT PICKER */}
      {editingInstrumentTrackId !== null && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-purple-500/50 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 flex-shrink-0">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-purple-400" /> Choisir l'Instrument General MIDI (1 à 128)
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Piste : {playbackState.tracks.find((t) => t.id === editingInstrumentTrackId)?.name}
                </p>
              </div>
              <button
                onClick={() => setEditingInstrumentTrackId(null)}
                className="p-1 text-zinc-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="relative flex-shrink-0">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchGmQuery}
                onChange={(e) => setSearchGmQuery(e.target.value)}
                placeholder="Rechercher par nom d'instrument (ex: Piano, Guitar, Sax, Strings, Bass, Synth...)"
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500 rounded-lg pl-9 pr-4 py-2 text-xs text-white"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-shrink-0">
              <button
                onClick={() => setSelectedGmFamily(null)}
                className={`px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedGmFamily === null
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                Tous (128)
              </button>
              {GM_CATEGORIES.map((cat, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedGmFamily(idx)}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                    selectedGmFamily === idx
                      ? 'bg-purple-600 text-white shadow'
                      : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Instrument Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-1">
              {filteredGmInstruments.map((inst) => {
                const currentTrack = playbackState.tracks.find((t) => t.id === editingInstrumentTrackId);
                const isSelected = currentTrack?.program === inst.index && !currentTrack.isPercussion;

                return (
                  <button
                    key={inst.index}
                    onClick={() => {
                      if (editingInstrumentTrackId !== null) {
                        midiAudioEngine.setTrackProgram(editingInstrumentTrackId, inst.index);
                        setEditingInstrumentTrackId(null);
                      }
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-purple-950/80 border-purple-500 text-white shadow-md'
                        : 'bg-zinc-950 border-zinc-800/80 hover:border-purple-800 hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-purple-300 flex-shrink-0">
                        #{inst.index + 1}
                      </span>
                      <span className="text-xs font-bold truncate">{inst.name}</span>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800 flex-shrink-0">
              <span className="text-[11px] text-zinc-500 font-mono">
                {filteredGmInstruments.length} instruments trouvés
              </span>
              <button
                onClick={() => setEditingInstrumentTrackId(null)}
                className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-lg cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
