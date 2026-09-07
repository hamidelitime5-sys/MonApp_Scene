import React, { useState } from 'react';
import { Search, Plus, Sparkles, Guitar, Play, Edit3, Trash2, Clock, Music, Upload, Download } from 'lucide-react';
import { Song } from '../types';

interface SongLibraryProps {
  songs: Song[];
  onSelectSongToEdit: (song: Song) => void;
  onCreateNewSong: () => void;
  onOpenImportModal: () => void;
  onOpenExportModal?: (song?: Song) => void;
  onDeleteSong: (id: string) => void;
  onLaunchSingleSongStageView: (song: Song) => void;
}

export const SongLibrary: React.FC<SongLibraryProps> = ({
  songs,
  onSelectSongToEdit,
  onCreateNewSong,
  onOpenImportModal,
  onOpenExportModal,
  onDeleteSong,
  onLaunchSingleSongStageView,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Tous');
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'bpm' | 'key' | 'updated'>('updated');

  // Collect all unique tags
  const allTags = Array.from(new Set(['Tous', ...songs.flatMap((s) => s.tags || [])]));

  // Filter and sort songs
  const filteredSongs = songs
    .filter((song) => {
      const matchesSearch =
        song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
        song.key.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTag = selectedTag === 'Tous' || (song.tags && song.tags.includes(selectedTag));
      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
      if (sortBy === 'bpm') return b.bpm - a.bpm;
      if (sortBy === 'key') return a.key.localeCompare(b.key);
      return b.updatedAt - a.updatedAt;
    });

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins}m ${remainder < 10 ? '0' : ''}${remainder}s`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Action Controls with Grand Format Logo */}
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
              <Music className="w-6 h-6 text-orange-500" /> Répertoire &amp; Partitions Live
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Gérez vos grilles d'accords, paroles grand format, transpositions et métadonnées de scène pour vos {songs.length} morceaux.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onOpenExportModal && (
            <button
              onClick={() => onOpenExportModal()}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              title="Exporter toute la bibliothèque en sauvegarde MobileSheets (.msb) ou JSON"
            >
              <Download className="w-3.5 h-3.5 text-zinc-400" />
              <span>Exporter (.msb / .msf)</span>
            </button>
          )}

          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-orange-400" />
            <span>Importer des chansons</span>
          </button>

          <button
            onClick={onCreateNewSong}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md hover:shadow-lg"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nouvelle Chanson</span>
          </button>
        </div>
      </div>

      {/* Search, Filter & Sorting Bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-zinc-900/50 border border-zinc-800 p-4 rounded-lg">
        
        {/* Search Bar */}
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher titre, artiste, tonalité (ex: Champs-Élysées, C, Joe)..."
            className="w-full bg-zinc-950 border border-zinc-800 text-white pl-10 pr-4 py-2 rounded text-xs focus:outline-none focus:border-orange-500 transition"
          />
        </div>

        {/* Tag Filters */}
        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto pb-2 lg:pb-0 scrollbar-none">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1.5 rounded text-xs font-semibold whitespace-nowrap transition ${
                selectedTag === tag
                  ? 'bg-orange-500 text-black font-bold'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <span className="text-xs text-zinc-400 font-semibold">Trier par :</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as unknown as typeof sortBy)}
            className="bg-zinc-950 border border-zinc-800 text-white text-xs font-semibold px-3 py-1.5 rounded focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="updated">Récemment Mises à Jour</option>
            <option value="title">Titre (A-Z)</option>
            <option value="artist">Artiste (A-Z)</option>
            <option value="bpm">Tempo (BPM rapide d'abord)</option>
            <option value="key">Tonalité</option>
          </select>
        </div>
      </div>

      {/* Song Cards Grid */}
      {filteredSongs.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-lg">
          <Music className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Aucune chanson trouvée</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1 mb-6">
            Ajustez vos critères de recherche ou cliquez sur "Importer des chansons" pour ajouter des partitions facilement.
          </p>
          <button
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-black font-bold text-xs uppercase tracking-wider rounded"
          >
            <Upload className="w-3.5 h-3.5" /> Importer des chansons
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSongs.map((song) => (
            <div
              key={song.id}
              className="group bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-5 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-orange-400 transition line-clamp-1">
                      {song.title}
                    </h3>
                    <p className="text-xs text-zinc-400 font-medium line-clamp-1">{song.artist}</p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 bg-zinc-800 text-orange-400 border border-zinc-700 rounded text-xs font-mono font-bold">
                      {song.key}
                    </span>
                  </div>
                </div>

                {/* Song Badges & Specs */}
                <div className="flex flex-wrap items-center gap-2 my-3 text-xs text-zinc-400 font-mono">
                  <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                    ⚡ {song.bpm} BPM
                  </span>
                  <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" /> {formatDuration(song.durationSeconds)}
                  </span>
                  {song.capo !== undefined && song.capo > 0 && (
                    <span className="bg-orange-500/10 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                      <Guitar className="w-3 h-3" /> Capo {song.capo}
                    </span>
                  )}
                  {song.midiFileName && (
                    <span className="bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded flex items-center gap-1">
                      🎹 MIDI Multi-pistes
                    </span>
                  )}
                </div>

                {/* Tags */}
                {song.tags && song.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {song.tags.map((t) => (
                      <span key={t} className="text-[10px] font-semibold bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800 mt-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectSongToEdit(song)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
                    title="Éditer la chanson & grille"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {onOpenExportModal && (
                    <button
                      onClick={() => onOpenExportModal(song)}
                      className="p-1.5 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                      title="Exporter ce morceau (.msf, .msb, .cho)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteSong(song.id)}
                    className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition cursor-pointer"
                    title="Supprimer la chanson"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => onLaunchSingleSongStageView(song)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-orange-500 hover:text-black text-orange-400 border border-zinc-700 font-bold text-xs rounded transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Vue Scène</span>
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
