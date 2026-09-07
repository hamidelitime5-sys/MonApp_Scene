import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { Song } from '../types';
import { extractStructuredTextFromPdf } from './pdfParser';

export interface ParsedMobileSheetsResult {
  songs: Partial<Song>[];
  extractedFilesCount: number;
  fileName: string;
}

let SQL_PROMISE: Promise<any> | null = null;

async function getSqlInstance() {
  if (!SQL_PROMISE) {
    SQL_PROMISE = initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
    }).catch((err) => {
      console.warn('sql.js could not be initialized from CDN, using fallback:', err);
      return null;
    });
  }
  return SQL_PROMISE;
}

/**
 * Helper to clean and format title from filename
 */
function cleanSongTitle(raw: string): string {
  if (!raw) return 'Chanson sans titre';
  return raw
    .replace(/\.(msf|msb|pdf|pro|cho|chordpro|txt|crd|json|xml)$/i, '')
    .replace(/^(\d+[-_.\s]+)/, '') // Remove track numbers e.g. "01 - "
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Helper to extract printable strings from a binary buffer (e.g. SQLite records or proprietary binary)
 */
function extractStringsFromBinary(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer);
  const strings: string[] = [];
  let currentStr = '';

  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    if ((byte >= 32 && byte <= 126) || (byte >= 160 && byte <= 255) || byte === 10 || byte === 13) {
      currentStr += String.fromCharCode(byte);
    } else {
      if (currentStr.trim().length >= 3) {
        strings.push(currentStr.trim());
      }
      currentStr = '';
    }
  }
  if (currentStr.trim().length >= 3) {
    strings.push(currentStr.trim());
  }

  return strings;
}

/**
 * Find matching file in ZIP archive regardless of path separators or casing
 */
function findZipEntry(zip: JSZip, targetPath: string): { name: string; file: any } | null {
  if (!targetPath) return null;
  const normalizedTarget = targetPath.replace(/\\/g, '/').trim();
  const baseName = normalizedTarget.split('/').pop()?.toLowerCase() || '';

  // 1. Exact match
  if (zip.files[normalizedTarget]) {
    return { name: normalizedTarget, file: zip.files[normalizedTarget] };
  }

  // 2. Basename match
  for (const zipPath of Object.keys(zip.files)) {
    if (zip.files[zipPath].dir) continue;
    const zipBaseName = zipPath.split('/').pop()?.toLowerCase() || '';
    if (zipBaseName === baseName) {
      return { name: zipPath, file: zip.files[zipPath] };
    }
  }

  // 3. Fuzzy matching by title
  const cleanTargetName = baseName.replace(/\.[^.]+$/, '');
  if (cleanTargetName.length > 2) {
    for (const zipPath of Object.keys(zip.files)) {
      if (zip.files[zipPath].dir) continue;
      const zipBaseName = zipPath.split('/').pop()?.toLowerCase() || '';
      if (zipBaseName.includes(cleanTargetName) || cleanTargetName.includes(zipBaseName.replace(/\.[^.]+$/, ''))) {
        return { name: zipPath, file: zip.files[zipPath] };
      }
    }
  }

  return null;
}

/**
 * Main parser for MobileSheets .msf and .msb files
 */
export async function parseMobileSheetsFile(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<ParsedMobileSheetsResult> {
  const songsMap = new Map<string, Partial<Song>>();
  let totalFilesCount = 0;
  const baseDefaultTitle = cleanSongTitle(fileName);

  // -------------------------------------------------------------
  // STEP 1: Attempt to treat the file as a ZIP archive
  // -------------------------------------------------------------
  let zip: JSZip | null = null;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
    totalFilesCount = Object.keys(zip.files).length;
  } catch (zipErr) {
    console.warn('Le fichier n\'est pas une archive ZIP standard. Tentative de lecture SQLite directe...', zipErr);
  }

  if (zip) {
    const allZipPaths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
    const dbPaths = allZipPaths.filter((p) => /\.(db|sqlite|sqlite3|db3|msf)$/i.test(p) || p.toLowerCase().includes('mobilesheets'));
    const pdfPaths = allZipPaths.filter((p) => /\.pdf$/i.test(p));
    const chordProPaths = allZipPaths.filter((p) => /\.(pro|cho|chopro|chordpro|crd|txt)$/i.test(p));
    const xmlPaths = allZipPaths.filter((p) => /\.xml$/i.test(p));
    const jsonPaths = allZipPaths.filter((p) => /\.json$/i.test(p));

    const processedPdfPaths = new Set<string>();
    const processedChordProPaths = new Set<string>();

    // 1.1 Process SQLite database inside the MobileSheets archive
    for (const dbPath of dbPaths) {
      try {
        const dbBuffer = await zip.files[dbPath].async('arraybuffer');
        const SQL = await getSqlInstance();

        if (SQL) {
          try {
            const db = new SQL.Database(new Uint8Array(dbBuffer));

            // Query existing tables
            const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
            const existingTables = new Set<string>();
            if (tablesResult.length > 0 && tablesResult[0].values) {
              tablesResult[0].values.forEach((row: any[]) => existingTables.add(String(row[0]).toLowerCase()));
            }

            if (existingTables.has('songs')) {
              // Try comprehensive Songs query
              let songsQuery = 'SELECT * FROM Songs;';
              const songsStmt = db.exec(songsQuery);

              if (songsStmt.length > 0) {
                const columns = songsStmt[0].columns.map((c: string) => c.toLowerCase());
                const rows = songsStmt[0].values;

                // Also query Files / SongFiles if exists
                const filesBySongId = new Map<number, string[]>();
                if (existingTables.has('files') || existingTables.has('songfiles')) {
                  const tableName = existingTables.has('files') ? 'Files' : 'SongFiles';
                  try {
                    const filesStmt = db.exec(`SELECT * FROM ${tableName};`);
                    if (filesStmt.length > 0) {
                      const fCols = filesStmt[0].columns.map((c: string) => c.toLowerCase());
                      const songIdIdx = fCols.indexOf('songid');
                      const pathIdx = fCols.indexOf('path') !== -1 ? fCols.indexOf('path') : fCols.indexOf('filename');

                      if (songIdIdx !== -1 && pathIdx !== -1) {
                        filesStmt[0].values.forEach((fRow: any[]) => {
                          const sId = Number(fRow[songIdIdx]);
                          const fPath = String(fRow[pathIdx] || '');
                          if (sId && fPath) {
                            if (!filesBySongId.has(sId)) filesBySongId.set(sId, []);
                            filesBySongId.get(sId)!.push(fPath);
                          }
                        });
                      }
                    }
                  } catch (fErr) {
                    console.warn('Erreur lecture table Files:', fErr);
                  }
                }

                // Also query Artists if exists
                const artistsBySongId = new Map<number, string>();
                if (existingTables.has('songartists') && existingTables.has('artists')) {
                  try {
                    const artStmt = db.exec(`
                      SELECT sa.SongId, a.Name 
                      FROM SongArtists sa 
                      JOIN Artists a ON a.Id = sa.ArtistId;
                    `);
                    if (artStmt.length > 0) {
                      artStmt[0].values.forEach((aRow: any[]) => {
                        const sId = Number(aRow[0]);
                        const aName = String(aRow[1] || '');
                        if (sId && aName) artistsBySongId.set(sId, aName);
                      });
                    }
                  } catch {
                    // Ignore artist join error
                  }
                }

                // Process each row in Songs table
                for (const row of rows) {
                  const getVal = (colName: string) => {
                    const idx = columns.indexOf(colName.toLowerCase());
                    return idx !== -1 ? row[idx] : undefined;
                  };

                  const songId = Number(getVal('id') || 0);
                  const title = String(getVal('title') || getVal('name') || '').trim();
                  if (!title) continue;

                  const artist =
                    artistsBySongId.get(songId) ||
                    String(getVal('artist') || getVal('artists') || getVal('composer') || 'MobileSheets').trim();
                  const key = String(getVal('key') || getVal('originalkey') || 'C').trim();
                  const bpm = Number(getVal('tempo') || getVal('bpm') || 120) || 120;
                  const timeSig = String(getVal('timesignature') || getVal('time') || '4/4').trim();
                  const durationSecs = Number(getVal('duration') || 210) || 210;
                  const capo = Number(getVal('capo') || 0);
                  const notes = String(getVal('notes') || getVal('custom') || getVal('customgroup') || '').trim();

                  let extractedChordPro = '';
                  let attachedFileName = '';

                  // Look for attached files for this song
                  const attachedPaths = filesBySongId.get(songId) || [];
                  // If no direct attached path, look for matching PDF or ChordPro with song title
                  if (attachedPaths.length === 0) {
                    const matchPdf = pdfPaths.find((p) => cleanSongTitle(p).toLowerCase() === title.toLowerCase());
                    if (matchPdf) attachedPaths.push(matchPdf);
                    const matchCho = chordProPaths.find((p) => cleanSongTitle(p).toLowerCase() === title.toLowerCase());
                    if (matchCho) attachedPaths.push(matchCho);
                  }

                  for (const rawFilePath of attachedPaths) {
                    const matchedEntry = findZipEntry(zip, rawFilePath);
                    if (matchedEntry) {
                      attachedFileName = matchedEntry.name;
                      if (/\.pdf$/i.test(matchedEntry.name)) {
                        processedPdfPaths.add(matchedEntry.name);
                        try {
                          const pdfBuf = await matchedEntry.file.async('arraybuffer');
                          const pdfText = await extractStructuredTextFromPdf(pdfBuf);
                          if (pdfText && pdfText.trim().length > 0) {
                            extractedChordPro = pdfText;
                          }
                        } catch (pErr) {
                          console.warn('Erreur extraction PDF dans MSF:', pErr);
                        }
                      } else if (/\.(pro|cho|chopro|chordpro|crd|txt)$/i.test(matchedEntry.name)) {
                        processedChordProPaths.add(matchedEntry.name);
                        try {
                          const choText = await matchedEntry.file.async('string');
                          if (choText && choText.trim().length > 0) {
                            extractedChordPro = choText;
                          }
                        } catch (cErr) {
                          console.warn('Erreur extraction ChordPro dans MSF:', cErr);
                        }
                      }
                    }
                  }

                  // Build complete, robust ChordPro content
                  let finalChordPro = '';
                  if (extractedChordPro && extractedChordPro.includes('{title:')) {
                    finalChordPro = extractedChordPro;
                  } else if (extractedChordPro) {
                    finalChordPro = `{title: ${title}}\n{artist: ${artist}}\n{key: ${key}}\n{bpm: ${bpm}}\n{time: ${timeSig}}\n\n${extractedChordPro}`;
                  } else {
                    finalChordPro = `{title: ${title}}\n{artist: ${artist}}\n{key: ${key}}\n{bpm: ${bpm}}\n{time: ${timeSig}}\n\n[Section 1]\nPartition importée de MobileSheets${attachedFileName ? ` (${attachedFileName})` : ''}\nUtilisez l'Éditeur d'Accords ou le Nettoyeur IA pour harmoniser cette partition.`;
                  }

                  songsMap.set(title.toLowerCase(), {
                    title,
                    artist: artist || 'MobileSheets',
                    key: key || 'C',
                    bpm: bpm || 120,
                    timeSignature: timeSig || '4/4',
                    durationSeconds: durationSecs,
                    capo: capo > 0 ? capo : undefined,
                    chordProContent: finalChordPro,
                    tags: ['MobileSheets', '.msf'],
                    notes: notes || `Importé depuis MobileSheets (${fileName})`,
                  });
                }
              }
            }
            db.close();
          } catch (dbExecErr) {
            console.warn('Erreur exécution SQLite MobileSheets:', dbExecErr);
          }
        }
      } catch (dbReadErr) {
        console.warn('Erreur lecture fichier DB dans zip:', dbReadErr);
      }
    }

    // 1.2 Process all remaining PDF files in the archive that were not yet parsed
    for (const pdfPath of pdfPaths) {
      if (processedPdfPaths.has(pdfPath)) continue;

      const pdfTitle = cleanSongTitle(pdfPath);
      // Check if already in songsMap
      if (songsMap.has(pdfTitle.toLowerCase())) {
        const existing = songsMap.get(pdfTitle.toLowerCase())!;
        if (!existing.chordProContent || existing.chordProContent.includes('Partition importée de MobileSheets')) {
          try {
            const pdfBuf = await zip.files[pdfPath].async('arraybuffer');
            const pdfText = await extractStructuredTextFromPdf(pdfBuf);
            if (pdfText && pdfText.trim()) {
              existing.chordProContent = `{title: ${existing.title}}\n{artist: ${existing.artist}}\n{key: ${existing.key}}\n\n${pdfText}`;
            }
          } catch {
            // Ignore
          }
        }
        continue;
      }

      try {
        const pdfBuf = await zip.files[pdfPath].async('arraybuffer');
        const pdfText = await extractStructuredTextFromPdf(pdfBuf);

        songsMap.set(pdfTitle.toLowerCase(), {
          title: pdfTitle,
          artist: 'MobileSheets',
          key: 'C',
          bpm: 120,
          timeSignature: '4/4',
          durationSeconds: 210,
          chordProContent: pdfText && pdfText.trim()
            ? `{title: ${pdfTitle}}\n{artist: MobileSheets}\n{key: C}\n\n${pdfText}`
            : `{title: ${pdfTitle}}\n{artist: MobileSheets}\n{key: C}\n\n[Intro]\n[C]  |  [G]  |  [Am]  |  [F]\n\n[Couplet 1]\nPartition extraite du fichier ${pdfPath}`,
          tags: ['MobileSheets', 'PDF', '.msf'],
          notes: `Fichier PDF ${pdfPath} extrait de l'archive MobileSheets`,
        });
        processedPdfPaths.add(pdfPath);
      } catch (err) {
        console.warn(`Erreur lecture PDF ${pdfPath}:`, err);
      }
    }

    // 1.3 Process all remaining ChordPro / Text files in the archive
    for (const choPath of chordProPaths) {
      if (processedChordProPaths.has(choPath)) continue;

      try {
        const text = await zip.files[choPath].async('string');
        if (!text || !text.trim()) continue;

        let choTitle = cleanSongTitle(choPath);
        let choArtist = 'MobileSheets';
        let choKey = 'C';
        let choBpm = 120;
        let choTime = '4/4';

        const tMatch = text.match(/\{title:\s*([^}]+)\}/i) || text.match(/\{t:\s*([^}]+)\}/i);
        if (tMatch) choTitle = tMatch[1].trim();

        const aMatch = text.match(/\{artist:\s*([^}]+)\}/i) || text.match(/\{a:\s*([^}]+)\}/i);
        if (aMatch) choArtist = aMatch[1].trim();

        const kMatch = text.match(/\{key:\s*([^}]+)\}/i) || text.match(/\{k:\s*([^}]+)\}/i);
        if (kMatch) choKey = kMatch[1].trim();

        const bMatch = text.match(/\{bpm:\s*(\d+)\}/i) || text.match(/\{tempo:\s*(\d+)\}/i);
        if (bMatch) choBpm = parseInt(bMatch[1], 10) || 120;

        const timeMatch = text.match(/\{time:\s*([^}]+)\}/i);
        if (timeMatch) choTime = timeMatch[1].trim();

        songsMap.set(choTitle.toLowerCase(), {
          title: choTitle,
          artist: choArtist,
          key: choKey,
          bpm: choBpm,
          timeSignature: choTime,
          durationSeconds: 210,
          chordProContent: text.includes('{title:')
            ? text
            : `{title: ${choTitle}}\n{artist: ${choArtist}}\n{key: ${choKey}}\n\n${text}`,
          tags: ['MobileSheets', 'ChordPro', '.msf'],
          notes: `Fichier ChordPro ${choPath} extrait de l'archive MobileSheets`,
        });
        processedChordProPaths.add(choPath);
      } catch (err) {
        console.warn(`Erreur lecture ChordPro ${choPath}:`, err);
      }
    }

    // 1.4 Process XML / JSON metadata files
    for (const xmlPath of xmlPaths) {
      try {
        const content = await zip.files[xmlPath].async('string');
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        const songNodes = xmlDoc.querySelectorAll('Song, song, MobileSheetsSong, item, SongData');

        songNodes.forEach((node) => {
          const title =
            node.querySelector('Title, title, Name, name')?.textContent ||
            node.getAttribute('title') ||
            '';
          if (!title || songsMap.has(title.trim().toLowerCase())) return;

          const artist =
            node.querySelector('Artist, artist, Composer, composer')?.textContent ||
            node.getAttribute('artist') ||
            'MobileSheets';
          const key =
            node.querySelector('Key, key, OriginalKey')?.textContent ||
            node.getAttribute('key') ||
            'C';
          const bpmStr =
            node.querySelector('Tempo, tempo, BPM, bpm')?.textContent ||
            node.getAttribute('bpm') ||
            '120';
          const timeSig =
            node.querySelector('TimeSignature, timeSignature, Time')?.textContent ||
            node.getAttribute('time') ||
            '4/4';
          const chordsOrText =
            node.querySelector('ChordPro, chordpro, Text, text, Content, content')?.textContent || '';

          songsMap.set(title.trim().toLowerCase(), {
            title: title.trim(),
            artist: artist.trim(),
            key: key.trim() || 'C',
            bpm: parseInt(bpmStr, 10) || 120,
            timeSignature: timeSig.trim() || '4/4',
            durationSeconds: 210,
            chordProContent: chordsOrText.includes('{title:')
              ? chordsOrText
              : `{title: ${title.trim()}}\n{artist: ${artist.trim()}}\n{key: ${key.trim() || 'C'}}\n\n` +
                (chordsOrText || '[Couplet 1]\nParoles et accords MobileSheets'),
            tags: ['MobileSheets', '.msf'],
            notes: `Extrait XML de ${xmlPath}`,
          });
        });
      } catch {
        // Ignore XML error
      }
    }

    for (const jsonPath of jsonPaths) {
      try {
        const content = await zip.files[jsonPath].async('string');
        const data = JSON.parse(content);
        const items = Array.isArray(data) ? data : data.songs || [data];

        for (const item of items) {
          const itemTitle = item.title || item.Title || item.Name;
          if (!itemTitle || songsMap.has(itemTitle.trim().toLowerCase())) continue;

          songsMap.set(itemTitle.trim().toLowerCase(), {
            title: itemTitle.trim(),
            artist: item.artist || item.Artist || item.Composer || 'MobileSheets',
            key: item.key || item.Key || item.OriginalKey || 'C',
            bpm: Number(item.bpm || item.tempo || item.Tempo) || 120,
            timeSignature: item.timeSignature || item.TimeSignature || '4/4',
            durationSeconds: Number(item.duration || item.Duration) || 210,
            chordProContent:
              item.chordPro ||
              item.chordProContent ||
              item.content ||
              item.text ||
              `{title: ${itemTitle}}\n{artist: ${item.artist || 'MobileSheets'}}\n\n[Couplet 1]\nParoles de la chanson`,
            tags: ['MobileSheets', '.msf'],
            notes: item.notes || item.Notes || `Importé depuis JSON ${fileName}`,
          });
        }
      } catch {
        // Ignore JSON error
      }
    }
  }

  // -------------------------------------------------------------
  // STEP 2: If the file was not a ZIP (direct SQLite or text file)
  // -------------------------------------------------------------
  if (songsMap.size === 0) {
    try {
      const SQL = await getSqlInstance();
      if (SQL) {
        try {
          const db = new SQL.Database(new Uint8Array(arrayBuffer));
          const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table';");
          const existingTables = new Set<string>();
          if (tablesResult.length > 0 && tablesResult[0].values) {
            tablesResult[0].values.forEach((row: any[]) => existingTables.add(String(row[0]).toLowerCase()));
          }

          if (existingTables.has('songs')) {
            const songsStmt = db.exec('SELECT * FROM Songs;');
            if (songsStmt.length > 0) {
              const columns = songsStmt[0].columns.map((c: string) => c.toLowerCase());
              const rows = songsStmt[0].values;

              for (const row of rows) {
                const getVal = (colName: string) => {
                  const idx = columns.indexOf(colName.toLowerCase());
                  return idx !== -1 ? row[idx] : undefined;
                };

                const title = String(getVal('title') || getVal('name') || '').trim();
                if (!title) continue;

                const artist = String(getVal('artist') || getVal('artists') || getVal('composer') || 'MobileSheets').trim();
                const key = String(getVal('key') || getVal('originalkey') || 'C').trim();
                const bpm = Number(getVal('tempo') || getVal('bpm') || 120) || 120;
                const timeSig = String(getVal('timesignature') || getVal('time') || '4/4').trim();
                const notes = String(getVal('notes') || getVal('custom') || '').trim();

                songsMap.set(title.toLowerCase(), {
                  title,
                  artist: artist || 'MobileSheets',
                  key: key || 'C',
                  bpm: bpm || 120,
                  timeSignature: timeSig || '4/4',
                  durationSeconds: 210,
                  chordProContent: `{title: ${title}}\n{artist: ${artist}}\n{key: ${key}}\n{bpm: ${bpm}}\n{time: ${timeSig}}\n\n[Intro]\n[C]  |  [G]  |  [Am]  |  [F]\n\n[Couplet 1]\nPartition importée de la base MobileSheets (${fileName})\nUtilisez l'Éditeur d'Accords ou le Nettoyeur IA pour insérer vos accords.`,
                  tags: ['MobileSheets', 'SQLite', '.msf'],
                  notes: notes || `Base MobileSheets ${fileName}`,
                });
              }
            }
          }
          db.close();
        } catch (dbErr) {
          console.warn('Erreur lecture directe SQLite:', dbErr);
        }
      }
    } catch {
      // Ignore
    }
  }

  // -------------------------------------------------------------
  // STEP 3: Fallback text / binary string scanner
  // -------------------------------------------------------------
  if (songsMap.size === 0) {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = decoder.decode(arrayBuffer);

      if (rawText.includes('{title:') || rawText.includes('{t:') || rawText.includes('<Song')) {
        let extractedTitle = baseDefaultTitle;
        let extractedArtist = 'MobileSheets';
        let extractedKey = 'C';

        const titleMatch = rawText.match(/\{title:\s*([^}]+)\}/i) || rawText.match(/<Title>([^<]+)<\/Title>/i);
        if (titleMatch) extractedTitle = titleMatch[1].trim();

        const artistMatch = rawText.match(/\{artist:\s*([^}]+)\}/i) || rawText.match(/<Artist>([^<]+)<\/Artist>/i);
        if (artistMatch) extractedArtist = artistMatch[1].trim();

        const keyMatch = rawText.match(/\{key:\s*([^}]+)\}/i) || rawText.match(/<Key>([^<]+)<\/Key>/i);
        if (keyMatch) extractedKey = keyMatch[1].trim();

        songsMap.set(extractedTitle.toLowerCase(), {
          title: extractedTitle,
          artist: extractedArtist,
          key: extractedKey,
          bpm: 120,
          timeSignature: '4/4',
          durationSeconds: 210,
          chordProContent: rawText.includes('{title:')
            ? rawText
            : `{title: ${extractedTitle}}\n{artist: ${extractedArtist}}\n{key: ${extractedKey}}\n\n${rawText}`,
          tags: ['MobileSheets', '.msf'],
          notes: `Importé depuis le fichier texte MobileSheets ${fileName}`,
        });
      } else {
        const strings = extractStringsFromBinary(arrayBuffer);
        const validLines = strings.filter(
          (s) =>
            s.length > 3 &&
            s.length < 80 &&
            !s.startsWith('SQLite') &&
            !s.startsWith('FORMAT') &&
            !s.includes('CREATE TABLE') &&
            !s.includes('sqlite_') &&
            !s.includes('index')
        );

        if (validLines.length > 0) {
          // Take distinct title candidates
          const uniqueTitles = Array.from(new Set(validLines)).slice(0, 10);
          uniqueTitles.forEach((t) => {
            songsMap.set(t.toLowerCase(), {
              title: t,
              artist: 'MobileSheets Import',
              key: 'C',
              bpm: 120,
              timeSignature: '4/4',
              durationSeconds: 210,
              chordProContent: `{title: ${t}}\n{artist: MobileSheets}\n{key: C}\n\n[Couplet 1]\nChanson extraite du fichier MobileSheets ${fileName}`,
              tags: ['MobileSheets', '.msf'],
              notes: `Extrait binaire de ${fileName}`,
            });
          });
        }
      }
    } catch (rawErr) {
      console.warn('Erreur lecture brute:', rawErr);
    }
  }

  // -------------------------------------------------------------
  // STEP 4: Ultimate guarantee
  // -------------------------------------------------------------
  if (songsMap.size === 0) {
    songsMap.set(baseDefaultTitle.toLowerCase(), {
      title: baseDefaultTitle || 'Chanson MobileSheets',
      artist: 'MobileSheets',
      key: 'C',
      bpm: 120,
      timeSignature: '4/4',
      durationSeconds: 210,
      chordProContent: `{title: ${baseDefaultTitle}}\n{artist: MobileSheets}\n{key: C}\n\n[Intro]\n[C]  |  [G]  |  [Am]  |  [F]\n\n[Couplet 1]\nPartition issue du fichier ${fileName}`,
      tags: ['MobileSheets', '.msf'],
      notes: `Fichier conteneur MobileSheets ${fileName}`,
    });
  }

  const finalSongsList = Array.from(songsMap.values());

  return {
    songs: finalSongsList,
    extractedFilesCount: Math.max(totalFilesCount, finalSongsList.length),
    fileName,
  };
}
