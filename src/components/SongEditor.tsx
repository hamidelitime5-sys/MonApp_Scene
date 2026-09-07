import React, { useState, useRef } from 'react';
import { Save, ArrowLeft, Eye, Edit3, Sparkles, Radio, Youtube, Plus, RefreshCw, Trash2, Sliders, Music, FileText, Check, Download, Clock, FileCode, HardDrive } from 'lucide-react';
import { NotationMode, Song } from '../types';
import { formatChordNotation, getKeyDistance, transposeChordPro, transposeNote } from '../utils/chordUtils';
import { JamTrackPlayer } from './JamTrackPlayer';
import { exportMobileSheetsSongFile, exportSingleChordProFile } from '../utils/mobileSheetsExporter';
import { LyricSyncStudioModal } from './LyricSyncStudioModal';
import { midiAudioEngine, DEFAULT_DOSSIER_INSTRUMENTS } from '../utils/midiAudioEngine';

interface SongEditorProps {
  song: Song;
  onSave: (updatedSong: Song) => void;
  onCancel: () => void;
  onOpenChordModal: (chordName: string) => void;
  onOpenExportModal?: (song?: Song) => void;
}

export const SongEditor: React.FC<SongEditorProps> = ({
  song,
  onSave,
  onCancel,
  onOpenChordModal,
  onOpenExportModal,
}) => {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [key, setKey] = useState(song.key);
  const [targetKey, setTargetKey] = useState(song.key);
  const [bpm, setBpm] = useState(song.bpm);
  const [timeSignature, setTimeSignature] = useState(song.timeSignature || '4/4');
  const [durationSeconds, setDurationSeconds] = useState(song.durationSeconds || 210);
  const [capo, setCapo] = useState<number>(song.capo || 0);
  const [tuning, setTuning] = useState(song.tuning || 'Standard');
  const [tags, setTags] = useState<string>(song.tags ? song.tags.join(', ') : '');
  const [notes, setNotes] = useState(song.notes || '');
  const [jamTrackUrl, setJamTrackUrl] = useState(song.jamTrackUrl || '');
  const [jamTrackStyle, setJamTrackStyle] = useState(song.jamTrackStyle || '');
  const [midiData, setMidiData] = useState<string | undefined>(song.midiData);
  const [midiFileName, setMidiFileName] = useState<string | undefined>(song.midiFileName);
  const [midiSoundfontName, setMidiSoundfontName] = useState<string | undefined>(song.midiSoundfontName);
  const [fichierSampler, setFichierSampler] = useState<string>(() => {
    if (song.fichier_sampler) return song.fichier_sampler;
    const legacy = song.fichier_instrument || song.vSamplerConfig?.fichier_instrument || '';
    if (legacy.includes('/') || legacy.includes('\\')) {
      return legacy.split(/[/\\]/).pop() || legacy;
    }
    return legacy;
  });
  const [isJamModalOpen, setIsJamModalOpen] = useState(false);
  const [isSyncStudioOpen, setIsSyncStudioOpen] = useState(false);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [chordProContent, setChordProContent] = useState(song.chordProContent);
  const [notationMode, setNotationMode] = useState<NotationMode>('standard');
  const [viewTab, setViewTab] = useState<'split' | 'edit' | 'preview'>('split');

  // Interactive Chord Builder State
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [builderRoot, setBuilderRoot] = useState('C');
  const [builderSuffix, setBuilderSuffix] = useState('');
  const [builderBass, setBuilderBass] = useState('');
  const [isChordPaletteOpen, setIsChordPaletteOpen] = useState(true);

  // Selected Chord Action Modal / Popover state
  const [activeChordAction, setActiveChordAction] = useState<string | null>(null);
  const [replacementChord, setReplacementChord] = useState('');

  // Transposition semitones offset
  const transposeOffset = getKeyDistance(key, targetKey);

  const currentConstructedChord = `${builderRoot}${builderSuffix}${builderBass ? '/' + builderBass : ''}`;

  // Insert constructed or custom chord at textarea cursor position
  const insertChordAtCursor = (chordToInsert: string) => {
    const formattedTag = `[${chordToInsert.replace(/^\[|\]$/g, '')}]`;
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const textBefore = chordProContent.substring(0, start);
      const textAfter = chordProContent.substring(end);

      const newContent = textBefore + formattedTag + textAfter;
      setChordProContent(newContent);

      // Restore focus and move cursor right after inserted chord
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + formattedTag.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 50);
    } else {
      setChordProContent((prev) => prev + ' ' + formattedTag);
    }
  };

  // Replace a specific chord across the entire song content
  const handleReplaceChord = (targetChord: string, newChordName: string) => {
    if (!newChordName.trim()) return;
    const cleanNew = newChordName.trim().replace(/^\[|\]$/g, '');
    const cleanTarget = targetChord.replace(/^\[|\]$/g, '');

    const regex = new RegExp(`\\[${cleanTarget}\\]`, 'g');
    const updated = chordProContent.replace(regex, `[${cleanNew}]`);
    setChordProContent(updated);
    setActiveChordAction(null);
    setReplacementChord('');
  };

  // Delete a specific chord from the entire song content
  const handleDeleteChord = (targetChord: string) => {
    const cleanTarget = targetChord.replace(/^\[|\]$/g, '');
    const regex = new RegExp(`\\[${cleanTarget}\\]`, 'g');
    const updated = chordProContent.replace(regex, '');
    setChordProContent(updated);
    setActiveChordAction(null);
  };

  // Step transpose by semitones (+1 / -1)
  const stepTranspose = (delta: number) => {
    const newK = transposeNote(targetKey, delta);
    setTargetKey(newK);
  };

  // Apply transposition permanently to raw ChordPro content
  const applyTranspositionPermanently = () => {
    if (transposeOffset === 0) return;
    const transposedText = transposeChordPro(chordProContent, transposeOffset, 'standard', targetKey);
    setChordProContent(transposedText);
    setKey(targetKey);
  };

  const handleSave = () => {
    const updated: Song = {
      ...song,
      title: title.trim() || 'Chanson Sans Titre',
      artist: artist.trim() || 'Artiste Inconnu',
      key: targetKey,
      bpm: Number(bpm) || 120,
      timeSignature: timeSignature || '4/4',
      durationSeconds: Number(durationSeconds) || 210,
      capo: Number(capo) || 0,
      tuning: tuning || 'Standard',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: notes.trim(),
      jamTrackUrl: jamTrackUrl.trim(),
      jamTrackStyle: jamTrackStyle.trim(),
      midiData,
      midiFileName,
      midiSoundfontName,
      fichier_sampler: fichierSampler.trim() || undefined,
      fichier_instrument: fichierSampler.trim() || undefined,
      vSamplerConfig: song.vSamplerConfig ? {
        ...song.vSamplerConfig,
        fichier_sampler: fichierSampler.trim() || undefined,
        fichier_instrument: fichierSampler.trim() || undefined,
      } : undefined,
      introDelaySeconds: song.introDelaySeconds,
      chordProContent: transposeOffset !== 0 ? transposeChordPro(chordProContent, transposeOffset) : chordProContent,
      updatedAt: Date.now(),
    };
    onSave(updated);
  };

  // AI Refine PDF / MIDI or Raw Text with Gemini API
  const handleRefineWithAi = async () => {
    setIsAiRefining(true);
    try {
      const res = await fetch('/api/ai/refine-midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          rawMidiInfo: notes,
          draftChordPro: chordProContent,
          estimatedKey: key,
          bpm,
          timeSignature,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.song) {
        setChordProContent(data.song.chordProContent || chordProContent);
        if (data.song.key) setKey(data.song.key);
        if (data.song.key) setTargetKey(data.song.key);
        if (data.song.bpm) setBpm(data.song.bpm);
        if (data.song.notes) setNotes(data.song.notes);
      }
    } catch (err) {
      console.error('Erreur lors de l\'harmonisation IA:', err);
    } finally {
      setIsAiRefining(false);
    }
  };

  // Render formatted lines from ChordPro content
  const renderFormattedChordPro = (content: string) => {
    const transposedContent = transposeChordPro(content, transposeOffset, notationMode, targetKey);
    const lines = transposedContent.split('\n');

    return lines.map((line, lIdx) => {
      // Section header
      const sectionMatch = line.trim().match(/^\[(Verse|Chorus|Intro|Bridge|Solo|Outro|Pre-Chorus|Couplet|Refrain|Pont)[^\]]*\]$/i);
      if (sectionMatch) {
        return (
          <div key={lIdx} className="mt-6 mb-2">
            <span className="px-3 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded text-xs font-bold uppercase tracking-wider">
              {line.trim().replace(/^\[|\]$/g, '')}
            </span>
          </div>
        );
      }

      // Metadata line
      if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
        return null;
      }

      // Parse inline chords
      const parts = line.split(/(\[[^\]]+\])/g);
      const hasChords = parts.some((p) => p.startsWith('[') && p.endsWith(']'));

      if (!hasChords) {
        return (
          <div key={lIdx} className="text-zinc-200 min-h-[1.5rem] font-sans text-sm leading-relaxed">
            {line}
          </div>
        );
      }

      return (
        <div key={lIdx} className="my-3 flex flex-wrap items-end gap-x-2 gap-y-1">
          {parts.map((part, pIdx) => {
            if (part.startsWith('[') && part.endsWith(']')) {
              const chordName = part.slice(1, -1);
              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => {
                    setActiveChordAction(chordName);
                    setReplacementChord(chordName);
                  }}
                  className="inline-flex items-center px-2 py-0.5 bg-orange-500/15 hover:bg-orange-500/30 text-orange-400 font-bold font-mono text-xs rounded border border-orange-500/40 transition cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                  title="Cliquer pour éditer, remplacer ou voir le diagramme d'accord"
                >
                  {chordName}
                </button>
              );
            }
            return (
              <span key={pIdx} className="text-white font-medium text-sm">
                {part}
              </span>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/50 border border-zinc-800 p-5 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-orange-500" /> Éditeur d'Accords & Partitions
            </h1>
            <p className="text-xs text-zinc-400">Ajoutez, modifiez et transposez vos accords de partitions PDF ou texte</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onOpenExportModal) {
                onOpenExportModal({
                  ...song,
                  title,
                  artist,
                  key: targetKey,
                  bpm: Number(bpm) || 120,
                  timeSignature,
                  durationSeconds: Number(durationSeconds) || 210,
                  capo: Number(capo) || 0,
                  tuning,
                  tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                  notes,
                  chordProContent: transposeOffset !== 0 ? transposeChordPro(chordProContent, transposeOffset) : chordProContent,
                });
              } else {
                exportMobileSheetsSongFile([{
                  ...song,
                  title,
                  artist,
                  key: targetKey,
                  bpm: Number(bpm) || 120,
                  timeSignature,
                  durationSeconds: Number(durationSeconds) || 210,
                  capo: Number(capo) || 0,
                  tuning,
                  tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
                  notes,
                  chordProContent: transposeOffset !== 0 ? transposeChordPro(chordProContent, transposeOffset) : chordProContent,
                }], title);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-orange-400 font-semibold text-xs rounded transition cursor-pointer border border-zinc-700"
            title="Exporter ce morceau (.msf / .msb / .cho)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter (.msf)</span>
          </button>
          <button
            onClick={() => setIsSyncStudioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 font-bold text-xs rounded transition cursor-pointer border border-amber-500/40 shadow-sm"
            title="Ouvrir le Studio de Calage & Chronomètre pour synchroniser chaque ligne au tempo exact"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>⏱️ Calage Paroles & Chrono</span>
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded transition"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded transition shadow cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Enregistrer les modifications
          </button>
        </div>
      </div>

      {/* Metadata Inputs Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-4">
        <h3 className="text-[10px] font-bold uppercase text-orange-400 tracking-widest">Spécifications de la Chanson</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Titre de la chanson</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Artiste / Groupe</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Tonalité Principale</label>
            <input
              type="text"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setTargetKey(e.target.value);
              }}
              className="w-full bg-zinc-950 border border-zinc-800 text-orange-400 font-mono font-bold px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Tempo (BPM)</label>
            <input
              type="number"
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono font-bold px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Capodastre (Frette)</label>
            <input
              type="number"
              min="0"
              max="12"
              value={capo}
              onChange={(e) => setCapo(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Chiffrage de Mesure</label>
            <input
              type="text"
              value={timeSignature}
              onChange={(e) => setTimeSignature(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Durée (en secondes)</label>
            <input
              type="number"
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Tags (séparés par des virgules)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Chanson Française, Pop, Live, PDF"
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-zinc-400 mb-1 flex items-center justify-between">
              <span>Lien Jam Track / Backing Track (YouTube ou Internet)</span>
              <button
                type="button"
                onClick={() => setIsJamModalOpen(true)}
                className="text-orange-400 hover:text-orange-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Radio className="w-3 h-3" /> Ouvrir Lecteur Jam Tracks
              </button>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={jamTrackUrl}
                onChange={(e) => setJamTrackUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="flex-1 bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setIsJamModalOpen(true)}
                className="px-3 py-2 bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Youtube className="w-3.5 h-3.5" /> Explorer
              </button>
            </div>
          </div>

          {/* Dedicated MIDI File (.mid / .midi) Attachment */}
          <div className="sm:col-span-2 bg-zinc-950/60 p-3.5 rounded-lg border border-purple-900/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-purple-400" />
                Fichier MIDI Associé (.mid / .midi)
              </span>
              {midiFileName && (
                <button
                  type="button"
                  onClick={() => {
                    setMidiData(undefined);
                    setMidiFileName(undefined);
                  }}
                  className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Supprimer le MIDI
                </button>
              )}
            </div>

            {midiFileName ? (
              <div className="flex items-center justify-between bg-purple-950/40 border border-purple-800/60 px-3 py-2 rounded text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400 font-mono">🎹 {midiFileName}</span>
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded font-bold">
                    Prêt pour le Lecteur Multipiste
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <label className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition">
                  <Plus className="w-3.5 h-3.5" /> Choisir un fichier .mid / .midi
                  <input
                    type="file"
                    accept=".mid,.midi"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          const base64 = (reader.result as string).split(',')[1];
                          setMidiData(base64);
                          setMidiFileName(file.name);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
                <span className="text-[11px] text-zinc-500">
                  Ou utilisez le lecteur MIDI live avec la démo Gainsbourg
                </span>
              </div>
            )}
          </div>

          {/* Configuration Preset VSampler 3 (.vs3 / .vsp) sur Disque D: */}
          <div className="sm:col-span-2 bg-zinc-950/70 p-3.5 rounded-lg border border-amber-900/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                Fichier Sampler VSampler 3 (.vs3 / .vsp) — 2ème Disque Interne (D:)
              </span>
              <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded font-bold flex items-center gap-1">
                <HardDrive className="w-3 h-3" />
                Dossier Relatif Morceau
              </span>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">
                Nom du fichier preset (stocké dans le dossier de la chanson) :
              </label>
              <input
                type="text"
                value={fichierSampler}
                onChange={(e) => setFichierSampler(e.target.value)}
                placeholder="Ex: couleur_cafe.vs3"
                className="w-full bg-zinc-900 border border-zinc-700 text-amber-200 font-mono px-3 py-2 rounded text-xs focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Aperçu dynamique du chemin reconstitué sous Windows */}
            <div className="p-2.5 bg-zinc-900/80 rounded border border-zinc-800 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>Reconstitution dynamique sur le 2ème disque (D:) :</span>
              </div>
              <div className="font-mono text-amber-300 text-[11px] bg-zinc-950 px-2 py-1 rounded border border-zinc-800 break-all select-all">
                {midiAudioEngine.buildDynamicVSamplerPath(title || 'Chanson', fichierSampler || 'setup.vs3')}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono pt-0.5">
                Commande système Windows : <span className="text-zinc-400">exec(&quot;C:\Program Files\VSampler3\VSampler3.exe&quot; &quot;{midiAudioEngine.buildDynamicVSamplerPath(title || 'Chanson', fichierSampler || 'setup.vs3')}&quot;)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Chord Builder Palette */}
      <div className="bg-zinc-900/60 border border-orange-500/30 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-orange-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Palette de Construction & d'Insertion d'Accords
            </h3>
          </div>
          <button
            onClick={() => setIsChordPaletteOpen(!isChordPaletteOpen)}
            className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
          >
            {isChordPaletteOpen ? 'Masquer la palette' : 'Afficher la palette'}
          </button>
        </div>

        {isChordPaletteOpen && (
          <div className="space-y-3 pt-2 border-t border-zinc-800">
            {/* Note fondamentales */}
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">1. Note Fondamentale :</span>
              <div className="flex flex-wrap gap-1">
                {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setBuilderRoot(r)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition ${
                      builderRoot === r
                        ? 'bg-orange-500 text-black shadow'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Suffixes & Qualité d'accord */}
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">2. Qualité d'accord :</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: 'Majeur', val: '' },
                  { label: 'Mineur (m)', val: 'm' },
                  { label: 'Septième (7)', val: '7' },
                  { label: 'Min 7 (m7)', val: 'm7' },
                  { label: 'Maj 7 (maj7)', val: 'maj7' },
                  { label: 'Sus 2 (sus2)', val: 'sus2' },
                  { label: 'Sus 4 (sus4)', val: 'sus4' },
                  { label: 'Diminué (dim)', val: 'dim' },
                  { label: 'Add 9 (add9)', val: 'add9' },
                  { label: 'Quinte (5)', val: '5' },
                  { label: 'Sixième (6)', val: '6' },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => setBuilderSuffix(s.val)}
                    className={`px-2 py-1 text-xs font-mono font-semibold rounded transition ${
                      builderSuffix === s.val
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Basse / Slash Chord */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Basse / Slash :</span>
                <select
                  value={builderBass}
                  onChange={(e) => setBuilderBass(e.target.value)}
                  className="bg-zinc-950 text-orange-400 font-mono text-xs font-bold border border-zinc-800 rounded px-2 py-1 focus:outline-none"
                >
                  <option value="">Pas de basse inversée</option>
                  {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((b) => (
                    <option key={b} value={b}>
                      /{b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => insertChordAtCursor(currentConstructedChord)}
                className="px-4 py-1.5 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded shadow transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Insérer [{currentConstructedChord}] au curseur
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor & Live Preview Switcher */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden shadow-xl">
        
        {/* Editor Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewTab('split')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                viewTab === 'split' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Vue Divisée
            </button>
            <button
              onClick={() => setViewTab('edit')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                viewTab === 'edit' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Éditeur ChordPro
            </button>
            <button
              onClick={() => setViewTab('preview')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                viewTab === 'preview' ? 'bg-orange-500 text-black font-bold' : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5 inline mr-1" /> Grille en Direct
            </button>

            <button
              type="button"
              onClick={handleRefineWithAi}
              disabled={isAiRefining}
              className="ml-2 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Permet de structurer et corriger les grilles brutes du PDF avec Gemini IA"
            >
              {isAiRefining ? (
                <>
                  <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span>Harmonisation PDF...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>⚡ Nettoyer & Structurer les Accords du PDF (IA)</span>
                </>
              )}
            </button>
          </div>

          {/* Transposition & Notation Mode Bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Transpose Controls */}
            <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800 text-xs">
              <span className="text-zinc-400 font-semibold mr-1">Transposer :</span>
              <button
                type="button"
                onClick={() => stepTranspose(-1)}
                className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold rounded"
                title="Abaisser d'un demi-ton (-1)"
              >
                -1
              </button>
              <span className="text-orange-400 font-mono font-bold px-1.5">{targetKey}</span>
              <button
                type="button"
                onClick={() => stepTranspose(1)}
                className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-white font-mono font-bold rounded"
                title="Augmenter d'un demi-ton (+1)"
              >
                +1
              </button>

              {transposeOffset !== 0 && (
                <button
                  type="button"
                  onClick={applyTranspositionPermanently}
                  className="ml-2 px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 font-bold text-[10px] uppercase rounded"
                  title="Appliquer définitivement au texte ChordPro"
                >
                  Appliquer
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded border border-zinc-800 text-xs">
              <span className="text-zinc-400 font-semibold">Notation :</span>
              <select
                value={notationMode}
                onChange={(e) => setNotationMode(e.target.value as NotationMode)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                <option value="standard" className="bg-zinc-900">Standard (C, D, E)</option>
                <option value="solfege" className="bg-zinc-900">Solfège (Do, Ré, Mi)</option>
                <option value="german" className="bg-zinc-900">Allemand (H, B)</option>
                <option value="nashville" className="bg-zinc-900">Nashville (1, 4, 5)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workspace Body */}
        <div className={`grid ${viewTab === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'} divide-y lg:divide-y-0 lg:divide-x divide-zinc-800`}>
          
          {/* ChordPro Raw Code Editor */}
          {(viewTab === 'split' || viewTab === 'edit') && (
            <div className="p-5 bg-zinc-950 flex flex-col h-[520px]">
              
              {/* Quick Sections Inserter */}
              <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b border-zinc-800">
                <span className="text-xs text-zinc-500 font-bold self-center mr-1">Sections :</span>
                {['[Intro]', '[Couplet 1]', '[Refrain]', '[Pont]', '[Solo]', '[Outro]'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => insertChordAtCursor('\n' + tag + '\n')}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-orange-300 font-mono text-xs font-bold rounded border border-zinc-700 transition"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                value={chordProContent}
                onChange={(e) => setChordProContent(e.target.value)}
                placeholder="Entrez vos paroles avec les accords entre crochets comme [C] ou [Am]..."
                className="w-full flex-1 bg-transparent text-zinc-200 font-mono text-xs leading-relaxed focus:outline-none resize-none p-2"
              />
            </div>
          )}

          {/* Formatted Live Chart Preview */}
          {(viewTab === 'split' || viewTab === 'preview') && (
            <div className="p-6 bg-zinc-900/40 h-[520px] overflow-y-auto">
              <div className="mb-4 pb-3 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{title || 'Chanson Sans Titre'}</h2>
                  <p className="text-xs text-zinc-400">{artist || 'Artiste Inconnu'}</p>
                </div>
                <span className="text-xs font-mono text-zinc-500">Cliquez sur un accord pour le modifier ou le remplacer</span>
              </div>

              <div className="space-y-1">
                {renderFormattedChordPro(chordProContent)}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal: Selected Chord Action (Edit / Replace / Delete / Diagram) */}
      {activeChordAction && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-orange-500 text-black font-mono font-bold text-sm rounded">
                  [{activeChordAction}]
                </span>
                <h3 className="text-sm font-bold text-white">Éditer cet Accord</h3>
              </div>
              <button
                onClick={() => setActiveChordAction(null)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">
                  Nouveau nom pour remplacer <span className="text-orange-400">[{activeChordAction}]</span> :
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={replacementChord}
                    onChange={(e) => setReplacementChord(e.target.value)}
                    placeholder="ex: G7, Cmaj7, Dm..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 text-orange-400 font-mono font-bold px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={() => handleReplaceChord(activeChordAction, replacementChord)}
                    className="px-3 py-2 bg-orange-500 text-black font-bold text-xs rounded hover:bg-orange-400"
                  >
                    Remplacer
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <button
                  onClick={() => {
                    onOpenChordModal(activeChordAction);
                    setActiveChordAction(null);
                  }}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded flex items-center justify-center gap-2"
                >
                  <Music className="w-4 h-4 text-orange-400" /> Voir Diagramme Guitare & Piano
                </button>

                <button
                  onClick={() => handleDeleteChord(activeChordAction)}
                  className="w-full py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 font-bold text-xs rounded flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4 text-red-400" /> Supprimer tous les [{activeChordAction}] de la chanson
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Jam Track Backing Player */}
      {isJamModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <JamTrackPlayer
            currentSong={{
              ...song,
              title,
              artist,
              key,
              bpm,
              jamTrackUrl,
              jamTrackStyle,
            }}
            onSaveJamTrackToSong={(url, style) => {
              setJamTrackUrl(url);
              if (style) setJamTrackStyle(style);
              setIsJamModalOpen(false);
            }}
            onClose={() => setIsJamModalOpen(false)}
          />
        </div>
      )}

      {/* Modal: Lyric Sync Studio & Precision Calibrator */}
      {isSyncStudioOpen && (
        <LyricSyncStudioModal
          song={{
            ...song,
            title,
            artist,
            key,
            bpm,
            midiData,
            midiFileName,
            midiSoundfontName,
            chordProContent,
            durationSeconds: Number(durationSeconds) || 210,
          }}
          onClose={() => setIsSyncStudioOpen(false)}
          onSaveSong={(updatedSong) => {
            setChordProContent(updatedSong.chordProContent);
            if (updatedSong.durationSeconds) setDurationSeconds(updatedSong.durationSeconds);
            setIsSyncStudioOpen(false);
          }}
        />
      )}

    </div>
  );
};
