import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

// Safe directory resolution compatible with both CJS bundling and native Node ESM
const getAppDir = () => {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return process.cwd();
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Configure body parsers with generous 50MB limit for large PDF base64 payloads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // JSON / Body-parser error handler to return JSON instead of HTML error pages
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Body parser error:', err);
      if (err.type === 'entity.too.large' || err.status === 413) {
        return res.status(413).json({
          success: false,
          error: 'Le fichier PDF est trop volumineux (dépasse la limite autorisée).',
          details: 'PayloadTooLargeError: Le document PDF dépasse la taille maximale autorisée.',
        });
      }
      return res.status(400).json({
        success: false,
        error: 'Erreur lors du traitement des données reçues.',
        details: err.message || String(err),
      });
    }
    next();
  });

  // Helper to extract JSON from Gemini text response safely
  function extractJsonFromText(text: string): any {
    if (!text) throw new Error('Réponse vide de l\'IA');
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const startIdx = clean.indexOf('{');
      const endIdx = clean.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        const jsonSubstring = clean.substring(startIdx, endIdx + 1);
        return JSON.parse(jsonSubstring);
      }
      throw new Error('Impossible de parser le JSON retourné par le modèle');
    }
  }

  // Gemini AI Client Lazy Initialization
  function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is missing');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Safe Gemini caller with multi-model fallback and quota resilience
  async function generateContentSafe(promptOrContents: any): Promise<string> {
    const ai = getGeminiClient();
    const modelsToTry = ['gemini-3.7-flash', 'gemini-3.1-flash-lite'];

    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: promptOrContents,
        });
        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`Gemini call failed with model ${model}:`, errMsg);
        // If quota limit or rate-limit, continue to next fallback model
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
          continue;
        }
        break;
      }
    }
    throw lastError || new Error('Gemini generation failed');
  }

  // Fallback Local Musical Generator for Songs
  function generateLocalSong(title: string, artist?: string, style?: string) {
    const cleanTitle = title || 'Nouvelle Chanson';
    const cleanArtist = artist || 'Artiste Répertoire';
    const key = 'G';
    const bpm = 120;

    return {
      title: cleanTitle,
      artist: cleanArtist,
      key,
      bpm,
      timeSignature: '4/4',
      durationSeconds: 210,
      capo: 0,
      tags: ['Généré', style || 'Variété / Pop'],
      notes: 'Grille d\'accords structurée par le moteur musical LiveSet Pro',
      chordProContent: `{title: ${cleanTitle}}\n{artist: ${cleanArtist}}\n{key: ${key}}\n\n[Intro]\n[G]  |  [D]  |  [Em]  |  [C]\n\n[Couplet 1]\n[G]Paroles du premier couplet pour [D]commencer le morceau\n[Em]Harmonie et progression fluide [C]vers le refrain\n[G]Chaque mesure est calibrée [D]pour la scène\n[C]Préparation du [D]refrain\n\n[Refrain]\n[G]Refrain puissant et fédérateur [D]pour le public\n[Em]Mélodie accrocheuse et [C]chords ouverts\n[G]L'énergie monte en puissance [D]sur scène\n[C]  |  [D]  |  [G]\n\n[Pont]\n[Em]Section de transition intimiste [Bm]\n[C]Reprise de la dynamique avant [D]le grand final\n\n[Refrain]\n[G]Refrain final et [D]apothéose\n[Em]  |  [C]  |  [G]\n\n[Outro]\n[G]  |  [D]  |  [C]  |  [G]`
    };
  }

  // Fallback Local Musical Harmonizer for MIDI
  function harmonizeMidiLocally(title: string, rawMidiInfo?: string, draftChordPro?: string, estimatedKey?: string, bpm?: number, timeSignature?: string) {
    const cleanTitle = title || 'Chanson MIDI';
    const key = estimatedKey || 'C';
    const beats = bpm || 120;
    const ts = timeSignature || '4/4';

    // Extract chords from draft if present
    const chordMatches = draftChordPro ? draftChordPro.match(/\[([A-G][b#]?[a-zA-Z0-9/]*)\]/g) : null;
    const extractedChords = chordMatches ? Array.from(new Set(chordMatches.map(c => c.replace(/[\[\]]/g, '')))) : ['C', 'G', 'Am', 'F'];
    const safeChords = extractedChords.length >= 2 ? extractedChords : [key, 'G', 'Am', 'F'];

    const c1 = safeChords[0] || 'C';
    const c2 = safeChords[1] || 'G';
    const c3 = safeChords[2] || 'Am';
    const c4 = safeChords[3] || 'F';

    return {
      title: cleanTitle,
      artist: 'MIDI Harmonisé',
      key,
      bpm: beats,
      timeSignature: ts,
      durationSeconds: 210,
      notes: 'Grille MIDI structurée et harmonisée par le moteur musical LiveSet',
      chordProContent: `{title: ${cleanTitle}}\n{artist: MIDI Harmonisé}\n{key: ${key}}\n\n[Intro]\n[${c1}]  |  [${c2}]  |  [${c3}]  |  [${c4}]\n\n[Couplet 1]\n[${c1}]Mélodie et séquence d'accords [${c2}]extraites du fichier MIDI\n[${c3}]Progression harmonique calée sur la [${c4}]mesure\n\n[Refrain]\n[${c1}]Thème principal et harmonisation [${c2}]de scène\n[${c3}]Accompagnement guitare & clavier [${c4}]\n\n[Pont]\n[${c3}]  |  [${c4}]  |  [${c1}]  |  [${c2}]\n\n[Outro]\n[${c1}]  |  [${c2}]  |  [${c4}]  |  [${c1}]`
    };
  }

  // Fallback Local Setlist Generator
  function generateLocalSetlist(venue?: string, targetDurationMinutes?: number, vibe?: string, existingSongs?: any[]) {
    const targetMins = targetDurationMinutes || 45;
    const songsList = Array.isArray(existingSongs) && existingSongs.length > 0 ? existingSongs : [];

    // Sort songs or create dynamic tracks
    const selectedSongs = songsList.length > 0
      ? songsList.slice(0, Math.min(8, songsList.length))
      : [
          { title: 'Ouverture Énergique', artist: 'Groupe Live', key: 'G', bpm: 130, durationSeconds: 240, chordProContent: '[Intro]\n[G]  |  [C]  |  [D]' },
          { title: 'Titre Dynamique', artist: 'Groupe Live', key: 'D', bpm: 124, durationSeconds: 210, chordProContent: '[Verse 1]\n[D]Dynamique [G]scène [A]' },
          { title: 'Ballade Intimiste', artist: 'Groupe Live', key: 'Am', bpm: 85, durationSeconds: 270, chordProContent: '[Verse 1]\n[Am]Douceur [F]intimiste [C] [G]' },
          { title: 'Climax & Singalong', artist: 'Groupe Live', key: 'E', bpm: 128, durationSeconds: 250, chordProContent: '[Chorus]\n[E]Chœur public [A] [B]' },
          { title: 'Final en Apothéose', artist: 'Groupe Live', key: 'A', bpm: 135, durationSeconds: 300, chordProContent: '[Outro]\n[A]Final [D] [E] [A]' },
        ];

    const tracks: any[] = [];
    let currentSecs = 0;
    const targetSecs = targetMins * 60;

    selectedSongs.forEach((s, idx) => {
      if (currentSecs >= targetSecs && idx > 2) return;
      tracks.push({
        type: 'song',
        title: s.title || `Morceau ${idx + 1}`,
        artist: s.artist || 'Artiste',
        key: s.key || 'C',
        bpm: s.bpm || 120,
        durationSeconds: s.durationSeconds || 210,
        chordProContent: s.chordProContent || '[Intro]\n[C]  |  [G]  |  [Am]  |  [F]',
      });
      currentSecs += (s.durationSeconds || 210);

      // Add interlude mid-set
      if (idx === Math.floor(selectedSongs.length / 2)) {
        tracks.push({
          type: 'interlude',
          interludeTitle: 'Accordage & Présentation des Musiciens',
          interludeDurationSeconds: 90,
          notes: 'Transition de scène et mot pour le public',
        });
        currentSecs += 90;
      }
    });

    return {
      setlistName: `Setlist ${vibe || 'Concert'} - ${venue || 'Scène'}`,
      targetDurationMinutes: targetMins,
      tags: ['Optimisé', vibe || 'Concert Live'],
      recommendations: 'Démarrez fort avec un titre entraînant, placez l\'acoustique au milieu et finissez sur le morceau signature.',
      tracks,
    };
  }

  // API Endpoint: Generate Chords & Lyrics for Song
  app.post('/api/ai/generate-song', async (req, res) => {
    try {
      const { title, artist, style } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Song title is required' });
      }

      const prompt = `You are a professional music arranger and chord chart writer for live band performances.
Generate a complete, accurate ChordPro-formatted chord chart and lyrics sheet for:
Song Title: "${title}"
Artist: "${artist || 'Unknown'}"
Style/Genre: "${style || 'Pop/Rock'}"

Please respond ONLY with valid raw JSON adhering strictly to this JSON structure (no markdown fences, no formatting backticks):
{
  "title": "${title}",
  "artist": "${artist || 'Original Artist'}",
  "key": "G",
  "bpm": 120,
  "timeSignature": "4/4",
  "durationSeconds": 210,
  "capo": 0,
  "tags": ["Rock", "Live"],
  "notes": "Performance notes for band",
  "chordProContent": "{title: ${title}}\\n{artist: ${artist || 'Artist'}}\\n{key: G}\\n\\n[Verse 1]\\n[G]Lyrics here [C]with embedded [D]chords\\n\\n[Chorus]\\n[C]Chorus lyrics [G]here [D]again"
}

Make sure chords are in bracket syntax like [Am], [G/B], [Cadd9], [D7].
Provide accurate verse, chorus, bridge sections.`;

      try {
        const responseText = await generateContentSafe(prompt);
        const songData = extractJsonFromText(responseText);
        return res.json({ success: true, song: songData });
      } catch (geminiErr) {
        console.warn('Gemini song generation fell back to local musical engine:', geminiErr);
        const fallbackSong = generateLocalSong(title, artist, style);
        return res.json({ success: true, song: fallbackSong, isFallback: true });
      }
    } catch (error) {
      console.error('Error generating song:', error);
      const fallbackSong = generateLocalSong(req.body?.title, req.body?.artist, req.body?.style);
      return res.json({ success: true, song: fallbackSong, isFallback: true });
    }
  });

  // API Endpoint: Refine & Harmonize MIDI Draft Chart
  app.post('/api/ai/refine-midi', async (req, res) => {
    try {
      const { title, rawMidiInfo, draftChordPro, estimatedKey, bpm, timeSignature } = req.body;

      const prompt = `You are an expert music producer and audio transcription specialist.
A user imported a raw MIDI file named "${title || 'Untitled'}".
Raw MIDI information:
- Estimated Key: ${estimatedKey || 'C'}
- Tempo: ${bpm || 120} BPM
- Time Signature: ${timeSignature || '4/4'}
- Technical Note Summary: "${rawMidiInfo || 'MIDI notes extracted'}"

Draft Chord Sequence extracted from raw MIDI:
${draftChordPro || 'None'}

Your task:
Analyze this MIDI draft and convert it into a clean, musically coherent, professional ChordPro song sheet with lyrics/structure suitable for live musicians.
1. Organize the song into standard sections like [Intro], [Couplet 1], [Refrain], [Pont], [Outro].
2. Standardize the chords to clean, standard guitar/piano notation (e.g., C, G, Am, F, Dm, Em, G7, Cadd9) avoiding messy or accidental chords.
3. Add song structure placeholders if lyrics are missing.

Respond ONLY with valid raw JSON adhering strictly to this JSON structure (no markdown fences, no formatting backticks):
{
  "title": "${title || 'Song title'}",
  "artist": "MIDI Arranged",
  "key": "${estimatedKey || 'C'}",
  "bpm": ${bpm || 120},
  "timeSignature": "${timeSignature || '4/4'}",
  "durationSeconds": 210,
  "notes": "Grille MIDI nettoyée et harmonisée par l'IA Gemini",
  "chordProContent": "{title: ${title || 'Song'}}\\n{key: ${estimatedKey || 'C'}}\\n\\n[Intro]\\n[C]  |  [G]  |  [Am]  |  [F]\\n\\n[Couplet 1]\\n[C]Paroles de la chanson [G]ici\\n[Am]Grille d'accords optimisée [F]depuis le MIDI"
}`;

      try {
        const responseText = await generateContentSafe(prompt);
        const refinedSong = extractJsonFromText(responseText);
        return res.json({ success: true, song: refinedSong });
      } catch (geminiErr) {
        console.warn('Gemini MIDI refinement fell back to local harmonizer engine:', geminiErr);
        const fallbackSong = harmonizeMidiLocally(title, rawMidiInfo, draftChordPro, estimatedKey, bpm, timeSignature);
        return res.json({ success: true, song: fallbackSong, isFallback: true });
      }
    } catch (error) {
      console.error('Error refining MIDI:', error);
      const fallbackSong = harmonizeMidiLocally(req.body?.title, req.body?.rawMidiInfo, req.body?.draftChordPro, req.body?.estimatedKey, req.body?.bpm, req.body?.timeSignature);
      return res.json({ success: true, song: fallbackSong, isFallback: true });
    }
  });

  // API Endpoint: AI Setlist Generator
  app.post('/api/ai/suggest-setlist', async (req, res) => {
    try {
      const { venue, targetDurationMinutes, vibe, existingSongs, songs } = req.body;
      const librarySongs = existingSongs || songs || [];

      const prompt = `You are a veteran live music concert producer and setlist master.
Create a high-energy, well-paced performance setlist for a live band concert.

Venue/Event: "${venue || 'Main Concert Stage'}"
Target Duration: ${targetDurationMinutes || 45} minutes
Vibe/Genre: "${vibe || 'High-energy rock and pop crowd-pleasing show'}"
Available Library Songs: ${JSON.stringify(librarySongs || [])}

Create a setlist that flows dynamically (e.g., strong opener, high-energy peak, mid-set ballad, crowd singalong, epic encore closer).
Include interludes (e.g. guitar tuning, band intro speech, acoustic swap).

Respond ONLY with valid JSON in this exact structure (no markdown, no code blocks):
{
  "setlistName": "Generated Setlist Name",
  "targetDurationMinutes": ${targetDurationMinutes || 45},
  "tags": ["Festival", "High Energy"],
  "recommendations": "Pacing advice for the band",
  "tracks": [
    {
      "type": "song",
      "title": "Song Title",
      "artist": "Artist",
      "key": "D",
      "bpm": 120,
      "durationSeconds": 240,
      "chordProContent": "[Verse 1]\\n[D]Sample [G]chords\\n\\n[Chorus]\\n[A]Sample [D]lyrics"
    },
    {
      "type": "interlude",
      "interludeTitle": "Vocal Welcome Speech & Acoustic Swap",
      "interludeDurationSeconds": 90,
      "notes": "Transition from electric to acoustic guitar."
    }
  ]
}`;

      try {
        const responseText = await generateContentSafe(prompt);
        const setlistResult = extractJsonFromText(responseText);
        return res.json({ success: true, setlist: setlistResult });
      } catch (geminiErr) {
        console.warn('Gemini setlist generation fell back to local setlist engine:', geminiErr);
        const fallbackSetlist = generateLocalSetlist(venue, targetDurationMinutes, vibe, librarySongs);
        return res.json({ success: true, setlist: fallbackSetlist, isFallback: true });
      }
    } catch (error) {
      console.error('Error generating setlist:', error);
      const fallbackSetlist = generateLocalSetlist(req.body?.venue, req.body?.targetDurationMinutes, req.body?.vibe, req.body?.existingSongs || req.body?.songs);
      return res.json({ success: true, setlist: fallbackSetlist, isFallback: true });
    }
  });

  // API Endpoint: Parse PDF Sheet Music / Partition with Gemini Multimodal AI
  app.post('/api/ai/parse-pdf', async (req, res) => {
    try {
      const { fileName, extractedText, pdfBase64 } = req.body;
      const baseTitle = (fileName || 'Partition PDF').replace(/\.pdf$/i, '').replace(/_/g, ' ');

      let prompt = `You are an expert music transcriber, chord analyzer, and sheet music digitizer.
Analyze this sheet music / partition PDF or raw extracted PDF text for "${baseTitle}".
Your goal: Convert the song, lyrics, and chords into a clean, perfectly structured ChordPro sheet for musicians.

CRITICAL INSTRUCTIONS FOR GARBLED / RAW PDF TEXT CLEANUP & CHORDS:
1. Some sheet music PDFs use custom music notation fonts (Finale Maestro, Sibelius Opus, Bravura) where letters, lyrics, or chord symbols appear as unencoded characters, squares/tofu (e.g. , ▯, \uFFFD, \x00) or misplaced symbols in raw text. Read the visual content of the PDF pages directly if PDF base64 is provided to read the real human-readable song lyrics and title!
2. The input text or PDF may contain raw OCR artifacts, broken words (e.g., "be- gin-ning" -> "beginning", "Hearthechil-dren" -> "Hear the children", "fightthis" -> "fight this"), page/line numbers, "3fr", "mf", "D.S. al Coda", copyright notices, or website URLs.
3. CLEAN UP & REPAIR THE LYRICS: Filter out watermarks, page numbers, and diagram annotations ("3fr"). Fix merged or hyphenated words and eliminate any square/tofu artifacts so lyrics are clean, natural, and in complete standard French or English words.
4. EXTRACT ALL CHORDS ACCURATELY: Place every chord (e.g., Bb, Eb, F, F7, Gm, Eb/Bb, C, G, Am, Dm, etc.) in square brackets inline with the lyrics (e.g., [Bb]One love, [F]one heart, [Eb]Let's get to[Bb]gether and [F]feel all [Bb]right) or in measure grids ([Bb]  |  [F]  |  [Eb]  |  [Bb]).
5. Detect or estimate the exact Song Title, Artist, Key (e.g. Bb, C, G, Am), Tempo in BPM (e.g. 76, 120), and Time Signature (e.g. 4/4).
6. Structure into sections like [Intro], [Couplet 1], [Refrain], [Pont], [Outro].

Respond ONLY with valid raw JSON (no markdown backticks, no code blocks):
{
  "title": "${baseTitle}",
  "artist": "Artist Name",
  "key": "Bb",
  "bpm": 76,
  "timeSignature": "4/4",
  "durationSeconds": 170,
  "notes": "Partition PDF nettoyée et transcrite avec précision par l'IA Gemini",
  "chordProContent": "{title: Title}\\n{artist: Artist}\\n{key: Key}\\n\\n[Refrain]\\n[Bb]One love, [F]one heart\\n[Eb]Let's get to[Bb]gether and [F]feel all [Bb]right"
}`;

      let contents: any[] = [];

      if (pdfBase64) {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
        let fullPrompt = prompt;
        if (extractedText && extractedText.trim().length > 0) {
          fullPrompt += `\n\nHere is the structured line-by-line text and chords extracted from the PDF:\n"""\n${extractedText.slice(0, 10000)}\n"""`;
        }
        contents = [
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: cleanBase64,
            },
          },
          fullPrompt,
        ];
      } else if (extractedText && extractedText.trim().length > 0) {
        prompt += `\n\nText and chords extracted from PDF:\n"""\n${extractedText.slice(0, 10000)}\n"""`;
        contents = [prompt];
      } else {
        contents = [prompt];
      }

      try {
        const responseText = await generateContentSafe(contents);
        const parsedSong = extractJsonFromText(responseText);
        return res.json({ success: true, song: parsedSong });
      } catch (geminiErr) {
        console.warn('Gemini PDF parsing fell back to local structured parser:', geminiErr);
        const fallbackChordPro = extractedText && extractedText.includes('[')
          ? extractedText
          : `{title: ${baseTitle}}\n{artist: Partition PDF}\n{key: C}\n\n` + (extractedText || '[Intro]\n[C]  |  [G]  |  [Am]  |  [F]');

        const fallbackSong = {
          title: baseTitle,
          artist: 'Partition PDF',
          key: 'C',
          bpm: 120,
          timeSignature: '4/4',
          durationSeconds: 210,
          notes: `Partition PDF ${fileName} numérisée`,
          chordProContent: fallbackChordPro,
        };
        return res.json({ success: true, song: fallbackSong, isFallback: true });
      }
    } catch (error) {
      console.error('Error parsing PDF:', error);
      const baseTitle = (req.body?.fileName || 'Partition PDF').replace(/\.pdf$/i, '').replace(/_/g, ' ');
      const fallbackSong = {
        title: baseTitle,
        artist: 'Partition PDF',
        key: 'C',
        bpm: 120,
        timeSignature: '4/4',
        durationSeconds: 210,
        notes: `Partition PDF numérisée`,
        chordProContent: req.body?.extractedText || `{title: ${baseTitle}}\n{key: C}\n\n[Intro]\n[C]  |  [G]  |  [Am]  |  [F]`,
      };
      return res.json({ success: true, song: fallbackSong, isFallback: true });
    }
  });

  // API Endpoint: Open VSampler 3 Preset File (.vs3, .vsp) on Host System
  const DEFAULT_DOSSIER_INSTRUMENTS = "D:\\MaMusique\\Chansons_Scene\\";
  const DEFAULT_VSAMPLER_EXE = "C:\\Program Files\\VSampler3\\VSampler3.exe";

  app.post('/api/vsampler/open-preset', async (req, res) => {
    try {
      const {
        filePath,
        samplerFile,
        fichier_sampler,
        songTitle,
        titre,
        rootFolder,
        dossier_instruments,
        vsamplerExePath,
      } = req.body;

      const rawFile = (samplerFile || fichier_sampler || filePath || '').trim();
      if (!rawFile) {
        return res.status(400).json({ success: false, error: 'Nom ou chemin du fichier sampler (.vs3 ou .vsp) requis' });
      }

      // Construction dynamique du chemin complet sur le 2ème disque (D:)
      let cheminComplet = '';
      if (/^[a-zA-Z]:[/\\]/.test(rawFile)) {
        // Chemin absolu déjà fourni
        cheminComplet = rawFile.replace(/\//g, '\\');
      } else {
        // Combinaison dynamique : path.join(DOSSIER_INSTRUMENTS, chansonSelectionnee.titre, chansonSelectionnee.fichier_sampler)
        const root = (rootFolder || dossier_instruments || DEFAULT_DOSSIER_INSTRUMENTS).trim().replace(/\//g, '\\').replace(/\\+$/, '');
        const songFolderName = (songTitle || titre || '').trim().replace(/[<>:"/\\|?*]/g, '_');
        const cleanFileName = rawFile.replace(/^\\+/, '').replace(/\//g, '\\');
        cheminComplet = `${root}\\${songFolderName}\\${cleanFileName}`;
      }

      const exePath = (vsamplerExePath && typeof vsamplerExePath === 'string' ? vsamplerExePath : DEFAULT_VSAMPLER_EXE).trim().replace(/^["']|["']$/g, '');
      const fileName = path.basename(cheminComplet);

      console.log(`[VSampler 3 Engine] Reconstitution chemin dynamique disque D: "${cheminComplet}"`);
      console.log(`[VSampler 3 Engine] Commande Windows: "${exePath}" "${cheminComplet}" (OS: ${process.platform})`);

      if (process.platform === 'win32') {
        const { exec } = await import('child_process');
        // Exécution de la commande Windows demandée : exec(`"C:\\Program Files\\VSampler3\\VSampler3.exe" "${cheminComplet}"`)
        const cmd = `"${exePath}" "${cheminComplet}"`;
        exec(cmd, (err) => {
          if (err) {
            console.warn(`[VSampler 3] Échec commande directe exe, tentative via association Windows 'start':`, err);
            // Fallback: Windows shell association
            exec(`start "" "${cheminComplet}"`, (err2) => {
              if (err2) {
                console.error(`[VSampler 3] Erreur lancement VSampler 3:`, err2);
                return res.status(500).json({ success: false, error: err2.message, cheminComplet });
              }
              return res.json({
                success: true,
                method: 'shell_association',
                cheminComplet,
                filePath: cheminComplet,
                fileName,
                message: `Fichier "${fileName}" chargé avec succès dans VSampler 3 (${cheminComplet})`,
              });
            });
            return;
          }
          return res.json({
            success: true,
            method: 'direct_executable',
            cheminComplet,
            filePath: cheminComplet,
            fileName,
            message: `Fichier "${fileName}" ouvert dans VSampler 3 (${cheminComplet})`,
          });
        });
      } else {
        // Non-Windows environment (e.g. Linux container dev preview)
        return res.json({
          success: true,
          simulated: true,
          method: 'dynamic_windows_command',
          cheminComplet,
          filePath: cheminComplet,
          fileName,
          command: `"${exePath}" "${cheminComplet}"`,
          message: `Commande Windows dynamique prête sur disque D: "${cheminComplet}"`,
        });
      }
    } catch (err: any) {
      console.error('Error opening VSampler preset:', err);
      res.status(500).json({ success: false, error: err.message || String(err) });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LiveSet App Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
