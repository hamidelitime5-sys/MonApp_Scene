export type NotationMode = 'standard' | 'solfege' | 'german' | 'nashville';

export interface SimpleSongInstrumentsConfig {
  titre?: string;
  fichier_midi?: string;
  fichier_sampler?: string; // e.g. "couleur_cafe.vs3" on second hard drive (D:)
  fichier_instrument?: string; // Legacy fallback
  instruments?: Record<string, number>;
}

export interface VSamplerChannelConfig {
  channel: number; // 0 to 15 (MIDI Channel 1 to 16)
  enabled: boolean;
  name: string; // e.g. "Piano Montuno", "Basse Acoustique", "Cuivres", "Batterie"
  program: number; // 0 to 127
  bankMsb: number; // CC 0 (default 0 or 127 for drums)
  bankLsb: number; // CC 32 (default 0)
  volume: number; // 0 to 127 (default 100)
  pan: number; // 0 to 127 (default 64 = Center)
  reverb?: number; // CC 91 (default 40)
  chorus?: number; // CC 93 (default 0)
}

export interface VSamplerSongConfig {
  enabled: boolean; // Auto-send when song is loaded
  fichier_sampler?: string; // Relative filename e.g. "couleur_cafe.vs3" inside the song's folder on drive D:
  fichier_instrument?: string; // Legacy / alternate path
  dossier_racine?: string; // Optional custom root directory override
  masterPresetName?: string; // e.g. "Couleur Café VSampler Multi"
  masterProgramChange?: number; // Optional Master PC (e.g. on Channel 16 or omni to recall a Multi/Performance)
  channels: VSamplerChannelConfig[]; // 16 channel configs
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  key: string; // e.g. "G", "Am", "E"
  bpm: number;
  timeSignature: string; // e.g. "4/4", "3/4"
  durationSeconds: number; // e.g. 210 for 3m 30s
  introDelaySeconds?: number; // Intro offset before singing starts (e.g. 15s)
  capo?: number; // e.g. 2
  tuning?: string; // e.g. "Standard (E A D G B E)"
  chordProContent: string; // Lyrics with [Chord] embedded or line-above
  notes?: string;
  jamTrackUrl?: string; // YouTube or MP3 audio link for Jam Track / Backing Track
  jamTrackStyle?: string; // Style label e.g. "Blues Rock 120BPM"
  midiData?: string; // Base64 encoded MIDI file for multi-track playback
  midiFileName?: string; // Original MIDI file name
  midiSoundfontName?: string; // Associated soundfont info
  fichier_sampler?: string; // Relative .vs3 or .vsp file name stored in the song's folder on the 2nd drive (e.g. "couleur_cafe.vs3")
  fichier_instrument?: string; // Legacy / alternate field
  vSamplerConfig?: VSamplerSongConfig; // Per-song VSampler 3 instrument routing
  simpleInstruments?: Record<string, number>; // Concise format e.g. {"canal_1": 33, "canal_3": 22, "canal_10": 0}
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface SetlistEntry {
  id: string;
  type: 'song' | 'interlude';
  songId?: string;
  targetKey?: string; // override default song key for this setlist
  capo?: number;
  interludeTitle?: string;
  interludeDurationSeconds?: number;
  notes?: string; // e.g. "Guitar swap / 2 min speech"
}

export interface Setlist {
  id: string;
  name: string;
  venue?: string;
  date?: string;
  targetDurationMinutes?: number;
  entries: SetlistEntry[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ChordPosition {
  string: number; // 1 to 6 (1 = high E, 6 = low E)
  fret: number; // 0 = open, -1 = muted, 1..24
  finger?: number; // 1 = index, 2 = middle, 3 = ring, 4 = pinky
}

export interface GuitarChordData {
  chordName: string;
  baseFret: number; // The starting fret of the 5-fret diagram window (e.g. 1, 2, 3, 5, 7)
  positions: ChordPosition[]; // 6 strings
  barreFret?: number; // Fret on which index finger bars (e.g. 1, 2, 3...)
  barreStartString?: number; // default 6 (Low E) or 5 (A)
  barreEndString?: number; // default 1 (High E)
  voicingLabel?: string; // e.g. "Position standard (Case 1)", "Barré Forme La (Case 2)"
  noteNames?: string[]; // Evaluated note on each string from 6 down to 1
  voicings?: GuitarChordData[]; // Alternate positions on neck
}

export interface PianoChordData {
  chordName: string;
  notes: string[]; // e.g. ["C", "E", "G"] or ["C4", "E4", "G4"]
  voicingLabel?: string;
}

export interface StageSettings {
  autoScrollSpeed: number; // px per second
  fontSize: number; // rem multiplier e.g. 1, 1.25, 1.5
  darkStageMode: boolean;
  showMetronomePulse: boolean;
  metronomeVolume: number;
  notationMode: NotationMode;
}
