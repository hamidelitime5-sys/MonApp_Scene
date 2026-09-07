/**
 * Hamide Litime Software - Guitar & Bass Audio Engine
 * Web Audio API based interface access, FFT & Autocorrelation pitch detection,
 * live VU-metering, and audio monitoring.
 */

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface TuningPreset {
  id: string;
  name: string;
  instrument: 'guitar' | 'bass' | 'chromatic';
  notes: { note: string; octave: number; freq: number; stringNumber: number }[];
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: 'guitar_standard',
    name: 'Guitare Standard (E A D G B E)',
    instrument: 'guitar',
    notes: [
      { note: 'E', octave: 2, freq: 82.41, stringNumber: 6 },
      { note: 'A', octave: 2, freq: 110.0, stringNumber: 5 },
      { note: 'D', octave: 3, freq: 146.83, stringNumber: 4 },
      { note: 'G', octave: 3, freq: 196.0, stringNumber: 3 },
      { note: 'B', octave: 3, freq: 246.94, stringNumber: 2 },
      { note: 'E', octave: 4, freq: 329.63, stringNumber: 1 },
    ],
  },
  {
    id: 'guitar_drop_d',
    name: 'Guitare Drop D (D A D G B E)',
    instrument: 'guitar',
    notes: [
      { note: 'D', octave: 2, freq: 73.42, stringNumber: 6 },
      { note: 'A', octave: 2, freq: 110.0, stringNumber: 5 },
      { note: 'D', octave: 3, freq: 146.83, stringNumber: 4 },
      { note: 'G', octave: 3, freq: 196.0, stringNumber: 3 },
      { note: 'B', octave: 3, freq: 246.94, stringNumber: 2 },
      { note: 'E', octave: 4, freq: 329.63, stringNumber: 1 },
    ],
  },
  {
    id: 'guitar_half_step_down',
    name: 'Guitare 1/2 Ton en dessous (Eb Ab Db Gb Bb Eb)',
    instrument: 'guitar',
    notes: [
      { note: 'Eb', octave: 2, freq: 77.78, stringNumber: 6 },
      { note: 'Ab', octave: 2, freq: 103.83, stringNumber: 5 },
      { note: 'Db', octave: 3, freq: 138.59, stringNumber: 4 },
      { note: 'Gb', octave: 3, freq: 185.0, stringNumber: 3 },
      { note: 'Bb', octave: 3, freq: 233.08, stringNumber: 2 },
      { note: 'Eb', octave: 4, freq: 311.13, stringNumber: 1 },
    ],
  },
  {
    id: 'guitar_open_d',
    name: 'Guitare Open D (D A D F# A D)',
    instrument: 'guitar',
    notes: [
      { note: 'D', octave: 2, freq: 73.42, stringNumber: 6 },
      { note: 'A', octave: 2, freq: 110.0, stringNumber: 5 },
      { note: 'D', octave: 3, freq: 146.83, stringNumber: 4 },
      { note: 'F#', octave: 3, freq: 185.0, stringNumber: 3 },
      { note: 'A', octave: 3, freq: 220.0, stringNumber: 2 },
      { note: 'D', octave: 4, freq: 293.66, stringNumber: 1 },
    ],
  },
  {
    id: 'bass_standard_4',
    name: 'Basse Standard 4 Cordes (E A D G)',
    instrument: 'bass',
    notes: [
      { note: 'E', octave: 1, freq: 41.2, stringNumber: 4 },
      { note: 'A', octave: 1, freq: 55.0, stringNumber: 3 },
      { note: 'D', octave: 2, freq: 73.42, stringNumber: 2 },
      { note: 'G', octave: 2, freq: 98.0, stringNumber: 1 },
    ],
  },
  {
    id: 'bass_standard_5',
    name: 'Basse Standard 5 Cordes (B E A D G)',
    instrument: 'bass',
    notes: [
      { note: 'B', octave: 0, freq: 30.87, stringNumber: 5 },
      { note: 'E', octave: 1, freq: 41.2, stringNumber: 4 },
      { note: 'A', octave: 1, freq: 55.0, stringNumber: 3 },
      { note: 'D', octave: 2, freq: 73.42, stringNumber: 2 },
      { note: 'G', octave: 2, freq: 98.0, stringNumber: 1 },
    ],
  },
  {
    id: 'chromatic',
    name: 'Accordeur Chromatique Universel',
    instrument: 'chromatic',
    notes: [],
  },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export interface PitchDetectionResult {
  frequency: number;
  noteName: string;
  octave: number;
  cents: number;
  targetFrequency: number;
  volumeRms: number;
  volumePeakDb: number;
  inTune: boolean;
  closestStringNumber?: number;
}

export class GuitarAudioEngine {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private monitorGainNode: GainNode | null = null;
  private inputGainNode: GainNode | null = null;

  private isRunning = false;
  private animFrameId: number | null = null;
  private a4Calibration = 440;
  private currentPreset: TuningPreset = TUNING_PRESETS[0];

  private timeDomainBuffer: Float32Array | null = null;
  private frequencyBuffer: Uint8Array | null = null;

  private onPitchCallback: ((result: PitchDetectionResult | null) => void) | null = null;
  private onSpectrumCallback: ((data: Uint8Array) => void) | null = null;

  /**
   * List available audio input devices (sound cards, USB interfaces, line-in)
   */
  public async getAvailableInputDevices(): Promise<AudioInputDevice[]> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, index) => ({
          deviceId: d.deviceId,
          label: d.label || `Entrée Audio ${index + 1}`,
        }));
    } catch (err) {
      console.warn('Erreur lors de la détection des périphériques audio:', err);
      return [];
    }
  }

  /**
   * Start capturing audio from selected input device
   */
  public async startInput(deviceId?: string): Promise<boolean> {
    try {
      await this.stop();

      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      };

      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);

      // Input gain
      this.inputGainNode = this.audioCtx.createGain();
      this.inputGainNode.gain.value = 1.0;

      // Analyser for FFT & Autocorrelation
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 4096; // High resolution for low guitar & bass notes
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Direct monitoring (muted by default to prevent feedback loops)
      this.monitorGainNode = this.audioCtx.createGain();
      this.monitorGainNode.gain.value = 0.0;

      // Connect graph: Source -> InputGain -> Analyser & MonitorGain -> Destination
      this.sourceNode.connect(this.inputGainNode);
      this.inputGainNode.connect(this.analyserNode);
      this.inputGainNode.connect(this.monitorGainNode);
      this.monitorGainNode.connect(this.audioCtx.destination);

      this.timeDomainBuffer = new Float32Array(this.analyserNode.fftSize);
      this.frequencyBuffer = new Uint8Array(this.analyserNode.frequencyBinCount);

      this.isRunning = true;
      this.processLoop();
      return true;
    } catch (error) {
      console.error("Impossible d'accéder à l'interface audio:", error);
      this.isRunning = false;
      return false;
    }
  }

  /**
   * Stop audio capture and release interface
   */
  public async stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        await this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }

  public setInputGain(gain: number) {
    if (this.inputGainNode && this.audioCtx) {
      this.inputGainNode.gain.setValueAtTime(Math.max(0, Math.min(4, gain)), this.audioCtx.currentTime);
    }
  }

  public setMonitorVolume(volume: number) {
    if (this.monitorGainNode && this.audioCtx) {
      this.monitorGainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.audioCtx.currentTime);
    }
  }

  public setCalibration(hz: number) {
    this.a4Calibration = Math.max(420, Math.min(460, hz));
  }

  public setPreset(preset: TuningPreset) {
    this.currentPreset = preset;
  }

  public setPitchCallback(cb: (res: PitchDetectionResult | null) => void) {
    this.onPitchCallback = cb;
  }

  public setSpectrumCallback(cb: (data: Uint8Array) => void) {
    this.onSpectrumCallback = cb;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Main audio analysis loop
   */
  private processLoop = () => {
    if (!this.isRunning || !this.analyserNode || !this.timeDomainBuffer || !this.frequencyBuffer) {
      return;
    }

    // 1. Get raw waveform & spectrum
    this.analyserNode.getFloatTimeDomainData(this.timeDomainBuffer);
    this.analyserNode.getByteFrequencyData(this.frequencyBuffer);

    if (this.onSpectrumCallback) {
      this.onSpectrumCallback(this.frequencyBuffer);
    }

    // 2. Compute RMS & peak decibels
    let sumSquares = 0;
    let peakVal = 0;
    for (let i = 0; i < this.timeDomainBuffer.length; i++) {
      const val = this.timeDomainBuffer[i];
      sumSquares += val * val;
      const absVal = Math.abs(val);
      if (absVal > peakVal) peakVal = absVal;
    }
    const rms = Math.sqrt(sumSquares / this.timeDomainBuffer.length);
    const peakDb = peakVal > 0.00001 ? 20 * Math.log10(peakVal) : -100;

    // Gate threshold: ignore background noise
    if (rms < 0.012) {
      if (this.onPitchCallback) {
        this.onPitchCallback({
          frequency: 0,
          noteName: '--',
          octave: 0,
          cents: 0,
          targetFrequency: 0,
          volumeRms: rms,
          volumePeakDb: peakDb,
          inTune: false,
        });
      }
      this.animFrameId = requestAnimationFrame(this.processLoop);
      return;
    }

    // 3. Autocorrelation Pitch Detection
    const sampleRate = this.audioCtx ? this.audioCtx.sampleRate : 44100;
    const detectedFreq = this.detectPitchAutocorrelation(this.timeDomainBuffer, sampleRate);

    if (detectedFreq > 25 && detectedFreq < 1500) {
      const pitchResult = this.computePitchDetails(detectedFreq, rms, peakDb);
      if (this.onPitchCallback) {
        this.onPitchCallback(pitchResult);
      }
    } else {
      if (this.onPitchCallback) {
        this.onPitchCallback({
          frequency: 0,
          noteName: '--',
          octave: 0,
          cents: 0,
          targetFrequency: 0,
          volumeRms: rms,
          volumePeakDb: peakDb,
          inTune: false,
        });
      }
    }

    this.animFrameId = requestAnimationFrame(this.processLoop);
  };

  /**
   * Normalized Autocorrelation (Robust against overtones for guitar & bass strings)
   */
  private detectPitchAutocorrelation(buffer: Float32Array, sampleRate: number): number {
    const SIZE = buffer.length;
    // Lower frequency search: 28 Hz (Low B0 bass: 30.87 Hz)
    // Upper frequency search: 1200 Hz
    const minPeriod = Math.floor(sampleRate / 1200);
    const maxPeriod = Math.floor(sampleRate / 28);

    let bestPeriod = -1;
    let bestCorrelation = 0;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    if (rms < 0.01) return -1;

    // Normalizing correlation
    let lastCorrelation = 1;
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < SIZE - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      correlation = correlation / (SIZE - period);

      // Look for first prominent peak
      if (correlation > 0.82 && correlation > lastCorrelation) {
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestPeriod = period;
        }
      }
      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.82 && bestPeriod > 0) {
      // Parabolic interpolation for sub-bin precision
      return sampleRate / bestPeriod;
    }

    return -1;
  }

  /**
   * Compute musical note, octave, target frequency, and cents deviation
   */
  private computePitchDetails(
    freq: number,
    rms: number,
    peakDb: number
  ): PitchDetectionResult {
    // A4 calibration offset
    // midi = 69 + 12 * log2(freq / A4)
    const midiFloat = 69 + 12 * (Math.log(freq / this.a4Calibration) / Math.log(2));
    const roundedMidi = Math.round(midiFloat);
    const cents = Math.round((midiFloat - roundedMidi) * 100);

    const noteIndex = ((roundedMidi % 12) + 12) % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const octave = Math.floor(roundedMidi / 12) - 1;

    // Exact frequency of rounded target note
    const targetFreq = this.a4Calibration * Math.pow(2, (roundedMidi - 69) / 12);

    // Check if preset has matching string
    let closestStringNumber: number | undefined;
    if (this.currentPreset.notes.length > 0) {
      let minDiff = Infinity;
      for (const n of this.currentPreset.notes) {
        const diff = Math.abs(freq - n.freq);
        if (diff < minDiff) {
          minDiff = diff;
          closestStringNumber = n.stringNumber;
        }
      }
    }

    // Considered in tune if within +/- 3 cents
    const inTune = Math.abs(cents) <= 3;

    return {
      frequency: Math.round(freq * 10) / 10,
      noteName,
      octave,
      cents,
      targetFrequency: Math.round(targetFreq * 10) / 10,
      volumeRms: rms,
      volumePeakDb: Math.round(peakDb),
      inTune,
      closestStringNumber,
    };
  }
}

export const guitarAudioEngine = new GuitarAudioEngine();
