import * as pdfjsLib from 'pdfjs-dist';
import { Song } from '../types';

// Set up pdf.js worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ParsedPdfResult {
  song: Partial<Song>;
  fileName: string;
}

interface PdfItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Cleans replacement / tofu / control characters that render as boxes
 */
function cleanGarbledPdfText(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove Unicode replacement character  and box/tofu characters
    .replace(/[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    // Replace non-breaking spaces and unusual whitespace
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, ' ')
    // Normalize hyphenation and broken music syllabification (e.g. "chil - dren" -> "children")
    .replace(/([a-zA-ZÀ-ÿ])- (\w)/g, '$1$2');
}

/**
 * Group pdf.js text items into lines based on Y coordinates and sort by X position
 */
function groupItemsIntoLines(items: any[]): string[] {
  const parsedItems: PdfItem[] = [];

  for (const item of items) {
    if (!('str' in item) || !item.str) continue;
    const cleanStr = cleanGarbledPdfText(item.str);
    if (!cleanStr.trim()) continue;
    const x = item.transform ? item.transform[4] : 0;
    const y = item.transform ? item.transform[5] : 0;
    parsedItems.push({ str: cleanStr, x, y });
  }

  if (parsedItems.length === 0) return [];

  // Sort items by Y descending (top of page to bottom of page)
  parsedItems.sort((a, b) => b.y - a.y);

  const lines: PdfItem[][] = [];
  let currentLine: PdfItem[] = [];
  let currentY = parsedItems[0].y;

  for (const item of parsedItems) {
    if (Math.abs(item.y - currentY) < 5) {
      currentLine.push(item);
    } else {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);
  }

  return lines.map((lineItems) => {
    let lineStr = '';
    let prevEndX = 0;
    for (let i = 0; i < lineItems.length; i++) {
      const it = lineItems[i];
      if (i > 0) {
        const gap = it.x - prevEndX;
        if (gap > 4) {
          const spaces = Math.min(Math.max(1, Math.floor(gap / 6)), 15);
          lineStr += ' '.repeat(spaces);
        }
      }
      lineStr += it.str;
      prevEndX = it.x + it.str.length * 6;
    }
    return lineStr;
  });
}

/**
 * Regex for standard guitar/piano chord tokens
 */
const CHORD_TOKEN_REGEX = /^[A-G][b#]?(?:m|maj|min|dim|aug|sus|add|[0-9])*(?:\/[A-G][b#]?)?$/i;

function isChordToken(token: string): boolean {
  const clean = token.replace(/^[|()/-]+|[|()/-]+$/g, '').trim();
  if (!clean) return true;
  return CHORD_TOKEN_REGEX.test(clean);
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const tok of tokens) {
    if (isChordToken(tok)) chordCount++;
  }

  return chordCount / tokens.length >= 0.4 && chordCount > 0;
}

/**
 * Merge a line of chords over a line of lyrics into ChordPro [Chord]Lyric format
 */
function mergeChordAndLyricLine(chordLine: string, lyricLine: string): string {
  const chordMatches: { chord: string; index: number }[] = [];
  const regex = /([A-G][b#]?(?:m|maj|min|dim|aug|sus|add|[0-9])*(?:\/[A-G][b#]?)?)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(chordLine)) !== null) {
    chordMatches.push({ chord: match[1], index: match.index });
  }

  if (chordMatches.length === 0) return lyricLine;

  let result = lyricLine;
  // Sort descending so insertions don't alter earlier indices
  chordMatches.sort((a, b) => b.index - a.index);

  for (const { chord, index } of chordMatches) {
    if (index >= result.length) {
      result = result + ' [' + chord + ']';
    } else {
      result = result.slice(0, index) + '[' + chord + ']' + result.slice(index);
    }
  }

  return result;
}

/**
 * Convert extracted lines into structured ChordPro format
 */
export function convertLinesToChordPro(lines: string[]): string {
  const outputLines: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      outputLines.push('');
      i++;
      continue;
    }

    // Header detection
    if (/^(?:\[.*\]|\b(?:verse|couplet|refrain|chorus|bridge|pont|intro|outro|strophe)\b)/i.test(trimmed)) {
      outputLines.push(trimmed.startsWith('[') ? trimmed : `[${trimmed}]`);
      i++;
      continue;
    }

    if (isChordLine(line)) {
      const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
      if (nextLine && !isChordLine(nextLine) && nextLine.trim().length > 0) {
        const merged = mergeChordAndLyricLine(line, nextLine);
        outputLines.push(merged);
        i += 2;
      } else {
        const formattedChords = line.replace(
          /([A-G][b#]?(?:m|maj|min|dim|aug|sus|add|[0-9])*(?:\/[A-G][b#]?)?)/gi,
          '[$1]'
        );
        outputLines.push(formattedChords);
        i++;
      }
    } else {
      outputLines.push(line);
      i++;
    }
  }

  return outputLines.join('\n');
}

/**
 * Convert File to Base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Extract structured text line-by-line from PDF
 */
export async function extractStructuredTextFromPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/standard_fonts/`,
    });
    const pdf = await loadingTask.promise;
    const allLines: string[] = [];

    for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 10); pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageLines = groupItemsIntoLines(textContent.items);
      allLines.push(...pageLines);
      allLines.push(''); // Page separator line
    }

    return convertLinesToChordPro(allLines);
  } catch (err) {
    console.warn('Erreur extraction PDF structuré:', err);
    return '';
  }
}

/**
 * Main function to parse PDF partitions and extract chords
 */
export async function parsePdfMusicFile(file: File): Promise<ParsedPdfResult> {
  const fileName = file.name;
  const baseTitle = fileName.replace(/\.pdf$/i, '').replace(/_/g, ' ');

  let structuredChordPro = '';
  let pdfBase64 = '';

  try {
    const buffer = await file.arrayBuffer();
    structuredChordPro = await extractStructuredTextFromPdf(buffer);
  } catch (e) {
    console.warn('Erreur lors de la lecture du PDF:', e);
  }

  // Only convert to base64 if file is under 20MB to prevent client memory crashes
  if (file.size < 20 * 1024 * 1024) {
    try {
      pdfBase64 = await fileToBase64(file);
    } catch (e) {
      console.warn('Erreur conversion Base64:', e);
    }
  }

  // Call Gemini AI server route to refine and format partition with full chords
  try {
    const response = await fetch('/api/ai/parse-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        extractedText: structuredChordPro,
        pdfBase64: pdfBase64 || undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.song) {
        const finalChordPro = data.song.chordProContent || structuredChordPro;
        return {
          song: {
            title: data.song.title || baseTitle,
            artist: data.song.artist || 'Artiste Partition',
            key: data.song.key || 'C',
            bpm: Number(data.song.bpm) || 120,
            timeSignature: data.song.timeSignature || '4/4',
            durationSeconds: Number(data.song.durationSeconds) || 210,
            chordProContent: finalChordPro.includes('[')
              ? finalChordPro
              : `{title: ${baseTitle}}\n\n` + structuredChordPro,
            tags: ['PDF', 'Partition Numérisée'],
            notes: data.song.notes || `Partition PDF ${fileName} numérisée`,
          },
          fileName,
        };
      }
    } else {
      let errMsg = `Erreur HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error || errData.details || errMsg;
      } catch {
        // Response was not JSON
        const rawText = await response.text();
        errMsg = rawText.slice(0, 200) || errMsg;
      }
      console.warn('Erreur API parse-pdf:', errMsg);
    }
  } catch (err) {
    console.error('Erreur API parse-pdf:', err);
  }

  // Local fallback with preserved bracketed chords
  return {
    song: {
      title: baseTitle,
      artist: 'Partition PDF',
      key: 'C',
      bpm: 120,
      timeSignature: '4/4',
      durationSeconds: 210,
      chordProContent: structuredChordPro
        ? `{title: ${baseTitle}}\n\n` + structuredChordPro
        : `{title: ${baseTitle}}\n{key: C}\n\n[Intro]\n[C]  |  [G]  |  [Am]  |  [F]\n\n[Couplet 1]\nParoles extraites de la partition ${fileName}`,
      tags: ['PDF'],
      notes: `Partition PDF ${fileName}`,
    },
    fileName,
  };
}
