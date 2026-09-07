import React, { useState, useEffect } from 'react';
import { Sliders, Volume2, Guitar, Piano, Play, Pause, Zap, Music, Radio, Disc3, Mic } from 'lucide-react';
import {
  metronomeEngine,
  rhythmEngine,
  DRUM_GROOVES,
  DrumGrooveStyle,
  playTunerTone,
  stopTunerTone,
  TUNING_NOTES,
} from '../utils/audioEngine';
import { getGuitarChordData, getPianoChordData } from '../utils/chordUtils';
import { MidiMultiTrackPlayer } from './MidiMultiTrackPlayer';
import { GuitarStageStudio } from './GuitarStageStudio';
import { VSamplerPatchManagerModal } from './VSamplerPatchManagerModal';
import { Song } from '../types';

interface MusicianToolsProps {
  songs?: Song[];
  onUpdateSong?: (song: Song) => void;
}

export const MusicianTools: React.FC<MusicianToolsProps> = ({ songs = [], onUpdateSong }) => {
  const [activeMainTool, setActiveMainTool] = useState<'midi' | 'drums_metronome' | 'tuner_chords' | 'guitar_stage_studio'>('guitar_stage_studio');
  const [selectedSongId, setSelectedSongId] = useState<string>(songs.length > 0 ? songs[0].id : '');
  const [isVSamplerModalOpen, setIsVSamplerModalOpen] = useState(false);
  const [bpm, setBpm] = useState(110);
  const [timeSignatureBeats, setTimeSignatureBeats] = useState(4);
  const [isPlayingMetronome, setIsPlayingMetronome] = useState(false);
  const [isPlayingRhythm, setIsPlayingRhythm] = useState(false);
  const [selectedGroove, setSelectedGroove] = useState<DrumGrooveStyle>('latin_afrocuban');
  const [activeBeat, setActiveBeat] = useState<{ beat: number; isAccent: boolean } | null>(null);
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);

  // Chord dictionary lookup
  const [searchChord, setSearchChord] = useState('G');
  const [chordTypeTab, setChordTypeTab] = useState<'guitar' | 'piano'>('guitar');

  // Active tuning instrument tab
  const [tuningInstrument, setTuningInstrument] = useState<'guitar' | 'bass' | 'ukulele'>('guitar');
  const [activeToneNote, setActiveToneNote] = useState<string | null>(null);

  useEffect(() => {
    metronomeEngine.setBpm(bpm);
    rhythmEngine.setBpm(bpm);
  }, [bpm]);

  useEffect(() => {
    metronomeEngine.setBeatsPerBar(timeSignatureBeats);
  }, [timeSignatureBeats]);

  useEffect(() => {
    rhythmEngine.setStyle(selectedGroove);
  }, [selectedGroove]);

  useEffect(() => {
    metronomeEngine.setBeatCallback((beat, isAccent) => {
      setActiveBeat({ beat: beat + 1, isAccent });
      setTimeout(() => setActiveBeat(null), 120);
    });

    rhythmEngine.setStepCallback((_step, _totalSteps, isAccent, beatNumber) => {
      setActiveBeat({ beat: beatNumber, isAccent });
      setTimeout(() => setActiveBeat(null), 120);
    });

    return () => {
      metronomeEngine.stop();
      rhythmEngine.stop();
    };
  }, []);

  const toggleMetronome = () => {
    if (isPlayingRhythm) {
      rhythmEngine.stop();
      setIsPlayingRhythm(false);
    }
    const isPlaying = metronomeEngine.toggle();
    setIsPlayingMetronome(isPlaying);
  };

  const toggleRhythm = () => {
    if (isPlayingMetronome) {
      metronomeEngine.stop();
      setIsPlayingMetronome(false);
    }
    const isPlaying = rhythmEngine.toggle();
    setIsPlayingRhythm(isPlaying);
  };

  // Tap tempo handler
  const handleTapTempo = () => {
    const now = Date.now();
    const newTaps = [...tapTimestamps, now].slice(-5);
    setTapTimestamps(newTaps);

    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgIntervalMs > 0) {
        const calculatedBpm = Math.round(60000 / avgIntervalMs);
        if (calculatedBpm >= 30 && calculatedBpm <= 300) {
          setBpm(calculatedBpm);
        }
      }
    }
  };

  const handlePlayTone = (note: string, freq: number) => {
    if (activeToneNote === note) {
      stopTunerTone();
      setActiveToneNote(null);
    } else {
      playTunerTone(freq, 4);
      setActiveToneNote(note);
      setTimeout(() => setActiveToneNote(null), 4000);
    }
  };

  const guitarChord = getGuitarChordData(searchChord || 'G');
  const pianoChord = getPianoChordData(searchChord || 'G');

  const selectedSong = songs.find((s) => s.id === selectedSongId) || songs[0];

  return (
    <div className="space-y-8">
      
      {/* Page Title Header & Navigation Tabs */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sliders className="w-6 h-6 text-orange-500" /> Boîte à Outils & Accompagnement
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Lecteur MIDI multipistes avec banque de sons SF2, boîte à rythmes d'accompagnement, métronome Web Audio haute précision et dictionnaire d'accords.
            </p>
          </div>

          {/* Quick Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setActiveMainTool('guitar_stage_studio')}
              className={`px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTool === 'guitar_stage_studio'
                  ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Guitar className="w-4 h-4 text-orange-950" />
              <span>Studio Guitare &amp; Guitar Rig 7</span>
            </button>

            <button
              onClick={() => setActiveMainTool('midi')}
              className={`px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTool === 'midi'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Piano className="w-4 h-4 text-purple-300" />
              <span>Lecteur MIDI &amp; SF2</span>
            </button>

            <button
              onClick={() => setActiveMainTool('drums_metronome')}
              className={`px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTool === 'drums_metronome'
                  ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Boîte à Rythmes &amp; Métronome</span>
            </button>

            <button
              onClick={() => setActiveMainTool('tuner_chords')}
              className={`px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                activeMainTool === 'tuner_chords'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>Diapason &amp; Accords</span>
            </button>
          </div>
        </div>

        {/* If in MIDI tool mode, allow choosing a song from library */}
        {activeMainTool === 'midi' && songs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 font-bold uppercase text-[11px]">Chanson liée :</span>
              <select
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 text-orange-400 font-bold rounded px-3 py-1.5 focus:outline-none focus:border-purple-500"
              >
                {songs.map((song) => (
                  <option key={song.id} value={song.id}>
                    {song.title} — {song.artist} ({song.key}) {song.midiFileName ? '🎵 [MIDI]' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSong && (
                <span className="text-zinc-400 font-mono text-[11px]">
                  Tempo song : <strong className="text-orange-400">{selectedSong.bpm} BPM</strong> | Tonalité : <strong className="text-orange-400">{selectedSong.key}</strong>
                </span>
              )}
              {selectedSong && (
                <button
                  onClick={() => setIsVSamplerModalOpen(true)}
                  className="px-3 py-1.5 bg-purple-950/60 hover:bg-purple-900 border border-purple-700 text-purple-200 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow"
                  title="Configurer les instruments VSampler 3 pour cette chanson"
                >
                  <Piano className="w-3.5 h-3.5 text-purple-400" />
                  <span>Routeur VSampler 3 ({selectedSong.title})</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tool Tab 0: Guitar Stage Studio (Live Interface, Chromatic Tuner & Guitar Rig 7 WebMIDI) */}
      {activeMainTool === 'guitar_stage_studio' && (
        <GuitarStageStudio songs={songs} />
      )}

      {/* Tool Tab 1: Multi-Track MIDI & SoundFont SF2 Player */}
      {activeMainTool === 'midi' && (
        <div className="shadow-2xl">
          <MidiMultiTrackPlayer
            currentSong={selectedSong}
            mode="full"
            onSaveMidiToSong={(base64, fileName) => {
              if (selectedSong && onUpdateSong) {
                onUpdateSong({
                  ...selectedSong,
                  midiData: base64,
                  midiFileName: fileName,
                  updatedAt: Date.now(),
                });
              }
            }}
          />
        </div>
      )}

      {/* Tool Tab 2: Rhythm Accompaniment Machine & Metronome */}
      {activeMainTool === 'drums_metronome' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Rhythm / Drum Accompaniment Machine */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-orange-500" /> Boîte à Rythmes & Accompagnement
              </h3>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                Percussions Live
              </span>
            </div>

            {/* Visual Beat Bar */}
            <div className="flex justify-center items-center gap-3 mb-6">
              {[1, 2, 3, 4].map((beat) => {
                const isActive = activeBeat?.beat === beat;
                const isAccent = beat === 1;
                return (
                  <div
                    key={beat}
                    className={`w-12 h-14 rounded flex items-center justify-center font-mono font-bold text-base transition-all duration-100 ${
                      isActive
                        ? isAccent
                          ? 'bg-orange-500 text-black scale-110 shadow-lg shadow-orange-500/50'
                          : 'bg-green-500 text-black scale-105 shadow'
                        : 'bg-zinc-950 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {beat}
                  </div>
                );
              })}
            </div>

            {/* Style Selector */}
            <div className="space-y-2 mb-6">
              <label className="block text-xs font-bold text-zinc-400">Style de Rythme</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {DRUM_GROOVES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroove(g.id)}
                    className={`p-2 rounded text-left border transition text-xs font-bold ${
                      selectedGroove === g.id
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                    }`}
                  >
                    <p className="truncate">{g.name.split('(')[0]}</p>
                    <p className="text-[9px] font-normal text-zinc-500 truncate">{g.category}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* BPM Dial */}
            <div className="text-center space-y-2 mb-6">
              <div className="text-3xl font-bold text-white font-mono tracking-tight">
                {bpm} <span className="text-sm font-bold text-orange-400">BPM</span>
              </div>

              <input
                type="range"
                min="40"
                max="240"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
                className="w-full h-2 bg-zinc-950 rounded appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>

          {/* Start / Stop Accompaniment Button */}
          <button
            onClick={toggleRhythm}
            className={`w-full py-3.5 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition shadow cursor-pointer ${
              isPlayingRhythm
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-orange-500 text-black hover:bg-orange-400'
            }`}
          >
            {isPlayingRhythm ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlayingRhythm ? 'ARRÊTER LE BATTEMENT' : 'LANCER LE BATTEMENT LIVE'}</span>
          </button>
        </div>

        {/* Metronome Tool Box */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-6 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-orange-500" /> Métronome & Clic Précis
              </h3>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">Web Audio API</span>
            </div>

            {/* Visual Beat Bar */}
            <div className="flex justify-center items-center gap-3 mb-8">
              {Array.from({ length: timeSignatureBeats }).map((_, bIdx) => {
                const isActive = activeBeat?.beat === bIdx + 1;
                const isAccent = bIdx === 0;
                return (
                  <div
                    key={bIdx}
                    className={`w-12 h-14 rounded flex items-center justify-center font-mono font-bold text-base transition-all duration-100 ${
                      isActive
                        ? isAccent
                          ? 'bg-orange-500 text-black scale-110 shadow-lg'
                          : 'bg-orange-400 text-black scale-105'
                        : 'bg-zinc-950 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {bIdx + 1}
                  </div>
                );
              })}
            </div>

            {/* Controls: Time Sig & Tap Tempo */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Chiffrage de Mesure</label>
                <select
                  value={timeSignatureBeats}
                  onChange={(e) => setTimeSignatureBeats(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white font-bold px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value={4}>Mesure 4/4</option>
                  <option value={3}>Mesure 3/4</option>
                  <option value={6}>Mesure 6/8</option>
                  <option value={2}>Mesure 2/4</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Tap Tempo</label>
                <button
                  onClick={handleTapTempo}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-orange-500 active:text-black text-orange-400 font-bold text-xs rounded transition uppercase tracking-wider cursor-pointer"
                >
                  TAPER LE TEMPO
                </button>
              </div>
            </div>
          </div>

          {/* Start / Stop Big Button */}
          <button
            onClick={toggleMetronome}
            className={`w-full py-3.5 rounded font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition shadow cursor-pointer ${
              isPlayingMetronome
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-zinc-800 text-orange-400 hover:bg-zinc-700 border border-zinc-700'
            }`}
          >
            {isPlayingMetronome ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlayingMetronome ? 'ARRÊTER LE CLIC' : 'DÉMARRER LE CLIC'}</span>
          </button>
        </div>

      </div>
      )}

      {/* Tool Tab 3: Pitch Pipe & Chord Dictionary */}
      {activeMainTool === 'tuner_chords' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Reference Pitch Pipe & Instrument Tuner */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Guitar className="w-5 h-5 text-orange-500" /> Diapason & Notes d'Accordage
            </h3>
          </div>

          {/* Instrument Selector */}
          <div className="flex bg-zinc-950 p-1 rounded border border-zinc-800">
            {(['guitar', 'bass', 'ukulele'] as const).map((inst) => (
              <button
                key={inst}
                onClick={() => setTuningInstrument(inst)}
                className={`flex-1 py-1.5 text-xs font-bold capitalize rounded transition cursor-pointer ${
                  tuningInstrument === inst
                    ? 'bg-orange-500 text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {inst === 'guitar' ? 'Guitare' : inst === 'bass' ? 'Basse' : 'Ukulélé'}
              </button>
            ))}
          </div>

          {/* Strings Tones List */}
          <div className="space-y-2">
            {TUNING_NOTES[tuningInstrument].map((t) => {
              const isPlayingThisNote = activeToneNote === t.note;
              return (
                <div
                  key={t.note}
                  onClick={() => handlePlayTone(t.note, t.freq)}
                  className={`p-3 rounded border transition cursor-pointer flex items-center justify-between ${
                    isPlayingThisNote
                      ? 'bg-orange-500/10 border-orange-500 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono font-bold text-orange-400 text-xs">
                      {t.note}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-white">{t.label}</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">{t.freq} Hz</p>
                    </div>
                  </div>

                  <button className="px-3 py-1 bg-zinc-800 text-orange-400 font-bold text-xs rounded flex items-center gap-1">
                    <Zap className="w-3 h-3" />
                    <span>{isPlayingThisNote ? 'Arrêter' : 'Jouer la Note'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Chord Dictionary & Visualizer */}
        <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Piano className="w-5 h-5 text-orange-500" /> Dictionnaire d'Accords
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Schémas d'accords pour Guitare et Piano</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchChord}
                onChange={(e) => setSearchChord(e.target.value.trim())}
                placeholder="Ex: G, C, G7, Am..."
                className="w-24 bg-zinc-950 border border-zinc-800 text-orange-400 font-mono font-bold px-3 py-1 rounded text-xs focus:outline-none focus:border-orange-500 uppercase"
              />

              <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
                <button
                  onClick={() => setChordTypeTab('guitar')}
                  className={`p-1.5 rounded transition ${
                    chordTypeTab === 'guitar' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Diagramme Guitare"
                >
                  <Guitar className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setChordTypeTab('piano')}
                  className={`p-1.5 rounded transition ${
                    chordTypeTab === 'piano' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'
                  }`}
                  title="Diagramme Piano"
                >
                  <Piano className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Diagram Display */}
          <div className="bg-zinc-950 p-6 rounded-lg border border-zinc-800 flex flex-col items-center justify-center min-h-[220px]">
            <div className="text-center mb-4">
              <h4 className="text-2xl font-bold font-mono text-orange-400">{searchChord.toUpperCase() || 'C'}</h4>
              <p className="text-xs text-zinc-400">
                {chordTypeTab === 'guitar' ? 'Diagramme de frette Guitare' : 'Notes du clavier Piano'}
              </p>
            </div>

            {chordTypeTab === 'guitar' && guitarChord && (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2 text-xs font-mono font-bold text-zinc-400 mb-1">
                  <span>E A D G B e</span>
                </div>
                <div className="flex gap-2 font-mono text-sm bg-zinc-900 px-4 py-2 rounded border border-zinc-800 text-orange-300 font-bold">
                  {guitarChord.positions.map((p, i) => (
                    <span key={i}>{p.fret === -1 ? 'X' : p.fret}</span>
                  ))}
                </div>
              </div>
            )}

            {chordTypeTab === 'piano' && pianoChord && (
              <div className="flex items-center gap-2 bg-zinc-900 px-4 py-3 rounded border border-zinc-800">
                <span className="text-xs font-bold text-zinc-400">Notes :</span>
                {pianoChord.notes.map((n, i) => (
                  <span key={i} className="px-2 py-1 bg-orange-500 text-black font-bold font-mono rounded text-xs">
                    {n}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      )}

      {/* VSampler 3 Routing Modal */}
      <VSamplerPatchManagerModal
        isOpen={isVSamplerModalOpen}
        onClose={() => setIsVSamplerModalOpen(false)}
        currentSong={selectedSong || null}
        onUpdateSong={onUpdateSong}
      />

    </div>
  );
};
