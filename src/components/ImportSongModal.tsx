import React, { useState, useRef } from 'react';
import { Upload, FileText, Sparkles, X, CheckCircle, AlertCircle, Plus, Music, Copy, FileAudio, Layers, FileSpreadsheet, Mic2 } from 'lucide-react';
import { Song } from '../types';
import { parseMidiFile } from '../utils/midiParser';
import { parseMobileSheetsFile } from '../utils/mobileSheetsParser';
import { parsePdfMusicFile } from '../utils/pdfParser';

interface ImportSongModalProps {
  onClose: () => void;
  onImportSongs: (songs: Song[]) => void;
}

export const ImportSongModal: React.FC<ImportSongModalProps> = ({
  onClose,
  onImportSongs,
}) => {
  const [tab, setTab] = useState<'file' | 'paste' | 'ai'>('file');
  
  // File import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileSongs, setFileSongs] = useState<Partial<Song>[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isRefiningMidi, setIsRefiningMidi] = useState(false);

  // Paste text state
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteArtist, setPasteArtist] = useState('');
  const [pasteKey, setPasteKey] = useState('C');
  const [pasteBpm, setPasteBpm] = useState(120);
  const [pasteContent, setPasteContent] = useState('');

  // AI Import state
  const [aiTitle, setAiTitle] = useState('');
  const [aiArtist, setAiArtist] = useState('');
  const [aiStyle, setAiStyle] = useState('Variété / Pop Rock');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isCleaningPastedText, setIsCleaningPastedText] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Clean raw / garbled PDF pasted text with Gemini AI
  const handleCleanPastedTextWithAi = async () => {
    if (!pasteContent.trim()) return;
    setIsCleaningPastedText(true);
    setFileError(null);
    try {
      const response = await fetch('/api/ai/parse-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: pasteTitle || 'Partition Extraite',
          extractedText: pasteContent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.song) {
          if (data.song.title) setPasteTitle(data.song.title);
          if (data.song.artist) setPasteArtist(data.song.artist);
          if (data.song.key) setPasteKey(data.song.key);
          if (data.song.bpm) setPasteBpm(data.song.bpm);
          if (data.song.chordProContent) setPasteContent(data.song.chordProContent);
          setSuccessMsg('Texte du PDF réparé, nettoyé et formaté en ChordPro par Gemini IA !');
        } else {
          setFileError('Impossible de nettoyer le texte avec l\'IA.');
        }
      } else {
        let errMsg = 'Erreur lors du traitement par l\'IA';
        try {
          const errData = await response.json();
          errMsg = errData.error || errData.details || errMsg;
        } catch {
          const rawText = await response.text();
          errMsg = rawText.slice(0, 150) || errMsg;
        }
        setFileError(errMsg);
      }
    } catch (err) {
      console.error('Erreur de nettoyage IA:', err);
      setFileError('Erreur de connexion avec l\'IA Gemini.');
    } finally {
      setIsCleaningPastedText(false);
    }
  };

  // Success message
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to parse pasted text into ChordPro format if needed
  const parseRawTextToChordPro = (rawText: string, title: string, artist: string, keyStr: string): string => {
    let result = `{title: ${title || 'Chanson Sans Titre'}}\n{artist: ${artist || 'Artiste Inconnu'}}\n{key: ${keyStr || 'C'}}\n\n`;
    
    // If text already contains ChordPro brackets [Am], keep it as is
    if (rawText.includes('[') && rawText.includes(']')) {
      return result + rawText;
    }

    // Convert plain text / lines into ChordPro structure
    const lines = rawText.split('\n');
    lines.forEach((line) => {
      if (!line.trim()) {
        result += '\n';
        return;
      }
      // Check if line looks like section tag e.g. "Couplet 1:", "Refrain:"
      if (/^(couplet|refrain|verse|chorus|intro|outils|pont|bridge|solo)/i.test(line.trim())) {
        result += `[${line.trim().replace(/:$/, '')}]\n`;
      } else {
        result += `${line}\n`;
      }
    });

    return result;
  };

  // Process File Upload (.pdf, .msf, .msb, .mid, .midi, .txt, .pro, .chopro, .json)
  const processFiles = async (files: FileList) => {
    setFileError(null);
    setIsProcessingFiles(true);
    const newParsedSongs: Partial<Song>[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPdf = /\.pdf$/i.test(file.name);
      const isMidi = /\.(mid|midi|kar)$/i.test(file.name);
      const isKaraoke = /\.kar$/i.test(file.name);
      const isMsf = /\.(msf|msb)$/i.test(file.name);

      if (isPdf) {
        try {
          const pdfResult = await parsePdfMusicFile(file);
          if (pdfResult.song) {
            newParsedSongs.push(pdfResult.song);
            setSuccessMsg(`Partition PDF "${file.name}" numérisée et convertie avec l'IA Gemini !`);
          }
        } catch (err) {
          console.error('Erreur lors du traitement PDF', err);
          setFileError(`Erreur lors de la numérisation de la partition PDF "${file.name}".`);
        }
      } else if (isMsf) {
        try {
          const buffer = await file.arrayBuffer();
          const msfResult = await parseMobileSheetsFile(buffer, file.name);
          if (msfResult.songs.length > 0) {
            newParsedSongs.push(...msfResult.songs);
            setSuccessMsg(`${msfResult.songs.length} chanson(s) extraite(s) du fichier MobileSheets (.msf) !`);
          } else {
            setFileError(`Aucune chanson lisible n'a été trouvée dans le fichier MobileSheets "${file.name}".`);
          }
        } catch (err) {
          console.error('Erreur lors du traitement MobileSheets .msf', err);
          setFileError(`Erreur lors de la lecture du fichier MobileSheets "${file.name}".`);
        }
      } else if (isMidi) {
        try {
          const buffer = await file.arrayBuffer();
          const parsedMidi = await parseMidiFile(buffer, file.name);
          newParsedSongs.push({
            title: parsedMidi.title,
            artist: parsedMidi.artist,
            key: parsedMidi.key,
            bpm: parsedMidi.bpm,
            timeSignature: parsedMidi.timeSignature,
            durationSeconds: parsedMidi.durationSeconds,
            introDelaySeconds: parsedMidi.introDelaySeconds,
            chordProContent: parsedMidi.chordProContent,
            midiData: parsedMidi.midiData,
            midiFileName: file.name,
            tags: [
              'Importé',
              parsedMidi.hasLyrics ? 'Karaoké' : 'MIDI',
              `${parsedMidi.tracksInfo.length} Pistes`,
            ],
            notes: parsedMidi.rawNotesSummary,
          });
          if (parsedMidi.hasLyrics) {
            setSuccessMsg(`Fichier Karaoké "${file.name}" importé avec succès : ${parsedMidi.karaokeLineCount} lignes de paroles & accords extraits, connecté au lecteur MIDI !`);
          } else {
            setSuccessMsg(`Fichier MIDI "${file.name}" analysé : ${parsedMidi.tracksInfo.length} pistes prêtes pour le lecteur MIDI !`);
          }
        } catch (err) {
          console.error('Erreur lors du traitement MIDI / Karaoké', err);
          setFileError(`Erreur lors de la lecture du fichier Karaoké / MIDI "${file.name}".`);
        }
      } else {
        // Read text or JSON file
        await new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target?.result as string;
            if (text) {
              try {
                if (file.name.endsWith('.json')) {
                  const parsed = JSON.parse(text);
                  if (Array.isArray(parsed)) {
                    parsed.forEach((s) => {
                      if (s.title) newParsedSongs.push(s);
                    });
                  } else if (parsed.title) {
                    newParsedSongs.push(parsed);
                  }
                } else {
                  // Text or .pro / .chopro file
                  let extractedTitle = file.name.replace(/\.(txt|pro|chopro|chordpro)$/i, '');
                  let extractedArtist = 'Artiste Inconnu';
                  let extractedKey = 'C';

                  const titleMatch = text.match(/\{title:\s*([^}]+)\}/i);
                  if (titleMatch) extractedTitle = titleMatch[1].trim();

                  const artistMatch = text.match(/\{artist:\s*([^}]+)\}/i);
                  if (artistMatch) extractedArtist = artistMatch[1].trim();

                  const keyMatch = text.match(/\{key:\s*([^}]+)\}/i);
                  if (keyMatch) extractedKey = keyMatch[1].trim();

                  newParsedSongs.push({
                    title: extractedTitle,
                    artist: extractedArtist,
                    key: extractedKey,
                    bpm: 120,
                    timeSignature: '4/4',
                    durationSeconds: 210,
                    chordProContent: text.includes('{title:') ? text : parseRawTextToChordPro(text, extractedTitle, extractedArtist, extractedKey),
                    tags: ['Importé'],
                  });
                }
              } catch (err) {
                console.error('Erreur de lecture du fichier', err);
                setFileError(`Impossible de lire le fichier ${file.name}.`);
              }
            }
            resolve();
          };
          reader.readAsText(file);
        });
      }
    }

    if (newParsedSongs.length > 0) {
      setFileSongs((prev) => [...prev, ...newParsedSongs]);
    }
    setIsProcessingFiles(false);
  };

  // Refine MIDI with Gemini AI API
  const handleRefineMidiWithAi = async () => {
    setIsRefiningMidi(true);
    setFileError(null);
    try {
      const updatedList = [...fileSongs];
      let fallbackCount = 0;
      for (let i = 0; i < updatedList.length; i++) {
        const item = updatedList[i];
        if (item.tags?.includes('MIDI')) {
          const res = await fetch('/api/ai/refine-midi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: item.title,
              rawMidiInfo: item.notes,
              draftChordPro: item.chordProContent,
              estimatedKey: item.key,
              bpm: item.bpm,
              timeSignature: item.timeSignature,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.song) {
            if (data.isFallback) fallbackCount++;
            updatedList[i] = {
              ...item,
              chordProContent: data.song.chordProContent,
              key: data.song.key || item.key,
              bpm: data.song.bpm || item.bpm,
              notes: data.song.notes || item.notes,
              tags: [...(item.tags || []), data.isFallback ? 'Harmonisé' : 'IA Harmonisé'],
            };
          }
        }
      }
      setFileSongs(updatedList);
      setSuccessMsg(
        fallbackCount > 0
          ? 'Grilles MIDI structurées et harmonisées avec succès (moteur musical réactif) !'
          : 'Grilles MIDI harmonisées et nettoyées avec succès par Gemini IA !'
      );
    } catch (err) {
      console.error('Erreur lors du nettoyage MIDI IA:', err);
      setFileError('Impossible de contacter le serveur d\'harmonisation.');
    } finally {
      setIsRefiningMidi(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Submit Parsed File Songs
  const handleConfirmFileImport = () => {
    if (fileSongs.length === 0) return;

    const songsToImport: Song[] = fileSongs.map((fs, idx) => ({
      id: `imported-${Date.now()}-${idx}`,
      title: fs.title || 'Chanson Sans Titre',
      artist: fs.artist || 'Artiste Inconnu',
      key: fs.key || 'C',
      bpm: fs.bpm || 120,
      timeSignature: fs.timeSignature || '4/4',
      durationSeconds: fs.durationSeconds || 210,
      introDelaySeconds: fs.introDelaySeconds,
      chordProContent: fs.chordProContent || `{title: ${fs.title}}\n[Couplet 1]\nParoles sans accord`,
      midiData: fs.midiData,
      midiFileName: fs.midiFileName,
      tags: fs.tags || ['Importé'],
      notes: fs.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    onImportSongs(songsToImport);
    setSuccessMsg(`${songsToImport.length} chanson(s) importée(s) avec succès !`);
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  // Submit Copy-Pasted Text
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    const formattedContent = parseRawTextToChordPro(
      pasteContent,
      pasteTitle || 'Chanson Importée',
      pasteArtist || 'Artiste Inconnu',
      pasteKey || 'C'
    );

    const newSong: Song = {
      id: `song-paste-${Date.now()}`,
      title: pasteTitle.trim() || 'Chanson Importée',
      artist: pasteArtist.trim() || 'Artiste Inconnu',
      key: pasteKey || 'C',
      bpm: Number(pasteBpm) || 120,
      timeSignature: '4/4',
      durationSeconds: 210,
      chordProContent: formattedContent,
      tags: ['Importé'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onImportSongs([newSong]);
    setSuccessMsg('Chanson importée avec succès !');
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  // Submit AI Request to Gemini Server
  const handleAiImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiTitle.trim()) return;

    setIsAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/generate-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: aiTitle.trim(),
          artist: aiArtist.trim(),
          style: aiStyle,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la génération par IA');
      }

      const generated = data.song;
      const newSong: Song = {
        id: `ai-song-${Date.now()}`,
        title: generated.title || aiTitle,
        artist: generated.artist || aiArtist || 'IA Générée',
        key: generated.key || 'G',
        bpm: Number(generated.bpm) || 120,
        timeSignature: generated.timeSignature || '4/4',
        durationSeconds: Number(generated.durationSeconds) || 210,
        capo: Number(generated.capo) || 0,
        chordProContent: generated.chordProContent || `{title: ${aiTitle}}\n[Verse 1]\n[G]Partition générée par [C]IA`,
        notes: generated.notes || 'Grille et accords générés automatiquement par Gemini IA.',
        tags: generated.tags || ['IA Gemini', 'Importé'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      onImportSongs([newSong]);
      setSuccessMsg('Partition générée et importée dans votre bibliothèque !');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Erreur lors de l\'import IA:', err);
      setAiError(err instanceof Error ? err.message : 'Échec de la génération par l\'IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 text-white rounded-lg max-w-2xl w-full p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2 rounded bg-zinc-800 hover:bg-zinc-700 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded bg-orange-500/10 border border-orange-500/30 text-orange-400 flex items-center justify-center">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Importer des Chansons & Fichiers</h2>
            <p className="text-xs text-zinc-400">Importez des partitions .pdf, .msf / .msb (MobileSheets), .mid / .midi, .txt / .pro, ou recherchez via l'IA Gemini</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-zinc-950 p-1 rounded mb-6 border border-zinc-800">
          <button
            onClick={() => setTab('file')}
            className={`flex-1 py-1.5 text-xs font-bold rounded transition flex items-center justify-center gap-2 ${
              tab === 'file' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" /> Fichiers (.pdf, .msf, .midi, .txt)
          </button>

          <button
            onClick={() => setTab('paste')}
            className={`flex-1 py-1.5 text-xs font-bold rounded transition flex items-center justify-center gap-2 ${
              tab === 'paste' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" /> Copier / Coller Paroles
          </button>

          <button
            onClick={() => setTab('ai')}
            className={`flex-1 py-1.5 text-xs font-bold rounded transition flex items-center justify-center gap-2 ${
              tab === 'ai' ? 'bg-orange-500 text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" /> Recherche IA Gemini
          </button>
        </div>

        {/* Alert & Success Messages */}
        {fileError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {fileError}
          </div>
        )}

        {aiError && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold rounded mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {aiError}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-semibold rounded mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" /> {successMsg}
          </div>
        )}

        {/* TAB 1: FILE UPLOAD */}
        {tab === 'file' && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                dragActive
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Mic2 className="w-8 h-8 text-emerald-400" />
                <FileAudio className="w-8 h-8 text-purple-400" />
                <FileText className="w-8 h-8 text-red-400" />
                <Layers className="w-8 h-8 text-blue-400" />
                <Upload className="w-6 h-6 text-zinc-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Glissez & déposez vos fichiers Karaoké (.kar), MIDI, partitions PDF ou texte ici</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Formats pris en charge : <span className="font-mono text-emerald-400">.kar (Karaoké paroles + accords)</span>, <span className="font-mono text-purple-400">.mid, .midi</span>, <span className="font-mono text-red-400">.pdf</span>, <span className="font-mono text-blue-400">.msf, .msb</span>, .txt, .pro
                </p>
              </div>
              {isProcessingFiles && (
                <div className="flex items-center gap-2 text-xs text-orange-400 font-bold">
                  <div className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  <span>Analyse & extraction des paroles et accords en cours...</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.msf,.msb,.mid,.midi,.kar,.txt,.pro,.chopro,.chordpro,.json"
                className="hidden"
                onChange={(e) => e.target.files && processFiles(e.target.files)}
              />
            </div>

            {/* List of Detected Songs to Import */}
            {fileSongs.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Chansons & Partitions détectées ({fileSongs.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {fileSongs.map((s, idx) => {
                    const isKaraokeItem = s.tags?.includes('Karaoké');
                    const isPdfItem = s.tags?.includes('PDF') || s.tags?.includes('Partition Numérisée');
                    const isMidiItem = s.tags?.includes('MIDI');
                    const isMsfItem = s.tags?.includes('MobileSheets') || s.tags?.includes('.msf');
                    return (
                      <div key={idx} className="p-3 bg-zinc-950 border border-zinc-800 rounded flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {isKaraokeItem ? (
                            <Mic2 className="w-4 h-4 text-emerald-400" />
                          ) : isPdfItem ? (
                            <FileText className="w-4 h-4 text-red-400" />
                          ) : isMsfItem ? (
                            <Layers className="w-4 h-4 text-blue-400" />
                          ) : isMidiItem ? (
                            <FileAudio className="w-4 h-4 text-purple-400" />
                          ) : (
                            <Music className="w-4 h-4 text-orange-400" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{s.title || 'Sans titre'}</span>
                              {isKaraokeItem && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1">
                                  <Mic2 className="w-3 h-3" /> Karaoké (.kar)
                                </span>
                              )}
                              {isPdfItem && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-red-500/20 text-red-300 border border-red-500/40 rounded">
                                  Partition PDF
                                </span>
                              )}
                              {isMsfItem && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded">
                                  MobileSheets (.msf)
                                </span>
                              )}
                              {isMidiItem && !isKaraokeItem && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded">
                                  MIDI
                                </span>
                              )}
                            </div>
                            <span className="text-zinc-500">
                              — {s.artist || 'Artiste inconnu'} ({s.bpm || 120} BPM)
                              {isKaraokeItem && ' • Paroles & accords synchronisés avec lecteur MIDI'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-zinc-800 text-orange-400 font-mono font-bold rounded">
                            {s.key || 'C'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {fileSongs.some((s) => s.tags?.includes('MIDI')) && (
                  <button
                    type="button"
                    onClick={handleRefineMidiWithAi}
                    disabled={isRefiningMidi}
                    className="w-full py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-bold text-xs rounded transition flex items-center justify-center gap-2 cursor-pointer mb-2"
                  >
                    {isRefiningMidi ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span>Harmonisation IA du MIDI en cours...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>⚡ Structurer & Harmoniser la grille MIDI avec Gemini IA</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleConfirmFileImport}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 cursor-pointer shadow mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Valider l'importation de {fileSongs.length} chanson(s)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COPY-PASTE TEXT */}
        {tab === 'paste' && (
          <form onSubmit={handlePasteSubmit} className="space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Titre de la chanson *</label>
                <input
                  type="text"
                  required
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  placeholder="ex: Les Champs-Élysées"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Artiste / Groupe</label>
                <input
                  type="text"
                  value={pasteArtist}
                  onChange={(e) => setPasteArtist(e.target.value)}
                  placeholder="ex: Joe Dassin"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Tonalité Principale</label>
                <input
                  type="text"
                  value={pasteKey}
                  onChange={(e) => setPasteKey(e.target.value)}
                  placeholder="ex: C, G, Am..."
                  className="w-full bg-zinc-950 border border-zinc-800 text-orange-400 font-mono font-bold px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-zinc-400">
                  Collez les Paroles et Accords (Format ChordPro [Am] ou Texte brut de PDF illisible)
                </label>
                {pasteContent.trim().length > 10 && (
                  <button
                    type="button"
                    onClick={handleCleanPastedTextWithAi}
                    disabled={isCleaningPastedText}
                    className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    {isCleaningPastedText ? (
                      <>
                        <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span>Nettoyage du PDF par l'IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                        <span>⚡ Nettoyer ce PDF / Texte brut avec Gemini IA</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <textarea
                required
                rows={8}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Collez le texte brut de votre PDF scanné ou illisible ici...&#10;Exemple : 1 ONE LOVE Bb 3fr Eb F One love, one heart. Hearthechil-dren...&#10;&#10;Cliquez sur le bouton '⚡ Nettoyer ce PDF / Texte brut' pour réparer les mots et formater les accords [Bb] [Eb] !"
                className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs p-3 rounded focus:outline-none focus:border-orange-500 leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 cursor-pointer shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Créer & Importer cette chanson</span>
            </button>
          </form>
        )}

        {/* TAB 3: AI GEMINI SEARCH & GENERATION */}
        {tab === 'ai' && (
          <form onSubmit={handleAiImportSubmit} className="space-y-4 overflow-y-auto pr-1">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Titre de la chanson à rechercher *</label>
              <input
                type="text"
                required
                value={aiTitle}
                onChange={(e) => setAiTitle(e.target.value)}
                placeholder="ex: Ne me quitte pas, Wonderwall, Creep..."
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Artiste / Interprète</label>
              <input
                type="text"
                value={aiArtist}
                onChange={(e) => setAiArtist(e.target.value)}
                placeholder="ex: Jacques Brel, Oasis, Radiohead..."
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Style d'Arrangement</label>
              <select
                value={aiStyle}
                onChange={(e) => setAiStyle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500 cursor-pointer"
              >
                <option value="Variété / Pop Rock">Variété / Pop Rock Standard</option>
                <option value="Acoustique Unplugged">Acoustique Unplugged</option>
                <option value="Chanson Française / Piano Bar">Chanson Française / Piano Bar</option>
                <option value="Jazz / Blues Standards">Jazz / Blues Standards</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isAiLoading}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 cursor-pointer shadow mt-6"
            >
              {isAiLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>IA en train de générer les grilles & paroles...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Générer la partition avec Gemini IA</span>
                </>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
