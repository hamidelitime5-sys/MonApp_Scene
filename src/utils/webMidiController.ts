/**
 * Hamide Litime Software - WebMIDI & Guitar Rig 7 Stage Controller
 * Controls Guitar Rig 7 (Standalone or VST host) via WebMIDI and virtual ports (loopMIDI).
 * Sends Program Changes (presets), Control Changes (pedals, bypass, tuner mute), and listens
 * for external MIDI foot controllers (FCB1010, Line6, MeloAudio, Boss).
 */

export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: string;
  connection: string;
}

export interface MidiMessageLog {
  id: string;
  timestamp: string;
  direction: 'sent' | 'received';
  type: string;
  channel: number;
  data: string;
}

export interface GuitarRigPresetShortcut {
  id: string;
  name: string;
  category: string;
  programChange: number; // 0 - 127
  bankMsb?: number;
  bankLsb?: number;
  color: string;
  description: string;
}

export const GUITAR_RIG_DEFAULT_PRESETS: GuitarRigPresetShortcut[] = [
  {
    id: 'clean_deluxe',
    name: 'Clean Deluxe Tube',
    category: 'Clean',
    programChange: 0,
    color: 'emerald',
    description: 'Son clair vintage chaud avec réverbe à ressort pour rythmiques et arpèges.',
  },
  {
    id: 'clean_chorus_80s',
    name: '80s Dream Chorus',
    category: 'Clean',
    programChange: 1,
    color: 'teal',
    description: 'Son cristallin stéréo inspiré de Roland JC-120 et Police.',
  },
  {
    id: 'crunch_plexi',
    name: 'British Plexi Crunch',
    category: 'Crunch',
    programChange: 2,
    color: 'amber',
    description: 'Dynamique au toucher, du blues léger au classic rock AC/DC.',
  },
  {
    id: 'overdrive_screamer',
    name: 'Tube Screamer Blues',
    category: 'Crunch',
    programChange: 3,
    color: 'yellow',
    description: 'Médiums perçants type Stevie Ray Vaughan sur ampli Fender à lampes.',
  },
  {
    id: 'high_gain_recto',
    name: 'Modern Recto High Gain',
    category: 'Lead & Heavy',
    programChange: 4,
    color: 'orange',
    description: 'Gros son métal moderne, bas puissant et saturation tranchante.',
  },
  {
    id: 'solo_lead_delay',
    name: 'Singing Solo Lead & Delay',
    category: 'Lead & Heavy',
    programChange: 5,
    color: 'red',
    description: 'Sustain infini, compression douce et delay stéréo pour solos épiques.',
  },
  {
    id: 'acoustic_simulator',
    name: 'Acoustic Piezo Sim',
    category: 'Spécial',
    programChange: 6,
    color: 'blue',
    description: 'Transforme le micro guitare électrique en sonorité électro-acoustique.',
  },
  {
    id: 'ambient_space',
    name: 'Ambient Shimmer Reverb',
    category: 'Spécial',
    programChange: 7,
    color: 'purple',
    description: 'Nappes célestes et modulations spatiales pour intros atmosphériques.',
  },
];

export class WebMidiController {
  private midiAccess: MIDIAccess | null = null;
  private selectedOutputId: string | null = null;
  private selectedInputId: string | null = null;
  private midiChannel = 1; // 1-16 (0-15 in raw bytes)

  private outputPorts: MidiPortInfo[] = [];
  private inputPorts: MidiPortInfo[] = [];
  private messageLogs: MidiMessageLog[] = [];

  private onStateChangeCallback: (() => void) | null = null;
  private onIncomingMidiCallback: ((cmd: { type: string; noteOrCc: number; value: number }) => void) | null = null;

  /**
   * Request WebMIDI access from browser
   */
  public async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn('WebMIDI API non supportée sur ce navigateur.');
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.refreshPorts();

      this.midiAccess.onstatechange = () => {
        this.refreshPorts();
        if (this.onStateChangeCallback) this.onStateChangeCallback();
      };

      // Auto-select loopMIDI or first available port if none selected
      this.autoSelectPorts();
      return true;
    } catch (err) {
      console.warn('Accès WebMIDI refusé ou indisponible:', err);
      return false;
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.requestMIDIAccess;
  }

  public isConnected(): boolean {
    return !!this.midiAccess && this.outputPorts.length > 0;
  }

  public getOutputPorts(): MidiPortInfo[] {
    return this.outputPorts;
  }

  public getInputPorts(): MidiPortInfo[] {
    return this.inputPorts;
  }

  public getSelectedOutputId(): string | null {
    return this.selectedOutputId;
  }

  public getSelectedInputId(): string | null {
    return this.selectedInputId;
  }

  public getMidiChannel(): number {
    return this.midiChannel;
  }

  public setMidiChannel(ch: number) {
    this.midiChannel = Math.max(1, Math.min(16, ch));
  }

  public getLogs(): MidiMessageLog[] {
    return this.messageLogs;
  }

  public clearLogs() {
    this.messageLogs = [];
  }

  public setOnStateChange(cb: () => void) {
    this.onStateChangeCallback = cb;
  }

  public setOnIncomingMidi(cb: (cmd: { type: string; noteOrCc: number; value: number }) => void) {
    this.onIncomingMidiCallback = cb;
  }

  public selectOutput(portId: string | null) {
    this.selectedOutputId = portId;
  }

  public selectInput(portId: string | null) {
    if (this.selectedInputId && this.midiAccess) {
      const prevPort = this.midiAccess.inputs.get(this.selectedInputId);
      if (prevPort) {
        prevPort.onmidimessage = null;
      }
    }

    this.selectedInputId = portId;

    if (portId && this.midiAccess) {
      const newPort = this.midiAccess.inputs.get(portId);
      if (newPort) {
        newPort.onmidimessage = (event: MIDIMessageEvent) => this.handleIncomingMessage(event);
      }
    }
  }

  /**
   * Send MIDI Program Change (0 - 127) to switch presets in Guitar Rig 7
   */
  public sendProgramChange(programNumber: number, bankMsb?: number, bankLsb?: number): boolean {
    const output = this.getOutput();
    if (!output) return false;

    const channelIndex = this.midiChannel - 1; // 0-15
    const pc = Math.max(0, Math.min(127, programNumber));

    // Optional Bank Select MSB (CC #0) & LSB (CC #32)
    if (bankMsb !== undefined) {
      output.send([0xb0 | channelIndex, 0x00, Math.max(0, Math.min(127, bankMsb))]);
    }
    if (bankLsb !== undefined) {
      output.send([0xb0 | channelIndex, 0x20, Math.max(0, Math.min(127, bankLsb))]);
    }

    // Program Change: 0xC0 | channel, program
    output.send([0xc0 | channelIndex, pc]);

    this.addLog(
      'sent',
      'Program Change',
      this.midiChannel,
      `PC #${pc} (Preset ${pc + 1})${bankMsb !== undefined ? ` [Bank ${bankMsb}]` : ''}`
    );
    return true;
  }

  /**
   * Send MIDI Control Change (0 - 127) for pedals, wah, boost, tuner mute
   */
  public sendControlChange(ccNumber: number, value: number): boolean {
    const output = this.getOutput();
    if (!output) return false;

    const channelIndex = this.midiChannel - 1;
    const cc = Math.max(0, Math.min(127, ccNumber));
    const val = Math.max(0, Math.min(127, value));

    // Control Change: 0xB0 | channel, cc, value
    output.send([0xb0 | channelIndex, cc, val]);

    this.addLog('sent', 'Control Change', this.midiChannel, `CC #${cc} = ${val}`);
    return true;
  }

  /**
   * Send All Notes Off & Sound Off emergency panic
   */
  public sendPanic(): boolean {
    const output = this.getOutput();
    if (!output) return false;

    const channelIndex = this.midiChannel - 1;
    // CC 120 (All Sound Off), CC 123 (All Notes Off)
    output.send([0xb0 | channelIndex, 120, 0]);
    output.send([0xb0 | channelIndex, 123, 0]);

    this.addLog('sent', 'Panic', this.midiChannel, 'All Notes Off (CC 120 & 123)');
    return true;
  }

  private getOutput(): MIDIOutput | null {
    if (!this.midiAccess) return null;
    if (this.selectedOutputId) {
      const port = this.midiAccess.outputs.get(this.selectedOutputId);
      if (port) return port;
    }
    // Fallback: first available output
    const first = this.midiAccess.outputs.values().next().value;
    return first || null;
  }

  private refreshPorts() {
    if (!this.midiAccess) return;

    this.outputPorts = [];
    this.midiAccess.outputs.forEach((port) => {
      this.outputPorts.push({
        id: port.id,
        name: port.name || 'Port MIDI Sortie',
        manufacturer: port.manufacturer,
        state: port.state,
        connection: port.connection,
      });
    });

    this.inputPorts = [];
    this.midiAccess.inputs.forEach((port) => {
      this.inputPorts.push({
        id: port.id,
        name: port.name || 'Port MIDI Entrée',
        manufacturer: port.manufacturer,
        state: port.state,
        connection: port.connection,
      });
    });
  }

  private autoSelectPorts() {
    // Prefer loopMIDI or virtual port if present
    const loopOut = this.outputPorts.find(
      (p) =>
        p.name.toLowerCase().includes('loopmidi') ||
        p.name.toLowerCase().includes('guitar rig') ||
        p.name.toLowerCase().includes('virtual')
    );
    if (loopOut) {
      this.selectedOutputId = loopOut.id;
    } else if (this.outputPorts.length > 0 && !this.selectedOutputId) {
      this.selectedOutputId = this.outputPorts[0].id;
    }

    const loopIn = this.inputPorts.find(
      (p) =>
        p.name.toLowerCase().includes('loopmidi') ||
        p.name.toLowerCase().includes('pedal') ||
        p.name.toLowerCase().includes('commander')
    );
    if (loopIn) {
      this.selectInput(loopIn.id);
    } else if (this.inputPorts.length > 0 && !this.selectedInputId) {
      this.selectInput(this.inputPorts[0].id);
    }
  }

  private handleIncomingMessage(event: MIDIMessageEvent) {
    if (!event.data || event.data.length < 2) return;
    const status = event.data[0];
    const data1 = event.data[1];
    const data2 = event.data.length > 2 ? event.data[2] : 0;

    const messageType = status & 0xf0;
    const channel = (status & 0x0f) + 1;

    let typeStr = 'MIDI';
    if (messageType === 0x90) typeStr = data2 > 0 ? 'Note On' : 'Note Off';
    else if (messageType === 0x80) typeStr = 'Note Off';
    else if (messageType === 0xb0) typeStr = 'Control Change';
    else if (messageType === 0xc0) typeStr = 'Program Change';

    this.addLog('received', typeStr, channel, `#${data1} val=${data2}`);

    if (this.onIncomingMidiCallback) {
      this.onIncomingMidiCallback({
        type: typeStr,
        noteOrCc: data1,
        value: data2,
      });
    }
  }

  private addLog(
    direction: 'sent' | 'received',
    type: string,
    channel: number,
    data: string
  ) {
    const timeStr = new Date().toLocaleTimeString();
    const entry: MidiMessageLog = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: timeStr,
      direction,
      type,
      channel,
      data,
    };
    this.messageLogs = [entry, ...this.messageLogs].slice(0, 50);
  }
}

export const webMidiController = new WebMidiController();
