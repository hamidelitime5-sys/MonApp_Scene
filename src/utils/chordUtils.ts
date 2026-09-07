import { GuitarChordData, NotationMode, PianoChordData } from '../types';

export const CHROMATIC_SCALE_SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const CHROMATIC_SCALE_FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const SOLFEGE_MAP: Record<string, string> = {
  'C': 'Do', 'C#': 'Do#', 'Db': 'Reb', 'D': 'Re', 'D#': 'Re#', 'Eb': 'Mib',
  'E': 'Mi', 'F': 'Fa', 'F#': 'Fa#', 'Gb': 'Solb', 'G': 'Sol', 'G#': 'Sol#',
  'Ab': 'Lab', 'A': 'La', 'A#': 'La#', 'Bb': 'Sib', 'B': 'Si'
};

export const GERMAN_MAP: Record<string, string> = {
  'B': 'H', 'Bb': 'B'
};

/**
 * Normalizes root note to semitone index (0 to 11)
 */
export function getNoteIndex(note: string): number {
  const cleanNote = note.trim();
  let idx = CHROMATIC_SCALE_SHARPS.indexOf(cleanNote);
  if (idx !== -1) return idx;
  idx = CHROMATIC_SCALE_FLATS.indexOf(cleanNote);
  return idx !== -1 ? idx : 0;
}

/**
 * Parses a chord string like "Am7", "F#m", "Bb/D", "Cmaj7" into root, quality, and bass note.
 */
export function parseChord(chordStr: string) {
  const slashIdx = chordStr.indexOf('/');
  let mainChord = chordStr;
  let bassNote = '';

  if (slashIdx !== -1) {
    mainChord = chordStr.substring(0, slashIdx);
    bassNote = chordStr.substring(slashIdx + 1);
  }

  const match = mainChord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return { root: chordStr, quality: '', bassNote };

  return {
    root: match[1],
    quality: match[2],
    bassNote
  };
}

/**
 * Transposes a single note by semitones offset (-12 to +12)
 */
export function transposeNote(note: string, semitones: number, useFlats = false): string {
  if (!note) return '';
  const cleanNote = note.trim();
  const match = cleanNote.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return note;

  const root = match[1];
  const suffix = match[2];
  const idx = getNoteIndex(root);
  let newIdx = (idx + semitones) % 12;
  if (newIdx < 0) newIdx += 12;

  const scale = useFlats ? CHROMATIC_SCALE_FLATS : CHROMATIC_SCALE_SHARPS;
  return scale[newIdx] + suffix;
}

/**
 * Transposes a full chord name (e.g. "Am7/G") by semitones
 */
export function transposeChord(chord: string, semitones: number, useFlats = false): string {
  if (semitones === 0) return chord;
  const { root, quality, bassNote } = parseChord(chord);
  const newRoot = transposeNote(root, semitones, useFlats);
  const newBass = bassNote ? transposeNote(bassNote, semitones, useFlats) : '';
  
  return newRoot + quality + (newBass ? '/' + newBass : '');
}

/**
 * Converts a chord to selected Notation mode
 */
export function formatChordNotation(chord: string, mode: NotationMode, songKey = 'C'): string {
  if (mode === 'standard') return chord;
  
  const { root, quality, bassNote } = parseChord(chord);

  if (mode === 'solfege') {
    const solRoot = SOLFEGE_MAP[root] || root;
    const solBass = bassNote ? (SOLFEGE_MAP[bassNote] || bassNote) : '';
    return solRoot + quality + (solBass ? '/' + solBass : '');
  }

  if (mode === 'german') {
    const gerRoot = GERMAN_MAP[root] || root;
    const gerBass = bassNote ? (GERMAN_MAP[bassNote] || bassNote) : '';
    return gerRoot + quality + (gerBass ? '/' + gerBass : '');
  }

  if (mode === 'nashville') {
    const keyIdx = getNoteIndex(songKey.replace('m', ''));
    const chordIdx = getNoteIndex(root);
    let diff = (chordIdx - keyIdx) % 12;
    if (diff < 0) diff += 12;

    const nashvilleNumbers: Record<number, string> = {
      0: '1', 1: '1#', 2: '2', 3: '3b', 4: '3', 5: '4', 6: '4#', 7: '5', 8: '6b', 9: '6', 10: '7b', 11: '7'
    };
    const num = nashvilleNumbers[diff] || '1';
    return num + quality;
  }

  return chord;
}

/**
 * Formats seconds into MM:SS.d format (e.g. 01:23.5)
 */
export function formatTimeWithTenths(secs: number): string {
  if (isNaN(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = (secs % 60);
  const sInt = Math.floor(s);
  const tenths = Math.floor((s - sInt) * 10);
  return `${m < 10 ? '0' : ''}${m}:${sInt < 10 ? '0' : ''}${sInt}.${tenths}`;
}

/**
 * Formats seconds into standard MM:SS format (e.g. 01:23)
 */
export function formatTimeMMSS(secs: number): string {
  if (isNaN(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Parses a time string (e.g. "01:23.5", "1:23", "83.5", "00:15") into seconds
 */
export function parseTimeStringToSeconds(timeStr: string): number | undefined {
  if (!timeStr) return undefined;
  const clean = timeStr.trim();
  
  // Format MM:SS.s or M:SS.s or MM:SS
  const mmssMatch = clean.match(/^(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/);
  if (mmssMatch) {
    const mins = parseFloat(mmssMatch[1]);
    const secs = parseFloat(mmssMatch[2]);
    if (!isNaN(mins) && !isNaN(secs)) {
      return Number((mins * 60 + secs).toFixed(2));
    }
  }

  // Raw seconds format e.g. "83.5" or "45"
  const rawSec = parseFloat(clean);
  if (!isNaN(rawSec) && rawSec >= 0) {
    return Number(rawSec.toFixed(2));
  }

  return undefined;
}

/**
 * Extracts tagged timestamp from a single ChordPro line if present
 */
export function extractLineTimestamp(line: string): { taggedSeconds?: number; cleanLine: string } {
  const timeMatch = line.match(/(?:\{time:\s*|\[@)(\d{1,3}:\d{1,2}(?:\.\d+)?|\d+(?:\.\d+)?)(?:\}|\])/i);
  if (!timeMatch) {
    return { cleanLine: line };
  }

  const taggedSeconds = parseTimeStringToSeconds(timeMatch[1]);
  const cleanLine = line.replace(/(?:\{time:\s*|\[@)(\d{1,3}:\d{1,2}(?:\.\d+)?|\d+(?:\.\d+)?)(?:\}|\])\s*/gi, '').trim();
  return { taggedSeconds, cleanLine };
}

/**
 * Embeds or removes timestamp on a ChordPro line
 */
export function setLineTimestamp(line: string, seconds?: number): string {
  const cleaned = line.replace(/(?:\{time:\s*|\[@)(\d{1,3}:\d{1,2}(?:\.\d+)?|\d+(?:\.\d+)?)(?:\}|\])\s*/gi, '').trim();
  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds < 0) {
    return cleaned;
  }
  const formatted = formatTimeWithTenths(seconds);
  return `{time: ${formatted}} ${cleaned}`;
}

/**
 * Transposes all bracketed chords in ChordPro text e.g. "Hello [Am] world [G/B]"
 */
export function transposeChordPro(content: string, semitones: number, notationMode: NotationMode = 'standard', songKey = 'C'): string {
  return content.replace(/\[([A-G][#b]?[^\]]*)\]/g, (_, chordStr) => {
    const transposed = transposeChord(chordStr, semitones);
    const formatted = formatChordNotation(transposed, notationMode, songKey);
    return `[${formatted}]`;
  });
}

/**
 * Calculates semitone distance between two key signatures
 */
export function getKeyDistance(fromKey: string, toKey: string): number {
  const cleanFrom = fromKey.replace('m', '');
  const cleanTo = toKey.replace('m', '');
  const fromIdx = getNoteIndex(cleanFrom);
  const toIdx = getNoteIndex(cleanTo);
  let diff = toIdx - fromIdx;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

/**
 * Standard open tuning MIDI values & notes for guitar (E2, A2, D3, G3, B3, E4)
 */
export const GUITAR_STRING_OPEN_MIDI: Record<number, number> = {
  6: 40, // E2
  5: 45, // A2
  4: 50, // D3
  3: 55, // G3
  2: 59, // B3
  1: 64, // E4
};

export const GUITAR_STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'E']; // string 6 down to 1

/**
 * Returns note name for a given string and fret
 */
export function getNoteForStringAndFret(stringNum: number, fret: number): string {
  if (fret === -1) return '×';
  const openMidi = GUITAR_STRING_OPEN_MIDI[stringNum] || 40;
  const noteIdx = (openMidi + fret) % 12;
  return CHROMATIC_SCALE_SHARPS[noteIdx];
}

/**
 * Evaluates note names produced across all 6 strings for a given chord configuration
 */
export function evaluateChordNotes(positions: { string: number; fret: number }[]): string[] {
  const noteMap: Record<number, string> = {};
  positions.forEach((p) => {
    noteMap[p.string] = getNoteForStringAndFret(p.string, p.fret);
  });
  return [
    noteMap[6] || '×',
    noteMap[5] || '×',
    noteMap[4] || '×',
    noteMap[3] || '×',
    noteMap[2] || '×',
    noteMap[1] || '×',
  ];
}

/**
 * Guitar chord dictionary with baseFret (Case), positions, barre information and voicings
 */
export const GUITAR_CHORD_DICT: Record<string, GuitarChordData> = {
  // --- DO / C ---
  'C': {
    chordName: 'C',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'C', 'E', 'G', 'C', 'E'],
  },
  'Cm': {
    chordName: 'Cm',
    baseFret: 3,
    barreFret: 3,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 3)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 1 }, { string: 4, fret: 5, finger: 3 }, { string: 3, fret: 5, finger: 4 }, { string: 2, fret: 4, finger: 2 }, { string: 1, fret: 3, finger: 1 }],
    noteNames: ['×', 'C', 'G', 'C', 'Eb', 'G'],
  },
  'C7': {
    chordName: 'C7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 3, finger: 4 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'C', 'E', 'Bb', 'C', 'E'],
  },
  'Cmaj7': {
    chordName: 'Cmaj7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'C', 'E', 'G', 'B', 'E'],
  },
  'Cm7': {
    chordName: 'Cm7',
    baseFret: 3,
    barreFret: 3,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 3)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 1 }, { string: 4, fret: 5, finger: 3 }, { string: 3, fret: 3, finger: 1 }, { string: 2, fret: 4, finger: 2 }, { string: 1, fret: 3, finger: 1 }],
    noteNames: ['×', 'C', 'G', 'Bb', 'Eb', 'G'],
  },
  'Csus4': {
    chordName: 'Csus4',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 3, finger: 4 }, { string: 3, fret: 0 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['×', 'C', 'F', 'G', 'C', 'F'],
  },
  'Cadd9': {
    chordName: 'Cadd9',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 3, finger: 2 }, { string: 4, fret: 2, finger: 1 }, { string: 3, fret: 0 }, { string: 2, fret: 3, finger: 3 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'C', 'E', 'G', 'D', 'E'],
  },

  // --- RE / D ---
  'D': {
    chordName: 'D',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 3, finger: 3 }, { string: 1, fret: 2, finger: 2 }],
    noteNames: ['×', '×', 'D', 'A', 'D', 'F#'],
  },
  'Dm': {
    chordName: 'Dm',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 3, finger: 3 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['×', '×', 'D', 'A', 'D', 'F'],
  },
  'D7': {
    chordName: 'D7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 2, finger: 3 }],
    noteNames: ['×', '×', 'D', 'A', 'C', 'F#'],
  },
  'Dmaj7': {
    chordName: 'Dmaj7',
    baseFret: 1,
    barreFret: 2,
    barreStartString: 3,
    barreEndString: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 2, finger: 1 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['×', '×', 'D', 'A', 'C#', 'F#'],
  },
  'Dm7': {
    chordName: 'Dm7',
    baseFret: 1,
    barreFret: 1,
    barreStartString: 2,
    barreEndString: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['×', '×', 'D', 'A', 'C', 'F'],
  },
  'Dsus2': {
    chordName: 'Dsus2',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 3, finger: 3 }, { string: 1, fret: 0 }],
    noteNames: ['×', '×', 'D', 'A', 'D', 'E'],
  },
  'Dsus4': {
    chordName: 'Dsus4',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 0 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 3, finger: 2 }, { string: 1, fret: 3, finger: 4 }],
    noteNames: ['×', '×', 'D', 'A', 'D', 'G'],
  },

  // --- MI / E ---
  'E': {
    chordName: 'E',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 0 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 2, finger: 3 }, { string: 3, fret: 1, finger: 1 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['E', 'B', 'E', 'G#', 'B', 'E'],
  },
  'Em': {
    chordName: 'Em',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 0 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['E', 'B', 'E', 'G', 'B', 'E'],
  },
  'E7': {
    chordName: 'E7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 0 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 0 }, { string: 3, fret: 1, finger: 1 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['E', 'B', 'D', 'G#', 'B', 'E'],
  },
  'Em7': {
    chordName: 'Em7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 0 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['E', 'B', 'D', 'G', 'B', 'E'],
  },
  'Emaj7': {
    chordName: 'Emaj7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 0 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 1, finger: 1 }, { string: 3, fret: 1, finger: 1 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['E', 'B', 'D#', 'G#', 'B', 'E'],
  },
  'Esus4': {
    chordName: 'Esus4',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 0 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 2, finger: 3 }, { string: 3, fret: 2, finger: 4 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['E', 'B', 'E', 'A', 'B', 'E'],
  },

  // --- FA / F ---
  'F': {
    chordName: 'F',
    baseFret: 1,
    barreFret: 1,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 1)',
    positions: [{ string: 6, fret: 1, finger: 1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 3, finger: 4 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['F', 'C', 'F', 'A', 'C', 'F'],
  },
  'Fm': {
    chordName: 'Fm',
    baseFret: 1,
    barreFret: 1,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 1)',
    positions: [{ string: 6, fret: 1, finger: 1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 3, finger: 4 }, { string: 3, fret: 1, finger: 1 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['F', 'C', 'F', 'Ab', 'C', 'F'],
  },
  'F7': {
    chordName: 'F7',
    baseFret: 1,
    barreFret: 1,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 1)',
    positions: [{ string: 6, fret: 1, finger: 1 }, { string: 5, fret: 3, finger: 3 }, { string: 4, fret: 1, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['F', 'C', 'Eb', 'A', 'C', 'F'],
  },
  'Fmaj7': {
    chordName: 'Fmaj7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: -1 }, { string: 4, fret: 3, finger: 3 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 0 }],
    noteNames: ['×', '×', 'F', 'A', 'C', 'E'],
  },
  'F#': {
    chordName: 'F#',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 2)',
    positions: [{ string: 6, fret: 2, finger: 1 }, { string: 5, fret: 4, finger: 3 }, { string: 4, fret: 4, finger: 4 }, { string: 3, fret: 3, finger: 2 }, { string: 2, fret: 2, finger: 1 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['F#', 'C#', 'F#', 'A#', 'C#', 'F#'],
  },
  'F#m': {
    chordName: 'F#m',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 2)',
    positions: [{ string: 6, fret: 2, finger: 1 }, { string: 5, fret: 4, finger: 3 }, { string: 4, fret: 4, finger: 4 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 2, finger: 1 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['F#', 'C#', 'F#', 'A', 'C#', 'F#'],
  },
  'F#7': {
    chordName: 'F#7',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 2)',
    positions: [{ string: 6, fret: 2, finger: 1 }, { string: 5, fret: 4, finger: 3 }, { string: 4, fret: 2, finger: 1 }, { string: 3, fret: 3, finger: 2 }, { string: 2, fret: 2, finger: 1 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['F#', 'C#', 'E', 'A#', 'C#', 'F#'],
  },
  'F#m7': {
    chordName: 'F#m7',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 2)',
    positions: [{ string: 6, fret: 2, finger: 1 }, { string: 5, fret: 4, finger: 3 }, { string: 4, fret: 2, finger: 1 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 2, finger: 1 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['F#', 'C#', 'E', 'A', 'C#', 'F#'],
  },

  // --- SOL / G ---
  'G': {
    chordName: 'G',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 3, finger: 2 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 3, finger: 3 }],
    noteNames: ['G', 'B', 'D', 'G', 'B', 'G'],
  },
  'Gm': {
    chordName: 'Gm',
    baseFret: 3,
    barreFret: 3,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 3)',
    positions: [{ string: 6, fret: 3, finger: 1 }, { string: 5, fret: 5, finger: 3 }, { string: 4, fret: 5, finger: 4 }, { string: 3, fret: 3, finger: 1 }, { string: 2, fret: 3, finger: 1 }, { string: 1, fret: 3, finger: 1 }],
    noteNames: ['G', 'D', 'G', 'Bb', 'D', 'G'],
  },
  'G7': {
    chordName: 'G7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 3, finger: 3 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['G', 'B', 'D', 'G', 'B', 'F'],
  },
  'Gmaj7': {
    chordName: 'Gmaj7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: 3, finger: 2 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 2, finger: 3 }],
    noteNames: ['G', 'B', 'D', 'G', 'B', 'F#'],
  },
  'Gm7': {
    chordName: 'Gm7',
    baseFret: 3,
    barreFret: 3,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 3)',
    positions: [{ string: 6, fret: 3, finger: 1 }, { string: 5, fret: 5, finger: 3 }, { string: 4, fret: 3, finger: 1 }, { string: 3, fret: 3, finger: 1 }, { string: 2, fret: 3, finger: 1 }, { string: 1, fret: 3, finger: 1 }],
    noteNames: ['G', 'D', 'F', 'Bb', 'D', 'G'],
  },
  'G#': {
    chordName: 'G#',
    baseFret: 4,
    barreFret: 4,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 4)',
    positions: [{ string: 6, fret: 4, finger: 1 }, { string: 5, fret: 6, finger: 3 }, { string: 4, fret: 6, finger: 4 }, { string: 3, fret: 5, finger: 2 }, { string: 2, fret: 4, finger: 1 }, { string: 1, fret: 4, finger: 1 }],
    noteNames: ['G#', 'D#', 'G#', 'C', 'D#', 'G#'],
  },
  'G#m': {
    chordName: 'G#m',
    baseFret: 4,
    barreFret: 4,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 4)',
    positions: [{ string: 6, fret: 4, finger: 1 }, { string: 5, fret: 6, finger: 3 }, { string: 4, fret: 6, finger: 4 }, { string: 3, fret: 4, finger: 1 }, { string: 2, fret: 4, finger: 1 }, { string: 1, fret: 4, finger: 1 }],
    noteNames: ['G#', 'D#', 'G#', 'B', 'D#', 'G#'],
  },
  'Ab': {
    chordName: 'Ab',
    baseFret: 4,
    barreFret: 4,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: 'Barré Forme Mi (Case 4)',
    positions: [{ string: 6, fret: 4, finger: 1 }, { string: 5, fret: 6, finger: 3 }, { string: 4, fret: 6, finger: 4 }, { string: 3, fret: 5, finger: 2 }, { string: 2, fret: 4, finger: 1 }, { string: 1, fret: 4, finger: 1 }],
    noteNames: ['Ab', 'Eb', 'Ab', 'C', 'Eb', 'Ab'],
  },

  // --- LA / A ---
  'A': {
    chordName: 'A',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 2, finger: 3 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'A', 'C#', 'E'],
  },
  'Am': {
    chordName: 'Am',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 2, finger: 3 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'A', 'C', 'E'],
  },
  'A7': {
    chordName: 'A7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 2, finger: 3 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'G', 'C#', 'E'],
  },
  'Amaj7': {
    chordName: 'Amaj7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 1, finger: 1 }, { string: 2, fret: 2, finger: 3 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'G#', 'C#', 'E'],
  },
  'Am7': {
    chordName: 'Am7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 2 }, { string: 3, fret: 0 }, { string: 2, fret: 1, finger: 1 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'G', 'C', 'E'],
  },
  'Asus2': {
    chordName: 'Asus2',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 0 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'A', 'B', 'E'],
  },
  'Asus4': {
    chordName: 'Asus4',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 0 }, { string: 4, fret: 2, finger: 1 }, { string: 3, fret: 2, finger: 2 }, { string: 2, fret: 3, finger: 4 }, { string: 1, fret: 0 }],
    noteNames: ['×', 'A', 'E', 'A', 'D', 'E'],
  },

  // --- SI / B & Bb ---
  'Bb': {
    chordName: 'Bb',
    baseFret: 1,
    barreFret: 1,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 1, finger: 1 }, { string: 4, fret: 3, finger: 2 }, { string: 3, fret: 3, finger: 3 }, { string: 2, fret: 3, finger: 4 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['×', 'Bb', 'F', 'Bb', 'D', 'F'],
  },
  'Bbm': {
    chordName: 'Bbm',
    baseFret: 1,
    barreFret: 1,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 1, finger: 1 }, { string: 4, fret: 3, finger: 3 }, { string: 3, fret: 3, finger: 4 }, { string: 2, fret: 2, finger: 2 }, { string: 1, fret: 1, finger: 1 }],
    noteNames: ['×', 'Bb', 'F', 'Bb', 'Db', 'F'],
  },
  'B': {
    chordName: 'B',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 2)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 4, finger: 2 }, { string: 3, fret: 4, finger: 3 }, { string: 2, fret: 4, finger: 4 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['×', 'B', 'F#', 'B', 'D#', 'F#'],
  },
  'Bm': {
    chordName: 'Bm',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 2)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 4, finger: 3 }, { string: 3, fret: 4, finger: 4 }, { string: 2, fret: 3, finger: 2 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['×', 'B', 'F#', 'B', 'D', 'F#'],
  },
  'B7': {
    chordName: 'B7',
    baseFret: 1,
    voicingLabel: 'Position Ouverte (Case 1)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 2, finger: 2 }, { string: 4, fret: 1, finger: 1 }, { string: 3, fret: 2, finger: 3 }, { string: 2, fret: 0 }, { string: 1, fret: 2, finger: 4 }],
    noteNames: ['×', 'B', 'D#', 'A', 'B', 'F#'],
  },
  'Bm7': {
    chordName: 'Bm7',
    baseFret: 2,
    barreFret: 2,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 2)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 2, finger: 1 }, { string: 4, fret: 4, finger: 3 }, { string: 3, fret: 2, finger: 1 }, { string: 2, fret: 3, finger: 2 }, { string: 1, fret: 2, finger: 1 }],
    noteNames: ['×', 'B', 'F#', 'A', 'D', 'F#'],
  },

  // --- C# / Db & Eb ---
  'C#m': {
    chordName: 'C#m',
    baseFret: 4,
    barreFret: 4,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 4)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 4, finger: 1 }, { string: 4, fret: 6, finger: 3 }, { string: 3, fret: 6, finger: 4 }, { string: 2, fret: 5, finger: 2 }, { string: 1, fret: 4, finger: 1 }],
    noteNames: ['×', 'C#', 'G#', 'C#', 'E', 'G#'],
  },
  'C#': {
    chordName: 'C#',
    baseFret: 4,
    barreFret: 4,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 4)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 4, finger: 1 }, { string: 4, fret: 6, finger: 2 }, { string: 3, fret: 6, finger: 3 }, { string: 2, fret: 6, finger: 4 }, { string: 1, fret: 4, finger: 1 }],
    noteNames: ['×', 'C#', 'G#', 'C#', 'F', 'G#'],
  },
  'Eb': {
    chordName: 'Eb',
    baseFret: 6,
    barreFret: 6,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 6)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 6, finger: 1 }, { string: 4, fret: 8, finger: 2 }, { string: 3, fret: 8, finger: 3 }, { string: 2, fret: 8, finger: 4 }, { string: 1, fret: 6, finger: 1 }],
    noteNames: ['×', 'Eb', 'Bb', 'Eb', 'G', 'Bb'],
  },
  'Ebm': {
    chordName: 'Ebm',
    baseFret: 6,
    barreFret: 6,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: 'Barré Forme La (Case 6)',
    positions: [{ string: 6, fret: -1 }, { string: 5, fret: 6, finger: 1 }, { string: 4, fret: 8, finger: 3 }, { string: 3, fret: 8, finger: 4 }, { string: 2, fret: 7, finger: 2 }, { string: 1, fret: 6, finger: 1 }],
    noteNames: ['×', 'Eb', 'Bb', 'Eb', 'Gb', 'Bb'],
  },
};

/**
 * Generates an E-shape barre chord starting on 6th string
 */
export function generateEShapeBarre(root: string, quality: string): GuitarChordData {
  const rootIdx = getNoteIndex(root);
  // String 6 open is E (idx 4). Fret on string 6 = (rootIdx - 4 + 12) % 12
  let fret = (rootIdx - 4 + 12) % 12;
  if (fret === 0) fret = 12;

  const isMinor = quality.includes('m') && !quality.includes('maj');
  const is7th = quality.includes('7') && !quality.includes('maj');
  const isMaj7 = quality.includes('maj7') || quality.includes('M7');

  let positions: { string: number; fret: number; finger?: number }[] = [];
  let chordTypeLabel = 'Majeur';

  if (isMinor && is7th) {
    chordTypeLabel = 'Mineur 7';
    positions = [
      { string: 6, fret, finger: 1 },
      { string: 5, fret: fret + 2, finger: 3 },
      { string: 4, fret, finger: 1 },
      { string: 3, fret, finger: 1 },
      { string: 2, fret, finger: 1 },
      { string: 1, fret, finger: 1 },
    ];
  } else if (isMinor) {
    chordTypeLabel = 'Mineur';
    positions = [
      { string: 6, fret, finger: 1 },
      { string: 5, fret: fret + 2, finger: 3 },
      { string: 4, fret: fret + 2, finger: 4 },
      { string: 3, fret, finger: 1 },
      { string: 2, fret, finger: 1 },
      { string: 1, fret, finger: 1 },
    ];
  } else if (isMaj7) {
    chordTypeLabel = 'Maj7';
    positions = [
      { string: 6, fret, finger: 1 },
      { string: 5, fret: -1 },
      { string: 4, fret: fret + 1, finger: 3 },
      { string: 3, fret: fret + 1, finger: 4 },
      { string: 2, fret: fret - 1 > 0 ? fret - 1 : fret, finger: 2 },
      { string: 1, fret: -1 },
    ];
  } else if (is7th) {
    chordTypeLabel = '7ème';
    positions = [
      { string: 6, fret, finger: 1 },
      { string: 5, fret: fret + 2, finger: 3 },
      { string: 4, fret, finger: 1 },
      { string: 3, fret: fret + 1, finger: 2 },
      { string: 2, fret, finger: 1 },
      { string: 1, fret, finger: 1 },
    ];
  } else {
    // Standard Major
    positions = [
      { string: 6, fret, finger: 1 },
      { string: 5, fret: fret + 2, finger: 3 },
      { string: 4, fret: fret + 2, finger: 4 },
      { string: 3, fret: fret + 1, finger: 2 },
      { string: 2, fret, finger: 1 },
      { string: 1, fret, finger: 1 },
    ];
  }

  const name = root + quality;
  return {
    chordName: name,
    baseFret: fret,
    barreFret: fret,
    barreStartString: 6,
    barreEndString: 1,
    voicingLabel: `Barré Forme Mi (Case ${fret})`,
    positions,
    noteNames: evaluateChordNotes(positions),
  };
}

/**
 * Generates an A-shape barre chord starting on 5th string
 */
export function generateAShapeBarre(root: string, quality: string): GuitarChordData {
  const rootIdx = getNoteIndex(root);
  // String 5 open is A (idx 9). Fret on string 5 = (rootIdx - 9 + 12) % 12
  let fret = (rootIdx - 9 + 12) % 12;
  if (fret === 0) fret = 12;

  const isMinor = quality.includes('m') && !quality.includes('maj');
  const is7th = quality.includes('7') && !quality.includes('maj');
  const isMaj7 = quality.includes('maj7') || quality.includes('M7');

  let positions: { string: number; fret: number; finger?: number }[] = [];

  if (isMinor && is7th) {
    positions = [
      { string: 6, fret: -1 },
      { string: 5, fret, finger: 1 },
      { string: 4, fret: fret + 2, finger: 3 },
      { string: 3, fret, finger: 1 },
      { string: 2, fret: fret + 1, finger: 2 },
      { string: 1, fret, finger: 1 },
    ];
  } else if (isMinor) {
    positions = [
      { string: 6, fret: -1 },
      { string: 5, fret, finger: 1 },
      { string: 4, fret: fret + 2, finger: 3 },
      { string: 3, fret: fret + 2, finger: 4 },
      { string: 2, fret: fret + 1, finger: 2 },
      { string: 1, fret, finger: 1 },
    ];
  } else if (isMaj7) {
    positions = [
      { string: 6, fret: -1 },
      { string: 5, fret, finger: 1 },
      { string: 4, fret: fret + 2, finger: 3 },
      { string: 3, fret: fret + 1, finger: 2 },
      { string: 2, fret: fret + 2, finger: 4 },
      { string: 1, fret, finger: 1 },
    ];
  } else if (is7th) {
    positions = [
      { string: 6, fret: -1 },
      { string: 5, fret, finger: 1 },
      { string: 4, fret: fret + 2, finger: 3 },
      { string: 3, fret, finger: 1 },
      { string: 2, fret: fret + 2, finger: 4 },
      { string: 1, fret, finger: 1 },
    ];
  } else {
    // Major A-shape
    positions = [
      { string: 6, fret: -1 },
      { string: 5, fret, finger: 1 },
      { string: 4, fret: fret + 2, finger: 2 },
      { string: 3, fret: fret + 2, finger: 3 },
      { string: 2, fret: fret + 2, finger: 4 },
      { string: 1, fret, finger: 1 },
    ];
  }

  const name = root + quality;
  return {
    chordName: name,
    baseFret: fret,
    barreFret: fret,
    barreStartString: 5,
    barreEndString: 1,
    voicingLabel: `Barré Forme La (Case ${fret})`,
    positions,
    noteNames: evaluateChordNotes(positions),
  };
}

/**
 * Retrieves all voicings (Open, E-shape, A-shape) for a chord
 */
export function getAllVoicingsForChord(chordStr: string): GuitarChordData[] {
  const { root, quality } = parseChord(chordStr);
  const cleanName = root + quality;
  const voicings: GuitarChordData[] = [];

  // Check static dictionary first
  if (GUITAR_CHORD_DICT[cleanName]) {
    voicings.push(GUITAR_CHORD_DICT[cleanName]);
  } else if (GUITAR_CHORD_DICT[chordStr]) {
    voicings.push(GUITAR_CHORD_DICT[chordStr]);
  }

  // Generate A-Shape barre
  const aShape = generateAShapeBarre(root, quality);
  // Generate E-Shape barre
  const eShape = generateEShapeBarre(root, quality);

  // Add A-Shape if not already included or different baseFret
  if (!voicings.some((v) => v.baseFret === aShape.baseFret && v.positions[1]?.fret === aShape.positions[1]?.fret)) {
    voicings.push(aShape);
  }

  // Add E-Shape if not already included or different baseFret
  if (!voicings.some((v) => v.baseFret === eShape.baseFret && v.positions[0]?.fret === eShape.positions[0]?.fret)) {
    voicings.push(eShape);
  }

  // Sort voicings by lowest baseFret
  voicings.sort((a, b) => a.baseFret - b.baseFret);

  return voicings;
}

/**
 * Gets primary guitar chord representation with fallback and calculated voicings
 */
export function getGuitarChordData(chordStr: string): GuitarChordData {
  const voicings = getAllVoicingsForChord(chordStr);
  if (voicings.length > 0) {
    return {
      ...voicings[0],
      voicings,
    };
  }

  const { root, quality } = parseChord(chordStr);
  const fallback = generateAShapeBarre(root, quality);
  return {
    ...fallback,
    voicings: [fallback],
  };
}

/**
 * Piano notes mapping for piano chord chart generator
 */
export const PIANO_CHORD_DICT: Record<string, PianoChordData> = {
  'C': { chordName: 'C', notes: ['C', 'E', 'G'] },
  'Cm': { chordName: 'Cm', notes: ['C', 'Eb', 'G'] },
  'G': { chordName: 'G', notes: ['G', 'B', 'D'] },
  'Gm': { chordName: 'Gm', notes: ['G', 'Bb', 'D'] },
  'D': { chordName: 'D', notes: ['D', 'F#', 'A'] },
  'Dm': { chordName: 'Dm', notes: ['D', 'F', 'A'] },
  'A': { chordName: 'A', notes: ['A', 'C#', 'E'] },
  'Am': { chordName: 'Am', notes: ['A', 'C', 'E'] },
  'E': { chordName: 'E', notes: ['E', 'G#', 'B'] },
  'Em': { chordName: 'Em', notes: ['E', 'G', 'B'] },
  'F': { chordName: 'F', notes: ['F', 'A', 'C'] },
  'Fm': { chordName: 'Fm', notes: ['F', 'Ab', 'C'] },
  'Bm': { chordName: 'Bm', notes: ['B', 'D', 'F#'] },
  'B': { chordName: 'B', notes: ['B', 'D#', 'F#'] },
  'Bb': { chordName: 'Bb', notes: ['Bb', 'D', 'F'] },
  'Bbm': { chordName: 'Bbm', notes: ['Bb', 'Db', 'F'] },
  'F#': { chordName: 'F#', notes: ['F#', 'A#', 'C#'] },
  'F#m': { chordName: 'F#m', notes: ['F#', 'A', 'C#'] },
  'C#': { chordName: 'C#', notes: ['C#', 'F', 'G#'] },
  'C#m': { chordName: 'C#m', notes: ['C#', 'E', 'G#'] },
  'Ab': { chordName: 'Ab', notes: ['Ab', 'C', 'Eb'] },
  'G#m': { chordName: 'G#m', notes: ['G#', 'B', 'D#'] },
  'Eb': { chordName: 'Eb', notes: ['Eb', 'G', 'Bb'] },
  'Ebm': { chordName: 'Ebm', notes: ['Eb', 'Gb', 'Bb'] },
  'Cmaj7': { chordName: 'Cmaj7', notes: ['C', 'E', 'G', 'B'] },
  'C7': { chordName: 'C7', notes: ['C', 'E', 'G', 'Bb'] },
  'G7': { chordName: 'G7', notes: ['G', 'B', 'D', 'F'] },
  'D7': { chordName: 'D7', notes: ['D', 'F#', 'A', 'C'] },
  'A7': { chordName: 'A7', notes: ['A', 'C#', 'E', 'G'] },
  'E7': { chordName: 'E7', notes: ['E', 'G#', 'B', 'D'] },
  'B7': { chordName: 'B7', notes: ['B', 'D#', 'F#', 'A'] },
  'Am7': { chordName: 'Am7', notes: ['A', 'C', 'E', 'G'] },
  'Dm7': { chordName: 'Dm7', notes: ['D', 'F', 'A', 'C'] },
  'Em7': { chordName: 'Em7', notes: ['E', 'G', 'B', 'D'] },
};

/**
 * Gets or computes piano chord representation fallback
 */
export function getPianoChordData(chordStr: string): PianoChordData {
  if (PIANO_CHORD_DICT[chordStr]) return PIANO_CHORD_DICT[chordStr];
  const { root, quality } = parseChord(chordStr);
  const isMinor = quality.includes('m') && !quality.includes('maj');
  const is7th = quality.includes('7') && !quality.includes('maj');
  const isMaj7 = quality.includes('maj7') || quality.includes('M7');
  const isSus4 = quality.includes('sus4');
  const isSus2 = quality.includes('sus2');
  const isDim = quality.includes('dim');

  const rootIdx = getNoteIndex(root);
  let thirdInterval = isMinor ? 3 : 4;
  if (isSus4) thirdInterval = 5;
  if (isSus2) thirdInterval = 2;

  let fifthInterval = isDim ? 6 : 7;

  const notes: string[] = [
    CHROMATIC_SCALE_SHARPS[rootIdx],
    CHROMATIC_SCALE_SHARPS[(rootIdx + thirdInterval) % 12],
    CHROMATIC_SCALE_SHARPS[(rootIdx + fifthInterval) % 12],
  ];

  if (isMaj7) {
    notes.push(CHROMATIC_SCALE_SHARPS[(rootIdx + 11) % 12]);
  } else if (is7th) {
    notes.push(CHROMATIC_SCALE_SHARPS[(rootIdx + 10) % 12]);
  }

  return {
    chordName: chordStr,
    notes,
  };
}
