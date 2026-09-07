import React from 'react';
import { Printer, X } from 'lucide-react';
import { Setlist, Song } from '../types';

interface PrintableStageSheetProps {
  setlist: Setlist;
  songs: Song[];
  onClose: () => void;
}

export const PrintableStageSheet: React.FC<PrintableStageSheetProps> = ({
  setlist,
  songs,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-black p-8 rounded-lg max-w-3xl w-full shadow-2xl relative my-8 print:p-0 print:m-0 print:shadow-none print:w-full print:max-w-none">
        
        {/* Screen Controls (Hidden on Print) */}
        <div className="flex items-center justify-between pb-6 border-b border-zinc-200 mb-6 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Aperçu Feuille de Scène pour Impression</h2>
            <p className="text-xs text-zinc-500">Format optimisé haute visibilité pour pupitre ou sol de scène</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white font-bold text-xs uppercase tracking-wider rounded cursor-pointer hover:bg-zinc-800"
            >
              <Printer className="w-4 h-4" /> Imprimer / Exporter PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-black rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Content Body */}
        <div className="space-y-6">
          <div className="flex justify-between items-end border-b-4 border-black pb-4">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight">{setlist.name}</h1>
              {setlist.venue && <p className="text-sm font-bold text-zinc-700">📍 {setlist.venue}</p>}
            </div>
            <div className="text-right font-mono font-bold text-xs">
              <p>LIVESET PRO</p>
              <p className="text-zinc-500">{new Date().toLocaleDateString('fr-FR')}</p>
            </div>
          </div>

          {/* Séquence du concert */}
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-xs font-black uppercase tracking-wider">
                <th className="py-2 w-12">#</th>
                <th className="py-2">Titre du Morceau / Action</th>
                <th className="py-2">Artiste</th>
                <th className="py-2 text-center w-20">Tonalité</th>
                <th className="py-2 text-center w-20">Tempo</th>
                <th className="py-2 text-right w-24">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-sans text-sm">
              {setlist.entries.map((entry, idx) => {
                if (entry.type === 'interlude') {
                  return (
                    <tr key={entry.id} className="bg-zinc-100 font-bold italic">
                      <td className="py-3 font-mono">{idx + 1}</td>
                      <td colSpan={4} className="py-3 text-zinc-800">
                        ⏸ {entry.interludeTitle} {entry.notes && `(${entry.notes})`}
                      </td>
                      <td className="py-3 text-right font-mono text-xs">{entry.interludeDurationSeconds}s</td>
                    </tr>
                  );
                }

                const song = songs.find((s) => s.id === entry.songId);
                if (!song) return null;

                return (
                  <tr key={entry.id} className="font-semibold">
                    <td className="py-3 font-mono font-bold text-base">{idx + 1}</td>
                    <td className="py-3 text-base font-bold text-black">{song.title}</td>
                    <td className="py-3 text-zinc-600 text-xs">{song.artist}</td>
                    <td className="py-3 text-center">
                      <span className="font-mono font-bold text-sm bg-black text-white px-2 py-0.5 rounded">
                        {entry.targetKey || song.key}
                      </span>
                    </td>
                    <td className="py-3 text-center font-mono text-xs">{song.bpm} BPM</td>
                    <td className="py-3 text-right font-mono text-xs">
                      {Math.floor(song.durationSeconds / 60)}m {song.durationSeconds % 60}s
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer note */}
          <div className="pt-6 border-t-2 border-black flex justify-between text-[11px] font-bold text-zinc-600 uppercase">
            <span>© LiveSet Pro — Partition & Programmation de Concert</span>
            <span>Feuille de Scène Officielle</span>
          </div>
        </div>

      </div>
    </div>
  );
};
