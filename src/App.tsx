import React, { useState, useEffect } from 'react';
import { Navbar, ActiveTab } from './components/Navbar';
import { SetlistManager } from './components/SetlistManager';
import { SongLibrary } from './components/SongLibrary';
import { SongEditor } from './components/SongEditor';
import { StageMode } from './components/StageMode';
import { MusicianTools } from './components/MusicianTools';
import { ChordDiagramModal } from './components/ChordDiagramModal';
import { AiSetlistAssistantModal } from './components/AiSetlistAssistantModal';
import { ImportSongModal } from './components/ImportSongModal';
import { ExportModal } from './components/ExportModal';
import { TauriDesktopModal } from './components/TauriDesktopModal';
import { PrintableStageSheet } from './components/PrintableStageSheet';
import { Setlist, Song } from './types';
import {
  loadSongsFromStorage,
  saveSongsToStorage,
  loadSetlistsFromStorage,
  saveSetlistsToStorage,
} from './data/sampleData';

export default function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongsFromStorage());
  const [setlists, setlistsState] = useState<Setlist[]>(() => loadSetlistsFromStorage());
  const setSetlists = (newVal: Setlist[] | ((prev: Setlist[]) => Setlist[])) => {
    setlistsState(newVal);
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>('setlists');
  const [activeSetlistId, setActiveSetlistId] = useState<string | null>(
    setlists.length > 0 ? setlists[0].id : null
  );

  // Song being edited in SongEditor
  const [editingSong, setEditingSong] = useState<Song | null>(null);

  // Single song Stage view or setlist Stage view
  const [stageSingleSong, setStageSingleSong] = useState<Song | null>(null);
  const [isStageModeActive, setIsStageModeActive] = useState(false);

  // Modal states
  const [inspectedChord, setInspectedChord] = useState<string | null>(null);
  const [isAiSetlistModalOpen, setIsAiSetlistModalOpen] = useState(false);
  const [isImportSongModalOpen, setIsImportSongModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [exportTargetSong, setExportTargetSong] = useState<Song | null>(null);
  const [printableSetlist, setPrintableSetlist] = useState<Setlist | null>(null);

  const handleOpenExportModal = (targetSong?: Song | null, targetSetlistId?: string | null) => {
    if (targetSong) {
      setExportTargetSong(targetSong);
    } else {
      setExportTargetSong(null);
    }
    if (targetSetlistId) {
      setActiveSetlistId(targetSetlistId);
    }
    setIsExportModalOpen(true);
  };

  // Persist songs and setlists to localStorage
  useEffect(() => {
    saveSongsToStorage(songs);
  }, [songs]);

  useEffect(() => {
    saveSetlistsToStorage(setlists);
  }, [setlists]);

  // Song handlers
  const handleSaveSong = (updatedSong: Song) => {
    setSongs((prev) => {
      const idx = prev.findIndex((s) => s.id === updatedSong.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = updatedSong;
        return copy;
      }
      return [updatedSong, ...prev];
    });
    setEditingSong(null);
  };

  const handleCreateNewSong = () => {
    const newSong: Song = {
      id: `song-${Date.now()}`,
      title: 'Nouvelle Chanson',
      artist: 'Artiste',
      key: 'C',
      bpm: 120,
      timeSignature: '4/4',
      durationSeconds: 210,
      chordProContent: `{title: Nouvelle Chanson}\n{artist: Artiste}\n{key: C}\n\n[Couplet 1]\n[C]Paroles avec [G]accords intégrés\n\n[Refrain]\n[F]Paroles du refrain [C]ici`,
      tags: ['Chanson Française'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSongs((prev) => [newSong, ...prev]);
    setEditingSong(newSong);
  };

  const handleImportSongs = (newSongs: Song[]) => {
    setSongs((prev) => [...newSongs, ...prev]);
  };

  const handleDeleteSong = (id: string) => {
    setSongs((prev) => prev.filter((s) => s.id !== id));
    // Remove from setlists
    setSetlists((prev) =>
      prev.map((set) => ({
        ...set,
        entries: set.entries.filter((e) => e.songId !== id),
      }))
    );
  };

  // Setlist handlers
  const handleCreateSetlist = (name: string, venue?: string, targetDurationMinutes?: number) => {
    const newSetlist: Setlist = {
      id: `setlist-${Date.now()}`,
      name,
      venue,
      targetDurationMinutes,
      entries: [],
      tags: ['Live'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSetlists((prev) => [newSetlist, ...prev]);
    setActiveSetlistId(newSetlist.id);
  };

  const handleUpdateSetlist = (updatedSetlist: Setlist) => {
    setSetlists((prev) =>
      prev.map((set) => (set.id === updatedSetlist.id ? updatedSetlist : set))
    );
  };

  const handleDeleteSetlist = (id: string) => {
    setSetlists((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (activeSetlistId === id && filtered.length > 0) {
        setActiveSetlistId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Launch Stage View
  const handleLaunchStageModeForSetlist = (setlistId: string) => {
    setActiveSetlistId(setlistId);
    setStageSingleSong(null);
    setIsStageModeActive(true);
  };

  const handleLaunchSingleSongStageView = (song: Song) => {
    setStageSingleSong(song);
    setIsStageModeActive(true);
  };

  const activeSetlist = setlists.find((s) => s.id === activeSetlistId) || setlists[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#050505] text-slate-800 dark:text-zinc-300 font-sans selection:bg-orange-500 selection:text-black flex flex-col transition-colors duration-200">
      
      {/* Navigation Navbar */}
      {!isStageModeActive && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={(tab) => setActiveTab(tab)}
          setlists={setlists}
          activeSetlistId={activeSetlistId}
          setActiveSetlistId={setActiveSetlistId}
          onLaunchStageMode={() => {
            if (activeSetlistId) {
              handleLaunchStageModeForSetlist(activeSetlistId);
            } else if (setlists.length > 0) {
              handleLaunchStageModeForSetlist(setlists[0].id);
            }
          }}
          onOpenImportModal={() => setIsImportSongModalOpen(true)}
          onOpenExportModal={() => handleOpenExportModal()}
          onOpenDesktopModal={() => setIsDesktopModalOpen(true)}
        />
      )}

      {/* Main Workspace Body */}
      {isStageModeActive ? (
        <StageMode
          setlist={stageSingleSong ? undefined : activeSetlist}
          singleSong={stageSingleSong || undefined}
          songs={songs}
          onExitStageMode={() => setIsStageModeActive(false)}
          onOpenChordModal={(chord) => setInspectedChord(chord)}
          onUpdateSong={handleSaveSong}
        />
      ) : (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          
          {/* View Tab 1: Setlist Builder */}
          {activeTab === 'setlists' && (
            <SetlistManager
              setlists={setlists}
              songs={songs}
              activeSetlistId={activeSetlistId}
              onSelectSetlist={setActiveSetlistId}
              onCreateSetlist={handleCreateSetlist}
              onUpdateSetlist={handleUpdateSetlist}
              onDeleteSetlist={handleDeleteSetlist}
              onLaunchStageMode={handleLaunchStageModeForSetlist}
              onOpenAiSetlistAssistant={() => setIsAiSetlistModalOpen(true)}
              onOpenPrintableSheet={(setlist) => setPrintableSetlist(setlist)}
              onOpenImportModal={() => setIsImportSongModalOpen(true)}
              onOpenExportModal={(setlistId) => handleOpenExportModal(null, setlistId)}
            />
          )}

          {/* View Tab 2: Song Catalog or Song Editor */}
          {activeTab === 'songs' &&
            (editingSong ? (
              <SongEditor
                song={editingSong}
                onSave={handleSaveSong}
                onCancel={() => setEditingSong(null)}
                onOpenChordModal={(chord) => setInspectedChord(chord)}
                onOpenExportModal={(song) => handleOpenExportModal(song)}
              />
            ) : (
              <SongLibrary
                songs={songs}
                onSelectSongToEdit={(s) => setEditingSong(s)}
                onCreateNewSong={handleCreateNewSong}
                onOpenImportModal={() => setIsImportSongModalOpen(true)}
                onOpenExportModal={(song) => handleOpenExportModal(song)}
                onDeleteSong={handleDeleteSong}
                onLaunchSingleSongStageView={handleLaunchSingleSongStageView}
              />
            ))}

          {/* View Tab 3: Musician Tools (MIDI Multi-Track & SF2 Player, Metronome, Tuner & Chords) */}
          {activeTab === 'tools' && (
            <MusicianTools songs={songs} onUpdateSong={handleSaveSong} />
          )}

        </main>
      )}

      {/* Footer */}
      {!isStageModeActive && (
        <footer className="border-t border-slate-200 dark:border-zinc-900 bg-white dark:bg-zinc-950/80 py-6 text-center text-xs text-slate-500 dark:text-zinc-500">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <img src="/logo.jpg" alt="Logo" className="w-5 h-5 object-contain rounded" />
            <span className="font-bold text-slate-700 dark:text-zinc-400">Hamide Litime Software</span>
          </div>
          <p>© Hamide Litime Software — Application professionnelle de scène, carnet de chants, prompteur live et studio MIDI pour musiciens.</p>
        </footer>
      )}

      {/* Modal 1: Chord Fretboard & Piano Inspector */}
      {inspectedChord && (
        <ChordDiagramModal
          chordName={inspectedChord}
          onClose={() => setInspectedChord(null)}
        />
      )}

      {/* Modal 2: Import Songs (File Upload / Paste / AI Generator) */}
      {isImportSongModalOpen && (
        <ImportSongModal
          isOpen={isImportSongModalOpen}
          onClose={() => setIsImportSongModalOpen(false)}
          onImportSongs={handleImportSongs}
        />
      )}

      {/* Modal 3: Export Songs & MobileSheets Backup (.msb / .msf) */}
      {isExportModalOpen && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => {
            setIsExportModalOpen(false);
            setExportTargetSong(null);
          }}
          songs={songs}
          setlists={setlists}
          activeSetlistId={activeSetlistId}
          targetSong={exportTargetSong}
        />
      )}

      {/* Modal 4: AI Setlist Assistant Modal */}
      {isAiSetlistModalOpen && (
        <AiSetlistAssistantModal
          songs={songs}
          onCreateGeneratedSetlist={(newSetlist) => {
            setSetlists((prev) => [newSetlist, ...prev]);
            setActiveSetlistId(newSetlist.id);
            setActiveTab('setlists');
          }}
          onClose={() => setIsAiSetlistModalOpen(false)}
        />
      )}

      {/* Modal 5: Printable Stage Sheet */}
      {printableSetlist && (
        <PrintableStageSheet
          setlist={printableSetlist}
          songs={songs}
          onClose={() => setPrintableSetlist(null)}
        />
      )}

      {/* Modal 6: Tauri Windows 11 Desktop App Modal */}
      <TauriDesktopModal
        isOpen={isDesktopModalOpen}
        onClose={() => setIsDesktopModalOpen(false)}
      />

    </div>
  );
}
