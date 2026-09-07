import { Midi } from '@tonejs/midi';
import { parseMidi } from 'midi-file';

export interface ParsedMidiResult {
  title: string;
  artist: string;
  key: string;
  bpm: number;
  timeSignature: string;
  durationSeconds: number;
  introDelaySeconds?: number;
  chordProContent: string;
  tracksInfo: { name: string; instrument: string; noteCount: number; isPercussion: boolean }[];
  detectedChords: string[];
  rawNotesSummary: string;
  midiData: string; // Base64 encoded MIDI/KAR file for playback
  hasLyrics: boolean; // True if real karaoke lyrics were extracted
  karaokeLineCount: number;
}

// Note pitch classes mapping
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Major and Minor profiles (Krumhansl-Schmuckler)
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

/**
 * Estimate Key (Key Signature) from pitch class distribution
 */
function detectMidiKey(pitchCounts: number[]): string {
  const totalNotes = pitchCounts.reduce((a, b) => a + b, 0);
  if (totalNotes === 0) return 'C';

  let bestKey = 'C';
  let maxScore = -Infinity;

  for (let root = 0; root < 12; root++) {
    // Check Major
    let majorScore = 0;
    for (let i = 0; i < 12; i++) {
      majorScore += pitchCounts[(root + i) % 12] * MAJOR_PROFILE[i];
    }
    if (majorScore > maxScore) {
      maxScore = majorScore;
      bestKey = PITCH_NAMES[root];
    }

    // Check Minor
    let minorScore = 0;
    for (let i = 0; i < 12; i++) {
      minorScore += pitchCounts[(root + i) % 12] * MINOR_PROFILE[i];
    }
    if (minorScore > maxScore) {
      maxScore = minorScore;
      bestKey = `${PITCH_NAMES[root]}m`;
    }
  }

  return bestKey;
}

/**
 * Identify a chord name from a set of active pitch classes
 */
function identifyChordFromPitchClasses(pitchClasses: Set<number>, rootHint?: number): string {
  if (pitchClasses.size === 0) return '';
  const pcs = Array.from(pitchClasses).sort((a, b) => a - b);

  // If only 1 note
  if (pcs.length === 1) return PITCH_NAMES[pcs[0]];

  // Prioritize rootHint (e.g. from bass line)
  const candidateRoots: number[] = [];
  if (rootHint !== undefined && pcs.includes(rootHint)) {
    candidateRoots.push(rootHint);
  }
  for (const r of pcs) {
    if (!candidateRoots.includes(r)) candidateRoots.push(r);
  }

  // Pass 1: Prioritize standard Major & Minor triads (and basic 7ths)
  for (const root of candidateRoots) {
    const rootName = PITCH_NAMES[root];
    const intervals = pcs.map((pc) => (pc - root + 12) % 12);

    const hasMinor3rd = intervals.includes(3);
    const hasMajor3rd = intervals.includes(4);
    const hasPerfect5th = intervals.includes(7);
    const hasMinor7th = intervals.includes(10);
    const hasMajor7th = intervals.includes(11);

    if (hasMajor3rd && hasPerfect5th) {
      if (hasMinor7th) return `${rootName}7`;
      if (hasMajor7th) return `${rootName}maj7`;
      return rootName;
    }

    if (hasMinor3rd && hasPerfect5th) {
      if (hasMinor7th) return `${rootName}m7`;
      return `${rootName}m`;
    }
  }

  // Pass 2: Secondary chords (sus, dim, aug)
  for (const root of candidateRoots) {
    const rootName = PITCH_NAMES[root];
    const intervals = pcs.map((pc) => (pc - root + 12) % 12);
    const hasMinor3rd = intervals.includes(3);
    const hasMajor3rd = intervals.includes(4);
    const hasDim5th = intervals.includes(6);
    const hasAug5th = intervals.includes(8);
    const hasMinor7th = intervals.includes(10);
    const has2nd = intervals.includes(2);
    const has4th = intervals.includes(5);
    const hasPerfect5th = intervals.includes(7);

    if (has2nd && hasPerfect5th) {
      return `${rootName}sus2`;
    }

    if (has4th && hasPerfect5th) {
      return `${rootName}sus4`;
    }

    if (hasMinor3rd && hasDim5th) {
      if (hasMinor7th) return `${rootName}m7b5`;
      return `${rootName}dim`;
    }

    if (hasMajor3rd && hasAug5th) {
      return `${rootName}aug`;
    }
  }

  // Fallback to lowest pitch / root
  const primaryRoot = rootHint !== undefined ? rootHint : pcs[0];
  return PITCH_NAMES[primaryRoot];
}

/**
 * Clean up text encoding for MIDI strings (UTF-8, Latin1, CP1252)
 */
function cleanMidiText(raw: string): string {
  if (!raw) return '';
  try {
    const bytes = new Uint8Array(Array.from(raw).map((c) => c.charCodeAt(0)));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (!decoded.includes('\uFFFD') && decoded.length > 0) {
      return decoded;
    }
  } catch {}
  return raw;
}

interface ParsedKaraokeLine {
  startTime: number;
  endTime: number;
  text: string;
  isSectionBreak: boolean;
  syllables: { text: string; time: number }[];
}

interface ExtractedKaraokeData {
  isKaraoke: boolean;
  metaTitle?: string;
  metaArtist?: string;
  lines: ParsedKaraokeLine[];
}

/**
 * Extract Karaoke lyrics and timing from MIDI / KAR file using midi-file parser
 */
function extractKaraokeData(arrayBuffer: ArrayBuffer): ExtractedKaraokeData {
  try {
    const midiData = parseMidi(new Uint8Array(arrayBuffer));
    const ticksPerBeat = midiData.header.ticksPerBeat || 480;

    // 1. Build Global Tempo Map
    interface TempoEntry {
      tick: number;
      usPerBeat: number;
      timeSec: number;
    }

    const tempoEvents: { tick: number; usPerBeat: number }[] = [];
    midiData.tracks.forEach((track) => {
      let tick = 0;
      track.forEach((ev) => {
        tick += ev.deltaTime;
        if (ev.type === 'setTempo') {
          tempoEvents.push({ tick, usPerBeat: ev.microsecondsPerBeat });
        }
      });
    });

    // Default to 120 BPM (500,000 us/beat) if none specified
    if (tempoEvents.length === 0 || tempoEvents[0].tick !== 0) {
      tempoEvents.unshift({ tick: 0, usPerBeat: 500000 });
    }
    tempoEvents.sort((a, b) => a.tick - b.tick);

    const tempoMap: TempoEntry[] = [];
    let accTime = 0;
    let prevTick = 0;
    let currentUs = 500000;

    tempoEvents.forEach((te) => {
      const deltaTicks = te.tick - prevTick;
      accTime += (deltaTicks / ticksPerBeat) * (currentUs / 1000000);
      currentUs = te.usPerBeat;
      prevTick = te.tick;
      tempoMap.push({ tick: te.tick, usPerBeat: currentUs, timeSec: accTime });
    });

    const tickToSeconds = (targetTick: number): number => {
      let seg = tempoMap[0];
      for (let i = 0; i < tempoMap.length; i++) {
        if (tempoMap[i].tick <= targetTick) {
          seg = tempoMap[i];
        } else {
          break;
        }
      }
      const deltaTicks = targetTick - seg.tick;
      return seg.timeSec + (deltaTicks / ticksPerBeat) * (seg.usPerBeat / 1000000);
    };

    // 2. Gather All Lyrics & Text Events Across Tracks
    interface RawToken {
      tick: number;
      timeSec: number;
      text: string;
      isLyricEvent: boolean;
      trackIndex: number;
    }

    const allTokens: RawToken[] = [];
    let metaTitle: string | undefined;
    let metaArtist: string | undefined;
    let isKaraokeDetected = false;
    let foundHeaderTCount = 0;

    midiData.tracks.forEach((track, tIdx) => {
      let tick = 0;
      track.forEach((ev) => {
        tick += ev.deltaTime;
        if (ev.type === 'lyrics' || ev.type === 'text') {
          const rawStr = cleanMidiText(ev.text || '');
          if (!rawStr) return;

          // Check standard KAR tags: @K, @T, @A, @L, @I
          if (rawStr.startsWith('@K') || rawStr.includes('KARAOKE')) {
            isKaraokeDetected = true;
            return;
          }
          if (rawStr.startsWith('@T')) {
            const cleanT = rawStr.replace(/^@T\s*/, '').trim();
            if (cleanT) {
              if (foundHeaderTCount === 0) {
                metaTitle = cleanT;
              } else if (foundHeaderTCount === 1) {
                metaArtist = cleanT;
              }
              foundHeaderTCount++;
            }
            return;
          }
          if (rawStr.startsWith('@A')) {
            metaArtist = rawStr.replace(/^@A\s*/, '').trim();
            return;
          }
          if (rawStr.startsWith('@')) {
            // Ignore other metadata headers like @LENG, @V0100
            return;
          }

          const timeSec = tickToSeconds(tick);
          allTokens.push({
            tick,
            timeSec,
            text: rawStr,
            isLyricEvent: ev.type === 'lyrics',
            trackIndex: tIdx,
          });
        }
      });
    });

    if (allTokens.length === 0) {
      return { isKaraoke: isKaraokeDetected, metaTitle, metaArtist, lines: [] };
    }

    // Sort tokens chronologically
    allTokens.sort((a, b) => a.timeSec - b.timeSec);

    // 3. Assemble Tokens into Lyric Lines
    // KAR convention:
    // '/' = line break
    // '\' = stanza/section break (and line break)
    // Syllables with trailing '-' combine into single words without space
    const lines: ParsedKaraokeLine[] = [];
    let curLine: ParsedKaraokeLine = {
      startTime: 0,
      endTime: 0,
      text: '',
      isSectionBreak: false,
      syllables: [],
    };

    allTokens.forEach((tok) => {
      let str = tok.text;
      let isSectionBreak = false;
      let isLineBreak = false;

      // Check section break '\'
      if (str.startsWith('\\')) {
        isSectionBreak = true;
        isLineBreak = true;
        str = str.replace(/^\\+/, '');
      } else if (str.startsWith('/')) {
        isLineBreak = true;
        str = str.replace(/^\/+/, '');
      } else if (str.includes('\n') || str.includes('\r')) {
        isLineBreak = true;
        str = str.replace(/[\r\n]+/g, ' ');
      }

      // If there's a big time pause (> 3.2s) between syllables, treat as line break
      if (curLine.syllables.length > 0 && tok.timeSec - curLine.endTime > 3.2) {
        isLineBreak = true;
        if (tok.timeSec - curLine.endTime > 6.0) {
          isSectionBreak = true;
        }
      }

      if (isLineBreak && curLine.syllables.length > 0 && curLine.text.trim().length > 0) {
        curLine.text = curLine.text.trim();
        lines.push(curLine);
        curLine = {
          startTime: tok.timeSec,
          endTime: tok.timeSec,
          text: '',
          isSectionBreak,
          syllables: [],
        };
      } else if (isSectionBreak) {
        curLine.isSectionBreak = true;
      }

      if (curLine.syllables.length === 0) {
        curLine.startTime = tok.timeSec;
      }
      curLine.endTime = tok.timeSec;

      // Handle syllable word assembly
      if (curLine.text.endsWith('-')) {
        curLine.text = curLine.text.slice(0, -1) + str.trimStart();
      } else {
        curLine.text += str;
      }
      curLine.syllables.push({ text: str, time: tok.timeSec });
    });

    if (curLine.syllables.length > 0 && curLine.text.trim().length > 0) {
      curLine.text = curLine.text.trim();
      lines.push(curLine);
    }

    return {
      isKaraoke: isKaraokeDetected || lines.length > 0,
      metaTitle,
      metaArtist,
      lines,
    };
  } catch (err) {
    console.warn('Could not extract karaoke text from MIDI:', err);
    return { isKaraoke: false, lines: [] };
  }
}

/**
 * Format duration in mm:ss for ChordPro time markers
 */
function formatTimeMarker(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Main function to parse ArrayBuffer of a MIDI / KAR file
 */
export async function parseMidiFile(arrayBuffer: ArrayBuffer, fileName: string): Promise<ParsedMidiResult> {
  // 1. Convert binary arrayBuffer to Base64 for persistent playback storage
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const midiBase64 = btoa(binary);

  // 2. Extract Karaoke lyrics & metadata
  const karaokeData = extractKaraokeData(arrayBuffer);

  // 3. Load with ToneJS Midi for note & music theory analysis
  const midi = new Midi(arrayBuffer);

  // Clean Title & Artist (prefer KAR metadata if present)
  let title = karaokeData.metaTitle;
  if (!title || title.trim().length === 0) {
    title = midi.name && midi.name.trim().length > 0 
      ? midi.name.trim() 
      : fileName.replace(/\.(mid|midi|kar)$/i, '');
  }
  const artist = karaokeData.metaArtist || 'Fichier MIDI / Karaoké';

  // Tempo (BPM)
  let bpm = 120;
  if (midi.header.tempos && midi.header.tempos.length > 0) {
    bpm = Math.round(midi.header.tempos[0].bpm);
  }

  // Time Signature
  let timeSignature = '4/4';
  let beatsPerMeasure = 4;
  if (midi.header.timeSignatures && midi.header.timeSignatures.length > 0) {
    const ts = midi.header.timeSignatures[0].timeSignature;
    timeSignature = `${ts[0]}/${ts[1]}`;
    beatsPerMeasure = ts[0];
  }

  // Duration
  const durationSeconds = Math.max(15, Math.round(midi.duration || 180));

  // Collect tracks info
  const tracksInfo = midi.tracks.map((track, i) => {
    const isPerc = track.instrument?.percussion || track.channel === 9;
    return {
      name: track.name || `Piste ${i + 1}`,
      instrument: track.instrument?.name || 'Instrument Synthé',
      noteCount: track.notes.length,
      isPercussion: !!isPerc,
    };
  });

  // Analyze Pitch Classes & Key
  const pitchCounts = new Array(12).fill(0);
  const allNotesWithTime: { pitchClass: number; time: number; duration: number; midi: number }[] = [];

  midi.tracks.forEach((track) => {
    if (track.instrument?.percussion || track.channel === 9) return;
    track.notes.forEach((note) => {
      const pc = note.midi % 12;
      pitchCounts[pc]++;
      allNotesWithTime.push({
        pitchClass: pc,
        time: note.time,
        duration: note.duration,
        midi: note.midi,
      });
    });
  });

  const estimatedKey = detectMidiKey(pitchCounts);

  // Measure calculation
  const measureDuration = (60 / bpm) * beatsPerMeasure;
  const totalMeasures = Math.min(256, Math.ceil(durationSeconds / measureDuration));

  // Function to evaluate chords during any time window [startTime, endTime]
  const evaluateChordInWindow = (startTime: number, endTime: number, fallbackChord: string): string => {
    const activePitchClasses = new Set<number>();
    let lowestMidi = 128;
    let rootHint: number | undefined = undefined;

    const windowNotes = allNotesWithTime.filter((n) => {
      return n.time < endTime && n.time + n.duration > startTime && n.duration >= 0.08;
    });

    const bassNotes = windowNotes.filter((n) => n.midi < 64);
    if (bassNotes.length > 0) {
      bassNotes.sort((a, b) => a.midi - b.midi);
      rootHint = bassNotes[0].pitchClass;
    }

    windowNotes.forEach((n) => {
      if (n.midi <= 78) {
        activePitchClasses.add(n.pitchClass);
      }
      if (n.midi < lowestMidi) {
        lowestMidi = n.midi;
        if (rootHint === undefined) rootHint = n.pitchClass;
      }
    });

    const identified = identifyChordFromPitchClasses(activePitchClasses, rootHint);
    return identified || fallbackChord;
  };

  // Pre-calculate measure-by-measure chords
  const measureChords: { measureNum: number; chord: string; startTime: number; endTime: number }[] = [];
  const detectedChordsSet = new Set<string>();

  for (let m = 0; m < totalMeasures; m++) {
    const measureStart = m * measureDuration;
    const measureEnd = measureStart + measureDuration;
    const chord = evaluateChordInWindow(measureStart, measureEnd, estimatedKey);
    if (chord) {
      detectedChordsSet.add(chord);
      measureChords.push({ measureNum: m + 1, chord, startTime: measureStart, endTime: measureEnd });
    }
  }

  const detectedChordsList = Array.from(detectedChordsSet);

  // 4. Build ChordPro Content
  let chordProContent = `{title: ${title}}\n{artist: ${artist}}\n{key: ${estimatedKey}}\n{bpm: ${bpm}}\n{time: ${timeSignature}}\n\n`;

  chordProContent += `# ==========================================\n`;
  if (karaokeData.lines.length > 0) {
    chordProContent += `# FICHIER KARAOKÉ (.KAR / MIDI) SYNCHRONISÉ:\n`;
    chordProContent += `# Fichier: ${fileName}\n`;
    chordProContent += `# Paroles extraites: ${karaokeData.lines.length} lignes\n`;
  } else {
    chordProContent += `# FICHIER MIDI ANALYSÉ & HARMONISÉ:\n`;
    chordProContent += `# Fichier original: ${fileName}\n`;
  }
  chordProContent += `# Pistes: ${tracksInfo.length} (${tracksInfo.map((t) => t.name).join(', ')})\n`;
  chordProContent += `# Tonalité: ${estimatedKey} | Tempo: ${bpm} BPM\n`;
  chordProContent += `# Accords clés: ${detectedChordsList.join(', ') || 'Aucun'}\n`;
  chordProContent += `# ==========================================\n\n`;

  let introDelaySeconds = 0;

  // IF REAL KARAOKE LYRICS WERE DETECTED:
  if (karaokeData.lines.length > 0) {
    const firstLineTime = karaokeData.lines[0].startTime;
    introDelaySeconds = Math.max(0, Math.round(firstLineTime));

    // If there is an introductory instrumental passage (> 4s), create [Intro] section
    if (firstLineTime > 4.0) {
      chordProContent += `[Intro] {time: 00:00}\n`;
      const introMeasures = measureChords.filter((mc) => mc.endTime <= firstLineTime);
      if (introMeasures.length > 0) {
        const introLine = introMeasures.slice(0, 8).map((mc) => `[${mc.chord}]`).join('   |   ');
        chordProContent += `|  ${introLine}  |\n\n`;
      } else {
        chordProContent += `|  [${estimatedKey}]  |\n\n`;
      }
    }

    let sectionIdx = 1;
    let chorusCount = 1;
    let verseCount = 1;

    // Output lyrics paired with chords
    karaokeData.lines.forEach((line, lineIdx) => {
      // Determine if we should open a new section heading
      const isFirst = lineIdx === 0;
      const isStanza = line.isSectionBreak;
      const timeSincePrev = lineIdx > 0 ? line.startTime - karaokeData.lines[lineIdx - 1].endTime : 0;
      const isLongInterlude = timeSincePrev > 6.0;

      if (isFirst || isStanza || isLongInterlude) {
        let sectionTitle = '';
        if (isFirst && firstLineTime <= 4.0) {
          sectionTitle = `[Couplet ${verseCount++}]`;
        } else if (sectionIdx % 3 === 0) {
          sectionTitle = `[Refrain ${chorusCount++}]`;
        } else if (sectionIdx % 5 === 0) {
          sectionTitle = `[Pont]`;
        } else {
          sectionTitle = `[Couplet ${verseCount++}]`;
        }
        sectionIdx++;
        chordProContent += `\n${sectionTitle}\n`;
      }

      // Find the harmonic chord at the start of this line
      const chordAtStart = evaluateChordInWindow(line.startTime, line.startTime + 1.5, estimatedKey);

      // Check if there is a secondary chord change during the line
      let formattedLine = '';
      const lineDuration = line.endTime - line.startTime;

      if (lineDuration > 2.0) {
        const midTime = line.startTime + lineDuration * 0.5;
        const chordAtMid = evaluateChordInWindow(midTime, line.endTime, chordAtStart);

        if (chordAtMid && chordAtMid !== chordAtStart) {
          // Split line words roughly in half to embed secondary chord
          const words = line.text.split(' ');
          if (words.length >= 3) {
            const splitPoint = Math.floor(words.length / 2);
            const firstHalf = words.slice(0, splitPoint).join(' ');
            const secondHalf = words.slice(splitPoint).join(' ');
            formattedLine = `[${chordAtStart}]${firstHalf} [${chordAtMid}]${secondHalf}`;
          } else {
            formattedLine = `[${chordAtStart}]${line.text}`;
          }
        } else {
          formattedLine = `[${chordAtStart}]${line.text}`;
        }
      } else {
        formattedLine = `[${chordAtStart}]${line.text}`;
      }

      // Append time tag for sync prompter: {time: mm:ss}
      const timeTag = `{time: ${formatTimeMarker(line.startTime)}}`;
      chordProContent += `${formattedLine} ${timeTag}\n`;
    });

    chordProContent += `\n[Outro]\n|  [${estimatedKey}]  |\n`;
  } else {
    // NO LYRICS IN MIDI: Generate structured measure-by-measure chord blocks
    if (measureChords.length > 0) {
      const totalBlocks = Math.ceil(measureChords.length / 4);

      for (let b = 0; b < totalBlocks; b++) {
        const block = measureChords.slice(b * 4, (b + 1) * 4);
        const line = block.map((mc) => `[${mc.chord}]`).join('   |   ');

        let sectionName = '';
        if (b === 0) sectionName = '[Intro]';
        else if (b === 1) sectionName = '[Couplet 1]';
        else if (b === Math.floor(totalBlocks / 2)) sectionName = '[Refrain]';
        else if (b === totalBlocks - 2) sectionName = '[Pont]';
        else if (b === totalBlocks - 1) sectionName = '[Outro]';

        if (sectionName) {
          chordProContent += `${sectionName}\n`;
        }

        chordProContent += `|  ${line}  |\n`;
        if (sectionName || (b + 1) % 2 === 0) {
          chordProContent += `\n`;
        }
      }
    } else {
      chordProContent += `[Couplet 1]\n[${estimatedKey}] Fichier MIDI sans notes mélodiques identifiables.\n`;
    }
  }

  // Summary
  const rawNotesSummary = karaokeData.lines.length > 0
    ? `Karaoké (.kar / MIDI) : ${fileName} | ${karaokeData.lines.length} lignes de paroles | ${tracksInfo.length} pistes | ${allNotesWithTime.length} notes.`
    : `MIDI : ${fileName} | ${tracksInfo.length} pistes | ${allNotesWithTime.length} notes musicales lues.`;

  return {
    title,
    artist,
    key: estimatedKey,
    bpm,
    timeSignature,
    durationSeconds,
    introDelaySeconds,
    chordProContent,
    tracksInfo,
    detectedChords: detectedChordsList,
    rawNotesSummary,
    midiData: midiBase64,
    hasLyrics: karaokeData.lines.length > 0,
    karaokeLineCount: karaokeData.lines.length,
  };
}

