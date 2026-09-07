import React, { useState, useEffect, useRef } from 'react';
import {
  Guitar,
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Play,
  Square,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  ArrowRight,
  ListMusic,
  Activity,
  Mic,
  Disc,
  Layers,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  Music,
} from 'lucide-react';
import {
  guitarAudioEngine,
  AudioInputDevice,
  TuningPreset,
  TUNING_PRESETS,
  PitchDetectionResult,
} from '../utils/guitarAudioEngine';
import {
  webMidiController,
  MidiPortInfo,
  MidiMessageLog,
  GUITAR_RIG_DEFAULT_PRESETS,
  GuitarRigPresetShortcut,
} from '../utils/webMidiController';
import { Song } from '../types';

interface GuitarStageStudioProps {
  songs?: Song[];
  onSelectSongForStage?: (song: Song) => void;
  isCompactMode?: boolean; // For stage prompter overlay
  onCloseCompact?: () => void;
}

export const GuitarStageStudio: React.FC<GuitarStageStudioProps> = ({
  songs = [],
  onSelectSongForStage,
  isCompactMode = false,
  onCloseCompact,
}) => {
  const [activeTab, setActiveTab] = useState<'tuner' | 'guitarrig' | 'architecture'>('tuner');

  // --- AUDIO INTERFACE & TUNER STATE ---
  const [inputDevices, setInputDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isAudioRunning, setIsAudioRunning] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const [inputGain, setInputGain] = useState<number>(1.0);
  const [monitorVolume, setMonitorVolume] = useState<number>(0);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);

  const [selectedPreset, setSelectedPreset] = useState<TuningPreset>(TUNING_PRESETS[0]);
  const [a4Calibration, setA4Calibration] = useState<number>(440);
  const [pitchData, setPitchData] = useState<PitchDetectionResult | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- WEBMIDI & GUITAR RIG 7 STATE ---
  const [midiOutputs, setMidiOutputs] = useState<MidiPortInfo[]>([]);
  const [midiInputs, setMidiInputs] = useState<MidiPortInfo[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const [selectedInputId, setSelectedInputId] = useState<string>('');
  const [midiChannel, setMidiChannel] = useState<number>(1);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activePcNumber, setActivePcNumber] = useState<number>(0);
  const [manualPcInput, setManualPcInput] = useState<number>(0);
  const [midiLogs, setMidiLogs] = useState<MidiMessageLog[]>([]);

  // Pedalboard CC states
  const [isTunerMuted, setIsTunerMuted] = useState<boolean>(false);
  const [isSoloBoostActive, setIsSoloBoostActive] = useState<boolean>(false);
  const [isDelayActive, setIsDelayActive] = useState<boolean>(true);
  const [isReverbActive, setIsReverbActive] = useState<boolean>(true);
  const [wahExpressionValue, setWahExpressionValue] = useState<number>(64);
  const [rigVolumeValue, setRigVolumeValue] = useState<number>(100);

  // Song to preset mapping (persisted in localStorage)
  const [songPresetMap, setSongPresetMap] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('hamide_guitarrig_song_presets');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // --- INIT AUDIO DEVICES & MIDI ---
  useEffect(() => {
    // 1. Enumerate audio devices
    const loadAudioDevices = async () => {
      try {
        const devices = await guitarAudioEngine.getAvailableInputDevices();
        setInputDevices(devices);
        if (devices.length > 0 && !selectedDeviceId) {
          setSelectedDeviceId(devices[0].deviceId);
        }
      } catch (err) {
        console.warn('Erreur détection périphériques audio:', err);
      }
    };
    loadAudioDevices();

    // 2. Init WebMIDI
    const initMidi = async () => {
      await webMidiController.init();
      setMidiOutputs(webMidiController.getOutputPorts());
      setMidiInputs(webMidiController.getInputPorts());
      setSelectedOutputId(webMidiController.getSelectedOutputId() || '');
      setSelectedInputId(webMidiController.getSelectedInputId() || '');
      setMidiLogs(webMidiController.getLogs());

      webMidiController.setOnStateChange(() => {
        setMidiOutputs(webMidiController.getOutputPorts());
        setMidiInputs(webMidiController.getInputPorts());
        setSelectedOutputId(webMidiController.getSelectedOutputId() || '');
        setSelectedInputId(webMidiController.getSelectedInputId() || '');
      });

      webMidiController.setOnIncomingMidi((cmd) => {
        setMidiLogs([...webMidiController.getLogs()]);
        // If incoming Program Change, update UI
        if (cmd.type === 'Program Change') {
          setActivePcNumber(cmd.noteOrCc);
        }
      });
    };
    initMidi();

    // 3. Audio engine callbacks
    guitarAudioEngine.setPitchCallback((res) => {
      setPitchData(res);
    });

    guitarAudioEngine.setSpectrumCallback((spectrum) => {
      drawSpectrum(spectrum);
    });

    return () => {
      guitarAudioEngine.stop();
    };
  }, []);

  // Sync settings
  useEffect(() => {
    guitarAudioEngine.setPreset(selectedPreset);
  }, [selectedPreset]);

  useEffect(() => {
    guitarAudioEngine.setCalibration(a4Calibration);
  }, [a4Calibration]);

  useEffect(() => {
    guitarAudioEngine.setInputGain(inputGain);
  }, [inputGain]);

  useEffect(() => {
    guitarAudioEngine.setMonitorVolume(isMonitoring ? monitorVolume : 0);
  }, [isMonitoring, monitorVolume]);

  useEffect(() => {
    webMidiController.setMidiChannel(midiChannel);
  }, [midiChannel]);

  useEffect(() => {
    webMidiController.selectOutput(selectedOutputId || null);
  }, [selectedOutputId]);

  useEffect(() => {
    webMidiController.selectInput(selectedInputId || null);
  }, [selectedInputId]);

  // Save song-preset map
  useEffect(() => {
    try {
      localStorage.setItem('hamide_guitarrig_song_presets', JSON.stringify(songPresetMap));
    } catch {
      // ignore
    }
  }, [songPresetMap]);

  // --- AUDIO INPUT CONTROLS ---
  const handleToggleAudio = async () => {
    setAudioError(null);
    if (isAudioRunning) {
      await guitarAudioEngine.stop();
      setIsAudioRunning(false);
      setPitchData(null);
    } else {
      const ok = await guitarAudioEngine.startInput(selectedDeviceId || undefined);
      if (ok) {
        setIsAudioRunning(true);
        // re-enumerate with device labels now granted by browser
        const devices = await guitarAudioEngine.getAvailableInputDevices();
        setInputDevices(devices);
      } else {
        setAudioError(
          "Impossible d'accéder à l'interface audio. Vérifiez les autorisations de votre navigateur pour le microphone / carte son."
        );
      }
    }
  };

  // Draw audio FFT spectrum
  const drawSpectrum = (spectrum: Uint8Array) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    const barCount = 64;
    const barWidth = width / barCount;

    for (let i = 0; i < barCount; i++) {
      const val = spectrum[i * 2] || 0;
      const barHeight = (val / 255) * height;

      // Color gradient
      const hue = 25 + (i / barCount) * 15; // Orange to amber
      ctx.fillStyle = `hsl(${hue}, 95%, ${val > 180 ? '60%' : '45%'})`;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
    }
  };

  // --- MIDI GUITAR RIG 7 ACTIONS ---
  const handleSendPreset = (shortcut: GuitarRigPresetShortcut) => {
    setActivePresetId(shortcut.id);
    setActivePcNumber(shortcut.programChange);
    webMidiController.sendProgramChange(shortcut.programChange, shortcut.bankMsb, shortcut.bankLsb);
    setMidiLogs([...webMidiController.getLogs()]);
  };

  const handleSendDirectPc = (pc: number) => {
    setActivePcNumber(pc);
    webMidiController.sendProgramChange(pc);
    setMidiLogs([...webMidiController.getLogs()]);
  };

  const handleToggleTunerMute = () => {
    const next = !isTunerMuted;
    setIsTunerMuted(next);
    // CC #1 (Mod Wheel / Tuner Mute) or CC #68
    webMidiController.sendControlChange(1, next ? 127 : 0);
    setMidiLogs([...webMidiController.getLogs()]);
  };

  const handleToggleSoloBoost = () => {
    const next = !isSoloBoostActive;
    setIsSoloBoostActive(next);
    // CC #2 (Amp Boost / Distortion)
    webMidiController.sendControlChange(2, next ? 127 : 0);
    setMidiLogs([...webMidiController.getLogs()]);
  };

  const handleToggleDelay = () => {
    const next = !isDelayActive;
    setIsDelayActive(next);
    // CC #3 (Delay on/off)
    webMidiController.sendControlChange(3, next ? 127 : 0);
    setMidiLogs([...webMidiController.getLogs()]);
  };

  const handleToggleReverb = () => {
    const next = !isReverbActive;
    setIsReverbActive(next);
    // CC #4 (Reverb on/off)
    webMidiController.sendControlChange(4, next ? 127 : 0);
    setMidiLogs([...webMidiController.getLogs()]);
  };

  const handleWahChange = (val: number) => {
    setWahExpressionValue(val);
    // CC #11 (Expression / Wah)
    webMidiController.sendControlChange(11, val);
  };

  const handleRigVolumeChange = (val: number) => {
    setRigVolumeValue(val);
    // CC #7 (Channel Volume)
    webMidiController.sendControlChange(7, val);
  };

  const handlePanic = () => {
    webMidiController.sendPanic();
    setMidiLogs([...webMidiController.getLogs()]);
  };

  // Map preset to song
  const handleAssignPresetToSong = (songId: string, pcNumber: number) => {
    setSongPresetMap((prev) => ({
      ...prev,
      [songId]: pcNumber,
    }));
  };

  const handleTriggerSongPreset = (song: Song) => {
    const pc = songPresetMap[song.id] ?? 0;
    handleSendDirectPc(pc);
    if (onSelectSongForStage) {
      onSelectSongForStage(song);
    }
  };

  // --- RENDER NEEDLE CENT VALUE ---
  const cents = pitchData && pitchData.frequency > 0 ? pitchData.cents : 0;
  const inTune = pitchData ? pitchData.inTune : false;
  // Needle angle: -50 cents = -45 deg, +50 cents = +45 deg
  const needleAngle = Math.max(-45, Math.min(45, (cents / 50) * 45));

  return (
    <div
      className={`bg-zinc-950 text-white rounded-xl border border-zinc-800 shadow-2xl flex flex-col ${
        isCompactMode ? 'p-4 max-w-2xl mx-auto' : 'p-6 max-w-7xl mx-auto space-y-6'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-sm">
            <Guitar className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-white">Studio Scène Guitare &amp; Basse</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40">
                Live Pro
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Interface audio en direct, accordeur FFT de haute précision et télécommande MIDI pour Guitar Rig 7.
            </p>
          </div>
        </div>

        {isCompactMode && onCloseCompact && (
          <button
            onClick={onCloseCompact}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Mode Tabs */}
      <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs font-bold">
        <button
          onClick={() => setActiveTab('tuner')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'tuner'
              ? 'bg-orange-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>1. Accordeur &amp; Interface Audio</span>
        </button>

        <button
          onClick={() => setActiveTab('guitarrig')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'guitarrig'
              ? 'bg-orange-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>2. Contrôleur Guitar Rig 7 (WebMIDI)</span>
        </button>

        <button
          onClick={() => setActiveTab('architecture')}
          className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
            activeTab === 'architecture'
              ? 'bg-orange-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>3. VST3 vs Standalone (Guide)</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: CHROMATIC TUNER & AUDIO INTERFACE INPUT           */}
      {/* ========================================================= */}
      {activeTab === 'tuner' && (
        <div className="space-y-6">
          {/* Audio Interface Hardware Connection Bar */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1">
                <Mic className={`w-5 h-5 ${isAudioRunning ? 'text-green-400 animate-pulse' : 'text-zinc-500'}`} />
                <div className="flex-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Interface Audio Guitare / Carte Son
                  </label>
                  <select
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    disabled={isAudioRunning}
                    className="w-full bg-zinc-950 border border-zinc-800 text-white font-medium px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 disabled:opacity-60 cursor-pointer"
                  >
                    {inputDevices.length === 0 ? (
                      <option value="">Entrée par défaut du système (Micro / Ligne)</option>
                    ) : (
                      inputDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Start / Stop Audio Capture Button */}
              <button
                onClick={handleToggleAudio}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-lg cursor-pointer ${
                  isAudioRunning
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-green-500 text-black hover:bg-green-400'
                }`}
              >
                {isAudioRunning ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isAudioRunning ? "COUPER L'ENTRÉE" : "ACTIVER L'ENTRÉE GUITARE"}</span>
              </button>
            </div>

            {/* Error banner if permission denied */}
            {audioError && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{audioError}</span>
              </div>
            )}

            {/* Input Gain & Monitoring Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
              <div>
                <div className="flex justify-between text-zinc-400 font-bold mb-1">
                  <span>Gain d'Entrée</span>
                  <span className="font-mono text-orange-400">{Math.round(inputGain * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={inputGain}
                  onChange={(e) => setInputGain(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-950 rounded appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 font-bold mb-1">
                  <span className="flex items-center gap-1.5">
                    {isMonitoring ? <Volume2 className="w-3.5 h-3.5 text-green-400" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
                    Monitoring Casque
                  </span>
                  <button
                    onClick={() => setIsMonitoring(!isMonitoring)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                      isMonitoring ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {isMonitoring ? 'ACTIF' : 'MUET'}
                  </button>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={monitorVolume}
                  onChange={(e) => setMonitorVolume(Number(e.target.value))}
                  disabled={!isMonitoring}
                  className="w-full h-1.5 bg-zinc-950 rounded appearance-none cursor-pointer accent-green-500 disabled:opacity-40"
                />
              </div>

              {/* Live VU-Meter */}
              <div>
                <div className="flex justify-between text-zinc-400 font-bold mb-1">
                  <span>Niveau Signal (dB)</span>
                  <span className="font-mono text-zinc-300">
                    {pitchData && pitchData.volumePeakDb > -90 ? `${pitchData.volumePeakDb} dB` : '-∞ dB'}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 flex">
                  <div
                    className={`h-full transition-all duration-75 ${
                      (pitchData?.volumePeakDb || -100) > -3
                        ? 'bg-red-500'
                        : (pitchData?.volumePeakDb || -100) > -12
                        ? 'bg-amber-400'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, Math.max(0, ((pitchData?.volumePeakDb || -100) + 60) * 1.66))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Visual Tuner Stage */}
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center">
            
            {/* Top Tuner Settings: Presets & Calibration */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">Accordage :</span>
                <select
                  value={selectedPreset.id}
                  onChange={(e) => {
                    const found = TUNING_PRESETS.find((p) => p.id === e.target.value);
                    if (found) setSelectedPreset(found);
                  }}
                  className="bg-zinc-950 border border-zinc-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {TUNING_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400">Diapason A4 :</span>
                <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1">
                  <input
                    type="number"
                    min="420"
                    max="460"
                    value={a4Calibration}
                    onChange={(e) => setA4Calibration(Number(e.target.value))}
                    className="w-12 bg-transparent text-center font-mono font-bold text-orange-400 text-xs focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono">Hz</span>
                </div>
              </div>
            </div>

            {/* String Selector LEDs */}
            {selectedPreset.notes.length > 0 && (
              <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
                {selectedPreset.notes.map((n) => {
                  const isCurrentString = pitchData?.closestStringNumber === n.stringNumber;
                  return (
                    <div
                      key={n.stringNumber}
                      className={`flex flex-col items-center justify-center w-11 h-13 rounded-xl border transition-all ${
                        isCurrentString
                          ? inTune
                            ? 'bg-green-500/20 border-green-500 text-green-400 scale-105 shadow-lg shadow-green-500/20'
                            : 'bg-orange-500/20 border-orange-500 text-orange-400 scale-105 shadow-lg shadow-orange-500/20'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <span className="text-[10px] font-mono font-bold">Corde {n.stringNumber}</span>
                      <span className="text-sm font-extrabold font-mono">
                        {n.note}
                        <span className="text-[10px] font-normal">{n.octave}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Big Dial Gauge Display */}
            <div className="relative w-full max-w-md h-52 flex flex-col items-center justify-center">
              
              {/* Radial Arc Markers */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg viewBox="0 0 300 160" className="w-72 sm:w-80 h-auto">
                  {/* Outer circle arc */}
                  <path
                    d="M 30 140 A 120 120 0 0 1 270 140"
                    fill="none"
                    stroke="#27272a"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  {/* Center in-tune green arc */}
                  <path
                    d="M 135 22 A 120 120 0 0 1 165 22"
                    fill="none"
                    stroke={inTune ? '#22c55e' : '#15803d'}
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  {/* Needle Pivot & Line */}
                  <g
                    style={{
                      transformOrigin: '150px 140px',
                      transform: `rotate(${needleAngle}deg)`,
                      transition: 'transform 0.08s ease-out',
                    }}
                  >
                    <line
                      x1="150"
                      y1="140"
                      x2="150"
                      y2="30"
                      stroke={inTune ? '#22c55e' : '#f97316'}
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <circle cx="150" cy="140" r="8" fill={inTune ? '#22c55e' : '#f97316'} />
                  </g>
                </svg>
              </div>

              {/* Big Note Display */}
              <div className="z-10 text-center mt-12">
                <div
                  className={`text-6xl sm:text-7xl font-black font-mono tracking-tight transition-all duration-100 ${
                    !isAudioRunning || !pitchData || pitchData.frequency === 0
                      ? 'text-zinc-600'
                      : inTune
                      ? 'text-green-400 drop-shadow-[0_0_25px_rgba(34,197,94,0.6)]'
                      : 'text-orange-400 drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]'
                  }`}
                >
                  {isAudioRunning && pitchData && pitchData.frequency > 0 ? (
                    <>
                      {pitchData.noteName}
                      <span className="text-3xl font-normal text-zinc-400 ml-1">{pitchData.octave}</span>
                    </>
                  ) : (
                    '--'
                  )}
                </div>

                {/* Status Text & Cents */}
                <div className="mt-2 flex items-center justify-center gap-2">
                  {!isAudioRunning ? (
                    <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                      Cliquez sur "Activer l'entrée guitare" pour commencer
                    </span>
                  ) : !pitchData || pitchData.frequency === 0 ? (
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider animate-pulse">
                      Jouez une corde de votre guitare...
                    </span>
                  ) : inTune ? (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md">
                      <CheckCircle2 className="w-4 h-4" /> ACCORDÉ ({cents > 0 ? `+${cents}` : cents} ct)
                    </span>
                  ) : cents < 0 ? (
                    <span className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider">
                      ▼ TROP BAS ({cents} cents)
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-black uppercase tracking-wider">
                      ▲ TROP HAUT (+{cents} cents)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Numerical Frequency & Target */}
            <div className="flex items-center gap-6 text-xs font-mono text-zinc-400 mt-4">
              <div>
                Fréquence détectée :{' '}
                <span className="font-bold text-white">
                  {pitchData && pitchData.frequency > 0 ? `${pitchData.frequency} Hz` : '-- Hz'}
                </span>
              </div>
              <div className="h-4 w-[1px] bg-zinc-800" />
              <div>
                Cible juste :{' '}
                <span className="font-bold text-orange-400">
                  {pitchData && pitchData.targetFrequency > 0 ? `${pitchData.targetFrequency} Hz` : '-- Hz'}
                </span>
              </div>
            </div>

            {/* FFT Spectrum Real-Time Visualizer */}
            <div className="w-full mt-6">
              <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mb-1">
                <span>SPECTRE HARMONIQUE EN TEMPS RÉEL (FFT 4096 BINS)</span>
                <span>20 Hz — 2 kHz</span>
              </div>
              <canvas
                ref={canvasRef}
                width={480}
                height={40}
                className="w-full h-10 rounded-lg border border-zinc-800/80 bg-zinc-950"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: GUITAR RIG 7 REMOTE STAGE CONTROLLER (WEBMIDI)     */}
      {/* ========================================================= */}
      {activeTab === 'guitarrig' && (
        <div className="space-y-6">
          {/* MIDI Port & Hardware routing */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-orange-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Connexion MIDI vers Guitar Rig 7 Standalone</h3>
                  <p className="text-[11px] text-zinc-400">
                    Communique directement avec Guitar Rig 7 via câble virtuel (loopMIDI) ou interface USB-MIDI.
                  </p>
                </div>
              </div>

              <button
                onClick={handlePanic}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs font-bold flex items-center gap-1.5 border border-zinc-700 transition cursor-pointer"
                title="Coupe toutes les notes et réinitialise les contrôleurs MIDI"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Panic (All Notes Off)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-800">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Port MIDI Sortie (Vers Guitar Rig)</label>
                <select
                  value={selectedOutputId}
                  onChange={(e) => setSelectedOutputId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {midiOutputs.length === 0 ? (
                    <option value="">Aucun port détecté (Installez loopMIDI)</option>
                  ) : (
                    midiOutputs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Port MIDI Entrée (Pédalier au pied)</label>
                <select
                  value={selectedInputId}
                  onChange={(e) => setSelectedInputId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {midiInputs.length === 0 ? (
                    <option value="">Aucun pédalier détecté</option>
                  ) : (
                    midiInputs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Canal MIDI</label>
                <select
                  value={midiChannel}
                  onChange={(e) => setMidiChannel(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white font-bold px-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  {Array.from({ length: 16 }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Canal {i + 1} {i === 0 ? '(Standard Guitar Rig)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Virtual Stage Foot Controller / Live Pedalboard */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-orange-400" /> Pédalier Live &amp; Déclencheurs Directs (Control Change)
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">CC #1, #2, #3, #4, #7, #11</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Tuner / Mute */}
              <button
                onClick={handleToggleTunerMute}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition cursor-pointer ${
                  isTunerMuted
                    ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/30'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <VolumeX className="w-5 h-5" />
                <span>MUTE / TUNER</span>
                <span className="text-[9px] font-normal opacity-70">CC #1 ({isTunerMuted ? '127' : '0'})</span>
              </button>

              {/* Solo Boost */}
              <button
                onClick={handleToggleSoloBoost}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition cursor-pointer ${
                  isSoloBoostActive
                    ? 'bg-orange-500 text-black border-orange-400 shadow-lg shadow-orange-500/30'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Zap className="w-5 h-5" />
                <span>SOLO BOOST (+6dB)</span>
                <span className="text-[9px] font-normal opacity-70">CC #2 ({isSoloBoostActive ? '127' : '0'})</span>
              </button>

              {/* Delay Toggle */}
              <button
                onClick={handleToggleDelay}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition cursor-pointer ${
                  isDelayActive
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <Layers className="w-5 h-5" />
                <span>DELAY ECHO</span>
                <span className="text-[9px] font-normal opacity-70">CC #3 ({isDelayActive ? 'ON' : 'OFF'})</span>
              </button>

              {/* Reverb Toggle */}
              <button
                onClick={handleToggleReverb}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 font-bold text-xs transition cursor-pointer ${
                  isReverbActive
                    ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
                }`}
              >
                <Disc className="w-5 h-5" />
                <span>REVERB WASH</span>
                <span className="text-[9px] font-normal opacity-70">CC #4 ({isReverbActive ? 'ON' : 'OFF'})</span>
              </button>
            </div>

            {/* Expression Pedals: Wah & Master Rig Volume */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
              <div>
                <div className="flex justify-between text-zinc-400 font-bold mb-1">
                  <span>Pédale Wah / Expression (CC #11)</span>
                  <span className="font-mono text-orange-400">{wahExpressionValue} / 127</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={wahExpressionValue}
                  onChange={(e) => handleWahChange(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-950 rounded appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-zinc-400 font-bold mb-1">
                  <span>Volume Sortie Rig (CC #7)</span>
                  <span className="font-mono text-orange-400">{rigVolumeValue} / 127</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={rigVolumeValue}
                  onChange={(e) => handleRigVolumeChange(Number(e.target.value))}
                  className="w-full h-2 bg-zinc-950 rounded appearance-none cursor-pointer accent-orange-500"
                />
              </div>
            </div>
          </div>

          {/* Quick Guitar Rig Preset Selector (Program Change 0 - 127) */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Presets Directs Guitar Rig 7 (Program Change)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Sélectionnez un son pour envoyer instantanément le changement de programme à Guitar Rig 7.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-zinc-400">PC Direct :</span>
                <input
                  type="number"
                  min="0"
                  max="127"
                  value={manualPcInput}
                  onChange={(e) => setManualPcInput(Number(e.target.value))}
                  className="w-14 bg-zinc-950 border border-zinc-800 text-white font-mono font-bold px-2 py-1 rounded text-xs text-center"
                />
                <button
                  onClick={() => handleSendDirectPc(manualPcInput)}
                  className="px-2.5 py-1 bg-orange-500 text-black font-bold text-xs rounded hover:bg-orange-400 transition cursor-pointer"
                >
                  Envoyer
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {GUITAR_RIG_DEFAULT_PRESETS.map((p) => {
                const isSelected = activePcNumber === p.programChange;
                return (
                  <button
                    key={p.id}
                    onClick={() => handleSendPreset(p)}
                    className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-orange-500/20 border-orange-500 text-white shadow-lg shadow-orange-500/20'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">
                          {p.category}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          PC #{p.programChange}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-white leading-snug">{p.name}</h4>
                      <p className="text-[10px] text-zinc-500 mt-1 line-clamp-2">{p.description}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] font-bold text-orange-400">
                      <span>{isSelected ? 'ACTIF SUR SCÈNE' : 'CHARGER PRESET'}</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Song Preset Linker (Setlist Integration) */}
          {songs.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 p-5 rounded-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <ListMusic className="w-4 h-4 text-orange-400" /> Liaison Chansons ➔ Presets Guitar Rig 7
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Quand vous lancez une chanson sur scène, le son correspondant s'active automatiquement dans Guitar Rig 7 !
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                {songs.map((song) => {
                  const assignedPc = songPresetMap[song.id] ?? 0;
                  return (
                    <div
                      key={song.id}
                      className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="truncate flex-1">
                        <h4 className="font-bold text-white truncate">{song.title}</h4>
                        <p className="text-[10px] text-zinc-500 truncate">{song.artist || 'Artiste'}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={assignedPc}
                          onChange={(e) => handleAssignPresetToSong(song.id, Number(e.target.value))}
                          className="bg-zinc-900 border border-zinc-700 text-orange-400 font-mono font-bold px-2 py-1 rounded text-xs cursor-pointer"
                        >
                          {Array.from({ length: 16 }).map((_, i) => (
                            <option key={i} value={i}>
                              Preset #{i + 1} (PC {i})
                            </option>
                          ))}
                        </select>

                        <button
                          onClick={() => handleTriggerSongPreset(song)}
                          className="p-1.5 rounded bg-orange-500 hover:bg-orange-400 text-black font-bold transition cursor-pointer"
                          title="Tester et envoyer le son"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MIDI Live Console Monitor */}
          <div className="bg-zinc-900/40 border border-zinc-800 p-4 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
              <span className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-orange-400" /> Moniteur des Événements MIDI (WebMIDI)
              </span>
              <button
                onClick={() => {
                  webMidiController.clearLogs();
                  setMidiLogs([]);
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 font-normal transition"
              >
                Effacer l'historique
              </button>
            </div>

            <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-lg p-2 font-mono text-[11px] overflow-y-auto space-y-1">
              {midiLogs.length === 0 ? (
                <div className="text-zinc-600 italic text-center py-4">
                  En attente d'événements MIDI... Cliquez sur un preset ou actionnez une pédale.
                </div>
              ) : (
                midiLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`flex items-center gap-2 ${
                      log.direction === 'sent' ? 'text-orange-400' : 'text-green-400'
                    }`}
                  >
                    <span className="text-zinc-600">[{log.timestamp}]</span>
                    <span className="font-bold">{log.direction === 'sent' ? '➔ ENVOI' : '⬅ REÇU'}:</span>
                    <span className="text-zinc-300">{log.type}</span>
                    <span className="text-zinc-500">Ch.{log.channel}</span>
                    <span className="font-bold text-white">{log.data}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: ARCHITECTURE VST3 VS STANDALONE (EXPLANATION)      */}
      {/* ========================================================= */}
      {activeTab === 'architecture' && (
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed">
          <div className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-300 space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-white">
              <ShieldAlert className="w-5 h-5 text-orange-400" /> Analyse Technique pour Guitar Rig 7 &amp; Scène Live
            </h3>
            <p>
              Pour votre question : <em>« Est-il possible d'intégrer un hôte de plugin VST3 côté Rust (src-tauri) pour charger Guitar Rig 7, ou devons-nous mettre en place un routage MIDI (WebMIDI) vers l'application Standalone ? »</em>
            </p>
            <p className="font-bold text-white">
              👉 La réponse professionnelle sans équivoque pour la scène est :{' '}
              <span className="text-orange-400 underline">
                Le routage de commandes MIDI (WebMIDI / loopMIDI) vers Guitar Rig 7 Standalone.
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option A: VST3 in Rust */}
            <div className="bg-zinc-900/60 border border-red-500/30 p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <span>❌ Option A : Hôte VST3 dans Rust / Tauri</span>
              </div>
              <p className="text-zinc-400">
                Bien qu'il existe des crates Rust comme <code className="text-orange-300">vst3-sys</code> ou{' '}
                <code className="text-orange-300">baseview</code>, héberger Guitar Rig 7 directement dans Tauri présente des obstacles majeurs en situation réelle :
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 pl-1">
                <li>
                  <strong className="text-white">Problème d'affichage GUI (Airspace bug) :</strong> L'interface graphique de Guitar Rig 7 est une fenêtre Win32 native (DirectX/OpenGL). Dans Tauri (basé sur WebView2), intégrer une fenêtre native Win32 à l'intérieur du DOM HTML provoque des conflits de superposition (z-order), des scintillements et des plantages au redimensionnement.
                </li>
                <li>
                  <strong className="text-white">Moteur Audio &amp; Pilote ASIO :</strong> Un hôte VST3 doit gérer un moteur de rendu audio temps réel (buffer circulaire, callback ASIO haute priorité). Si le thread audio plante ou subit un lag de garbage collection, le son coupe net sur scène.
                </li>
                <li>
                  <strong className="text-white">Licences &amp; Native Access :</strong> Guitar Rig 7 vérifie les licences via le service d'arrière-plan de Native Instruments. Les hôtes VST3 non certifiés sont souvent bloqués ou instables.
                </li>
              </ul>
            </div>

            {/* Option B: WebMIDI to Standalone */}
            <div className="bg-zinc-900/60 border border-green-500/30 p-5 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                <span>✅ Option B : Contrôle à Distance de Guitar Rig Standalone</span>
              </div>
              <p className="text-zinc-400">
                C'est l'architecture adoptée par tous les guitaristes professionnels en tournée (touring rigs avec prompteur ou backing tracks) :
              </p>
              <ul className="list-disc list-inside space-y-2 text-zinc-400 pl-1">
                <li>
                  <strong className="text-white">Latence Minimum Garantie :</strong> Guitar Rig 7 Standalone communique directement avec les pilotes ASIO de votre carte son (Focusrite, Behringer, etc.) avec une latence inférieure à 3 millisecondes.
                </li>
                <li>
                  <strong className="text-white">Zéro Latence MIDI :</strong> L'application envoie les Program Changes et Control Changes instantanément via le protocole WebMIDI natif et loopMIDI sous Windows 11.
                </li>
                <li>
                  <strong className="text-white">Fiabilité Maximale :</strong> Si l'application d'affichage doit redémarrer, le son de la guitare ne coupe jamais car Guitar Rig continue de traiter le son en tâche de fond.
                </li>
                <li>
                  <strong className="text-white">Automatisation Setlist :</strong> Chaque chanson de votre setlist bascule automatiquement Guitar Rig sur le bon son (Clean, Crunch, Solo Lead, Wah).
                </li>
              </ul>
            </div>
          </div>

          {/* Step by step connection guide */}
          <div className="bg-zinc-900/80 border border-zinc-800 p-5 rounded-xl space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-orange-400" /> Guide Pratique d'Installation sous Windows 11
            </h4>
            <div className="space-y-2 text-zinc-400">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  1
                </span>
                <p>
                  Installez l'utilitaire gratuit <strong className="text-white">loopMIDI</strong> (de Tobias Erichsen) sur votre PC Windows 11. Cliquez sur le bouton <strong className="text-orange-400">+</strong> pour créer un port virtuel nommé <code className="text-orange-300">loopMIDI Port</code>.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  2
                </span>
                <p>
                  Dans <strong className="text-white">Guitar Rig 7 Standalone</strong>, allez dans <em>File ➔ Preferences ➔ MIDI</em>. Cochez l'entrée <code className="text-orange-300">loopMIDI Port</code> sur <strong className="text-green-400">ON</strong>.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  3
                </span>
                <p>
                  Dans cette application, sélectionnez <code className="text-orange-300">loopMIDI Port</code> dans l'onglet <strong>Contrôleur Guitar Rig 7</strong>. C'est prêt ! Vos boutons Clean, Crunch, Lead, Wah et vos setlists pilotent désormais votre son instantanément.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
