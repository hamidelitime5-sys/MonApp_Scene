import React, { useState } from 'react';
import { X, Guitar, Piano, Volume2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { getGuitarChordData, getPianoChordData, getAllVoicingsForChord } from '../utils/chordUtils';
import { playGuitarChordStrum, playPianoChordNotes } from '../utils/audioEngine';
import { GuitarChordData } from '../types';

interface ChordDiagramModalProps {
  chordName: string;
  onClose: () => void;
}

export const ChordDiagramModal: React.FC<ChordDiagramModalProps> = ({ chordName, onClose }) => {
  const [activeTab, setActiveTab] = useState<'guitar' | 'piano'>('guitar');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const allVoicings = getAllVoicingsForChord(chordName);
  const [selectedVoicingIndex, setSelectedVoicingIndex] = useState(0);

  const guitarData: GuitarChordData = allVoicings[selectedVoicingIndex] || getGuitarChordData(chordName);
  const pianoData = getPianoChordData(chordName);

  const baseFret = guitarData.baseFret || 1;
  const isNutVisible = baseFret === 1;

  const handlePlayAudio = () => {
    setIsPlayingAudio(true);
    if (activeTab === 'guitar') {
      playGuitarChordStrum(guitarData.positions);
    } else {
      playPianoChordNotes(pianoData.notes);
    }
    setTimeout(() => setIsPlayingAudio(false), 1200);
  };

  // Keyboard keys for 2-octave piano view
  const pianoKeys = [
    { note: 'C', isBlack: false, pos: 0 },
    { note: 'C#', isBlack: true, pos: 0.6 },
    { note: 'D', isBlack: false, pos: 1 },
    { note: 'D#', isBlack: true, pos: 1.65 },
    { note: 'E', isBlack: false, pos: 2 },
    { note: 'F', isBlack: false, pos: 3 },
    { note: 'F#', isBlack: true, pos: 3.6 },
    { note: 'G', isBlack: false, pos: 4 },
    { note: 'G#', isBlack: true, pos: 4.62 },
    { note: 'A', isBlack: false, pos: 5 },
    { note: 'A#', isBlack: true, pos: 5.65 },
    { note: 'B', isBlack: false, pos: 6 },
    { note: 'C', isBlack: false, pos: 7 },
    { note: 'C#', isBlack: true, pos: 7.6 },
    { note: 'D', isBlack: false, pos: 8 },
    { note: 'D#', isBlack: true, pos: 8.65 },
    { note: 'E', isBlack: false, pos: 9 },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 text-white p-5 sm:p-6 rounded-xl max-w-md w-full space-y-4 relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold font-mono text-orange-400 bg-orange-500/10 border border-orange-500/30 px-3 py-1 rounded-lg">
              {chordName}
            </span>
            <div>
              <h3 className="text-sm font-bold text-zinc-200">Diagramme d'Accord</h3>
              <p className="text-xs text-zinc-400">
                {activeTab === 'guitar' 
                  ? (guitarData.voicingLabel || `Case ${baseFret}`)
                  : `Notes: ${pianoData.notes.join(' - ')}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePlayAudio}
              className={`p-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                isPlayingAudio 
                  ? 'bg-orange-500 text-black border-orange-400' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-orange-400 border-zinc-700'
              }`}
              title="Écouter le son de l'accord"
            >
              <Volume2 className={`w-4 h-4 ${isPlayingAudio ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">Écouter</span>
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={() => setActiveTab('guitar')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 ${
              activeTab === 'guitar' ? 'bg-orange-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Guitar className="w-4 h-4" /> Guitare
          </button>
          <button
            onClick={() => setActiveTab('piano')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center gap-1.5 ${
              activeTab === 'piano' ? 'bg-orange-500 text-black shadow' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Piano className="w-4 h-4" /> Piano
          </button>
        </div>

        {/* Voicing Switcher for Guitar */}
        {activeTab === 'guitar' && allVoicings.length > 1 && (
          <div className="flex items-center justify-between bg-zinc-950/60 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
            <span className="text-zinc-400 font-medium">Position / Voicing :</span>
            <div className="flex items-center gap-1">
              {allVoicings.map((v, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedVoicingIndex(idx)}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                    selectedVoicingIndex === idx
                      ? 'bg-orange-500 text-black'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  Case {v.baseFret}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Visualizer Body */}
        <div className="bg-zinc-950 p-4 sm:p-5 rounded-xl border border-zinc-800 flex flex-col items-center justify-center min-h-[260px]">
          {activeTab === 'guitar' ? (
            <div className="w-full flex flex-col items-center">
              
              {/* Fret indicator banner */}
              <div className="mb-2 flex items-center justify-between w-full max-w-[280px] px-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/40">
                    {baseFret === 1 ? 'Sillet (Case 1)' : `Case ${baseFret}`}
                  </span>
                  {guitarData.barreFret && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      Barré Case {guitarData.barreFret}
                    </span>
                  )}
                </div>
                <span className="text-zinc-500 text-[11px]">6 cordes (E A D G B E)</span>
              </div>

              {/* Guitar Fretboard SVG */}
              <svg width="270" height="250" viewBox="0 0 270 250" className="select-none">
                {/* Background board */}
                <rect x="52" y="34" width="160" height="180" fill="#18181b" rx="2" stroke="#27272a" strokeWidth="1" />

                {/* Nut (if baseFret === 1) or top fret wire */}
                {isNutVisible ? (
                  <rect x="50" y="30" width="164" height="8" fill="#e4e4e7" rx="2" />
                ) : (
                  <line x1="52" y1="34" x2="212" y2="34" stroke="#71717a" strokeWidth="2.5" />
                )}

                {/* Base fret number on the left */}
                {!isNutVisible && (
                  <g>
                    {/* Badge next to top fret */}
                    <rect x="6" y="42" width="40" height="22" rx="4" fill="#f97316" fillOpacity="0.15" stroke="#f97316" strokeWidth="1.5" />
                    <text x="26" y="57" fill="#fb923c" fontSize="11" fontWeight="bold" textAnchor="middle">
                      {baseFret}fr
                    </text>
                    {/* Arrow pointing to fret 1 */}
                    <polygon points="46,53 50,53 48,56" fill="#fb923c" />
                  </g>
                )}

                {/* Fret wire lines (5 frets shown) */}
                {[1, 2, 3, 4, 5].map((fretIndex) => {
                  const y = 34 + fretIndex * 36;
                  const fretNumber = baseFret + fretIndex - 1;
                  return (
                    <g key={`fret-${fretIndex}`}>
                      <line x1="52" y1={y} x2="212" y2={y} stroke="#3f3f46" strokeWidth="2" />
                      {/* Secondary fret markers on left */}
                      {fretIndex > 1 && (
                        <text x="44" y={y - 14} fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="end">
                          {fretNumber}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* 6 Guitar Strings (6=E, 5=A, 4=D, 3=G, 2=B, 1=E) */}
                {[0, 1, 2, 3, 4, 5].map((strIdx) => {
                  const x = 52 + strIdx * 32;
                  const strokeW = 3.2 - strIdx * 0.45; // Thicker low strings
                  return (
                    <line
                      key={`str-${strIdx}`}
                      x1={x}
                      y1={isNutVisible ? 38 : 34}
                      x2={x}
                      y2="214"
                      stroke="#a1a1aa"
                      strokeWidth={strokeW}
                    />
                  );
                })}

                {/* Barre representation if present */}
                {guitarData.barreFret && (
                  (() => {
                    const relBarreFret = guitarData.barreFret - baseFret + 1;
                    if (relBarreFret >= 1 && relBarreFret <= 5) {
                      const startStr = guitarData.barreStartString || 6;
                      const endStr = guitarData.barreEndString || 1;
                      const x1 = 52 + (6 - startStr) * 32;
                      const x2 = 52 + (6 - endStr) * 32;
                      const y = 34 + (relBarreFret - 1) * 36 + 18;
                      const width = Math.abs(x2 - x1) + 22;
                      const minX = Math.min(x1, x2) - 11;
                      return (
                        <g key="barre-capsule">
                          <rect
                            x={minX}
                            y={y - 9}
                            width={width}
                            height="18"
                            rx="9"
                            fill="#f97316"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                          <text x={minX + 11} y={y + 4} fill="#000" fontSize="10" fontWeight="bold" textAnchor="middle">
                            1
                          </text>
                        </g>
                      );
                    }
                    return null;
                  })()
                )}

                {/* Finger dots & Open/Muted string marks */}
                {guitarData.positions.map((pos) => {
                  const strIndex = 6 - pos.string;
                  const x = 52 + strIndex * 32;

                  // Muted string (X)
                  if (pos.fret === -1) {
                    return (
                      <text key={`pos-${pos.string}`} x={x} y="24" fill="#ef4444" fontSize="15" fontWeight="bold" textAnchor="middle">
                        ×
                      </text>
                    );
                  }

                  // Open string (O)
                  if (pos.fret === 0) {
                    return (
                      <circle key={`pos-${pos.string}`} cx={x} cy="20" r="5" stroke="#22c55e" strokeWidth="2" fill="none" />
                    );
                  }

                  // Fretted dot
                  const relativeFret = pos.fret - baseFret + 1;
                  if (relativeFret >= 1 && relativeFret <= 5) {
                    const y = 34 + (relativeFret - 1) * 36 + 18;
                    return (
                      <g key={`pos-${pos.string}`}>
                        <circle cx={x} cy={y} r="11" fill="#f97316" stroke="#ffffff" strokeWidth="1.8" className="shadow-lg" />
                        {pos.finger && (
                          <text x={x} y={y + 4} fill="#000000" fontSize="11" fontWeight="bold" textAnchor="middle">
                            {pos.finger}
                          </text>
                        )}
                      </g>
                    );
                  }
                  return null;
                })}

                {/* String names and notes played at bottom */}
                {[6, 5, 4, 3, 2, 1].map((stringNum, idx) => {
                  const x = 52 + idx * 32;
                  const noteName = guitarData.noteNames ? guitarData.noteNames[idx] : '';
                  const stringStandardName = ['E', 'A', 'D', 'G', 'B', 'E'][idx];
                  return (
                    <g key={`bottom-lbl-${stringNum}`}>
                      <text x={x} y="230" fill="#71717a" fontSize="10" fontWeight="bold" textAnchor="middle">
                        {stringStandardName}
                      </text>
                      {noteName && noteName !== '×' && (
                        <text x={x} y="244" fill="#fb923c" fontSize="10" fontWeight="bold" textAnchor="middle">
                          {noteName}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-2 text-[11px] text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="text-red-400 font-bold">×</span> Muette
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full border border-green-500 inline-block"></span> À vide
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-orange-500 inline-block text-[8px] text-black font-bold text-center leading-3">1</span> Doigté (1=Index, 2=Majeur...)
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center space-y-4 py-2">
              <div className="bg-zinc-900/80 px-4 py-2 rounded-lg border border-zinc-800 flex items-center gap-2 text-xs">
                <span className="text-zinc-400">Notes du piano :</span>
                <strong className="text-orange-400 font-mono text-sm tracking-wide">
                  {pianoData.notes.join('  •  ')}
                </strong>
              </div>

              {/* Piano Keyboard Interactive SVG */}
              <div className="w-full flex justify-center overflow-x-auto py-2">
                <svg width="280" height="140" viewBox="0 0 320 150" className="select-none">
                  {/* White Keys */}
                  {[
                    { note: 'C', x: 0 },
                    { note: 'D', x: 32 },
                    { note: 'E', x: 64 },
                    { note: 'F', x: 96 },
                    { note: 'G', x: 128 },
                    { note: 'A', x: 160 },
                    { note: 'B', x: 192 },
                    { note: 'C', x: 224 },
                    { note: 'D', x: 256 },
                    { note: 'E', x: 288 },
                  ].map((k, idx) => {
                    const isPlayed = pianoData.notes.includes(k.note);
                    return (
                      <g key={`white-${idx}`}>
                        <rect
                          x={k.x}
                          y="0"
                          width="30"
                          height="135"
                          rx="3"
                          fill={isPlayed ? '#f97316' : '#f4f4f5'}
                          stroke="#18181b"
                          strokeWidth="1.5"
                        />
                        <text
                          x={k.x + 15}
                          y="125"
                          fill={isPlayed ? '#000000' : '#71717a'}
                          fontSize="11"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {k.note}
                        </text>
                      </g>
                    );
                  })}

                  {/* Black Keys */}
                  {[
                    { note: 'C#', alt: 'Db', x: 20 },
                    { note: 'D#', alt: 'Eb', x: 52 },
                    { note: 'F#', alt: 'Gb', x: 116 },
                    { note: 'G#', alt: 'Ab', x: 148 },
                    { note: 'A#', alt: 'Bb', x: 180 },
                    { note: 'C#', alt: 'Db', x: 244 },
                    { note: 'D#', alt: 'Eb', x: 276 },
                  ].map((bk, idx) => {
                    const isPlayed = pianoData.notes.includes(bk.note) || pianoData.notes.includes(bk.alt);
                    return (
                      <g key={`black-${idx}`}>
                        <rect
                          x={bk.x}
                          y="0"
                          width="20"
                          height="84"
                          rx="2"
                          fill={isPlayed ? '#ea580c' : '#18181b'}
                          stroke={isPlayed ? '#ffffff' : '#27272a'}
                          strokeWidth="1.2"
                        />
                        {isPlayed && (
                          <circle cx={bk.x + 10} cy="68" r="4" fill="#ffffff" />
                        )}
                        <text
                          x={bk.x + 10}
                          y="50"
                          fill={isPlayed ? '#ffffff' : '#a1a1aa'}
                          fontSize="8"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {bk.note}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-zinc-500 text-xs">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>Appuyez sur Écouter pour entendre l'accord</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-lg transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};

