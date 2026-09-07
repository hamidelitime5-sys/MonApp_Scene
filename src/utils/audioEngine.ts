class MetronomeAudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private bpm = 120;
  private beatsPerBar = 4;
  private currentBeat = 0;
  private timerId: number | null = null;
  private onBeatCallback: ((beat: number, isAccent: boolean) => void) | null = null;
  private volume = 0.8;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(30, Math.min(300, newBpm));
  }

  public setBeatsPerBar(beats: number) {
    this.beatsPerBar = Math.max(1, Math.min(16, beats));
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public setBeatCallback(cb: (beat: number, isAccent: boolean) => void) {
    this.onBeatCallback = cb;
  }

  public playClick(isAccent = false) {
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = isAccent ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, this.ctx.currentTime);

    const baseVol = isAccent ? this.volume : this.volume * 0.6;
    gain.gain.setValueAtTime(baseVol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  public start() {
    this.initCtx();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentBeat = 0;

    const tick = () => {
      if (!this.isPlaying) return;
      const isAccent = this.currentBeat === 0;
      this.playClick(isAccent);

      if (this.onBeatCallback) {
        this.onBeatCallback(this.currentBeat, isAccent);
      }

      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
      this.timerId = window.setTimeout(tick, (60 / this.bpm) * 1000);
    };

    tick();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const metronomeEngine = new MetronomeAudioEngine();

export type DrumGrooveStyle =
  | 'latin_afrocuban'
  | 'pop_rock'
  | 'folk_acoustic'
  | 'blues_shuffle'
  | 'funk'
  | 'reggae'
  | 'click_only';

export interface DrumGrooveDefinition {
  id: DrumGrooveStyle;
  name: string;
  category: string;
  description: string;
  subdivisions: number; // 16 for 4/4 standard, 12 for shuffle
}

export const DRUM_GROOVES: DrumGrooveDefinition[] = [
  {
    id: 'latin_afrocuban',
    name: 'Afro-Cubain / Latin (Couleur Café)',
    category: 'Groove & Chanson',
    description: 'Clave syncopée, percussions congas/bongos, charleston et basse chaloupée',
    subdivisions: 16,
  },
  {
    id: 'pop_rock',
    name: 'Pop / Rock Standard',
    category: 'Classique',
    description: 'Grosse caisse sur 1 & 3, Caisse claire sur 2 & 4, Charleston régulier',
    subdivisions: 16,
  },
  {
    id: 'folk_acoustic',
    name: 'Acoustique / Ballade Douce',
    category: 'Folk & Ballade',
    description: 'Shaker soyeux, kick feutré et rimshot discret',
    subdivisions: 16,
  },
  {
    id: 'blues_shuffle',
    name: 'Blues / Rock Shuffle (Swing)',
    category: 'Blues & Jazz',
    description: 'Rythme ternaire swingué en triolets avec charleston rebondissant',
    subdivisions: 12,
  },
  {
    id: 'funk',
    name: 'Funk & Groove Dynamique',
    category: 'Groove',
    description: 'Charleston en doubles croches syncopées et accents funky',
    subdivisions: 16,
  },
  {
    id: 'reggae',
    name: 'Reggae / Skank',
    category: 'World',
    description: 'One-drop sur le 3ème temps et skank de caisse claire',
    subdivisions: 16,
  },
  {
    id: 'click_only',
    name: 'Métronome Clic Seul',
    category: 'Outil de Précision',
    description: 'Clic métronome précis avec temps fort accentué',
    subdivisions: 16,
  },
];

class RhythmAccompanimentEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private bpm = 110;
  private style: DrumGrooveStyle = 'latin_afrocuban';
  private volume = 0.8;
  private currentStep = 0;
  private timerId: number | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private onStepCallback: ((step: number, totalSteps: number, isAccent: boolean, beatNumber: number) => void) | null = null;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1; // 1 second of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(30, Math.min(300, newBpm));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setStyle(newStyle: DrumGrooveStyle) {
    this.style = newStyle;
  }

  public getStyle(): DrumGrooveStyle {
    return this.style;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  public getVolume(): number {
    return this.volume;
  }

  public setStepCallback(cb: (step: number, totalSteps: number, isAccent: boolean, beatNumber: number) => void) {
    this.onStepCallback = cb;
  }

  // Synthesize instruments
  private triggerKick(time: number, accent = 1.0) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = time;

    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

    const gainVal = this.volume * 0.9 * accent;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  private triggerSnare(time: number, accent = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = time;

    // Noise component
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1000, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(this.volume * 0.7 * accent, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);

    // Tonal body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    oscGain.gain.setValueAtTime(this.volume * 0.4 * accent, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.15);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  private triggerHiHat(time: number, isOpen = false, accent = 0.8) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = time;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(7000, now);

    const gain = this.ctx.createGain();
    const decay = isOpen ? 0.25 : 0.04;
    const vol = this.volume * (isOpen ? 0.5 : 0.35) * accent;

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + decay);
  }

  private triggerClaveOrWoodblock(time: number, high = true) {
    if (!this.ctx) return;
    const now = time;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(high ? 2400 : 1800, now);

    gain.gain.setValueAtTime(this.volume * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  private triggerConga(time: number, isHigh = false) {
    if (!this.ctx) return;
    const now = time;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isHigh ? 380 : 220;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(startFreq * 0.6, now + 0.12);

    gain.gain.setValueAtTime(this.volume * 0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  private triggerShaker(time: number) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = time;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(6000, now);
    filter.Q.setValueAtTime(2, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.volume * 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.07);
  }

  // Step sequencer engine
  private playStep(step: number, totalSteps: number, time: number) {
    switch (this.style) {
      case 'latin_afrocuban': {
        // 16-step Afro-Cuban/Latin syncopated groove (Couleur Café style)
        // Kick on 0, 6, 10
        if (step === 0 || step === 6 || step === 10) this.triggerKick(time, step === 0 ? 1.0 : 0.8);
        // Snare / Rim on 4, 12
        if (step === 4 || step === 12) this.triggerSnare(time, 0.7);
        // Clave syncopation: 0, 3, 6, 10, 12 (Son Clave 3:2 feel)
        if (step === 0 || step === 3 || step === 6 || step === 10 || step === 12) {
          this.triggerClaveOrWoodblock(time, step % 2 === 0);
        }
        // Congas / Bongos on 2, 7, 8, 14, 15
        if (step === 2 || step === 8) this.triggerConga(time, true);
        if (step === 7 || step === 14) this.triggerConga(time, false);
        // Shaker / Hi-Hat on every even step (8th notes)
        if (step % 2 === 0) this.triggerShaker(time);
        break;
      }

      case 'pop_rock': {
        // Kick on 0, 8 (beats 1 & 3)
        if (step === 0 || step === 8) this.triggerKick(time, step === 0 ? 1.0 : 0.85);
        if (step === 10) this.triggerKick(time, 0.6); // slight syncopation
        // Snare on 4, 12 (beats 2 & 4)
        if (step === 4 || step === 12) this.triggerSnare(time, 1.0);
        // Hi-Hat on every 8th note (0, 2, 4, 6, 8, 10, 12, 14)
        if (step % 2 === 0) this.triggerHiHat(time, step === 14, step === 0 ? 0.9 : 0.7);
        break;
      }

      case 'folk_acoustic': {
        // Soft Kick on 0 and 8
        if (step === 0 || step === 8) this.triggerKick(time, 0.6);
        // Soft Snare / Rim on 4, 12
        if (step === 4 || step === 12) this.triggerSnare(time, 0.5);
        // Shaker on all 8ths
        if (step % 2 === 0) this.triggerShaker(time);
        break;
      }

      case 'blues_shuffle': {
        // 12-step shuffle (beats at 0, 3, 6, 9 with swing feel)
        if (step === 0 || step === 6) this.triggerKick(time, 0.9);
        if (step === 3 || step === 9) this.triggerSnare(time, 0.85);
        // Swung ride/hat on 0, 2, 3, 5, 6, 8, 9, 11
        if (step % 3 === 0 || step % 3 === 2) {
          this.triggerHiHat(time, false, step % 3 === 0 ? 0.8 : 0.5);
        }
        break;
      }

      case 'funk': {
        // Funk syncopated
        if (step === 0 || step === 7 || step === 10) this.triggerKick(time, 0.9);
        if (step === 4 || step === 12) this.triggerSnare(time, 0.9);
        if (step === 9 || step === 15) this.triggerSnare(time, 0.35); // ghost note
        // 16th Hi-hats
        this.triggerHiHat(time, step === 6 || step === 14, step % 4 === 0 ? 0.8 : 0.4);
        break;
      }

      case 'reggae': {
        // One drop on 8 (beat 3)
        if (step === 8) {
          this.triggerKick(time, 1.0);
          this.triggerSnare(time, 0.9);
        }
        // Skank on offbeats: 4, 12
        if (step === 4 || step === 12) this.triggerHiHat(time, true, 0.7);
        else if (step % 2 === 0) this.triggerHiHat(time, false, 0.4);
        break;
      }

      case 'click_only':
      default: {
        // Metronome click on beat starts (0, 4, 8, 12 for 16-step)
        if (step % (totalSteps / 4) === 0) {
          const isAccent = step === 0;
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = isAccent ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(isAccent ? 1200 : 800, time);
          gain.gain.setValueAtTime(this.volume * (isAccent ? 0.8 : 0.5), time);
          gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(time);
          osc.stop(time + 0.08);
        }
        break;
      }
    }
  }

  public start() {
    this.initCtx();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;

    const currentGroove = DRUM_GROOVES.find((g) => g.id === this.style) || DRUM_GROOVES[0];
    const totalSteps = currentGroove.subdivisions; // 16 for 4/4, 12 for shuffle

    // Step duration in ms
    // For 16 steps (16th notes), each beat is 4 steps -> stepDuration = (60 / bpm) / 4 * 1000
    // For 12 steps (triplets), each beat is 3 steps -> stepDuration = (60 / bpm) / 3 * 1000
    const stepsPerBeat = totalSteps / 4;
    const stepDurationMs = (60 / this.bpm / stepsPerBeat) * 1000;

    const tick = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const isAccent = this.currentStep === 0;
      const beatNumber = Math.floor(this.currentStep / stepsPerBeat) + 1;

      this.playStep(this.currentStep, totalSteps, now);

      if (this.onStepCallback) {
        this.onStepCallback(this.currentStep, totalSteps, isAccent, beatNumber);
      }

      this.currentStep = (this.currentStep + 1) % totalSteps;
      this.timerId = window.setTimeout(tick, (60 / this.bpm / stepsPerBeat) * 1000);
    };

    tick();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.start();
      return true;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const rhythmEngine = new RhythmAccompanimentEngine();

// Instrument Tuner / Pitch Pipe Frequency Reference
export const TUNING_NOTES: Record<string, { note: string; freq: number; label: string }[]> = {
  guitar: [
    { note: 'E2', freq: 82.41, label: '6th String (Low E)' },
    { note: 'A2', freq: 110.0, label: '5th String (A)' },
    { note: 'D3', freq: 146.83, label: '4th String (D)' },
    { note: 'G3', freq: 196.0, label: '3rd String (G)' },
    { note: 'B3', freq: 246.94, label: '2nd String (B)' },
    { note: 'E4', freq: 329.63, label: '1st String (High E)' },
  ],
  bass: [
    { note: 'E1', freq: 41.2, label: '4th String (Low E)' },
    { note: 'A1', freq: 55.0, label: '3rd String (A)' },
    { note: 'D2', freq: 73.42, label: '2nd String (D)' },
    { note: 'G2', freq: 98.0, label: '1st String (G)' },
  ],
  ukulele: [
    { note: 'G4', freq: 392.0, label: '4th String (G)' },
    { note: 'C4', freq: 261.63, label: '3rd String (C)' },
    { note: 'E4', freq: 329.63, label: '2nd String (E)' },
    { note: 'A4', freq: 440.0, label: '1st String (A)' },
  ]
};

let tunerOsc: OscillatorNode | null = null;
let tunerGain: GainNode | null = null;
let tunerCtx: AudioContext | null = null;

export function playTunerTone(freq: number, durationSeconds = 3) {
  stopTunerTone();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  tunerCtx = new AudioCtx();
  
  tunerOsc = tunerCtx.createOscillator();
  tunerGain = tunerCtx.createGain();

  tunerOsc.type = 'sine';
  tunerOsc.frequency.setValueAtTime(freq, tunerCtx.currentTime);

  tunerGain.gain.setValueAtTime(0.5, tunerCtx.currentTime);
  tunerGain.gain.exponentialRampToValueAtTime(0.0001, tunerCtx.currentTime + durationSeconds);

  tunerOsc.connect(tunerGain);
  tunerGain.connect(tunerCtx.destination);

  tunerOsc.start();
  tunerOsc.stop(tunerCtx.currentTime + durationSeconds);
}

export function stopTunerTone() {
  if (tunerOsc) {
    try { tunerOsc.stop(); } catch { /* ignore */ }
    tunerOsc = null;
  }
}

/**
 * Synthesizes a realistic acoustic guitar chord strum
 */
export function playGuitarChordStrum(positions: { string: number; fret: number }[]) {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  // Open string MIDI values: string 6 (E2)=40, 5 (A2)=45, 4 (D3)=50, 3 (G3)=55, 2 (B3)=59, 1 (E4)=64
  const openMidi: Record<number, number> = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
  const sortedPos = [...positions].sort((a, b) => b.string - a.string); // Strum from string 6 down to 1

  let strumOffset = 0;

  sortedPos.forEach((pos) => {
    if (pos.fret === -1) return; // Muted string

    const midi = (openMidi[pos.string] || 40) + pos.fret;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const startTime = ctx.currentTime + strumOffset;
    const duration = 1.8;

    // Harmonic oscillators for warm acoustic body resonance
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(freq * 2, startTime); // 1st overtone

    // Envelope
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration);
    osc2.stop(startTime + duration);

    strumOffset += 0.045; // slight strumming delay between strings
  });
}

/**
 * Synthesizes piano chord playback
 */
export function playPianoChordNotes(notes: string[]) {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const noteToMidi = (noteStr: string, defaultOctave = 4): number => {
    const scale = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteStr.match(/^([A-G][#b]?)([0-9]?)$/);
    if (!match) return 60;
    let n = match[1];
    if (n === 'Db') n = 'C#';
    if (n === 'Eb') n = 'D#';
    if (n === 'Gb') n = 'F#';
    if (n === 'Ab') n = 'G#';
    if (n === 'Bb') n = 'A#';
    const octave = match[2] ? parseInt(match[2], 10) : defaultOctave;
    const noteIdx = scale.indexOf(n);
    return 12 * (octave + 1) + (noteIdx !== -1 ? noteIdx : 0);
  };

  const startTime = ctx.currentTime;
  const duration = 2.0;

  notes.forEach((nStr) => {
    const midi = noteToMidi(nStr);
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  });
}
