import JSZip from 'jszip';
import initSqlJs from 'sql.js';
import { Song, Setlist } from '../types';

let SQL_PROMISE: Promise<any> | null = null;

async function getSqlInstance() {
  if (!SQL_PROMISE) {
    SQL_PROMISE = initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
    }).catch((err) => {
      console.warn('sql.js initialization warning:', err);
      return null;
    });
  }
  return SQL_PROMISE;
}

/**
 * Sanitizes file names for saving inside ZIP archives
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim();
}

/**
 * Creates a MobileSheets SQLite database matching MobileSheets v3+ schema
 */
async function createMobileSheetsDatabase(songs: Song[], setlists?: Setlist[]): Promise<Uint8Array | null> {
  const SQL = await getSqlInstance();
  if (!SQL) return null;

  try {
    const db = new SQL.Database();

    // Create MobileSheets SQLite tables
    db.run(`
      CREATE TABLE IF NOT EXISTS Settings (
        Name TEXT PRIMARY KEY,
        Value TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Songs (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Title TEXT NOT NULL,
        Artist TEXT,
        Album TEXT,
        Genre TEXT,
        Key TEXT,
        OriginalKey TEXT,
        Tempo INTEGER,
        TimeSignature TEXT,
        Duration INTEGER,
        Capo INTEGER,
        Difficulty INTEGER,
        Rating INTEGER,
        Notes TEXT,
        Custom TEXT,
        DateAdded INTEGER,
        LastModified INTEGER
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Files (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        SongId INTEGER NOT NULL,
        Path TEXT NOT NULL,
        PageOrder TEXT,
        Type INTEGER,
        FOREIGN KEY(SongId) REFERENCES Songs(Id) ON DELETE CASCADE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Artists (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL UNIQUE
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS SongArtists (
        SongId INTEGER,
        ArtistId INTEGER,
        PRIMARY KEY(SongId, ArtistId)
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS Setlists (
        Id INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Description TEXT
      );
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS SetlistSongs (
        SetlistId INTEGER,
        SongId INTEGER,
        SongOrder INTEGER,
        PRIMARY KEY(SetlistId, SongId, SongOrder)
      );
    `);

    // Insert Version & Metadata
    db.run("INSERT INTO Settings (Name, Value) VALUES ('DatabaseVersion', '60');");
    db.run("INSERT INTO Settings (Name, Value) VALUES ('AppName', 'LiveSet Chord Master');");

    const artistMap = new Map<string, number>();
    let nextArtistId = 1;

    const songIdMapping = new Map<string, number>();

    // Insert Songs and SongFiles
    songs.forEach((song, index) => {
      const dbSongId = index + 1;
      songIdMapping.set(song.id, dbSongId);

      const cleanArtist = song.artist || 'MobileSheets';
      let artistId = artistMap.get(cleanArtist.toLowerCase());
      if (!artistId) {
        artistId = nextArtistId++;
        artistMap.set(cleanArtist.toLowerCase(), artistId);
        db.run('INSERT OR IGNORE INTO Artists (Id, Name) VALUES (?, ?);', [artistId, cleanArtist]);
      }

      db.run(
        `INSERT INTO Songs (
          Id, Title, Artist, Key, OriginalKey, Tempo, TimeSignature, Duration, Capo, Notes, DateAdded, LastModified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          dbSongId,
          song.title,
          cleanArtist,
          song.key || 'C',
          song.key || 'C',
          song.bpm || 120,
          song.timeSignature || '4/4',
          song.durationSeconds || 210,
          song.capo || 0,
          song.notes || (song.tags ? `Tags: ${song.tags.join(', ')}` : ''),
          song.createdAt || Date.now(),
          song.updatedAt || Date.now(),
        ]
      );

      db.run('INSERT OR IGNORE INTO SongArtists (SongId, ArtistId) VALUES (?, ?);', [dbSongId, artistId]);

      // Associated ChordPro file path inside MSB archive
      const choFileName = `${sanitizeFileName(song.title)}.cho`;
      db.run(
        'INSERT INTO Files (SongId, Path, Type) VALUES (?, ?, 2);',
        [dbSongId, choFileName]
      );
    });

    // Insert Setlists if provided
    if (setlists && setlists.length > 0) {
      setlists.forEach((set, setIndex) => {
        const dbSetlistId = setIndex + 1;
        db.run('INSERT INTO Setlists (Id, Name, Description) VALUES (?, ?, ?);', [
          dbSetlistId,
          set.name,
          set.venue ? `Lieu: ${set.venue}` : '',
        ]);

        let order = 1;
        set.entries.forEach((entry) => {
          if (entry.type === 'song' && entry.songId) {
            const dbSongId = songIdMapping.get(entry.songId);
            if (dbSongId) {
              db.run('INSERT INTO SetlistSongs (SetlistId, SongId, SongOrder) VALUES (?, ?, ?);', [
                dbSetlistId,
                dbSongId,
                order++,
              ]);
            }
          }
        });
      });
    }

    const binaryData = db.export();
    db.close();
    return binaryData;
  } catch (err) {
    console.error('Error generating MobileSheets SQLite DB:', err);
    return null;
  }
}

/**
 * Triggers browser download of a blob with given filename
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Exports full library or selected songs as MobileSheets Backup (.msb)
 */
export async function exportMobileSheetsBackup(
  songs: Song[],
  setlists: Setlist[] = [],
  backupName: string = 'MobileSheets_Backup'
): Promise<void> {
  const zip = new JSZip();

  // 1. Add individual .cho / .chordpro files for each song
  songs.forEach((song) => {
    const choFileName = `${sanitizeFileName(song.title)}.cho`;
    let content = song.chordProContent;
    if (!content.includes('{title:')) {
      content = `{title: ${song.title}}\n{artist: ${song.artist}}\n{key: ${song.key}}\n{bpm: ${song.bpm}}\n{time: ${song.timeSignature || '4/4'}}\n\n${content}`;
    }
    zip.file(choFileName, content);
  });

  // 2. Generate and add MobileSheets SQLite database
  const dbData = await createMobileSheetsDatabase(songs, setlists);
  if (dbData) {
    zip.file('mobilesheets.db', dbData);
  }

  // 3. Add JSON Manifest for third-party tools & cross-compatibility
  const manifest = {
    appName: 'LiveSet & MobileSheets Exporter',
    version: '3.0.0',
    exportDate: new Date().toISOString(),
    songsCount: songs.length,
    setlistsCount: setlists.length,
    songs: songs.map((s) => ({
      title: s.title,
      artist: s.artist,
      key: s.key,
      bpm: s.bpm,
      timeSignature: s.timeSignature,
      durationSeconds: s.durationSeconds,
      capo: s.capo,
      tags: s.tags,
      notes: s.notes,
    })),
    setlists: setlists.map((st) => ({
      name: st.name,
      venue: st.venue,
      entriesCount: st.entries.length,
    })),
  };
  zip.file('mobilesheets_manifest.json', JSON.stringify(manifest, null, 2));

  // Generate .msb binary blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  const finalName = `${sanitizeFileName(backupName)}_${new Date().toISOString().slice(0, 10)}.msb`;
  downloadBlob(zipBlob, finalName);
}

/**
 * Exports a single song or setlist as MobileSheets Song File (.msf)
 */
export async function exportMobileSheetsSongFile(
  songs: Song[],
  fileName: string = 'Song_Export'
): Promise<void> {
  const zip = new JSZip();

  songs.forEach((song) => {
    const choFileName = `${sanitizeFileName(song.title)}.cho`;
    let content = song.chordProContent;
    if (!content.includes('{title:')) {
      content = `{title: ${song.title}}\n{artist: ${song.artist}}\n{key: ${song.key}}\n{bpm: ${song.bpm}}\n{time: ${song.timeSignature || '4/4'}}\n\n${content}`;
    }
    zip.file(choFileName, content);
  });

  const dbData = await createMobileSheetsDatabase(songs);
  if (dbData) {
    zip.file('mobilesheets.db', dbData);
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/octet-stream',
    compression: 'DEFLATE',
  });

  const finalName = `${sanitizeFileName(fileName)}.msf`;
  downloadBlob(zipBlob, finalName);
}

/**
 * Exports a single song as standalone ChordPro (.cho) file
 */
export function exportSingleChordProFile(song: Song) {
  let content = song.chordProContent;
  if (!content.includes('{title:')) {
    content = `{title: ${song.title}}\n{artist: ${song.artist}}\n{key: ${song.key}}\n{bpm: ${song.bpm}}\n{time: ${song.timeSignature || '4/4'}}\n\n${content}`;
  }
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${sanitizeFileName(song.title)}.cho`);
}
