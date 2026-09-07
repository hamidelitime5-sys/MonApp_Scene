import React, { useState } from 'react';
import {
  ListMusic,
  Plus,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  Clock,
  Sparkles,
  Printer,
  Copy,
  Check,
  Download,
  Pencil,
  Target,
  Edit2,
  X,
} from 'lucide-react';
import { Setlist, SetlistEntry, Song } from '../types';

interface SetlistManagerProps {
  setlists: Setlist[];
  songs: Song[];
  activeSetlistId: string | null;
  onSelectSetlist: (id: string) => void;
  onCreateSetlist: (name: string, venue?: string, targetDuration?: number) => void;
  onUpdateSetlist: (setlist: Setlist) => void;
  onDeleteSetlist: (id: string) => void;
  onLaunchStageMode: (setlistId: string) => void;
  onOpenAiSetlistAssistant: () => void;
  onOpenPrintableSheet: (setlist: Setlist) => void;
  onOpenImportModal: () => void;
  onOpenExportModal?: (setlistId?: string) => void;
}

export const SetlistManager: React.FC<SetlistManagerProps> = ({
  setlists,
  songs,
  activeSetlistId,
  onSelectSetlist,
  onCreateSetlist,
  onUpdateSetlist,
  onDeleteSetlist,
  onLaunchStageMode,
  onOpenAiSetlistAssistant,
  onOpenPrintableSheet,
  onOpenImportModal,
  onOpenExportModal,
}) => {
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [newSetVenue, setNewSetVenue] = useState('');
  const [newSetDuration, setNewSetDuration] = useState(60);

  // Edit Setlist details modal / inline state
  const [isEditingSetlistDetails, setIsEditingSetlistDetails] = useState(false);
  const [editSetName, setEditSetName] = useState('');
  const [editSetVenue, setEditSetVenue] = useState('');
  const [editSetDuration, setEditSetDuration] = useState(45);

  const [isAddSongModalOpen, setIsAddSongModalOpen] = useState(false);
  const [isAddInterludeModalOpen, setIsAddInterludeModalOpen] = useState(false);
  const [interludeTitle, setInterludeTitle] = useState('Accordage & Discours d\'Accroche');
  const [interludeDurationSecs, setInterludeDurationSecs] = useState(120);

  const [copiedText, setCopiedText] = useState(false);

  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];

  const startEditingSetlist = () => {
    if (!activeSetlist) return;
    setEditSetName(activeSetlist.name);
    setEditSetVenue(activeSetlist.venue || '');
    setEditSetDuration(activeSetlist.targetDurationMinutes || 45);
    setIsEditingSetlistDetails(true);
  };

  const handleSaveSetlistDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSetlist || !editSetName.trim()) return;
    onUpdateSetlist({
      ...activeSetlist,
      name: editSetName.trim(),
      venue: editSetVenue.trim() || undefined,
      targetDurationMinutes: Math.max(1, editSetDuration),
      updatedAt: Date.now(),
    });
    setIsEditingSetlistDetails(false);
  };

  const handleQuickAdjustTargetDuration = (deltaMinutes: number) => {
    if (!activeSetlist) return;
    const current = activeSetlist.targetDurationMinutes || 45;
    const updated = Math.max(5, current + deltaMinutes);
    onUpdateSetlist({
      ...activeSetlist,
      targetDurationMinutes: updated,
      updatedAt: Date.now(),
    });
  };

  // Calculate total duration in seconds for setlist
  const calculateSetlistDurationSeconds = (set: Setlist) => {
    return set.entries.reduce((acc, entry) => {
      if (entry.type === 'interlude') {
        return acc + (entry.interludeDurationSeconds || 60);
      }
      const song = songs.find((s) => s.id === entry.songId);
      return acc + (song ? song.durationSeconds : 210);
    }, 0);
  };

  const formatSecondsToMinSec = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
  };

  const handleCreateNewSetlistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSetName.trim()) return;
    onCreateSetlist(newSetName.trim(), newSetVenue.trim(), newSetDuration);
    setNewSetName('');
    setNewSetVenue('');
    setIsCreatingNew(false);
  };

  // Entry Management Functions
  const handleAddSongToSetlist = (songId: string) => {
    if (!activeSetlist) return;
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    const newEntry: SetlistEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'song',
      songId: song.id,
      targetKey: song.key,
      capo: song.capo || 0,
    };

    const updatedSet: Setlist = {
      ...activeSetlist,
      entries: [...activeSetlist.entries, newEntry],
      updatedAt: Date.now(),
    };
    onUpdateSetlist(updatedSet);
    setIsAddSongModalOpen(false);
  };

  const handleAddInterludeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSetlist) return;

    const newEntry: SetlistEntry = {
      id: `interlude-${Date.now()}`,
      type: 'interlude',
      interludeTitle: interludeTitle || 'Pause / Accordage',
      interludeDurationSeconds: Number(interludeDurationSecs) || 60,
    };

    const updatedSet: Setlist = {
      ...activeSetlist,
      entries: [...activeSetlist.entries, newEntry],
      updatedAt: Date.now(),
    };
    onUpdateSetlist(updatedSet);
    setIsAddInterludeModalOpen(false);
  };

  const handleMoveEntry = (index: number, direction: 'up' | 'down') => {
    if (!activeSetlist) return;
    const newEntries = [...activeSetlist.entries];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newEntries.length) return;

    const temp = newEntries[index];
    newEntries[index] = newEntries[targetIdx];
    newEntries[targetIdx] = temp;

    onUpdateSetlist({
      ...activeSetlist,
      entries: newEntries,
      updatedAt: Date.now(),
    });
  };

  const handleRemoveEntry = (entryId: string) => {
    if (!activeSetlist) return;
    const updatedEntries = activeSetlist.entries.filter((e) => e.id !== entryId);
    onUpdateSetlist({
      ...activeSetlist,
      entries: updatedEntries,
      updatedAt: Date.now(),
    });
  };

  const handleKeyChange = (entryId: string, newKey: string) => {
    if (!activeSetlist) return;
    const updatedEntries = activeSetlist.entries.map((entry) => {
      if (entry.id === entryId) {
        return { ...entry, targetKey: newKey };
      }
      return entry;
    });
    onUpdateSetlist({
      ...activeSetlist,
      entries: updatedEntries,
      updatedAt: Date.now(),
    });
  };

  // Share / Copy Text Format
  const handleCopySetlistText = () => {
    if (!activeSetlist) return;
    let text = `🎵 SETLIST : ${activeSetlist.name}\n`;
    if (activeSetlist.venue) text += `📍 Lieu : ${activeSetlist.venue}\n`;
    text += `⏱ Durée Totale : ${formatSecondsToMinSec(calculateSetlistDurationSeconds(activeSetlist))}\n\n`;

    activeSetlist.entries.forEach((entry, idx) => {
      if (entry.type === 'interlude') {
        text += `[${idx + 1}] ⏸ Intermède : ${entry.interludeTitle} (${entry.interludeDurationSeconds}s)\n`;
      } else {
        const song = songs.find((s) => s.id === entry.songId);
        if (song) {
          text += `[${idx + 1}] ${song.title} - ${song.artist} | Tonalité : ${entry.targetKey || song.key} | BPM : ${song.bpm}\n`;
        }
      }
    });

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Main Actions with Grand Format Logo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-gradient-to-r from-slate-900 via-zinc-900 to-black border border-slate-700 dark:border-zinc-800 p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-5">
          {/* Logo Grand Format */}
          <div className="h-20 sm:h-24 w-36 sm:w-44 bg-white rounded-2xl border-2 border-orange-500/40 p-2 shadow-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img
              src="/logo-wide.jpg"
              alt="Hamide Litime Software Grand Format"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpg';
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-orange-400">
                Hamide Litime Software
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-black">
                Edition Pro
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
              <ListMusic className="w-6 h-6 text-orange-500" /> Gestionnaire de Setlists &amp; Scène
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Organisez la séquence de vos concerts, le timing global, le prompteur live haute lisibilité et les transpositions pour vos musiciens.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpenAiSetlistAssistant}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Assistant IA Setlist</span>
          </button>

          <button
            onClick={() => setIsCreatingNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nouvelle Setlist</span>
          </button>
        </div>
      </div>

      {/* Form: Create New Setlist */}
      {isCreatingNew && (
        <form onSubmit={handleCreateNewSetlistSubmit} className="bg-zinc-900 border border-orange-500/40 p-6 rounded-lg space-y-4 shadow-2xl">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-400" /> Créer une Nouvelle Setlist
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Nom de la Setlist *</label>
              <input
                type="text"
                required
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder="ex: Concert Festival d'Été 2026"
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Lieu / Événement</label>
              <input
                type="text"
                value={newSetVenue}
                onChange={(e) => setNewSetVenue(e.target.value)}
                placeholder="ex: Scène Principale du Parc"
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Durée Cible (Minutes)</label>
              <input
                type="number"
                value={newSetDuration}
                onChange={(e) => setNewSetDuration(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono px-3 py-2 rounded text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded"
            >
              Créer la Setlist
            </button>
          </div>
        </form>
      )}

      {/* Setlists Tabs & Active Setlist Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Setlists Sidebar Navigation */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest px-1">Vos Setlists ({setlists.length})</h3>
          {setlists.map((set) => {
            const isSelected = activeSetlist && activeSetlist.id === set.id;
            const durationSecs = calculateSetlistDurationSeconds(set);
            return (
              <div
                key={set.id}
                onClick={() => onSelectSetlist(set.id)}
                className={`p-4 rounded border transition cursor-pointer flex flex-col gap-2 ${
                  isSelected
                    ? 'bg-orange-500/10 border-orange-500/30 text-white shadow-sm'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className={`font-bold text-sm ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                    {set.name}
                  </h4>
                  {setlists.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSetlist(set.id);
                      }}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Supprimer la Setlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                  <span>{set.entries.length === 1 ? '1 élément' : `${set.entries.length} éléments`}</span>
                  <span>⏱ {formatSecondsToMinSec(durationSecs)}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Setlist Tracklist Workspace */}
        {activeSetlist && (
          <div className="lg:col-span-3 space-y-6">
            
            {/* Active Set Header Card */}
            <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">{activeSetlist.name}</h2>
                    <button
                      onClick={startEditingSetlist}
                      className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded-lg transition"
                      title="Modifier les informations de la setlist (Titre, Lieu, Durée Cible)"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">
                    {activeSetlist.venue ? `📍 ${activeSetlist.venue}` : 'Lieu non spécifié'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleCopySetlistText}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-semibold rounded transition cursor-pointer"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copié !' : 'Copier le texte'}</span>
                  </button>

                  <button
                    onClick={() => onOpenPrintableSheet(activeSetlist)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white text-xs font-semibold rounded transition cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 text-orange-400" />
                    <span>Imprimer Feuille</span>
                  </button>

                  {onOpenExportModal && (
                    <button
                      onClick={() => onOpenExportModal(activeSetlist.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-orange-400 text-xs font-semibold rounded transition cursor-pointer"
                      title="Exporter cette Setlist pour MobileSheets (.msb / .msf)"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exporter (.msb / .msf)</span>
                    </button>
                  )}

                  <button
                    onClick={() => onLaunchStageMode(activeSetlist.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded shadow transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>LANCER LE MODE SCÈNE</span>
                  </button>
                </div>
              </div>

              {/* Setlist Timing Metrics */}
              {(() => {
                const totalDurationSecs = calculateSetlistDurationSeconds(activeSetlist);
                const targetSecs = (activeSetlist.targetDurationMinutes || 45) * 60;
                const percent = Math.min(100, Math.round((totalDurationSecs / targetSecs) * 100));
                const songCount = activeSetlist.entries.filter((e) => e.type === 'song').length;
                const interludeCount = activeSetlist.entries.filter((e) => e.type === 'interlude').length;
                const deltaMins = Math.round((targetSecs - totalDurationSecs) / 60);

                return (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                      <div>
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                          Durée Calculée
                        </span>
                        <div className="text-base font-bold text-orange-400 font-mono mt-1">
                          {formatSecondsToMinSec(totalDurationSecs)}
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide flex items-center gap-1">
                            <Target className="w-3 h-3 text-orange-400" />
                            Durée Cible
                          </span>
                          <button
                            onClick={startEditingSetlist}
                            className="text-zinc-500 hover:text-orange-400 transition"
                            title="Modifier la durée cible"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-base font-bold text-white font-mono">
                            {activeSetlist.targetDurationMinutes || 45} mins
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleQuickAdjustTargetDuration(-5)}
                              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
                              title="Réduire de 5 minutes"
                            >
                              -5m
                            </button>
                            <button
                              onClick={() => handleQuickAdjustTargetDuration(5)}
                              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded text-[10px] font-bold font-mono transition"
                              title="Ajouter 5 minutes"
                            >
                              +5m
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                          Nombre de Chansons
                        </span>
                        <div className="text-base font-bold text-white font-mono mt-1">
                          {songCount === 1 ? '1 titre' : `${songCount} titres`}
                        </div>
                      </div>

                      <div>
                        <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                          Intermèdes / Pauses
                        </span>
                        <div className="text-base font-bold text-white font-mono mt-1">
                          {interludeCount <= 1 ? `${interludeCount} pause` : `${interludeCount} pauses`}
                        </div>
                      </div>
                    </div>

                    {/* Target Duration Progress & Delta Bar */}
                    <div className="bg-zinc-950/80 px-4 py-2.5 rounded-lg border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-400 font-medium">Progression du Set :</span>
                        <span className="font-mono font-bold text-orange-400">{percent}%</span>
                        <span className="text-zinc-500 font-mono text-[11px]">
                          ({formatSecondsToMinSec(totalDurationSecs)} / {(activeSetlist.targetDurationMinutes || 45)}m)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {deltaMins > 0 ? (
                          <span className="text-zinc-400">
                            Temps restant à programmer : <strong className="text-emerald-400 font-mono">{deltaMins} min</strong>
                          </span>
                        ) : deltaMins === 0 ? (
                          <span className="text-emerald-400 font-bold">
                            ✓ Durée exacte atteinte
                          </span>
                        ) : (
                          <span className="text-amber-400">
                            Dépassement du temps cible : <strong className="text-amber-400 font-mono">+{Math.abs(deltaMins)} min</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Add Song & Add Interlude Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setIsAddSongModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-semibold rounded transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter Chanson du Répertoire
                </button>

                <button
                  onClick={() => setIsAddInterludeModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-semibold rounded transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-orange-400" /> Ajouter Intermède / Accordage
                </button>
              </div>
            </div>

            {/* Tracklist Items List */}
            <div className="space-y-3">
              {activeSetlist.entries.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900/40 border border-dashed border-zinc-800 rounded-lg">
                  <ListMusic className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400 font-medium">Cette setlist est actuellement vide.</p>
                  <button
                    onClick={() => setIsAddSongModalOpen(true)}
                    className="mt-3 px-4 py-2 bg-orange-500 text-black font-bold text-xs uppercase tracking-wider rounded"
                  >
                    Ajouter votre première chanson
                  </button>
                </div>
              ) : (
                activeSetlist.entries.map((entry, idx) => {
                  if (entry.type === 'interlude') {
                    return (
                      <div
                        key={entry.id}
                        className="bg-zinc-950 border border-orange-500/30 p-4 rounded flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 flex items-center justify-center font-mono font-bold text-xs">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                              ⏸ Intermède / Accordage
                            </span>
                            <h4 className="text-sm font-bold text-white">{entry.interludeTitle}</h4>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-zinc-400">
                            ⏱ {entry.interludeDurationSeconds}s
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleMoveEntry(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-zinc-500 hover:text-white disabled:opacity-30"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleMoveEntry(idx, 'down')}
                              disabled={idx === activeSetlist.entries.length - 1}
                              className="p-1 text-zinc-500 hover:text-white disabled:opacity-30"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveEntry(entry.id)}
                              className="p-1 text-zinc-500 hover:text-red-400 ml-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const song = songs.find((s) => s.id === entry.songId);
                  if (!song) return null;

                  return (
                    <div
                      key={entry.id}
                      className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 p-4 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded bg-zinc-800 text-zinc-300 flex items-center justify-center font-mono font-bold text-xs">
                          {idx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{song.title}</h4>
                          <p className="text-xs text-zinc-400">{song.artist}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        {/* Target Key Selector */}
                        <div className="flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded border border-zinc-800 text-xs">
                          <span className="text-zinc-500 font-semibold">Tonalité :</span>
                          <input
                            type="text"
                            value={entry.targetKey || song.key}
                            onChange={(e) => handleKeyChange(entry.id, e.target.value)}
                            className="w-12 bg-transparent text-orange-400 font-mono font-bold text-center focus:outline-none"
                          />
                        </div>

                        <span className="text-xs font-mono text-zinc-400">
                          ⚡ {song.bpm} BPM
                        </span>

                        <span className="text-xs font-mono text-zinc-400">
                          {Math.floor(song.durationSeconds / 60)}m {song.durationSeconds % 60}s
                        </span>

                        {/* Order & Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleMoveEntry(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveEntry(idx, 'down')}
                            disabled={idx === activeSetlist.entries.length - 1}
                            className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveEntry(entry.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>

      {/* Modal: Add Song from Library */}
      {isAddSongModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 text-white p-6 rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col">
            <h3 className="text-base font-bold mb-4">Sélectionner une Chanson à Ajouter</h3>
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {songs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => handleAddSongToSetlist(song.id)}
                  className="p-3 bg-zinc-950 hover:bg-orange-500/10 border border-zinc-800 hover:border-orange-500/30 rounded cursor-pointer flex items-center justify-between transition"
                >
                  <div>
                    <h4 className="font-bold text-sm text-white">{song.title}</h4>
                    <p className="text-xs text-zinc-400">{song.artist}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 bg-zinc-800 text-orange-400 font-bold rounded border border-zinc-700">
                      {song.key}
                    </span>
                    <span className="text-zinc-500">{song.bpm} BPM</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between items-center">
              <button
                onClick={() => {
                  setIsAddSongModalOpen(false);
                  onOpenImportModal();
                }}
                className="text-xs text-orange-400 hover:underline font-bold"
              >
                + Importer une nouvelle chanson...
              </button>
              <button
                onClick={() => setIsAddSongModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Interlude */}
      {isAddInterludeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleAddInterludeSubmit}
            className="bg-zinc-900 border border-zinc-800 text-white p-6 rounded-lg max-w-md w-full space-y-4"
          >
            <h3 className="text-base font-bold">Ajouter un Intermède / Pause</h3>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Titre de l'intermède</label>
              <input
                type="text"
                required
                value={interludeTitle}
                onChange={(e) => setInterludeTitle(e.target.value)}
                placeholder="ex: Accordage / Mot d'accueil du chanteur"
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1">Durée (Secondes)</label>
              <input
                type="number"
                value={interludeDurationSecs}
                onChange={(e) => setInterludeDurationSecs(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAddInterludeModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 font-semibold text-xs rounded"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-orange-500 text-black font-bold text-xs uppercase tracking-wider rounded"
              >
                Ajouter l'Intermède
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Setlist Details (Title, Venue, Target Duration) */}
      {isEditingSetlistDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSaveSetlistDetails}
            className="bg-zinc-900 border border-zinc-700 text-white p-6 rounded-xl max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Modifier la Setlist</h3>
                  <p className="text-xs text-zinc-400">Informations & Durée Cible</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingSetlistDetails(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Nom de la Setlist</label>
                <input
                  type="text"
                  required
                  value={editSetName}
                  onChange={(e) => setEditSetName(e.target.value)}
                  placeholder="ex: Grand Concert Festival d'Été 2026"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Lieu / Scène</label>
                <input
                  type="text"
                  value={editSetVenue}
                  onChange={(e) => setEditSetVenue(e.target.value)}
                  placeholder="ex: Scène Principale du Parc"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-zinc-300">Durée Cible du Concert (Minutes)</label>
                  <span className="text-xs font-mono font-bold text-orange-400">{editSetDuration} min</span>
                </div>
                <input
                  type="number"
                  min="5"
                  max="360"
                  step="5"
                  required
                  value={editSetDuration}
                  onChange={(e) => setEditSetDuration(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-orange-500"
                />

                {/* Preset chips */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-zinc-500">Préréglages :</span>
                  {[30, 45, 60, 75, 90, 120].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setEditSetDuration(mins)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition ${
                        editSetDuration === mins
                          ? 'bg-orange-500 text-black font-bold'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEditingSetlistDetails(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-lg transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition"
              >
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
