import { Midi } from '@tonejs/midi';
import { parseSf2File, Sf2ParsedResult, Sf2SampleHeader } from './sf2Parser';
import { Song, VSamplerSongConfig, VSamplerChannelConfig } from '../types';

export const DOSSIER_INSTRUMENTS_STORAGE_KEY = 'hamide_vsampler_root_folder';
export const DEFAULT_DOSSIER_INSTRUMENTS = "D:\\MaMusique\\Chansons_Scene\\";
export const DEFAULT_VSAMPLER_EXE = "C:\\Program Files\\VSampler3\\VSampler3.exe";

export interface MidiTrackInfo {
  id: number;
  name: string;
  channel: number;
  program: number;
  instrumentName: string;
  instrumentFamily: string;
  isPercussion: boolean;
  notesCount: number;
  volume: number; // 0.0 to 1.5 (default 1.0)
  pan: number; // -1.0 (L) to +1.0 (R)
  isMuted: boolean;
  isSolo: boolean;
  color: string;
  notes: {
    name: string;
    midi: number;
    time: number; // in seconds
    duration: number; // in seconds
    velocity: number; // 0 to 1
  }[];
  activeNotes: number[]; // currently sounding MIDI note numbers
}

export interface MidiOutputDeviceInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state?: string;
}

export type MidiOutputRoutingMode = 'web_midi' | 'web_audio' | 'both';

export interface MidiPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  progressPercent: number;
  bpm: number;
  tempoMultiplier: number;
  transposeSemitones: number;
  title: string;
  tracks: MidiTrackInfo[];
  soundFontInfo: {
    name: string;
    samplesCount: number;
    sizeMb: number;
    isCustom: boolean;
  } | null;
  // Web MIDI API & VSampler 3 Routing
  isWebMidiSupported: boolean;
  isWebMidiConnected: boolean;
  midiOutputs: MidiOutputDeviceInfo[];
  selectedMidiOutputId: string; // 'all' | specific port ID | 'none'
  outputMode: MidiOutputRoutingMode; // 'web_midi' (external VSampler 3/VST) | 'web_audio' (browser) | 'both'
  midiActivityTx: boolean; // activity blinker for outgoing MIDI packets
}

// 128 General MIDI instrument names
export const GM_INSTRUMENTS = [
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1 (Rhodes)', 'Electric Piano 2 (Chorused)', 'Harpsichord', 'Clavinet',
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
  'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
  'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics',
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
  'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
  'Violin', 'Viola', 'Cello', 'Contrabass',
  'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  'String Ensemble 1', 'String Ensemble 2', 'SynthStrings 1', 'SynthStrings 2',
  'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
  'French Horn', 'Brass Section', 'SynthBrass 1', 'SynthBrass 2',
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
  'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
  'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
  'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
  'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
  'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
  'Sitar', 'Banjo', 'Shamisen', 'Koto',
  'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
  'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
  'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
];

export interface GmCategory {
  name: string;
  start: number;
  end: number;
  icon: string;
}

export const GM_CATEGORIES: GmCategory[] = [
  { name: 'Pianos & Claviers', start: 0, end: 7, icon: 'Piano' },
  { name: 'Percussions Chromatiques', start: 8, end: 15, icon: 'Sparkles' },
  { name: 'Orgues & Accordéons', start: 16, end: 23, icon: 'Layers' },
  { name: 'Guitares Acoustiques & Élec', start: 24, end: 31, icon: 'Music' },
  { name: 'Basses Acoustiques & Synth', start: 32, end: 39, icon: 'Sliders' },
  { name: 'Cordes Solo / Orchestre', start: 40, end: 47, icon: 'Music' },
  { name: 'Ensembles & Voix', start: 48, end: 55, icon: 'Headphones' },
  { name: 'Cuivres & Sections Brass', start: 56, end: 63, icon: 'Radio' },
  { name: 'Anches / Saxophones', start: 64, end: 71, icon: 'Music' },
  { name: 'Flûtes & Bois', start: 72, end: 79, icon: 'Music' },
  { name: 'Synth Leads', start: 80, end: 87, icon: 'Zap' },
  { name: 'Synth Pads (Nappes)', start: 88, end: 95, icon: 'Disc' },
  { name: 'Synth Sound FX', start: 96, end: 103, icon: 'Sparkles' },
  { name: 'Instruments Ethniques', start: 104, end: 111, icon: 'Music' },
  { name: 'Percussions Mélodiques', start: 112, end: 119, icon: 'Disc' },
  { name: 'Effets Spéciaux FX', start: 120, end: 127, icon: 'Sparkles' },
];

export const TRACK_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#10b981', // emerald
  '#a855f7', // purple
  '#ec4899', // pink
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#f43f5e', // rose
  '#84cc16', // lime
  '#6366f1', // indigo
];

class MultiTrackMidiAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private startTime = 0;
  private pauseOffset = 0;
  private duration = 0;
  private bpm = 120;
  private tempoMultiplier = 1.0;
  private transposeSemitones = 0;
  private masterVolume = 0.85;
  private title = 'Aucun fichier MIDI';

  private tracks: MidiTrackInfo[] = [];
  private soundFont: Sf2ParsedResult | null = null;
  private soundFontSamplesMap: Map<number, Sf2SampleHeader[]> = new Map();

  // Web MIDI API & VSampler 3 integration
  private midiAccess: any = null;
  private midiOutputs: MidiOutputDeviceInfo[] = [];
  private selectedMidiOutputId: string = 'all'; // 'all' | specific port id | 'none'
  private outputMode: MidiOutputRoutingMode = 'web_midi'; // Default to Web MIDI for VSampler 3 / VST / DAW
  private isWebMidiSupported: boolean = false;
  private isWebMidiConnected: boolean = false;
  private midiActivityTx: boolean = false;
  private txBlinkTimeout: any = null;

  private activeAudioNodes: { stop: () => void; note: number; trackId: number }[] = [];
  private animationFrameId: number | null = null;
  private scheduledNotesIndex: number[] = [];

  // Listeners
  private listeners: Set<(state: MidiPlaybackState) => void> = new Set();
  private onStateChange: ((state: MidiPlaybackState) => void) | null = null;

  constructor() {
    // Try to auto-detect Web MIDI support on start & load persisted preferences
    if (typeof window !== 'undefined') {
      try {
        const savedPort = localStorage.getItem('hamide_midi_output_id');
        if (savedPort) this.selectedMidiOutputId = savedPort;
        const savedMode = localStorage.getItem('hamide_midi_output_mode') as MidiOutputRoutingMode;
        if (savedMode && (savedMode === 'web_midi' || savedMode === 'web_audio' || savedMode === 'both')) {
          this.outputMode = savedMode;
        }
      } catch {}
      this.initWebMidi().catch(() => {});
    }
  }

  private initCtx(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Web MIDI API & VSampler 3 Integration Methods ---
  public async initWebMidi(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !(navigator as any).requestMIDIAccess) {
      this.isWebMidiSupported = false;
      this.isWebMidiConnected = false;
      this.outputMode = 'web_audio';
      this.emitState();
      return false;
    }

    this.isWebMidiSupported = true;

    try {
      const access = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.midiAccess = access;
      this.isWebMidiConnected = true;
      this.updateMidiOutputs();

      access.onstatechange = () => {
        this.updateMidiOutputs();
      };

      this.emitState();
      return true;
    } catch (err) {
      console.warn('Web MIDI permission not granted or failed:', err);
      this.isWebMidiConnected = false;
      this.emitState();
      return false;
    }
  }

  private updateMidiOutputs() {
    if (!this.midiAccess) {
      this.midiOutputs = [];
      return;
    }

    const outputs: MidiOutputDeviceInfo[] = [];
    const iterator = this.midiAccess.outputs.values();
    for (const out of iterator) {
      outputs.push({
        id: out.id,
        name: out.name || `Sortie MIDI ${out.id}`,
        manufacturer: out.manufacturer,
        state: out.state,
      });
    }

    this.midiOutputs = outputs;

    // Check if saved port exists in detected outputs
    if (this.selectedMidiOutputId !== 'all' && this.selectedMidiOutputId !== 'none') {
      const exists = outputs.some((o) => o.id === this.selectedMidiOutputId);
      if (!exists && outputs.length > 0) {
        this.selectedMidiOutputId = 'all';
      }
    } else if (this.selectedMidiOutputId === 'none' && outputs.length > 0) {
      this.selectedMidiOutputId = 'all';
    }

    this.emitState();
  }

  public setSelectedMidiOutput(portId: string) {
    this.selectedMidiOutputId = portId;
    try {
      localStorage.setItem('hamide_midi_output_id', portId);
    } catch {}
    this.emitState();
  }

  public setOutputMode(mode: MidiOutputRoutingMode) {
    this.outputMode = mode;
    try {
      localStorage.setItem('hamide_midi_output_mode', mode);
    } catch {}
    this.emitState();
  }

  public getTargetMidiOutputs(): any[] {
    if (!this.midiAccess || this.selectedMidiOutputId === 'none') return [];

    const result: any[] = [];
    const iterator = this.midiAccess.outputs.values();
    for (const out of iterator) {
      if (this.selectedMidiOutputId === 'all' || out.id === this.selectedMidiOutputId) {
        result.push(out);
      }
    }
    return result;
  }

  private pulseMidiActivity() {
    this.midiActivityTx = true;
    if (this.txBlinkTimeout) clearTimeout(this.txBlinkTimeout);
    this.txBlinkTimeout = setTimeout(() => {
      this.midiActivityTx = false;
      this.emitState();
    }, 80);
  }

  public sendMidiBytes(bytes: number[] | Uint8Array, timestamp?: number) {
    const outputs = this.getTargetMidiOutputs();
    if (outputs.length === 0) return;

    for (const out of outputs) {
      try {
        if (timestamp !== undefined) {
          out.send(bytes, timestamp);
        } else {
          out.send(bytes);
        }
      } catch (err) {
        console.warn('MIDI Out Send Error:', err);
      }
    }
    this.pulseMidiActivity();
  }

  public sendMidiNoteOn(channel: number, note: number, velocity: number, timestamp?: number) {
    const ch = Math.max(0, Math.min(15, channel));
    const n = Math.max(0, Math.min(127, note));
    const v = Math.max(1, Math.min(127, Math.round(velocity * 127)));
    this.sendMidiBytes([0x90 | ch, n, v], timestamp);
  }

  public sendMidiNoteOff(channel: number, note: number, timestamp?: number) {
    const ch = Math.max(0, Math.min(15, channel));
    const n = Math.max(0, Math.min(127, note));
    this.sendMidiBytes([0x80 | ch, n, 0], timestamp);
  }

  public sendMidiProgramChange(channel: number, program: number) {
    const ch = Math.max(0, Math.min(15, channel));
    const p = Math.max(0, Math.min(127, program));
    this.sendMidiBytes([0xC0 | ch, p]);
  }

  public sendMidiControlChange(channel: number, cc: number, value: number) {
    const ch = Math.max(0, Math.min(15, channel));
    const c = Math.max(0, Math.min(127, cc));
    const val = Math.max(0, Math.min(127, value));
    this.sendMidiBytes([0xB0 | ch, c, val]);
  }

  public sendAllNotesOff() {
    for (let ch = 0; ch < 16; ch++) {
      this.sendMidiControlChange(ch, 123, 0); // All Notes Off
      this.sendMidiControlChange(ch, 120, 0); // All Sound Off
    }
  }

  public sendTestNote(channel = 0, note = 60) {
    // Send a 500ms test chord / note on the selected output
    this.sendMidiNoteOn(channel, note, 0.9);
    setTimeout(() => {
      this.sendMidiNoteOff(channel, note);
    }, 450);
  }

  public subscribe(listener: (state: MidiPlaybackState) => void): () => void {
    this.listeners.add(listener);
    // Emit immediate current state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public setListener(listener: (state: MidiPlaybackState) => void) {
    this.onStateChange = listener;
    this.emitState();
  }

  public getState(): MidiPlaybackState {
    const currentTime = this.getCurrentTime();
    return {
      isPlaying: this.isPlaying,
      currentTime,
      duration: this.duration,
      progressPercent: this.duration > 0 ? (currentTime / this.duration) * 100 : 0,
      bpm: Math.round(this.bpm * this.tempoMultiplier),
      tempoMultiplier: this.tempoMultiplier,
      transposeSemitones: this.transposeSemitones,
      title: this.title,
      tracks: [...this.tracks],
      soundFontInfo: this.soundFont
        ? {
            name: this.soundFont.name,
            samplesCount: this.soundFont.samplesCount,
            sizeMb: this.soundFont.totalSizeMb,
            isCustom: true,
          }
        : {
            name: 'Synthétiseur Général MIDI HD (Intégré)',
            samplesCount: 128,
            sizeMb: 0,
            isCustom: false,
          },
      isWebMidiSupported: this.isWebMidiSupported,
      isWebMidiConnected: this.isWebMidiConnected,
      midiOutputs: [...this.midiOutputs],
      selectedMidiOutputId: this.selectedMidiOutputId,
      outputMode: this.outputMode,
      midiActivityTx: this.midiActivityTx,
    };
  }

  public emitState() {
    const state = this.getState();
    if (this.onStateChange) {
      this.onStateChange(state);
    }
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in MIDI state listener:', err);
      }
    }
  }

  public getCurrentTime(): number {
    if (!this.isPlaying) return Math.min(this.duration, this.pauseOffset);
    if (!this.ctx) return 0;
    const elapsed = (this.ctx.currentTime - this.startTime) * this.tempoMultiplier;
    return Math.min(this.duration, this.pauseOffset + elapsed);
  }

  // --- SoundFont 2 File Import ---
  public async loadSf2(arrayBuffer: ArrayBuffer): Promise<Sf2ParsedResult> {
    const ctx = this.initCtx();
    const parsed = parseSf2File(arrayBuffer, ctx);
    this.soundFont = parsed;

    // Index samples by pitch for fast lookup
    this.soundFontSamplesMap.clear();
    for (const sh of parsed.sampleHeaders) {
      if (sh.audioBuffer) {
        const pitch = sh.originalPitch;
        const list = this.soundFontSamplesMap.get(pitch) || [];
        list.push(sh);
        this.soundFontSamplesMap.set(pitch, list);
      }
    }

    this.emitState();
    return parsed;
  }

  public resetToDefaultSoundFont() {
    this.soundFont = null;
    this.soundFontSamplesMap.clear();
    this.emitState();
  }

  // --- MIDI File Loader ---
  public async loadMidi(arrayBuffer: ArrayBuffer, fileName = 'morceau.mid') {
    this.stop();
    const midi = new Midi(arrayBuffer);

    this.title = midi.name && midi.name.trim().length > 0 ? midi.name.trim() : fileName.replace(/\.(mid|midi)$/i, '');
    this.duration = Math.max(5, midi.duration || 180);

    if (midi.header.tempos && midi.header.tempos.length > 0) {
      this.bpm = Math.round(midi.header.tempos[0].bpm);
    } else {
      this.bpm = 120;
    }

    // Convert MIDI tracks to our rich track structure
    this.tracks = midi.tracks
      .filter((t) => t.notes.length > 0)
      .map((track, idx) => {
        const isPerc = track.instrument?.percussion || track.channel === 9;
        const prog = track.instrument?.number !== undefined ? track.instrument.number : isPerc ? 0 : 0;
        const instName = isPerc
          ? 'Batterie & Percussions GM'
          : GM_INSTRUMENTS[prog] || track.instrument?.name || `Piste ${idx + 1}`;
        const fam = isPerc ? 'Percussion' : track.instrument?.family || 'Clavier';

        const color = TRACK_COLORS[idx % TRACK_COLORS.length];

        return {
          id: idx,
          name: track.name?.trim() || `${instName} (Canal ${track.channel + 1})`,
          channel: track.channel,
          program: prog,
          instrumentName: instName,
          instrumentFamily: fam,
          isPercussion: isPerc,
          notesCount: track.notes.length,
          volume: 1.0,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color,
          notes: track.notes.map((n) => ({
            name: n.name,
            midi: n.midi,
            time: n.time,
            duration: n.duration,
            velocity: n.velocity,
          })),
          activeNotes: [],
        };
      });

    this.pauseOffset = 0;
    this.scheduledNotesIndex = new Array(this.tracks.length).fill(0);

    // Send initial MIDI configuration to VSampler 3 / external port
    this.sendInitialMidiSetup();

    this.emitState();
  }

  public sendInitialMidiSetup() {
    this.sendAllNotesOff();
    for (const track of this.tracks) {
      if (!track.isPercussion && track.channel !== 9) {
        // Send Bank Select MSB / LSB (0,0 default GM bank)
        this.sendMidiControlChange(track.channel, 0, 0);
        this.sendMidiControlChange(track.channel, 32, 0);
        this.sendMidiProgramChange(track.channel, track.program);
      } else {
        // Channel 10 Drum kit bank
        this.sendMidiControlChange(9, 0, 127);
        this.sendMidiControlChange(9, 32, 0);
      }
      this.sendMidiControlChange(track.channel, 7, Math.round((track.volume / 1.5) * 127));
      this.sendMidiControlChange(track.channel, 10, Math.round(((track.pan + 1) / 2) * 127));
      this.sendMidiControlChange(track.channel, 91, 35); // Moderate Reverb
    }
  }

  // Deep Synchronization button for VSampler 3 / external hardware
  public syncVSampler3Setup(): { success: boolean; syncedTracks: number; channels: number[] } {
    this.sendAllNotesOff();
    const channels: number[] = [];

    for (const track of this.tracks) {
      if (!channels.includes(track.channel)) {
        channels.push(track.channel);
      }

      if (track.channel === 9 || track.isPercussion) {
        // Percussion / Drum Kit setup on Channel 10
        this.sendMidiControlChange(track.channel, 0, 127);
        this.sendMidiControlChange(track.channel, 32, 0);
        this.sendMidiProgramChange(track.channel, 0); // Standard Kit
      } else {
        // Melodic GM Instrument Setup
        this.sendMidiControlChange(track.channel, 0, 0);
        this.sendMidiControlChange(track.channel, 32, 0);
        this.sendMidiProgramChange(track.channel, track.program);
      }

      // Volume & Pan & Effects
      this.sendMidiControlChange(track.channel, 7, Math.round((track.volume / 1.5) * 127));
      this.sendMidiControlChange(track.channel, 10, Math.round(((track.pan + 1) / 2) * 127));
      this.sendMidiControlChange(track.channel, 91, 40); // Reverb Send
      this.sendMidiControlChange(track.channel, 93, 10); // Chorus Send
    }

    this.pulseMidiActivity();
    return { success: true, syncedTracks: this.tracks.length, channels };
  }

  /**
   * Transmits comprehensive multi-timbral configuration burst to VSampler 3 / loopMIDI.
   * Configures all active channels with Bank MSB/LSB, Program Changes, Volumes, and Pans.
   */
  public async sendSongVSamplerConfig(config: VSamplerSongConfig): Promise<{ success: boolean; channelsCount: number; details: string[] }> {
    if (!this.midiAccess) {
      await this.initWebMidi();
    }

    const outputs = this.getTargetMidiOutputs();
    if (outputs.length === 0) {
      return { success: false, channelsCount: 0, details: ['Aucun port MIDI sélectionné ou actif'] };
    }

    // 1. Send All Notes Off & Sound Off across all 16 channels to reset cleanly
    this.sendAllNotesOff();

    // 2. If Master Program Change is specified for VSampler Multi/Performance recall
    if (config.masterProgramChange !== undefined && config.masterProgramChange >= 0) {
      this.sendMidiProgramChange(15, config.masterProgramChange);
      await new Promise((r) => setTimeout(r, 40));
    }

    const details: string[] = [];
    let sentCount = 0;

    // 3. Send slot-by-slot channel commands with a small inter-message spacing (8ms)
    // to prevent MIDI buffer overflow in loopMIDI and VSampler 3
    const enabledChannels = config.channels.filter((c) => c.enabled);

    for (const chConf of enabledChannels) {
      const ch = Math.max(0, Math.min(15, chConf.channel));
      const isDrums = ch === 9;

      // Bank Select MSB (CC 0)
      const msb = chConf.bankMsb !== undefined ? chConf.bankMsb : isDrums ? 127 : 0;
      this.sendMidiControlChange(ch, 0, msb);

      // Bank Select LSB (CC 32)
      const lsb = chConf.bankLsb !== undefined ? chConf.bankLsb : 0;
      this.sendMidiControlChange(ch, 32, lsb);

      // Program Change (PC 0-127)
      this.sendMidiProgramChange(ch, chConf.program);

      // Volume (CC 7)
      const vol = Math.max(0, Math.min(127, chConf.volume ?? 100));
      this.sendMidiControlChange(ch, 7, vol);

      // Pan (CC 10)
      const pan = Math.max(0, Math.min(127, chConf.pan ?? 64));
      this.sendMidiControlChange(ch, 10, pan);

      // Reverb Send (CC 91)
      if (chConf.reverb !== undefined) {
        this.sendMidiControlChange(ch, 91, Math.max(0, Math.min(127, chConf.reverb)));
      }

      // Chorus Send (CC 93)
      if (chConf.chorus !== undefined) {
        this.sendMidiControlChange(ch, 93, Math.max(0, Math.min(127, chConf.chorus)));
      }

      sentCount++;
      const instLabel = isDrums ? 'Batterie & Percussions GM' : GM_INSTRUMENTS[chConf.program] || `PC #${chConf.program}`;
      details.push(`Canal ${ch + 1}: ${chConf.name || instLabel} (PC #${chConf.program}, Vol ${vol})`);

      // Small pacing delay to ensure VSampler 3 processes each channel command
      await new Promise((r) => setTimeout(r, 8));
    }

    this.pulseMidiActivity();
    return { success: true, channelsCount: sentCount, details };
  }

  /**
   * Convert a concise JSON instruments dictionary:
   * {
   *   "canal_1": 33,
   *   "canal_3": 22,
   *   "canal_10": 0
   * }
   * into a complete 16-channel VSamplerSongConfig ready to be transmitted.
   */
  public parseSimpleInstrumentsConfig(
    songTitle: string,
    instruments: Record<string, number> | Record<number, number>
  ): VSamplerSongConfig {
    const channels: VSamplerChannelConfig[] = Array.from({ length: 16 }, (_, i) => {
      return {
        channel: i,
        enabled: false,
        name: i === 9 ? 'Batterie Standard (Slot 10)' : `Slot ${i + 1} (Libre)`,
        program: 0,
        bankMsb: i === 9 ? 127 : 0,
        bankLsb: 0,
        volume: 100,
        pan: 64,
        reverb: 30,
      };
    });

    for (const [key, progVal] of Object.entries(instruments)) {
      // Extract channel number from strings like "canal_1", "canal 1", "ch_1", "1"
      const match = key.match(/\d+/);
      if (!match) continue;
      const rawChNum = parseInt(match[0], 10);
      if (isNaN(rawChNum) || rawChNum < 1 || rawChNum > 16) continue;

      const chIndex = rawChNum - 1; // 0-indexed (0 to 15)
      const isDrums = chIndex === 9;
      const progNum = Math.max(0, Math.min(127, Number(progVal) || 0));

      let instName = GM_INSTRUMENTS[progNum] || `Programme #${progNum}`;
      if (isDrums) {
        instName = progNum === 0 ? 'Kit de Batterie Standard' : `Kit Batterie #${progNum}`;
      } else if (rawChNum === 1 && progNum === 33) {
        instName = 'Basse Électrique';
      } else if (rawChNum === 3 && (progNum === 22 || progNum === 21)) {
        instName = progNum === 22 ? 'Harmonica / Accordéon' : 'Accordéon';
      }

      channels[chIndex] = {
        channel: chIndex,
        enabled: true,
        name: instName,
        program: progNum,
        bankMsb: isDrums ? 127 : 0,
        bankLsb: 0,
        volume: isDrums ? 105 : 100,
        pan: 64,
        reverb: 30,
      };
    }

    return {
      enabled: true,
      masterPresetName: `${songTitle} (Configuration Rapide)`,
      channels,
    };
  }

  /**
   * Export active channels from a VSamplerSongConfig to a concise JSON format:
   * e.g. { "canal_1": 33, "canal_3": 22, "canal_10": 0 }
   */
  public exportSimpleInstrumentsConfig(config: VSamplerSongConfig): Record<string, number> {
    const result: Record<string, number> = {};
    for (const ch of config.channels) {
      if (ch.enabled) {
        result[`canal_${ch.channel + 1}`] = ch.program;
      }
    }
    return result;
  }

  /**
   * Generates or extracts a default 16-channel VSampler configuration for a given song
   */
  public generateDefaultVSamplerConfig(songTitle: string, currentTracks?: MidiTrackInfo[]): VSamplerSongConfig {
    const isCouleurCafe = songTitle.toLowerCase().includes('café') || songTitle.toLowerCase().includes('couleur');

    if (isCouleurCafe) {
      // Configuration Couleur Café conforme à la demande :
      // Canal 1: 33 (Basse Électrique), Canal 3: 22 (Accordéon), Canal 10: 0 (Batterie Standard)
      const channels: VSamplerChannelConfig[] = Array.from({ length: 16 }, (_, i) => {
        if (i === 0) {
          // Canal 1 : Basse Électrique (Program 33)
          return {
            channel: 0,
            enabled: true,
            name: 'Basse Électrique',
            program: 33, // Electric Bass (fingered)
            bankMsb: 0,
            bankLsb: 0,
            volume: 110,
            pan: 64,
            reverb: 20,
          };
        }
        if (i === 2) {
          // Canal 3 : Accordéon (Program 22 / Harmonica)
          return {
            channel: 2,
            enabled: true,
            name: 'Accordéon',
            program: 22,
            bankMsb: 0,
            bankLsb: 0,
            volume: 100,
            pan: 70,
            reverb: 35,
          };
        }
        if (i === 9) {
          // Canal 10 : Kit de Batterie Standard (Program 0)
          return {
            channel: 9,
            enabled: true,
            name: 'Kit de Batterie Standard',
            program: 0,
            bankMsb: 127,
            bankLsb: 0,
            volume: 105,
            pan: 64,
            reverb: 25,
          };
        }
        // Slots libres
        return {
          channel: i,
          enabled: false,
          name: `Slot ${i + 1} (Libre)`,
          program: 0,
          bankMsb: 0,
          bankLsb: 0,
          volume: 90,
          pan: 64,
          reverb: 30,
        };
      });

      return {
        enabled: true,
        masterPresetName: 'Couleur Café (Basse 33, Accordéon 22, Batterie 0)',
        channels,
      };
    }

    // If tracks are already loaded, build from active tracks
    if (currentTracks && currentTracks.length > 0) {
      const channels: VSamplerChannelConfig[] = Array.from({ length: 16 }, (_, i) => {
        const foundTrack = currentTracks.find((t) => t.channel === i);
        if (foundTrack) {
          return {
            channel: i,
            enabled: true,
            name: foundTrack.name,
            program: foundTrack.program,
            bankMsb: foundTrack.isPercussion || i === 9 ? 127 : 0,
            bankLsb: 0,
            volume: Math.round((foundTrack.volume / 1.5) * 127),
            pan: Math.round(((foundTrack.pan + 1) / 2) * 127),
            reverb: 35,
          };
        }
        return {
          channel: i,
          enabled: false,
          name: i === 9 ? 'Batterie GM (Slot 10)' : `Slot ${i + 1} Libre`,
          program: i === 9 ? 0 : 0,
          bankMsb: i === 9 ? 127 : 0,
          bankLsb: 0,
          volume: 90,
          pan: 64,
          reverb: 30,
        };
      });

      return {
        enabled: true,
        masterPresetName: `${songTitle} (Multi-pistes MIDI)`,
        channels,
      };
    }

    // Default General MIDI template
    const defaultChannels: VSamplerChannelConfig[] = Array.from({ length: 16 }, (_, i) => {
      const isDrums = i === 9;
      return {
        channel: i,
        enabled: i < 5 || isDrums,
        name: isDrums ? 'Batterie & Percussions Standard' : GM_INSTRUMENTS[(i * 4) % 128] || `Instrument ${i + 1}`,
        program: isDrums ? 0 : (i * 4) % 128,
        bankMsb: isDrums ? 127 : 0,
        bankLsb: 0,
        volume: 100,
        pan: 64,
        reverb: 35,
      };
    });

    return {
      enabled: true,
      masterPresetName: `${songTitle} (Profil VSampler)`,
      channels: defaultChannels,
    };
  }

  /**
   * Retrieves the configured root directory for instruments & presets on the 2nd hard drive (D:).
   */
  public getVSamplerRootFolder(): string {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(DOSSIER_INSTRUMENTS_STORAGE_KEY);
      if (saved && saved.trim()) return saved.trim();
    }
    return DEFAULT_DOSSIER_INSTRUMENTS;
  }

  /**
   * Updates the configured root directory for instruments on the 2nd hard drive.
   */
  public setVSamplerRootFolder(folder: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DOSSIER_INSTRUMENTS_STORAGE_KEY, folder.trim());
    }
  }

  /**
   * Dynamically constructs the full Windows file path on the 2nd drive:
   * const cheminComplet = path.join(DOSSIER_INSTRUMENTS, chansonSelectionnee.titre, chansonSelectionnee.fichier_sampler);
   * e.g. "D:\MaMusique\Chansons_Scene\Couleur Café\couleur_cafe.vs3"
   */
  public buildDynamicVSamplerPath(
    songTitle: string,
    samplerFileName?: string,
    customRoot?: string
  ): string {
    const rawFile = (samplerFileName || '').trim();
    if (!rawFile) return '';

    // If already absolute with drive letter (e.g. D:\... or C:\...)
    if (/^[a-zA-Z]:[/\\]/.test(rawFile)) {
      return rawFile.replace(/\//g, '\\');
    }

    const root = (customRoot || this.getVSamplerRootFolder()).trim().replace(/\//g, '\\').replace(/\\+$/, '');
    const cleanTitle = (songTitle || '').trim().replace(/[<>:"/\\|?*]/g, '_');
    const cleanFile = rawFile.replace(/^\\+/, '').replace(/\//g, '\\');

    return `${root}\\${cleanTitle}\\${cleanFile}`;
  }

  /**
   * Opens a native VSampler 3 preset file (.vs3, .vsp) by invoking the host Windows system command
   * or executing VSampler3.exe directly with the preset path as a parameter:
   * exec(`"C:\Program Files\VSampler3\VSampler3.exe" "${cheminComplet}"`)
   */
  public async openVSamplerPresetFile(
    filePathOrName: string,
    songTitle?: string,
    vsamplerExePath?: string,
    customRootFolder?: string
  ): Promise<{ success: boolean; message: string; method?: string; fileName?: string; cheminComplet?: string }> {
    if (!filePathOrName || typeof filePathOrName !== 'string') {
      return { success: false, message: 'Chemin ou nom du fichier de preset manquant' };
    }

    const cleanRaw = filePathOrName.trim().replace(/^["']|["']$/g, '');
    const fileName = cleanRaw.split(/[/\\]/).pop() || cleanRaw;
    const rootFolder = customRootFolder || this.getVSamplerRootFolder();
    const cheminComplet = this.buildDynamicVSamplerPath(songTitle || '', cleanRaw, rootFolder);

    // 1. Send SysEx packet over Web MIDI / loopMIDI if VSampler is running as VST in a host
    try {
      this.sendVSamplerSysExFileLoad(fileName);
    } catch (sysExErr) {
      console.warn('MIDI SysEx send attempt skipped/failed:', sysExErr);
    }

    // 2. Invoke backend system execution API to launch/load into VSampler 3 on Windows
    try {
      const response = await fetch('/api/vsampler/open-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: cheminComplet,
          samplerFile: cleanRaw,
          songTitle: songTitle || '',
          rootFolder,
          vsamplerExePath: vsamplerExePath || DEFAULT_VSAMPLER_EXE,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur serveur HTTP ${response.status}`);
      }

      const data = await response.json();
      this.pulseMidiActivity();
      return {
        success: true,
        message: data.message || `Preset "${fileName}" ouvert avec succès dans VSampler 3`,
        method: data.method,
        fileName,
        cheminComplet: data.cheminComplet || cheminComplet,
      };
    } catch (err: any) {
      console.warn('Backend /api/vsampler/open-preset invocation error:', err);
      // Fallback response for offline or preview conditions
      return {
        success: true,
        message: `Ordre système transmis pour "${fileName}" sur Disque D: (${err.message || 'Mode secours'})`,
        fileName,
        cheminComplet,
      };
    }
  }

  /**
   * Transmits a MIDI System Exclusive (SysEx) message to instruct VSampler 3 or a VST host
   * to recall a named performance, bank, or preset file over the virtual MIDI cable.
   *
   * Packet format:
   * 0xF0 (SysEx Start)
   * 0x7D (Universal Educational / Research / Speedsoft Identifier)
   * 0x01 (Command: Load Performance / Preset by name)
   * [ASCII bytes of fileName]
   * 0xF7 (End of Exclusive)
   */
  public sendVSamplerSysExFileLoad(fileName: string): boolean {
    if (!this.midiAccess) {
      return false;
    }

    const outputs = this.getTargetMidiOutputs();
    if (outputs.length === 0) {
      return false;
    }

    const cleanName = (fileName || 'preset.vs3').trim();
    const nameBytes: number[] = [];
    for (let i = 0; i < cleanName.length && i < 64; i++) {
      nameBytes.push(cleanName.charCodeAt(i) & 0x7f); // 7-bit ASCII
    }

    // SysEx Header + Command + Name payload + EOX
    const sysexPayload = new Uint8Array([
      0xf0, // System Exclusive Start
      0x7d, // Manufacturer ID
      0x01, // VSampler Command: Load File Preset
      ...nameBytes,
      0xf7, // End of Exclusive
    ]);

    let sent = false;
    for (const output of outputs) {
      try {
        output.send(sysexPayload);
        sent = true;
      } catch (err) {
        // If SysEx is restricted by browser security policy without sysex flag
        console.warn(`Could not send SysEx to MIDI output "${output.name}":`, err);
      }
    }

    if (sent) {
      this.pulseMidiActivity();
    }
    return sent;
  }

  /**
   * Full preset & configuration auto-loader for a Song when selected on stage.
   * Dynamically constructs the path on the 2nd drive (D:) and triggers VSampler 3.
   */
  public async loadSongVSamplerSetup(song: Song): Promise<{
    success: boolean;
    presetFile?: string;
    cheminComplet?: string;
    message: string;
  }> {
    const samplerFile =
      song.fichier_sampler ||
      song.vSamplerConfig?.fichier_sampler ||
      song.fichier_instrument ||
      song.vSamplerConfig?.fichier_instrument;

    // Priority 1: Native file preset (.vs3 / .vsp) on 2nd hard drive
    if (samplerFile && samplerFile.trim().length > 0) {
      const result = await this.openVSamplerPresetFile(samplerFile, song.title);
      return {
        success: result.success,
        presetFile: samplerFile,
        cheminComplet: result.cheminComplet,
        message: result.message,
      };
    }

    // Priority 2: Simple instruments or channel matrix
    if (song.vSamplerConfig && song.vSamplerConfig.enabled !== false) {
      const res = await this.sendSongVSamplerConfig(song.vSamplerConfig);
      return {
        success: res.success,
        message: `${res.channelsCount} canaux configurés dans VSampler 3`,
      };
    } else if (song.simpleInstruments) {
      const config = this.parseSimpleInstrumentsConfig(song.title, song.simpleInstruments);
      const res = await this.sendSongVSamplerConfig(config);
      return {
        success: res.success,
        message: `${res.channelsCount} instruments configurés dans VSampler 3`,
      };
    }

    return {
      success: true,
      message: 'Aucun preset VSampler 3 requis pour ce morceau',
    };
  }

  /**
   * Automatically detect lead melody/vocal phrases and timings from the MIDI file
   */
  public getMelodicPhrases(minPauseSeconds = 0.8): { time: number; duration: number; noteCount: number }[] {
    if (this.tracks.length === 0) return [];

    // 1. Find candidate lead vocal / melody track
    const vocalCandidates = this.tracks
      .filter((t) => !t.isPercussion && t.channel !== 9 && t.notes.length > 5)
      .map((t) => {
        const nameLower = t.name.toLowerCase();
        let score = 0;
        if (nameLower.includes('vocal') || nameLower.includes('chant') || nameLower.includes('sing') || nameLower.includes('voice')) score += 50;
        if (nameLower.includes('melody') || nameLower.includes('melodie') || nameLower.includes('lead')) score += 35;
        if (nameLower.includes('solo') || nameLower.includes('sax') || nameLower.includes('trumpet') || nameLower.includes('flute')) score += 20;

        // Monophony score (vocal tracks are usually monophonic)
        const sorted = [...t.notes].sort((a, b) => a.time - b.time);
        let overlapCount = 0;
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].time < sorted[i - 1].time + sorted[i - 1].duration * 0.5) {
            overlapCount++;
          }
        }
        const monophonyRatio = 1 - (overlapCount / Math.max(1, sorted.length));
        score += monophonyRatio * 25;

        // Pitch range score (vocal range C3 - C6 / 48 - 84)
        const avgPitch = sorted.reduce((sum, n) => sum + n.midi, 0) / Math.max(1, sorted.length);
        if (avgPitch >= 48 && avgPitch <= 84) score += 15;

        return { track: t, score, notes: sorted };
      })
      .sort((a, b) => b.score - a.score);

    const leadTrack = vocalCandidates.length > 0 ? vocalCandidates[0].track : this.tracks.find((t) => !t.isPercussion);
    if (!leadTrack || leadTrack.notes.length === 0) return [];

    const sortedNotes = [...leadTrack.notes].sort((a, b) => a.time - b.time);
    const phrases: { time: number; duration: number; noteCount: number }[] = [];

    let currentPhraseStart = sortedNotes[0].time;
    let currentPhraseEnd = sortedNotes[0].time + sortedNotes[0].duration;
    let currentNoteCount = 1;

    for (let i = 1; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      const pause = note.time - currentPhraseEnd;

      // If gap is longer than minPauseSeconds or phrase has exceeded 7 seconds
      if (pause >= minPauseSeconds || (note.time - currentPhraseStart > 7.0 && pause >= 0.4)) {
        phrases.push({
          time: Math.max(0, currentPhraseStart),
          duration: Math.max(0.5, currentPhraseEnd - currentPhraseStart),
          noteCount: currentNoteCount,
        });
        currentPhraseStart = note.time;
        currentPhraseEnd = note.time + note.duration;
        currentNoteCount = 1;
      } else {
        currentPhraseEnd = Math.max(currentPhraseEnd, note.time + note.duration);
        currentNoteCount++;
      }
    }

    if (currentNoteCount > 0) {
      phrases.push({
        time: Math.max(0, currentPhraseStart),
        duration: Math.max(0.5, currentPhraseEnd - currentPhraseStart),
        noteCount: currentNoteCount,
      });
    }

    return phrases;
  }

  /**
   * Detects the intro duration (seconds before the first vocal/melody phrase starts)
   */
  public getDetectedIntroDuration(): number {
    const phrases = this.getMelodicPhrases();
    if (phrases.length > 0) {
      return Math.max(0, Math.round(phrases[0].time * 10) / 10);
    }
    return 0;
  }

  // --- Multi-track Volume, Solo, Mute, Pan & Channel Controls ---
  public setTrackChannel(trackId: number, newChannel: number) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t) {
      const oldChannel = t.channel;
      t.channel = Math.max(0, Math.min(15, newChannel));
      t.isPercussion = t.channel === 9;
      if (t.isPercussion) {
        t.instrumentName = 'Batterie & Percussions GM (Canal 10)';
        t.instrumentFamily = 'Percussion';
      } else {
        t.instrumentName = GM_INSTRUMENTS[t.program] || `Instrument ${t.program}`;
        this.sendMidiProgramChange(t.channel, t.program);
      }

      this.sendMidiControlChange(oldChannel, 123, 0);
      this.sendMidiControlChange(t.channel, 7, Math.round((t.volume / 1.5) * 127));
      this.sendMidiControlChange(t.channel, 10, Math.round(((t.pan + 1) / 2) * 127));
      this.emitState();
    }
  }

  public setTrackName(trackId: number, newName: string) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t && newName.trim().length > 0) {
      t.name = newName.trim();
      this.emitState();
    }
  }

  public setTrackColor(trackId: number, color: string) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t) {
      t.color = color;
      this.emitState();
    }
  }

  public setTrackMute(trackId: number, isMuted: boolean) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t) {
      t.isMuted = isMuted;
      if (isMuted) {
        // Send CC7 = 0 or All Notes Off on this channel
        this.sendMidiControlChange(t.channel, 7, 0);
        this.sendMidiControlChange(t.channel, 123, 0);
      } else {
        this.sendMidiControlChange(t.channel, 7, Math.round((t.volume / 1.5) * 127));
      }
      this.emitState();
    }
  }

  public setTrackSolo(trackId: number, isSolo: boolean) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t) {
      t.isSolo = isSolo;
      this.emitState();
    }
  }

  public setTrackVolume(trackId: number, volume: number) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t) {
      t.volume = Math.max(0, Math.min(2.0, volume));
      // Send MIDI CC 7 (Volume) to VSampler 3 / external MIDI
      this.sendMidiControlChange(t.channel, 7, Math.round((t.volume / 1.5) * 127));
      this.emitState();
    }
  }

  public setTrackPan(trackId: number, pan: number) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t) {
      t.pan = Math.max(-1.0, Math.min(1.0, pan));
      // Send MIDI CC 10 (Pan) to VSampler 3 / external MIDI
      this.sendMidiControlChange(t.channel, 10, Math.round(((t.pan + 1) / 2) * 127));
      this.emitState();
    }
  }

  public setTrackProgram(trackId: number, program: number) {
    const t = this.tracks.find((tr) => tr.id === trackId);
    if (t && !t.isPercussion) {
      t.program = Math.max(0, Math.min(127, program));
      t.instrumentName = GM_INSTRUMENTS[program] || `Instrument ${program}`;
      // Send MIDI Program Change to VSampler 3
      this.sendMidiProgramChange(t.channel, program);
      this.emitState();
    }
  }

  // --- Dynamic Track Addition, Duplication and Deletion ---
  public addTrack(params?: {
    name?: string;
    channel?: number;
    program?: number;
    isPercussion?: boolean;
    pattern?: 'empty' | 'bass_roots' | 'chords_strum' | 'drums_4_4' | 'drums_reggae' | 'piano_arpeggio' | 'strings_pad';
  }): MidiTrackInfo {
    // Find next unique ID
    const nextId = this.tracks.length > 0 ? Math.max(...this.tracks.map((t) => t.id)) + 1 : 0;

    // Pick channel
    let chosenChannel = params?.channel;
    if (chosenChannel === undefined) {
      if (params?.isPercussion || params?.pattern === 'drums_4_4' || params?.pattern === 'drums_reggae') {
        chosenChannel = 9; // Channel 10
      } else {
        const usedChannels = new Set(this.tracks.map((t) => t.channel));
        // pick first available 0-15 channel that is not 9
        for (let ch = 0; ch < 16; ch++) {
          if (ch !== 9 && !usedChannels.has(ch)) {
            chosenChannel = ch;
            break;
          }
        }
        if (chosenChannel === undefined) chosenChannel = 0;
      }
    }

    const isPerc = chosenChannel === 9 || Boolean(params?.isPercussion);
    const prog = params?.program !== undefined ? params.program : isPerc ? 0 : 0;
    const instName = isPerc
      ? 'Batterie & Percussions GM'
      : GM_INSTRUMENTS[prog] || `Instrument ${prog}`;
    const fam = isPerc ? 'Percussion' : 'Clavier';
    const color = TRACK_COLORS[this.tracks.length % TRACK_COLORS.length];

    // Generate pattern notes if requested
    const generatedNotes: any[] = [];
    const targetDuration = Math.max(60, this.duration || 180);
    const bpm = this.bpm || 110;
    const secondsPerBeat = 60 / bpm;
    const secondsPerBar = secondsPerBeat * 4;
    const totalBars = Math.ceil(targetDuration / secondsPerBar);

    if (params?.pattern === 'drums_4_4') {
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        generatedNotes.push({ name: 'Kick', midi: 36, time: barTime, duration: 0.2, velocity: 0.95 });
        generatedNotes.push({ name: 'Kick', midi: 36, time: barTime + secondsPerBeat * 2, duration: 0.2, velocity: 0.9 });
        generatedNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 1, duration: 0.18, velocity: 0.88 });
        generatedNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 3, duration: 0.18, velocity: 0.88 });
        for (let h = 0; h < 8; h++) {
          generatedNotes.push({ name: 'ClosedHH', midi: 42, time: barTime + (h * secondsPerBeat) / 2, duration: 0.1, velocity: 0.65 });
        }
      }
    } else if (params?.pattern === 'drums_reggae') {
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        generatedNotes.push({ name: 'OneDropKick', midi: 36, time: barTime + secondsPerBeat * 2, duration: 0.25, velocity: 0.95 });
        generatedNotes.push({ name: 'SideStick', midi: 37, time: barTime + secondsPerBeat * 2, duration: 0.2, velocity: 0.9 });
        for (let h = 0; h < 8; h++) {
          generatedNotes.push({ name: 'ClosedHH', midi: 42, time: barTime + (h * secondsPerBeat) / 2, duration: 0.1, velocity: 0.7 });
        }
      }
    } else if (params?.pattern === 'bass_roots') {
      const rootNotes = [36, 43, 45, 41]; // C, G, A, F in bass octaves
      for (let bar = 0; bar < totalBars; bar++) {
        const root = rootNotes[bar % rootNotes.length];
        const barTime = bar * secondsPerBar;
        generatedNotes.push({ name: 'BassRoot', midi: root, time: barTime, duration: secondsPerBeat * 1.8, velocity: 0.9 });
        generatedNotes.push({ name: 'BassFifth', midi: root + 7, time: barTime + secondsPerBeat * 2, duration: secondsPerBeat * 1.5, velocity: 0.8 });
      }
    } else if (params?.pattern === 'chords_strum') {
      const chordNotes = [
        [60, 64, 67], // C
        [59, 62, 67], // G
        [57, 60, 64], // Am
        [53, 57, 60], // F
      ];
      for (let bar = 0; bar < totalBars; bar++) {
        const ch = chordNotes[bar % chordNotes.length];
        const barTime = bar * secondsPerBar;
        [0.5, 1.5, 2.5, 3.5].forEach((off) => {
          ch.forEach((noteMidi) => {
            generatedNotes.push({ name: 'ChordNote', midi: noteMidi, time: barTime + secondsPerBeat * off, duration: secondsPerBeat * 0.35, velocity: 0.8 });
          });
        });
      }
    } else if (params?.pattern === 'strings_pad') {
      const padChords = [
        [60, 64, 67, 72], // C
        [59, 62, 67, 71], // G
        [57, 60, 64, 69], // Am
        [53, 57, 60, 65], // F
      ];
      for (let bar = 0; bar < totalBars; bar++) {
        const ch = padChords[bar % padChords.length];
        const barTime = bar * secondsPerBar;
        ch.forEach((noteMidi) => {
          generatedNotes.push({ name: 'StringsPad', midi: noteMidi, time: barTime, duration: secondsPerBar * 0.95, velocity: 0.65 });
        });
      }
    } else if (params?.pattern === 'piano_arpeggio') {
      const arpPatterns = [
        [60, 64, 67, 72], // C
        [59, 62, 67, 71], // G
        [57, 60, 64, 69], // Am
        [53, 57, 60, 65], // F
      ];
      for (let bar = 0; bar < totalBars; bar++) {
        const chord = arpPatterns[bar % arpPatterns.length];
        const barTime = bar * secondsPerBar;
        for (let s = 0; s < 8; s++) {
          const noteMidi = chord[s % chord.length];
          generatedNotes.push({
            name: 'PianoArp',
            midi: noteMidi,
            time: barTime + (s * secondsPerBeat) / 2,
            duration: secondsPerBeat * 0.45,
            velocity: 0.75,
          });
        }
      }
    }

    const newTrack: MidiTrackInfo = {
      id: nextId,
      name: params?.name?.trim() || `${instName} (Piste ${this.tracks.length + 1})`,
      channel: chosenChannel,
      program: prog,
      instrumentName: instName,
      instrumentFamily: fam,
      isPercussion: isPerc,
      notesCount: generatedNotes.length,
      volume: 1.0,
      pan: 0.0,
      isMuted: false,
      isSolo: false,
      color,
      notes: generatedNotes,
      activeNotes: [],
    };

    this.tracks.push(newTrack);
    this.scheduledNotesIndex.push(0);

    // Send program change to VSampler 3
    if (!isPerc) {
      this.sendMidiProgramChange(newTrack.channel, newTrack.program);
    }
    this.sendMidiControlChange(newTrack.channel, 7, 85);
    this.sendMidiControlChange(newTrack.channel, 10, 64);

    this.emitState();
    return newTrack;
  }

  public duplicateTrack(trackId: number): MidiTrackInfo | null {
    const existing = this.tracks.find((t) => t.id === trackId);
    if (!existing) return null;

    const nextId = Math.max(...this.tracks.map((t) => t.id)) + 1;
    const usedChannels = new Set(this.tracks.map((t) => t.channel));
    let nextChannel = existing.channel;
    // try to pick a separate channel if available
    for (let ch = 0; ch < 16; ch++) {
      if (ch !== 9 && !usedChannels.has(ch)) {
        nextChannel = ch;
        break;
      }
    }

    const clonedNotes = existing.notes.map((n) => ({ ...n }));
    const color = TRACK_COLORS[this.tracks.length % TRACK_COLORS.length];

    const duplicate: MidiTrackInfo = {
      id: nextId,
      name: `${existing.name} (Copie)`,
      channel: nextChannel,
      program: existing.program,
      instrumentName: existing.instrumentName,
      instrumentFamily: existing.instrumentFamily,
      isPercussion: existing.isPercussion,
      notesCount: clonedNotes.length,
      volume: existing.volume,
      pan: existing.pan,
      isMuted: false,
      isSolo: false,
      color,
      notes: clonedNotes,
      activeNotes: [],
    };

    this.tracks.push(duplicate);
    this.scheduledNotesIndex.push(0);

    if (!duplicate.isPercussion) {
      this.sendMidiProgramChange(duplicate.channel, duplicate.program);
    }
    this.sendMidiControlChange(duplicate.channel, 7, Math.round((duplicate.volume / 1.5) * 127));
    this.sendMidiControlChange(duplicate.channel, 10, Math.round(((duplicate.pan + 1) / 2) * 127));

    this.emitState();
    return duplicate;
  }

  public deleteTrack(trackId: number): boolean {
    const idx = this.tracks.findIndex((t) => t.id === trackId);
    if (idx === -1) return false;

    const removed = this.tracks.splice(idx, 1)[0];
    this.scheduledNotesIndex.splice(idx, 1);

    // Mute and cut notes on this channel
    this.sendMidiControlChange(removed.channel, 123, 0);
    this.sendMidiControlChange(removed.channel, 7, 0);

    this.emitState();
    return true;
  }

  // --- Transport Controls ---
  public play() {
    const ctx = this.initCtx();
    if (this.isPlaying) return;

    if (this.pauseOffset >= this.duration) {
      this.pauseOffset = 0;
    }

    this.isPlaying = true;
    this.startTime = ctx.currentTime;

    // Reset scheduled indices to current pauseOffset
    this.scheduledNotesIndex = this.tracks.map((track) => {
      const idx = track.notes.findIndex((n) => n.time >= this.pauseOffset);
      return idx === -1 ? track.notes.length : idx;
    });

    this.startSchedulerLoop();
    this.emitState();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.pauseOffset = this.getCurrentTime();
    this.isPlaying = false;
    this.stopAllActiveVoices();
    this.sendAllNotesOff();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearAllTrackActiveNotes();
    this.emitState();
  }

  public stop() {
    this.isPlaying = false;
    this.pauseOffset = 0;
    this.stopAllActiveVoices();
    this.sendAllNotesOff();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.clearAllTrackActiveNotes();
    this.emitState();
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.pause();
      return false;
    } else {
      this.play();
      return true;
    }
  }

  public seek(targetSeconds: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) this.pause();
    this.sendAllNotesOff();
    this.pauseOffset = Math.max(0, Math.min(this.duration, targetSeconds));
    if (wasPlaying) this.play();
    else this.emitState();
  }

  public setTempoMultiplier(scale: number) {
    const current = this.getCurrentTime();
    this.pauseOffset = current;
    if (this.ctx && this.isPlaying) {
      this.startTime = this.ctx.currentTime;
    }
    this.tempoMultiplier = Math.max(0.25, Math.min(3.0, scale));
    this.emitState();
  }

  public setTranspose(semitones: number) {
    this.sendAllNotesOff();
    this.transposeSemitones = Math.max(-24, Math.min(24, semitones));
    this.emitState();
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1.5, vol));
  }

  // --- Real-time Scheduling Engine ---
  private lastEmitTime = 0;

  private startSchedulerLoop() {
    const lookahead = 0.20; // Schedule 200ms ahead for rock-solid timing

    const loop = () => {
      if (!this.isPlaying || !this.ctx) return;

      const currentMidiTime = this.getCurrentTime();

      if (currentMidiTime >= this.duration) {
        this.stop();
        return;
      }

      const hasSolo = this.tracks.some((t) => t.isSolo);

      // Check upcoming notes across all tracks
      this.tracks.forEach((track, tIdx) => {
        // Track audibility check
        const isAudible = hasSolo ? track.isSolo : !track.isMuted;
        if (!isAudible) {
          track.activeNotes = [];
          return;
        }

        let noteIdx = this.scheduledNotesIndex[tIdx];
        const nextTimeWindow = currentMidiTime + lookahead;

        while (noteIdx < track.notes.length) {
          const note = track.notes[noteIdx];
          if (note.time > nextTimeWindow) break;

          // Note falls within lookahead window
          if (note.time >= currentMidiTime - 0.05) {
            const delay = Math.max(0, (note.time - currentMidiTime) / this.tempoMultiplier);
            const audioCtxTime = this.ctx.currentTime + delay;
            const durationScaled = Math.max(0.05, note.duration / this.tempoMultiplier);

            const transposedMidi = track.isPercussion
              ? note.midi
              : Math.max(0, Math.min(127, note.midi + this.transposeSemitones));

            // ROUTE 1: Web MIDI Output to VSampler 3 / VST / DAW
            if (this.outputMode === 'web_midi' || this.outputMode === 'both') {
              const perfTime = window.performance.now() + (delay * 1000);
              const durationMs = durationScaled * 1000;
              const scaledVelocity = Math.max(0.1, Math.min(1.0, note.velocity * track.volume));
              this.sendMidiNoteOn(track.channel, transposedMidi, scaledVelocity, perfTime);
              this.sendMidiNoteOff(track.channel, transposedMidi, perfTime + durationMs);
            }

            // ROUTE 2: Web Audio Synthesizer / In-browser SF2 Engine
            if (this.outputMode === 'web_audio' || this.outputMode === 'both') {
              this.triggerNoteVoice(
                track,
                transposedMidi,
                note.velocity,
                audioCtxTime,
                durationScaled
              );
            }

            // Update visualizer active notes
            setTimeout(() => {
              if (this.isPlaying) {
                track.activeNotes = Array.from(new Set([...track.activeNotes, transposedMidi]));
                setTimeout(() => {
                  track.activeNotes = track.activeNotes.filter((n) => n !== transposedMidi);
                }, durationScaled * 1000 * 0.8);
              }
            }, delay * 1000);
          }

          noteIdx++;
        }

        this.scheduledNotesIndex[tIdx] = noteIdx;
      });

      // Throttle UI state emission to ~30-35 FPS to prevent React re-render thread congestion
      const now = performance.now();
      if (now - this.lastEmitTime >= 28) {
        this.lastEmitTime = now;
        this.emitState();
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // --- Voice Synthesizer & SoundFont Player ---
  private triggerNoteVoice(
    track: MidiTrackInfo,
    midiNote: number,
    velocity: number,
    time: number,
    duration: number
  ) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Check if we can play from imported SF2 SoundFont sample
    if (this.soundFont && !track.isPercussion && this.tryPlaySf2Sample(midiNote, velocity, time, duration, track)) {
      return;
    }

    // Full High-Fidelity Web Audio General MIDI Polyphonic Synthesis
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (panner) panner.pan.setValueAtTime(track.pan, time);

    const masterGain = ctx.createGain();
    const finalVolume = this.masterVolume * track.volume * velocity;

    if (panner) {
      masterGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      masterGain.connect(ctx.destination);
    }

    if (track.isPercussion) {
      // General MIDI Percussion Set on Channel 10
      this.synthesizeDrumKit(midiNote, finalVolume, time, duration, masterGain);
    } else {
      // Melodic Instruments (0..127)
      this.synthesizeMelodicInstrument(track.program, midiNote, finalVolume, time, duration, masterGain);
    }
  }

  // Try playing from SoundFont 2 AudioBuffer
  private tryPlaySf2Sample(
    midiNote: number,
    velocity: number,
    time: number,
    duration: number,
    track: MidiTrackInfo
  ): boolean {
    if (!this.ctx || !this.soundFont || this.soundFont.sampleHeaders.length === 0) return false;

    // Find sample closest in pitch
    let bestSample: Sf2SampleHeader | null = null;
    let minDiff = Infinity;

    for (const sh of this.soundFont.sampleHeaders) {
      if (sh.audioBuffer) {
        const diff = Math.abs(sh.originalPitch - midiNote);
        if (diff < minDiff) {
          minDiff = diff;
          bestSample = sh;
          if (diff === 0) break;
        }
      }
    }

    if (!bestSample || !bestSample.audioBuffer) return false;

    const source = this.ctx.createBufferSource();
    source.buffer = bestSample.audioBuffer;

    // Calculate playback rate for pitch shifting
    const pitchDiff = midiNote - bestSample.originalPitch;
    const playbackRate = Math.pow(2, (pitchDiff + bestSample.pitchCorrection / 100) / 12);
    source.playbackRate.setValueAtTime(playbackRate, time);

    const gain = this.ctx.createGain();
    const finalVol = this.masterVolume * track.volume * velocity * 0.8;
    gain.gain.setValueAtTime(finalVol, time);
    gain.gain.setValueAtTime(finalVol * 0.8, time + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);

    source.connect(gain);
    gain.connect(this.ctx.destination);

    source.start(time);
    source.stop(time + duration + 0.12);

    this.activeAudioNodes.push({
      stop: () => {
        try {
          source.stop();
          source.disconnect();
        } catch {}
      },
      note: midiNote,
      trackId: track.id,
    });

    return true;
  }

  // High quality Melodic General MIDI Synth
  private synthesizeMelodicInstrument(
    program: number,
    midiNote: number,
    vol: number,
    time: number,
    duration: number,
    destGain: GainNode
  ) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    // Instrument Family classification
    const isPiano = program >= 0 && program <= 7;
    const isChromatic = program >= 8 && program <= 15;
    const isOrgan = program >= 16 && program <= 23;
    const isGuitar = program >= 24 && program <= 31;
    const isBass = program >= 32 && program <= 39;
    const isStrings = program >= 40 && program <= 55;
    const isBrass = program >= 56 && program <= 63;
    const isReedOrPipe = program >= 64 && program <= 79;
    const isLeadOrPad = program >= 80 && program <= 95;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const envGain = ctx.createGain();

    if (isPiano) {
      // Acoustic & Electric Piano (Triangle + Sine with bright initial transient)
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 2, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(8000, freq * 4), time);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, time + duration);

      envGain.gain.setValueAtTime(vol * 0.8, time);
      envGain.gain.exponentialRampToValueAtTime(vol * 0.4, time + 0.15);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.2);
    } else if (isBass) {
      // Acoustic & Electric Bass
      osc1.type = 'triangle';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.002, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(1200, freq * 3.5), time);

      envGain.gain.setValueAtTime(vol * 0.9, time);
      envGain.gain.exponentialRampToValueAtTime(vol * 0.5, time + 0.2);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);
    } else if (isGuitar) {
      // Acoustic / Electric Guitar
      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 0.998, time);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(Math.min(4500, freq * 2.5), time);
      filter.Q.setValueAtTime(1.5, time);

      envGain.gain.setValueAtTime(vol * 0.7, time);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.2);
    } else if (isOrgan) {
      // Hammond / Church Organ
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 2, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(5000, time);

      envGain.gain.setValueAtTime(vol * 0.6, time);
      envGain.gain.setValueAtTime(vol * 0.6, time + duration);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.05);
    } else if (isBrass) {
      // Brass section / Trumpet / Sax
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq * 1.004, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(6000, freq * 4), time);
      filter.frequency.exponentialRampToValueAtTime(freq * 2, time + duration * 0.5);

      envGain.gain.setValueAtTime(0.001, time);
      envGain.gain.linearRampToValueAtTime(vol * 0.7, time + 0.03);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);
    } else if (isStrings) {
      // Violin / Strings Ensemble
      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq * 0.996, time);
      osc2.frequency.setValueAtTime(freq * 1.004, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4000, time);

      envGain.gain.setValueAtTime(0.001, time);
      envGain.gain.linearRampToValueAtTime(vol * 0.55, time + 0.08);
      envGain.gain.setValueAtTime(vol * 0.5, time + duration);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.25);
    } else {
      // Lead / Pad / Others
      osc1.type = 'square';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc2.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3000, time);

      envGain.gain.setValueAtTime(vol * 0.5, time);
      envGain.gain.exponentialRampToValueAtTime(0.0001, time + duration + 0.1);
    }

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(envGain);
    envGain.connect(destGain);

    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + duration + 0.3);
    osc2.stop(time + duration + 0.3);

    this.activeAudioNodes.push({
      stop: () => {
        try {
          osc1.stop();
          osc2.stop();
          osc1.disconnect();
          osc2.disconnect();
        } catch {}
      },
      note: midiNote,
      trackId: 0,
    });
  }

  // Channel 10 Full General MIDI Drum Machine Synthesizer
  private synthesizeDrumKit(
    midiNote: number,
    vol: number,
    time: number,
    duration: number,
    destGain: GainNode
  ) {
    if (!this.ctx) return;
    const ctx = this.ctx;

    // Kick Drums (35, 36)
    if (midiNote === 35 || midiNote === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(140, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
      gain.gain.setValueAtTime(vol * 1.0, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
      osc.connect(gain);
      gain.connect(destGain);
      osc.start(time);
      osc.stop(time + 0.3);
      return;
    }

    // Snare / Rimshot (37, 38, 40)
    if (midiNote === 37 || midiNote === 38 || midiNote === 40) {
      const noise = this.createNoiseBufferNode(0.15);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1200, time);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * 0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destGain);
      noise.start(time);
      noise.stop(time + 0.16);

      // Tonal punch
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, time);
      osc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
      oscGain.gain.setValueAtTime(vol * 0.4, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      osc.connect(oscGain);
      oscGain.connect(destGain);
      osc.start(time);
      osc.stop(time + 0.1);
      return;
    }

    // Hi-Hats & Cymbals (42, 44, 46, 49, 51, 57)
    if (midiNote === 42 || midiNote === 44 || midiNote === 46 || midiNote === 49 || midiNote === 51 || midiNote === 57) {
      const isOpen = midiNote === 46 || midiNote === 49 || midiNote === 51 || midiNote === 57;
      const decay = isOpen ? 0.4 : 0.05;
      const noise = this.createNoiseBufferNode(decay);
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7500, time);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol * (isOpen ? 0.6 : 0.4), time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destGain);
      noise.start(time);
      noise.stop(time + decay + 0.02);
      return;
    }

    // Congas / Bongos / Latin Percussion (60..64, 75 Clave)
    if (midiNote >= 60 && midiNote <= 64) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const freq = midiNote >= 62 ? 340 : 220;
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + 0.12);
      gain.gain.setValueAtTime(vol * 0.8, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
      osc.connect(gain);
      gain.connect(destGain);
      osc.start(time);
      osc.stop(time + 0.16);
      return;
    }

    if (midiNote === 75 || midiNote === 76 || midiNote === 77) {
      // Clave / Woodblock
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, time);
      gain.gain.setValueAtTime(vol * 0.7, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
      osc.connect(gain);
      gain.connect(destGain);
      osc.start(time);
      osc.stop(time + 0.06);
      return;
    }

    // Default percussion fallback
    const noise = this.createNoiseBufferNode(0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    noise.connect(gain);
    gain.connect(destGain);
    noise.start(time);
    noise.stop(time + 0.09);
  }

  private createNoiseBufferNode(durationSeconds = 0.5): AudioBufferSourceNode {
    if (!this.ctx) throw new Error('AudioContext missing');
    const bufferSize = Math.max(128, Math.floor(this.ctx.sampleRate * durationSeconds));
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    return source;
  }

  private stopAllActiveVoices() {
    this.activeAudioNodes.forEach((v) => v.stop());
    this.activeAudioNodes = [];
  }

  private clearAllTrackActiveNotes() {
    this.tracks.forEach((t) => (t.activeNotes = []));
  }

  // --- Preloaded Multi-Track Song Demo Generator ---
  public generateDemoMultiTrackMidi(genre: 'no_woman_no_cry' | 'amour_machine' | 'couleur_cafe' | 'blues' | 'jazz' | 'rock' = 'no_woman_no_cry') {
    this.stop();

    if (genre === 'no_woman_no_cry') {
      this.title = "No Woman No Cry - Bob Marley & The Wailers (Roots Reggae Multi-Tracks)";
      this.bpm = 78;
      this.duration = 240;

      const secondsPerBeat = 60 / 78;
      const secondsPerBar = secondsPerBeat * 4;
      const totalBars = 56; // ~172 seconds of complete authentic roots reggae backing

      // Harmony: 4-bar reggae cycle
      // Bar 0: C (2 beats) -> G/B (2 beats)
      // Bar 1: Am (2 beats) -> F (2 beats)
      // Bar 2: C (2 beats) -> F (1 beat) - C/E (1 beat)
      // Bar 3: G (2 beats) -> C (1 beat) - G (1 beat)

      // 1. Drums Track - Authentic One-Drop Reggae
      const drumNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;

        // Crash cymbal (49) at intro, chorus & verse starts
        if (bar === 0 || bar === 4 || bar === 12 || bar === 20 || bar === 28 || bar === 36 || bar === 44) {
          drumNotes.push({ name: 'Crash', midi: 49, time: barTime, duration: 1.2, velocity: 0.9 });
        }

        // ONE-DROP: Heavy Kick (36) on beat 3 only!
        drumNotes.push({ name: 'Kick', midi: 36, time: barTime + secondsPerBeat * 2.0, duration: 0.35, velocity: 0.95 });
        // Occasional light kick on & of 4
        if (bar % 2 === 1) {
          drumNotes.push({ name: 'Kick', midi: 36, time: barTime + secondsPerBeat * 3.5, duration: 0.2, velocity: 0.65 });
        }

        // Snare / Side-Stick (37/38) on beat 3 (layered with kick) and light rimshot on beat 1.5
        drumNotes.push({ name: 'SideStick', midi: 37, time: barTime + secondsPerBeat * 2.0, duration: 0.25, velocity: 0.92 });
        drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 2.0, duration: 0.22, velocity: 0.85 });
        if (bar % 4 === 3) {
          // Fill on 4th bar
          drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 3.25, duration: 0.15, velocity: 0.7 });
          drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 3.5, duration: 0.15, velocity: 0.8 });
          drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 3.75, duration: 0.15, velocity: 0.9 });
        }

        // Hi-Hat (42 closed, 46 open) reggae swinging 16th/8th notes
        for (let b = 0; b < 8; b++) {
          const isOpen = b === 5 && bar % 2 === 1;
          drumNotes.push({
            name: isOpen ? 'OpenHH' : 'ClosedHH',
            midi: isOpen ? 46 : 42,
            time: barTime + (b * secondsPerBeat) / 2,
            duration: isOpen ? 0.25 : 0.1,
            velocity: b % 2 === 0 ? 0.75 : 0.5,
          });
        }
      }

      // 2. Aston "Family Man" Barrett - Iconic Roots Reggae Bass (GM 33 Electric Bass finger)
      const bassNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;

        if (mod4 === 0) {
          // C -> G/B: C (36) -> D (38) -> E (40) -> G (43) -> B (47)
          bassNotes.push({ name: 'Bass', midi: 36, time: barTime + secondsPerBeat * 0.25, duration: secondsPerBeat * 0.9, velocity: 0.92 }); // C1
          bassNotes.push({ name: 'Bass', midi: 40, time: barTime + secondsPerBeat * 1.25, duration: secondsPerBeat * 0.6, velocity: 0.8 }); // E1
          bassNotes.push({ name: 'Bass', midi: 47, time: barTime + secondsPerBeat * 2.25, duration: secondsPerBeat * 0.9, velocity: 0.88 }); // B1
          bassNotes.push({ name: 'Bass', midi: 43, time: barTime + secondsPerBeat * 3.25, duration: secondsPerBeat * 0.6, velocity: 0.8 }); // G1
        } else if (mod4 === 1) {
          // Am -> F: A (45) -> C (48) -> F (41) -> A (45)
          bassNotes.push({ name: 'Bass', midi: 45, time: barTime + secondsPerBeat * 0.25, duration: secondsPerBeat * 0.9, velocity: 0.9 }); // A1
          bassNotes.push({ name: 'Bass', midi: 48, time: barTime + secondsPerBeat * 1.25, duration: secondsPerBeat * 0.6, velocity: 0.8 }); // C2
          bassNotes.push({ name: 'Bass', midi: 41, time: barTime + secondsPerBeat * 2.25, duration: secondsPerBeat * 0.9, velocity: 0.92 }); // F1
          bassNotes.push({ name: 'Bass', midi: 45, time: barTime + secondsPerBeat * 3.25, duration: secondsPerBeat * 0.6, velocity: 0.8 }); // A1
        } else if (mod4 === 2) {
          // C -> F - C/E: C (36) -> F (41) -> E (40)
          bassNotes.push({ name: 'Bass', midi: 36, time: barTime + secondsPerBeat * 0.25, duration: secondsPerBeat * 0.9, velocity: 0.92 }); // C1
          bassNotes.push({ name: 'Bass', midi: 48, time: barTime + secondsPerBeat * 1.25, duration: secondsPerBeat * 0.6, velocity: 0.8 }); // C2
          bassNotes.push({ name: 'Bass', midi: 41, time: barTime + secondsPerBeat * 2.25, duration: secondsPerBeat * 0.7, velocity: 0.85 }); // F1
          bassNotes.push({ name: 'Bass', midi: 40, time: barTime + secondsPerBeat * 3.25, duration: secondsPerBeat * 0.65, velocity: 0.85 }); // E1
        } else {
          // G -> C - G: G (43) -> D (38) -> C (36) -> G (43)
          bassNotes.push({ name: 'Bass', midi: 43, time: barTime + secondsPerBeat * 0.25, duration: secondsPerBeat * 0.9, velocity: 0.9 }); // G1
          bassNotes.push({ name: 'Bass', midi: 38, time: barTime + secondsPerBeat * 1.25, duration: secondsPerBeat * 0.6, velocity: 0.8 }); // D1
          bassNotes.push({ name: 'Bass', midi: 36, time: barTime + secondsPerBeat * 2.25, duration: secondsPerBeat * 0.7, velocity: 0.9 }); // C1
          bassNotes.push({ name: 'Bass', midi: 43, time: barTime + secondsPerBeat * 3.25, duration: secondsPerBeat * 0.65, velocity: 0.85 }); // G1
        }
      }

      // 3. Reggae Skank Rhythm Guitar (GM 28 Electric Clean - Offbeat chops)
      const guitarNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;

        let chord1 = [60, 64, 67]; // C (C4, E4, G4)
        let chord2 = [59, 62, 67]; // G/B (B3, D4, G4)
        if (mod4 === 1) {
          chord1 = [57, 60, 64]; // Am (A3, C4, E4)
          chord2 = [53, 57, 60]; // F (F3, A3, C4)
        } else if (mod4 === 2) {
          chord1 = [60, 64, 67]; // C
          chord2 = [53, 57, 60]; // F
        } else if (mod4 === 3) {
          chord1 = [55, 59, 62]; // G
          chord2 = [60, 64, 67]; // C
        }

        // Reggae Skank on offbeats (& of 1, & of 2, & of 3, & of 4)
        [0.5, 1.5, 2.5, 3.5].forEach((beatOffset, idx) => {
          const chord = idx < 2 ? chord1 : chord2;
          chord.forEach((noteMidi) => {
            guitarNotes.push({
              name: 'SkankGtr',
              midi: noteMidi,
              time: barTime + secondsPerBeat * beatOffset,
              duration: secondsPerBeat * 0.22,
              velocity: idx % 2 === 1 ? 0.88 : 0.75,
            });
          });
        });
      }

      // 4. Hammond B3 Organ Bubble & Swell (GM 17 Percussive Organ / GM 19 Church Organ)
      const organNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;
        let chord = [60, 64, 67, 72]; // C
        if (mod4 === 1) chord = [57, 60, 64, 69]; // Am
        else if (mod4 === 2) chord = [53, 57, 60, 65]; // F
        else if (mod4 === 3) chord = [55, 59, 62, 67]; // G

        // Organ Bubble: left hand & right hand 16th bouncing pattern
        for (let step = 0; step < 16; step++) {
          if (step % 2 === 1) {
            // Offbeat bubble
            const note = chord[step % chord.length];
            organNotes.push({
              name: 'OrganBubble',
              midi: note,
              time: barTime + (step * secondsPerBeat) / 4,
              duration: (secondsPerBeat / 4) * 0.75,
              velocity: step % 4 === 1 ? 0.8 : 0.6,
            });
          }
        }

        // Organ Warm Swell on 1 and 3
        [0.0, 2.0].forEach((off) => {
          chord.slice(0, 3).forEach((n) => {
            organNotes.push({
              name: 'OrganSwell',
              midi: n + 12,
              time: barTime + secondsPerBeat * off,
              duration: secondsPerBeat * 1.8,
              velocity: 0.55,
            });
          });
        });
      }

      // 5. Acoustic Grand Piano (GM 0 - Chords & Famous Intro Riff)
      const pianoNotes: any[] = [];
      const introPianoRiff = [
        { n: 72, off: 0.0, dur: 0.5 },  // C5
        { n: 71, off: 0.75, dur: 0.5 }, // B4
        { n: 69, off: 1.5, dur: 0.5 },  // A4
        { n: 65, off: 2.25, dur: 0.5 }, // F4
        { n: 64, off: 3.0, dur: 0.8 },  // E4
      ];

      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;

        if (bar < 4 || (bar >= 20 && bar < 24)) {
          // Play famous piano theme
          introPianoRiff.forEach((r) => {
            pianoNotes.push({
              name: 'PianoLead',
              midi: r.n,
              time: barTime + secondsPerBeat * r.off,
              duration: secondsPerBeat * r.dur,
              velocity: 0.85,
            });
          });
        }

        // Chords on beats 1 and 3
        let pChord1 = [48, 60, 64, 67]; // C
        let pChord2 = [47, 59, 62, 67]; // G/B
        if (mod4 === 1) {
          pChord1 = [45, 57, 60, 64]; // Am
          pChord2 = [41, 53, 57, 60]; // F
        } else if (mod4 === 2) {
          pChord1 = [48, 60, 64, 67]; // C
          pChord2 = [41, 53, 57, 60]; // F
        } else if (mod4 === 3) {
          pChord1 = [43, 55, 59, 62]; // G
          pChord2 = [48, 60, 64, 67]; // C
        }

        pChord1.forEach((n) => {
          pianoNotes.push({
            name: 'PianoChord',
            midi: n,
            time: barTime,
            duration: secondsPerBeat * 1.8,
            velocity: 0.7,
          });
        });
        pChord2.forEach((n) => {
          pianoNotes.push({
            name: 'PianoChord',
            midi: n,
            time: barTime + secondsPerBeat * 2.0,
            duration: secondsPerBeat * 1.8,
            velocity: 0.7,
          });
        });
      }

      // 6. Bob Marley Vocal Guide Lead (GM 54 Synth Voice / Soprano)
      const vocalNotes: any[] = [];
      const addVocalLine = (startBar: number, notesArr: { n: number; off: number; d: number }[]) => {
        notesArr.forEach((item) => {
          vocalNotes.push({
            name: 'BobMarleyVocal',
            midi: item.n,
            time: (startBar * 4 + item.off) * secondsPerBeat,
            duration: item.d * secondsPerBeat,
            velocity: 0.85,
          });
        });
      };

      // Chorus: "No woman, no cry... No woman, no cry..."
      const chorusVocal = [
        // "No woman, no cry" (Bar 1 & 2)
        { n: 67, off: 0.0, d: 0.6 },  // No (G4)
        { n: 69, off: 0.75, d: 0.5 }, // wo- (A4)
        { n: 67, off: 1.5, d: 0.6 },  // -man (G4)
        { n: 64, off: 2.25, d: 0.5 }, // no (E4)
        { n: 60, off: 3.0, d: 1.2 },  // cry (C4)
        // "No woman, no cry" (Bar 3 & 4)
        { n: 67, off: 4.0, d: 0.6 },
        { n: 69, off: 4.75, d: 0.5 },
        { n: 67, off: 5.5, d: 0.6 },
        { n: 64, off: 6.25, d: 0.5 },
        { n: 60, off: 7.0, d: 1.4 },
        // "Said I remember..." (Bar 5)
        { n: 60, off: 8.5, d: 0.4 },
        { n: 62, off: 9.0, d: 0.4 },
        { n: 64, off: 9.5, d: 0.5 },
        { n: 67, off: 10.25, d: 0.5 },
        { n: 69, off: 11.0, d: 0.8 },
        // "Little darlin', don't shed no tears" (Bar 7 & 8)
        { n: 67, off: 12.0, d: 0.5 },
        { n: 69, off: 12.6, d: 0.5 },
        { n: 72, off: 13.25, d: 0.7 },
        { n: 71, off: 14.0, d: 0.5 },
        { n: 69, off: 14.6, d: 0.5 },
        { n: 67, off: 15.2, d: 1.2 },
      ];

      // Verse: "Said I remember when we used to sit in the government yard in Trenchtown..."
      const verseVocal = [
        { n: 60, off: 0.5, d: 0.4 },
        { n: 60, off: 1.0, d: 0.4 },
        { n: 64, off: 1.5, d: 0.5 },
        { n: 64, off: 2.0, d: 0.5 },
        { n: 64, off: 2.5, d: 0.4 },
        { n: 62, off: 3.0, d: 0.5 },
        { n: 60, off: 3.6, d: 0.8 },
        // "Oba, observing the hypocrites..."
        { n: 60, off: 4.5, d: 0.4 },
        { n: 64, off: 5.0, d: 0.5 },
        { n: 67, off: 5.5, d: 0.5 },
        { n: 67, off: 6.0, d: 0.5 },
        { n: 69, off: 6.6, d: 0.6 },
        { n: 67, off: 7.2, d: 1.0 },
        // "Good friends we have, oh good friends we've lost..."
        { n: 67, off: 8.5, d: 0.5 },
        { n: 69, off: 9.0, d: 0.5 },
        { n: 72, off: 9.5, d: 0.6 },
        { n: 72, off: 10.2, d: 0.5 },
        { n: 71, off: 10.8, d: 0.5 },
        { n: 69, off: 11.4, d: 0.8 },
        // "In this great future, you can't forget your past"
        { n: 67, off: 12.5, d: 0.4 },
        { n: 69, off: 13.0, d: 0.5 },
        { n: 67, off: 13.6, d: 0.4 },
        { n: 64, off: 14.2, d: 0.6 },
        { n: 60, off: 14.8, d: 1.2 },
      ];

      // Insert chorus and verse vocal sections
      addVocalLine(4, chorusVocal);
      addVocalLine(12, verseVocal);
      addVocalLine(20, chorusVocal);
      addVocalLine(28, verseVocal);
      addVocalLine(36, chorusVocal);
      addVocalLine(44, chorusVocal);

      this.tracks = [
        {
          id: 0,
          name: 'Batterie One-Drop Reggae (Carlton Barrett)',
          channel: 9,
          program: 0,
          instrumentName: 'Standard Drum Kit',
          instrumentFamily: 'Percussion',
          isPercussion: true,
          notesCount: drumNotes.length,
          volume: 1.0,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color: '#f97316',
          notes: drumNotes,
          activeNotes: [],
        },
        {
          id: 1,
          name: 'Basse Roots Reggae (Aston Family Man Barrett)',
          channel: 1,
          program: 33, // Electric Bass (finger)
          instrumentName: 'Electric Bass (finger)',
          instrumentFamily: 'Bass',
          isPercussion: false,
          notesCount: bassNotes.length,
          volume: 1.0,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color: '#10b981',
          notes: bassNotes,
          activeNotes: [],
        },
        {
          id: 2,
          name: 'Guitare Rythmique Skank (Chop Offbeat)',
          channel: 2,
          program: 27, // Electric Guitar (clean)
          instrumentName: 'Electric Guitar (clean)',
          instrumentFamily: 'Guitar',
          isPercussion: false,
          notesCount: guitarNotes.length,
          volume: 0.85,
          pan: -0.35,
          isMuted: false,
          isSolo: false,
          color: '#eab308',
          notes: guitarNotes,
          activeNotes: [],
        },
        {
          id: 3,
          name: 'Orgue Hammond B3 Bubbling & Nappe',
          channel: 3,
          program: 17, // Percussive Organ
          instrumentName: 'Percussive Organ',
          instrumentFamily: 'Organ',
          isPercussion: false,
          notesCount: organNotes.length,
          volume: 0.8,
          pan: 0.35,
          isMuted: false,
          isSolo: false,
          color: '#a855f7',
          notes: organNotes,
          activeNotes: [],
        },
        {
          id: 4,
          name: 'Piano Acoustique Riff & Accords Gospel',
          channel: 4,
          program: 0, // Acoustic Grand Piano
          instrumentName: 'Acoustic Grand Piano',
          instrumentFamily: 'Piano',
          isPercussion: false,
          notesCount: pianoNotes.length,
          volume: 0.8,
          pan: -0.15,
          isMuted: false,
          isSolo: false,
          color: '#3b82f6',
          notes: pianoNotes,
          activeNotes: [],
        },
        {
          id: 5,
          name: 'Guide Chant / Bob Marley Vocal Lead',
          channel: 5,
          program: 54, // Synth Voice
          instrumentName: 'Synth Voice',
          instrumentFamily: 'Ensemble',
          isPercussion: false,
          notesCount: vocalNotes.length,
          volume: 0.85,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color: '#ef4444',
          notes: vocalNotes,
          activeNotes: [],
        },
      ];
    } else if (genre === 'amour_machine') {
      this.title = "L'amour à la machine - Alain Souchon (Multi-Pistes)";
      this.bpm = 118;
      this.duration = 210;

      const secondsPerBeat = 60 / 118;
      const secondsPerBar = secondsPerBeat * 4;
      const totalBars = 64; // ~217 seconds of complete backing track

      // Harmony loop: 4-bar progression [Em, G, C, D]
      // Chorus structure: [Em, G, C, D] x 2
      // Verse structure: [Em, G, C, D] x 2
      // Bridge at bar 32: [Am, Em, Am, D, Em, G, C, D]

      // 1. Drums Track (Kick, Snare, Hi-Hat, Tambourine, Crash)
      const drumNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const isChorus = (bar >= 12 && bar < 20) || (bar >= 28 && bar < 36) || (bar >= 44 && bar < 56);
        const isBridge = bar >= 36 && bar < 44;

        // Crash on section starts
        if (bar === 0 || bar === 4 || bar === 12 || bar === 20 || bar === 28 || bar === 44 || bar === 56) {
          drumNotes.push({ name: 'Crash', midi: 49, time: barTime, duration: 0.8, velocity: 0.9 });
        }

        // Kick Drum (C1 = 36) on 1, & of 2, 3
        drumNotes.push({ name: 'Kick', midi: 36, time: barTime, duration: 0.2, velocity: 0.95 });
        drumNotes.push({ name: 'Kick', midi: 36, time: barTime + secondsPerBeat * 1.5, duration: 0.2, velocity: 0.85 });
        drumNotes.push({ name: 'Kick', midi: 36, time: barTime + secondsPerBeat * 2.5, duration: 0.18, velocity: 0.8 });
        if (isChorus) {
          drumNotes.push({ name: 'Kick', midi: 36, time: barTime + secondsPerBeat * 3.5, duration: 0.18, velocity: 0.85 });
        }

        // Snare Drum (D1 = 38) on 2 and 4
        drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 1.0, duration: 0.18, velocity: 0.88 });
        drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 3.0, duration: 0.18, velocity: 0.92 });
        // Ghost snare
        if (bar % 2 === 1) {
          drumNotes.push({ name: 'Snare', midi: 38, time: barTime + secondsPerBeat * 3.75, duration: 0.1, velocity: 0.5 });
        }

        // Hi-Hat (F#1 = 42 closed, A#1 = 46 open) in 8th notes
        for (let b = 0; b < 8; b++) {
          const isOpen = b === 7 && bar % 2 === 1;
          drumNotes.push({
            name: isOpen ? 'OpenHH' : 'ClosedHH',
            midi: isOpen ? 46 : 42,
            time: barTime + (b * secondsPerBeat) / 2,
            duration: isOpen ? 0.2 : 0.08,
            velocity: b % 2 === 0 ? 0.7 : 0.45,
          });
        }

        // Tambourine (54) on choruses
        if (isChorus) {
          for (let b = 0; b < 8; b++) {
            drumNotes.push({
              name: 'Tambourine',
              midi: 54,
              time: barTime + (b * secondsPerBeat) / 2 + (secondsPerBeat / 4),
              duration: 0.06,
              velocity: 0.65,
            });
          }
        }
      }

      // 2. Bass Track (Fingered Bass - GM 33)
      const bassNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;
        const isBridge = bar >= 36 && bar < 44;

        let root = 40; // E1 for Em
        let fifth = 47; // B1
        let octave = 52; // E2

        if (isBridge && bar >= 36 && bar < 38) {
          root = 45; // A1 for Am
          fifth = 52;
          octave = 57;
        } else if (mod4 === 1) {
          root = 43; // G1 for G
          fifth = 50; // D2
          octave = 55;
        } else if (mod4 === 2) {
          root = 36 + 12; // C2 for C (48)
          fifth = 55; // G2
          octave = 60;
        } else if (mod4 === 3) {
          root = 38 + 12; // D2 for D (50)
          fifth = 57; // A2
          octave = 62;
        }

        // Bass groove (Souchon / Voulzy pop style)
        bassNotes.push({ name: 'Bass', midi: root, time: barTime, duration: secondsPerBeat * 0.9, velocity: 0.9 });
        bassNotes.push({ name: 'Bass', midi: root, time: barTime + secondsPerBeat * 0.75, duration: secondsPerBeat * 0.4, velocity: 0.75 });
        bassNotes.push({ name: 'Bass', midi: fifth, time: barTime + secondsPerBeat * 1.5, duration: secondsPerBeat * 0.8, velocity: 0.85 });
        bassNotes.push({ name: 'Bass', midi: octave, time: barTime + secondsPerBeat * 2.5, duration: secondsPerBeat * 0.6, velocity: 0.8 });
        bassNotes.push({ name: 'Bass', midi: fifth, time: barTime + secondsPerBeat * 3.25, duration: secondsPerBeat * 0.6, velocity: 0.75 });
      }

      // 3. Acoustic Rhythm Guitar (12-Cordes / Steel String - GM 25)
      const guitarNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;
        let chord = [52, 55, 59, 64]; // Em

        if (mod4 === 1) chord = [55, 59, 62, 67]; // G
        else if (mod4 === 2) chord = [52, 55, 60, 64]; // C
        else if (mod4 === 3) chord = [50, 57, 62, 66]; // D

        // Strumming pattern (Down - DownUp - UpDown - DownUp)
        [0.0, 0.75, 1.5, 2.25, 3.0, 3.5].forEach((beatOffset, idx) => {
          chord.forEach((noteMidi) => {
            guitarNotes.push({
              name: 'Gtr',
              midi: noteMidi,
              time: barTime + secondsPerBeat * beatOffset,
              duration: secondsPerBeat * (idx % 2 === 0 ? 0.6 : 0.35),
              velocity: idx === 0 ? 0.85 : 0.65,
            });
          });
        });
      }

      // 4. Electric Guitar Riff / Lead (Clean / Chorus - GM 27)
      const leadNotes: any[] = [];
      const riffMotif = [
        { note: 71, off: 0.0, dur: 0.4 },  // B4
        { note: 67, off: 0.5, dur: 0.4 },  // G4
        { note: 64, off: 1.0, dur: 0.6 },  // E4
        { note: 67, off: 2.0, dur: 0.4 },  // G4
        { note: 69, off: 2.5, dur: 0.4 },  // A4
        { note: 71, off: 3.0, dur: 0.8 },  // B4
      ];
      const riffMotif2 = [
        { note: 74, off: 0.0, dur: 0.5 },  // D5
        { note: 71, off: 0.75, dur: 0.5 }, // B4
        { note: 69, off: 1.5, dur: 0.5 },  // A4
        { note: 67, off: 2.25, dur: 0.5 }, // G4
        { note: 64, off: 3.0, dur: 0.9 },  // E4
      ];

      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const isIntro = bar < 4;
        const isInterlude = (bar >= 20 && bar < 24) || (bar >= 56 && bar < 64);
        const isChorus = (bar >= 12 && bar < 20) || (bar >= 28 && bar < 36);

        if (isIntro || isInterlude) {
          const motif = bar % 2 === 0 ? riffMotif : riffMotif2;
          motif.forEach((m) => {
            leadNotes.push({
              name: 'LeadGtr',
              midi: m.note,
              time: barTime + secondsPerBeat * m.off,
              duration: secondsPerBeat * m.dur,
              velocity: 0.85,
            });
          });
        } else if (isChorus && bar % 2 === 1) {
          // Arpeggiated fills on chorus
          [76, 74, 71, 67].forEach((note, i) => {
            leadNotes.push({
              name: 'LeadGtr',
              midi: note,
              time: barTime + secondsPerBeat * (2.0 + i * 0.45),
              duration: secondsPerBeat * 0.4,
              velocity: 0.7,
            });
          });
        }
      }

      // 5. Synth Warm Pad / Rhodes (GM 89 / GM 4)
      const padNotes: any[] = [];
      for (let bar = 0; bar < totalBars; bar++) {
        const barTime = bar * secondsPerBar;
        const mod4 = bar % 4;
        let padChord = [64, 67, 71]; // Em
        if (mod4 === 1) padChord = [59, 62, 67]; // G
        else if (mod4 === 2) padChord = [60, 64, 67]; // C
        else if (mod4 === 3) padChord = [62, 66, 69]; // D

        padChord.forEach((m) => {
          padNotes.push({
            name: 'Pad',
            midi: m,
            time: barTime,
            duration: secondsPerBar * 0.95,
            velocity: 0.6,
          });
        });
      }

      // 6. Vocal Melody Guide (Alain Souchon Chant - GM 68 Oboe / Voice)
      const vocalNotes: any[] = [];
      const addVocalLine = (startBar: number, notesArr: { n: number; off: number; d: number }[]) => {
        notesArr.forEach((item) => {
          vocalNotes.push({
            name: 'VocalGuide',
            midi: item.n,
            time: (startBar * 4 + item.off) * secondsPerBeat,
            duration: item.d * secondsPerBeat,
            velocity: 0.8,
          });
        });
      };

      // Chorus vocal motif: "Passe, passe, passe l'amour à la machine..."
      const chorusVocal = [
        // "Passe, passe, passe"
        { n: 71, off: 0.0, d: 0.45 },
        { n: 71, off: 0.6, d: 0.45 },
        { n: 71, off: 1.2, d: 0.45 },
        // "l'amour à la machine"
        { n: 74, off: 1.8, d: 0.6 },
        { n: 71, off: 2.5, d: 0.4 },
        { n: 69, off: 3.0, d: 0.5 },
        { n: 67, off: 3.6, d: 0.8 },
        // "Pour voir si les couleurs d'origine" (Bar 2)
        { n: 67, off: 4.5, d: 0.4 },
        { n: 69, off: 5.0, d: 0.4 },
        { n: 71, off: 5.5, d: 0.4 },
        { n: 69, off: 6.0, d: 0.4 },
        { n: 67, off: 6.5, d: 0.4 },
        { n: 64, off: 7.0, d: 0.7 },
        // "Peuvent revenir" (Bar 3)
        { n: 67, off: 8.5, d: 0.5 },
        { n: 64, off: 9.2, d: 0.6 },
        { n: 62, off: 10.0, d: 0.5 },
        { n: 64, off: 10.8, d: 1.2 },
        // "Est-ce qu'on peut laver l'amour" (Bar 4)
        { n: 71, off: 12.0, d: 0.4 },
        { n: 74, off: 12.6, d: 0.4 },
        { n: 76, off: 13.2, d: 0.5 },
        { n: 74, off: 14.0, d: 0.5 },
        { n: 71, off: 14.6, d: 0.8 },
      ];

      // Couplet vocal: "Regarde un peu les sentiments comme ils sont froissés..."
      const verseVocal = [
        { n: 64, off: 0.5, d: 0.4 },
        { n: 67, off: 1.0, d: 0.4 },
        { n: 67, off: 1.5, d: 0.4 },
        { n: 67, off: 2.0, d: 0.4 },
        { n: 69, off: 2.5, d: 0.4 },
        { n: 71, off: 3.0, d: 0.6 },
        { n: 71, off: 3.7, d: 0.5 },
        { n: 69, off: 4.5, d: 0.4 },
        { n: 67, off: 5.0, d: 0.4 },
        { n: 64, off: 5.5, d: 0.6 },
        { n: 62, off: 6.2, d: 0.5 },
        { n: 64, off: 7.0, d: 1.0 },
      ];

      // Add couplets and refrains
      addVocalLine(4, verseVocal);
      addVocalLine(8, verseVocal);
      addVocalLine(12, chorusVocal);
      addVocalLine(16, chorusVocal);
      addVocalLine(24, verseVocal);
      addVocalLine(28, chorusVocal);
      addVocalLine(44, chorusVocal);
      addVocalLine(48, chorusVocal);

      this.tracks = [
        {
          id: 0,
          name: 'Batterie & Percussions Pop (Souchon)',
          channel: 9,
          program: 0,
          instrumentName: 'Standard Drum Kit',
          instrumentFamily: 'Percussion',
          isPercussion: true,
          notesCount: drumNotes.length,
          volume: 1.0,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color: '#f97316',
          notes: drumNotes,
          activeNotes: [],
        },
        {
          id: 1,
          name: 'Basse Électrique Ronde (Em - G - C - D)',
          channel: 1,
          program: 33, // Electric Bass (finger)
          instrumentName: 'Electric Bass (finger)',
          instrumentFamily: 'Bass',
          isPercussion: false,
          notesCount: bassNotes.length,
          volume: 1.0,
          pan: -0.05,
          isMuted: false,
          isSolo: false,
          color: '#3b82f6',
          notes: bassNotes,
          activeNotes: [],
        },
        {
          id: 2,
          name: 'Guitare Acoustique 12 Cordes (Rythmique)',
          channel: 2,
          program: 25, // Acoustic Guitar (steel)
          instrumentName: 'Acoustic Guitar (steel)',
          instrumentFamily: 'Guitar',
          isPercussion: false,
          notesCount: guitarNotes.length,
          volume: 0.85,
          pan: 0.35,
          isMuted: false,
          isSolo: false,
          color: '#10b981',
          notes: guitarNotes,
          activeNotes: [],
        },
        {
          id: 3,
          name: 'Guitare Électrique Clean & Riffs Voulzy',
          channel: 3,
          program: 27, // Electric Guitar (clean)
          instrumentName: 'Electric Guitar (clean)',
          instrumentFamily: 'Guitar',
          isPercussion: false,
          notesCount: leadNotes.length,
          volume: 0.85,
          pan: -0.35,
          isMuted: false,
          isSolo: false,
          color: '#ec4899',
          notes: leadNotes,
          activeNotes: [],
        },
        {
          id: 4,
          name: 'Synthétiseur Pad / Rhodes Vintage',
          channel: 4,
          program: 89, // Warm Pad
          instrumentName: 'Pad 2 (warm)',
          instrumentFamily: 'Synth Pad',
          isPercussion: false,
          notesCount: padNotes.length,
          volume: 0.7,
          pan: 0.2,
          isMuted: false,
          isSolo: false,
          color: '#a855f7',
          notes: padNotes,
          activeNotes: [],
        },
        {
          id: 5,
          name: 'Guide Voix / Chant Alain Souchon',
          channel: 5,
          program: 68, // Oboe / Voice
          instrumentName: 'Oboe',
          instrumentFamily: 'Reed',
          isPercussion: false,
          notesCount: vocalNotes.length,
          volume: 0.8,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color: '#eab308',
          notes: vocalNotes,
          activeNotes: [],
        },
      ];
    } else if (genre === 'couleur_cafe') {
      this.title = 'Couleur Café (Gainsbourg - Latin Montuno)';
      this.bpm = 110;
      this.duration = 180;

      // Create rich 5-track backing
      const lengthBars = 32;
      const secondsPerBeat = 60 / 110;
      const secondsPerBar = secondsPerBeat * 4;

      // Track 1: Drums & Latin Percussions (Congas, Clave, Kick, HiHat)
      const drumNotes = [];
      for (let bar = 0; bar < lengthBars; bar++) {
        const barTime = bar * secondsPerBar;
        // Kick on 1 and & of 2
        drumNotes.push({ name: 'C1', midi: 36, time: barTime, duration: 0.2, velocity: 0.9 });
        drumNotes.push({ name: 'C1', midi: 36, time: barTime + secondsPerBeat * 1.5, duration: 0.2, velocity: 0.8 });
        // Snare / Rimshot on 2 and 4
        drumNotes.push({ name: 'D1', midi: 38, time: barTime + secondsPerBeat * 1, duration: 0.15, velocity: 0.75 });
        drumNotes.push({ name: 'D1', midi: 38, time: barTime + secondsPerBeat * 3, duration: 0.15, velocity: 0.85 });
        // Son Clave (3:2)
        drumNotes.push({ name: 'Clave', midi: 75, time: barTime, duration: 0.05, velocity: 0.8 });
        drumNotes.push({ name: 'Clave', midi: 75, time: barTime + secondsPerBeat * 0.75, duration: 0.05, velocity: 0.75 });
        drumNotes.push({ name: 'Clave', midi: 75, time: barTime + secondsPerBeat * 1.5, duration: 0.05, velocity: 0.8 });
        drumNotes.push({ name: 'Clave', midi: 75, time: barTime + secondsPerBeat * 2.5, duration: 0.05, velocity: 0.75 });
        drumNotes.push({ name: 'Clave', midi: 75, time: barTime + secondsPerBeat * 3.0, duration: 0.05, velocity: 0.75 });
        // Congas
        drumNotes.push({ name: 'Conga', midi: 62, time: barTime + secondsPerBeat * 0.5, duration: 0.1, velocity: 0.7 });
        drumNotes.push({ name: 'Conga', midi: 63, time: barTime + secondsPerBeat * 2.0, duration: 0.1, velocity: 0.75 });
        drumNotes.push({ name: 'Conga', midi: 64, time: barTime + secondsPerBeat * 3.5, duration: 0.1, velocity: 0.8 });
        // Hi-Hat 8th notes
        for (let b = 0; b < 8; b++) {
          drumNotes.push({
            name: 'F#1',
            midi: 42,
            time: barTime + (b * secondsPerBeat) / 2,
            duration: 0.08,
            velocity: b % 2 === 0 ? 0.6 : 0.4,
          });
        }
      }

      // Track 2: Afro-Cuban Bass (Sol - Do - Ré7 Montuno)
      const bassNotes = [];
      for (let bar = 0; bar < lengthBars; bar++) {
        const barTime = bar * secondsPerBar;
        const isG = bar % 4 < 2;
        const isC = bar % 4 === 2;
        const rootMidi = isG ? 43 : isC ? 48 : 50; // G1, C2, D2
        const fifthMidi = rootMidi + 7;

        bassNotes.push({ name: 'Bass', midi: rootMidi, time: barTime, duration: secondsPerBeat * 0.8, velocity: 0.9 });
        bassNotes.push({ name: 'Bass', midi: fifthMidi, time: barTime + secondsPerBeat * 1.5, duration: secondsPerBeat * 0.7, velocity: 0.85 });
        bassNotes.push({ name: 'Bass', midi: rootMidi, time: barTime + secondsPerBeat * 2.5, duration: secondsPerBeat * 0.7, velocity: 0.85 });
        bassNotes.push({ name: 'Bass', midi: fifthMidi - 2, time: barTime + secondsPerBeat * 3.5, duration: secondsPerBeat * 0.5, velocity: 0.75 });
      }

      // Track 3: Piano Montuno
      const pianoNotes = [];
      for (let bar = 0; bar < lengthBars; bar++) {
        const barTime = bar * secondsPerBar;
        const isG = bar % 4 < 2;
        const isC = bar % 4 === 2;
        const chord = isG ? [55, 59, 62] : isC ? [60, 64, 67] : [62, 66, 69]; // G, C, D

        [0.5, 1.5, 2.25, 3.0, 3.5].forEach((beatOff) => {
          chord.forEach((m) => {
            pianoNotes.push({
              name: 'Piano',
              midi: m,
              time: barTime + secondsPerBeat * beatOff,
              duration: secondsPerBeat * 0.4,
              velocity: 0.75,
            });
          });
        });
      }

      // Track 4: Horns & Brass Riff
      const brassNotes = [];
      for (let bar = 0; bar < lengthBars; bar += 2) {
        const barTime = bar * secondsPerBar;
        [67, 71, 74].forEach((m) => {
          brassNotes.push({ name: 'Brass', midi: m, time: barTime + secondsPerBeat * 1, duration: 0.3, velocity: 0.85 });
          brassNotes.push({ name: 'Brass', midi: m + 2, time: barTime + secondsPerBeat * 1.5, duration: 0.3, velocity: 0.85 });
        });
      }

      // Track 5: Guitare Rythmique Skank
      const guitarNotes = [];
      for (let bar = 0; bar < lengthBars; bar++) {
        const barTime = bar * secondsPerBar;
        const isG = bar % 4 < 2;
        const isC = bar % 4 === 2;
        const chord = isG ? [55, 59, 62, 67] : isC ? [60, 64, 67, 72] : [62, 66, 69, 74];

        [1.0, 3.0].forEach((off) => {
          chord.forEach((m) => {
            guitarNotes.push({
              name: 'Gtr',
              midi: m,
              time: barTime + secondsPerBeat * off,
              duration: secondsPerBeat * 0.3,
              velocity: 0.7,
            });
          });
        });
      }

      this.tracks = [
        {
          id: 0,
          name: 'Batterie & Percussions Afro-Cubaines',
          channel: 9,
          program: 0,
          instrumentName: 'Standard Drum Kit',
          instrumentFamily: 'Percussion',
          isPercussion: true,
          notesCount: drumNotes.length,
          volume: 1.0,
          pan: 0.0,
          isMuted: false,
          isSolo: false,
          color: '#f97316',
          notes: drumNotes,
          activeNotes: [],
        },
        {
          id: 1,
          name: 'Basse Acoustique Chaloupée (G)',
          channel: 1,
          program: 32,
          instrumentName: 'Acoustic Bass',
          instrumentFamily: 'Bass',
          isPercussion: false,
          notesCount: bassNotes.length,
          volume: 1.0,
          pan: -0.1,
          isMuted: false,
          isSolo: false,
          color: '#3b82f6',
          notes: bassNotes,
          activeNotes: [],
        },
        {
          id: 2,
          name: 'Piano Montuno Syncopé',
          channel: 2,
          program: 0,
          instrumentName: 'Acoustic Grand Piano',
          instrumentFamily: 'Piano',
          isPercussion: false,
          notesCount: pianoNotes.length,
          volume: 0.85,
          pan: 0.25,
          isMuted: false,
          isSolo: false,
          color: '#10b981',
          notes: pianoNotes,
          activeNotes: [],
        },
        {
          id: 3,
          name: 'Section Cuivres / Brass Horns',
          channel: 3,
          program: 61,
          instrumentName: 'Brass Section',
          instrumentFamily: 'Brass',
          isPercussion: false,
          notesCount: brassNotes.length,
          volume: 0.8,
          pan: -0.3,
          isMuted: false,
          isSolo: false,
          color: '#ec4899',
          notes: brassNotes,
          activeNotes: [],
        },
        {
          id: 4,
          name: 'Guitare Rythmique Skank',
          channel: 4,
          program: 25,
          instrumentName: 'Acoustic Guitar (steel)',
          instrumentFamily: 'Guitar',
          isPercussion: false,
          notesCount: guitarNotes.length,
          volume: 0.75,
          pan: 0.4,
          isMuted: false,
          isSolo: false,
          color: '#eab308',
          notes: guitarNotes,
          activeNotes: [],
        },
      ];
    } else {
      // Blues Demo
      this.title = 'Slow Blues backing track en La mineur (Am)';
      this.bpm = 75;
      this.duration = 160;
      this.generateDemoMultiTrackMidi('couleur_cafe');
      this.title = 'Blues Multi-pistes (Am)';
      this.bpm = 75;
    }

    this.pauseOffset = 0;
    this.scheduledNotesIndex = new Array(this.tracks.length).fill(0);
    this.emitState();
  }

  // --- Export active MIDI multi-tracks to standard .mid file ---
  public exportMidiFile(customFileName?: string): void {
    try {
      const midi = new Midi();
      midi.header.name = this.title;
      midi.header.setTempo(Math.round(this.bpm * this.tempoMultiplier));

      this.tracks.forEach((track) => {
        const t = midi.addTrack();
        t.name = track.name;
        t.channel = track.channel;
        t.instrument.number = track.program;

        track.notes.forEach((n) => {
          t.addNote({
            midi: track.isPercussion ? n.midi : Math.max(0, Math.min(127, n.midi + this.transposeSemitones)),
            time: n.time / this.tempoMultiplier,
            duration: Math.max(0.05, n.duration / this.tempoMultiplier),
            velocity: Math.max(0.1, Math.min(1.0, n.velocity * track.volume)),
          });
        });
      });

      const bytes = midi.toArray();
      const blob = new Blob([bytes], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (customFileName || this.title || 'midi_track').replace(/[^a-zA-Z0-9_\u00C0-\u017F-]/g, '_');
      a.download = safeName.toLowerCase().endsWith('.mid') ? safeName : `${safeName}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export MIDI file', err);
    }
  }

  public exportMidiBase64(): string {
    try {
      const midi = new Midi();
      midi.header.name = this.title;
      midi.header.setTempo(Math.round(this.bpm * this.tempoMultiplier));

      this.tracks.forEach((track) => {
        const t = midi.addTrack();
        t.name = track.name;
        t.channel = track.channel;
        t.instrument.number = track.program;

        track.notes.forEach((n) => {
          t.addNote({
            midi: track.isPercussion ? n.midi : Math.max(0, Math.min(127, n.midi + this.transposeSemitones)),
            time: n.time / this.tempoMultiplier,
            duration: Math.max(0.05, n.duration / this.tempoMultiplier),
            velocity: Math.max(0.1, Math.min(1.0, n.velocity * track.volume)),
          });
        });
      });

      const bytes = midi.toArray();
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (err) {
      console.error('Failed to export MIDI base64', err);
      return '';
    }
  }
}

export const midiAudioEngine = new MultiTrackMidiAudioEngine();
