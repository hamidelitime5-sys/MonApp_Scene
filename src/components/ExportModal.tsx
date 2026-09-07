import React, { useState } from 'react';
import { X, Download, HardDrive, Music, ListMusic, Check, FileText, Sparkles, FolderArchive, Layers } from 'lucide-react';
import { Song, Setlist } from '../types';
import { exportMobileSheetsBackup, exportMobileSheetsSongFile } from '../utils/mobileSheetsExporter';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  songs: Song[];
  setlists: Setlist[];
  activeSetlistId?: string | null;
  targetSong?: Song | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  songs,
  setlists,
  activeSetlistId,
  targetSong,
}) => {
  const [exportScope, setExportScope] = useState<'all' | 'setlist' | 'single'>('all');
  const [exportFormat, setExportFormat] = useState<'msb' | 'msf' | 'cho_zip' | 'json'>('msb');
  const [selectedSetlistId, setSelectedSetlistId] = useState<string>(
    activeSetlistId || (setlists.length > 0 ? setlists[0].id : '')
  );
  const [selectedSongId, setSelectedSongId] = useState<string>(
    targetSong?.id || (songs.length > 0 ? songs[0].id : '')
  );
  const [isExporting, setIsExporting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentSetlist = setlists.find((s) => s.id === selectedSetlistId);
  const currentSong = songs.find((s) => s.id === selectedSongId);

  // Compute songs to export based on selected scope
  const getSongsToExport = (): Song[] => {
    if (exportScope === 'single') {
      return currentSong ? [currentSong] : [];
    }
    if (exportScope === 'setlist' && currentSetlist) {
      const songIdsInSet = currentSetlist.entries
        .filter((e) => e.type === 'song' && e.songId)
        .map((e) => e.songId!);
      return songs.filter((s) => songIdsInSet.includes(s.id));
    }
    return songs;
  };

  const handleExecuteExport = async () => {
    setIsExporting(true);
    setSuccessNotice(null);

    const songsToExport = getSongsToExport();

    if (songsToExport.length === 0) {
      alert('Aucune chanson sélectionnée pour l\'export.');
      setIsExporting(false);
      return;
    }

    try {
      if (exportFormat === 'msb') {
        const backupName =
          exportScope === 'setlist' && currentSetlist
            ? `MobileSheets_${currentSetlist.name}`
            : exportScope === 'single' && currentSong
            ? `MobileSheets_${currentSong.title}`
            : 'MobileSheets_Bibliotheque';

        await exportMobileSheetsBackup(
          songsToExport,
          exportScope === 'all' ? setlists : currentSetlist ? [currentSetlist] : [],
          backupName
        );
        setSuccessNotice(`Fichier Sauvegarde MobileSheets (.msb) généré avec succès (${songsToExport.length} chanson(s)) !`);
      } else if (exportFormat === 'msf') {
        const fileName =
          exportScope === 'single' && currentSong
            ? currentSong.title
            : exportScope === 'setlist' && currentSetlist
            ? currentSetlist.name
            : 'MobileSheets_Chansons';

        await exportMobileSheetsSongFile(songsToExport, fileName);
        setSuccessNotice(`Fichier Chansons MobileSheets (.msf) généré avec succès (${songsToExport.length} chanson(s)) !`);
      } else if (exportFormat === 'json') {
        const data = {
          exportDate: new Date().toISOString(),
          songsCount: songsToExport.length,
          songs: songsToExport,
          setlists: exportScope === 'all' ? setlists : currentSetlist ? [currentSetlist] : [],
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LiveSet_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setSuccessNotice(`Sauvegarde JSON exportée avec succès !`);
      }
    } catch (err) {
      console.error('Erreur lors de l\'export:', err);
      alert('Une erreur est survenue lors de la création du fichier d\'export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Exporter & Sauvegarder (MobileSheets .msb / .msf)
              </h2>
              <p className="text-xs text-zinc-400">
                Transférez vos partitions et setlists vers votre tablette, MobileSheets ou vos sauvegardes.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          
          {/* Success Message */}
          {successNotice && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {/* Scope Selector */}
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-2 uppercase tracking-wider">
              1. Que souhaitez-vous exporter ?
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setExportScope('all')}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                  exportScope === 'all'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <HardDrive className={`w-4 h-4 ${exportScope === 'all' ? 'text-orange-400' : 'text-zinc-500'}`} />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">
                    {songs.length}
                  </span>
                </div>
                <span className="text-xs font-bold block text-white">Toute la Bibliothèque</span>
                <span className="text-[10px] text-zinc-500 leading-tight">Toutes les partitions & setlists</span>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('setlist')}
                disabled={setlists.length === 0}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                  exportScope === 'setlist'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <ListMusic className={`w-4 h-4 ${exportScope === 'setlist' ? 'text-orange-400' : 'text-zinc-500'}`} />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">
                    {setlists.length}
                  </span>
                </div>
                <span className="text-xs font-bold block text-white">Une Setlist</span>
                <span className="text-[10px] text-zinc-500 leading-tight">Chansons ordonnées du concert</span>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('single')}
                disabled={songs.length === 0}
                className={`p-3 rounded-lg border text-left flex flex-col justify-between transition cursor-pointer ${
                  exportScope === 'single'
                    ? 'bg-orange-500/10 border-orange-500 text-white shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <Music className={`w-4 h-4 ${exportScope === 'single' ? 'text-orange-400' : 'text-zinc-500'}`} />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300">
                    1
                  </span>
                </div>
                <span className="text-xs font-bold block text-white">Un Morceau Unique</span>
                <span className="text-[10px] text-zinc-500 leading-tight">Partition individuelle</span>
              </button>
            </div>
          </div>

          {/* Conditional Dropdown for Setlist or Song */}
          {exportScope === 'setlist' && setlists.length > 0 && (
            <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
              <label className="text-xs font-bold text-zinc-400 block mb-1.5">
                Sélectionner la Setlist à exporter :
              </label>
              <select
                value={selectedSetlistId}
                onChange={(e) => setSelectedSetlistId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              >
                {setlists.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.entries.filter((e) => e.type === 'song').length} chansons)
                  </option>
                ))}
              </select>
            </div>
          )}

          {exportScope === 'single' && songs.length > 0 && (
            <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800">
              <label className="text-xs font-bold text-zinc-400 block mb-1.5">
                Sélectionner la chanson à exporter :
              </label>
              <select
                value={selectedSongId}
                onChange={(e) => setSelectedSongId(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              >
                {songs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.artist} ({s.key})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Format Selector */}
          <div>
            <label className="text-xs font-bold text-zinc-300 block mb-2 uppercase tracking-wider">
              2. Format de destination
            </label>
            <div className="space-y-2">
              
              {/* MSB Option */}
              <label
                onClick={() => setExportFormat('msb')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  exportFormat === 'msb'
                    ? 'bg-orange-500/10 border-orange-500 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === 'msb'}
                  onChange={() => setExportFormat('msb')}
                  className="mt-1 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">Sauvegarde MobileSheets (.msb)</span>
                    <span className="px-1.5 py-0.5 bg-orange-500 text-black font-extrabold text-[10px] rounded">
                      Recommandé
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Archive standard avec base de données SQLite <code>mobilesheets.db</code> et fichiers d'accords. Idéal pour "Restaurer la sauvegarde" dans MobileSheets (Android / iPad / Windows).
                  </p>
                </div>
              </label>

              {/* MSF Option */}
              <label
                onClick={() => setExportFormat('msf')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  exportFormat === 'msf'
                    ? 'bg-orange-500/10 border-orange-500 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === 'msf'}
                  onChange={() => setExportFormat('msf')}
                  className="mt-1 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">Fichier Chanson MobileSheets (.msf)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Format d'échange direct pour importer des chansons isolées ou en lot dans MobileSheets via le menu "Importer &gt; Fichier MobileSheets".
                  </p>
                </div>
              </label>

              {/* JSON Option */}
              <label
                onClick={() => setExportFormat('json')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                  exportFormat === 'json'
                    ? 'bg-orange-500/10 border-orange-500 text-white'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  checked={exportFormat === 'json'}
                  onChange={() => setExportFormat('json')}
                  className="mt-1 text-orange-500 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-white">Sauvegarde Universelle (JSON)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Format texte brut universel pour sauvegarder ou transférer entre navigateurs et ordinateurs.
                  </p>
                </div>
              </label>

            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            Total à exporter : <strong className="text-white font-mono">{getSongsToExport().length}</strong> morceau(x)
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition"
            >
              Fermer
            </button>

            <button
              type="button"
              onClick={handleExecuteExport}
              disabled={isExporting || getSongsToExport().length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded-lg transition shadow-lg cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Génération du fichier...' : `Télécharger le fichier .${exportFormat}`}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
