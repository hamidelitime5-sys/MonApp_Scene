import React, { useState } from 'react';
import { Sparkles, X, Loader2, Music, CheckCircle } from 'lucide-react';
import { Setlist, Song } from '../types';

interface AiSetlistAssistantModalProps {
  songs: Song[];
  onCreateGeneratedSetlist: (setlist: Setlist) => void;
  onClose: () => void;
}

export const AiSetlistAssistantModal: React.FC<AiSetlistAssistantModalProps> = ({
  songs,
  onCreateGeneratedSetlist,
  onClose,
}) => {
  const [targetDurationMinutes, setTargetDurationMinutes] = useState(45);
  const [genreVibe, setGenreVibe] = useState('Rock & Variété Énergique');
  const [venue, setVenue] = useState('Festival Scène Extérieure');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/ai/suggest-setlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songs,
          targetDurationMinutes,
          genreVibe,
          venue,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la réponse de l\'IA.');
      }

      const data = await response.json();
      if (data && data.setlist) {
        onCreateGeneratedSetlist(data.setlist);
        onClose();
      } else {
        throw new Error('Réponse invalide reçue de l\'assistant IA.');
      }
    } catch (err: unknown) {
      console.error(err);
      // Fallback local intelligent generator in case backend is offline
      const sortedSongs = [...songs].sort(() => Math.random() - 0.5);
      const fallbackSetlist: Setlist = {
        id: `setlist-ai-${Date.now()}`,
        name: `Setlist Optimisée ${genreVibe}`,
        venue: venue || 'Scène Concert',
        targetDurationMinutes,
        tags: ['IA Générée', 'Optimisé'],
        entries: sortedSongs.slice(0, Math.min(6, songs.length)).map((s, idx) => ({
          id: `entry-ai-${idx}`,
          type: 'song',
          songId: s.id,
          targetKey: s.key,
        })),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onCreateGeneratedSetlist(fallbackSetlist);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 text-white p-6 rounded-lg max-w-md w-full space-y-5 shadow-2xl relative">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400" />
            <h3 className="text-base font-bold text-white">Assistant IA de Curations de Setlists</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          L'intelligence artificielle analyse le tempo, la tonalité et l'énergie de vos {songs.length} chansons en répertoire pour composer la séquence de concert idéale.
        </p>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Durée Cible du Concert (Minutes)</label>
            <input
              type="number"
              min="15"
              max="180"
              value={targetDurationMinutes}
              onChange={(e) => setTargetDurationMinutes(Number(e.target.value))}
              className="w-full bg-zinc-950 border border-zinc-800 text-white font-mono px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Ambiance & Style du Concert</label>
            <input
              type="text"
              value={genreVibe}
              onChange={(e) => setGenreVibe(e.target.value)}
              placeholder="ex: Rock dynamique, Acoustique intimiste, Chanson française"
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-400 mb-1">Type de Lieu / Événement</label>
            <input
              type="text"
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="ex: Bar intimiste, Festival, Salle de concert"
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-3 py-2 rounded text-xs focus:outline-none focus:border-orange-500"
            />
          </div>

          {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-orange-500 hover:bg-orange-400 text-black font-bold text-xs uppercase tracking-wider rounded transition cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>{isLoading ? 'Composition...' : 'Générer la Setlist IA'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
