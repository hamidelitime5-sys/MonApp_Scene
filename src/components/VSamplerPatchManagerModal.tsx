import React, { useState, useEffect } from 'react';
import {
  Piano,
  Sliders,
  Send,
  Save,
  RefreshCw,
  X,
  Check,
  HelpCircle,
  Activity,
  Sparkles,
  Volume2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Music,
  Zap,
  Code,
  Copy,
  FolderOpen,
  FileCode,
  Terminal,
  HardDrive,
} from 'lucide-react';
import { Song, VSamplerSongConfig, VSamplerChannelConfig } from '../types';
import { midiAudioEngine, GM_INSTRUMENTS, MidiPlaybackState } from '../utils/midiAudioEngine';

interface VSamplerPatchManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song | null;
  onUpdateSong?: (updatedSong: Song) => void;
  onShowToast?: (msg: string) => void;
}

const GM_CATEGORIES = [
  { name: 'Piano (0-7)', min: 0, max: 7 },
  { name: 'Percussion chromatique (8-15)', min: 8, max: 15 },
  { name: 'Orgue (16-23)', min: 16, max: 23 },
  { name: 'Guitare (24-31)', min: 24, max: 31 },
  { name: 'Basse (32-39)', min: 32, max: 39 },
  { name: 'Cordes / Solo (40-47)', min: 40, max: 47 },
  { name: 'Ensemble (48-55)', min: 48, max: 55 },
  { name: 'Cuivres (56-63)', min: 56, max: 63 },
  { name: 'Anches / Sax (64-71)', min: 64, max: 71 },
  { name: 'Flûtes (72-79)', min: 72, max: 79 },
  { name: 'Synth Lead (80-87)', min: 80, max: 87 },
  { name: 'Synth Pad (88-95)', min: 88, max: 95 },
  { name: 'Effets FX (96-103)', min: 96, max: 103 },
  { name: 'Ethnique / Divers (104-111)', min: 104, max: 111 },
  { name: 'Percussif / Drums (112-119)', min: 112, max: 119 },
  { name: 'Effets sonores (120-127)', min: 120, max: 127 },
];

export const VSamplerPatchManagerModal: React.FC<VSamplerPatchManagerModalProps> = ({
  isOpen,
  onClose,
  currentSong,
  onUpdateSong,
  onShowToast,
}) => {
  const [engineState, setEngineState] = useState<MidiPlaybackState>(midiAudioEngine.getState());
  const [config, setConfig] = useState<VSamplerSongConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'matrix' | 'json'>('matrix');
  const [dossierInstruments, setDossierInstruments] = useState<string>(() => midiAudioEngine.getVSamplerRootFolder());
  const [fichierSampler, setFichierSampler] = useState<string>('');
  const [vsamplerExePath, setVsamplerExePath] = useState<string>('C:\\Program Files\\VSampler3\\VSampler3.exe');
  const [isOpeningPreset, setIsOpeningPreset] = useState<boolean>(false);
  const [showAdvancedPath, setShowAdvancedPath] = useState<boolean>(false);
  const [jsonText, setJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isJsonCopied, setIsJsonCopied] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [activeTestChannel, setActiveTestChannel] = useState<number | null>(null);

  // Subscribe to MIDI Engine updates
  useEffect(() => {
    const unsub = midiAudioEngine.subscribe((state) => {
      setEngineState(state);
    });
    return () => unsub();
  }, []);

  // Sync JSON text representation when config or song changes
  useEffect(() => {
    if (!currentSong || !config) return;
    const instruments = midiAudioEngine.exportSimpleInstrumentsConfig(config);
    const obj: any = {
      titre: currentSong.title,
      fichier_midi: currentSong.midiFileName || `${currentSong.title.toLowerCase().replace(/\s+/g, '_')}.mid`,
      fichier_sampler: fichierSampler || 'setup.vs3',
      instruments,
    };
    setJsonText(JSON.stringify(obj, null, 2));
  }, [config, currentSong?.title, currentSong?.midiFileName, fichierSampler]);

  // Load config for the active song
  useEffect(() => {
    if (!currentSong) {
      setConfig(null);
      setFichierSampler('');
      return;
    }

    // Set preset path from song if present
    const rawPreset =
      currentSong.fichier_sampler ||
      currentSong.vSamplerConfig?.fichier_sampler ||
      currentSong.fichier_instrument ||
      currentSong.vSamplerConfig?.fichier_instrument ||
      '';
    const cleanFileName = (rawPreset.includes('/') || rawPreset.includes('\\'))
      ? rawPreset.split(/[/\\]/).pop() || ''
      : rawPreset;
    setFichierSampler(cleanFileName);

    if (currentSong.dossier_racine || currentSong.vSamplerConfig?.dossier_racine) {
      setDossierInstruments(currentSong.dossier_racine || currentSong.vSamplerConfig?.dossier_racine || midiAudioEngine.getVSamplerRootFolder());
    }

    // 1. Check if song has simpleInstruments
    if (currentSong.simpleInstruments) {
      const parsed = midiAudioEngine.parseSimpleInstrumentsConfig(currentSong.title, currentSong.simpleInstruments);
      parsed.fichier_sampler = cleanFileName;
      parsed.fichier_instrument = cleanFileName;
      setConfig(parsed);
      return;
    }

    // 2. Check if song has an embedded config
    if (currentSong.vSamplerConfig && currentSong.vSamplerConfig.channels?.length === 16) {
      const cloned = JSON.parse(JSON.stringify(currentSong.vSamplerConfig));
      if (!cloned.fichier_sampler && cleanFileName) {
        cloned.fichier_sampler = cleanFileName;
        cloned.fichier_instrument = cleanFileName;
      }
      setConfig(cloned);
      return;
    }

    // 3. Check localStorage for previously saved config for this song ID
    try {
      const saved = localStorage.getItem('hamide_vsampler_song_configs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[currentSong.id] && parsed[currentSong.id].channels?.length === 16) {
          const f = parsed[currentSong.id].fichier_sampler || parsed[currentSong.id].fichier_instrument;
          if (f) {
            setFichierSampler((f.includes('/') || f.includes('\\')) ? f.split(/[/\\]/).pop() || '' : f);
          }
          setConfig(parsed[currentSong.id]);
          return;
        }
      }
    } catch {
      // ignore
    }

    // 4. Otherwise, generate a smart default based on song title and loaded MIDI tracks
    const autoDefault = midiAudioEngine.generateDefaultVSamplerConfig(currentSong.title, engineState.tracks);
    autoDefault.fichier_sampler = cleanFileName;
    autoDefault.fichier_instrument = cleanFileName;
    setConfig(autoDefault);
  }, [currentSong?.id, currentSong?.title, currentSong?.fichier_instrument, currentSong?.fichier_sampler, engineState.tracks.length]);

  if (!isOpen || !currentSong || !config) return null;

  const notify = (msg: string) => {
    if (onShowToast) onShowToast(msg);
  };

  // Test opening the native VSampler preset file on host
  const handleTestOpenPreset = async () => {
    if (!fichierSampler || fichierSampler.trim().length === 0) {
      notify('⚠️ Renseignez le nom du fichier sampler .vs3 ou .vsp d\'abord');
      return;
    }
    setIsOpeningPreset(true);
    try {
      const res = await midiAudioEngine.openVSamplerPresetFile(
        fichierSampler,
        currentSong.title,
        vsamplerExePath,
        dossierInstruments
      );
      notify(res.message);
    } catch (err: any) {
      notify(`⚠️ Erreur d'ouverture : ${err.message}`);
    } finally {
      setIsOpeningPreset(false);
    }
  };

  // Transmit configuration burst to VSampler 3
  const handleSendBurst = async () => {
    setIsSending(true);
    try {
      const res = await midiAudioEngine.sendSongVSamplerConfig(config);
      if (res.success) {
        notify(`🎹 VSampler 3 : ${res.channelsCount} canaux configurés pour "${currentSong.title}" !`);
      } else {
        notify(`⚠️ Erreur d'envoi VSampler : ${res.details.join(', ')}`);
      }
    } catch (err) {
      console.error(err);
      notify('⚠️ Échec de la transmission MIDI');
    } finally {
      setIsSending(false);
    }
  };

  // Save config to song & localStorage
  const handleSave = () => {
    midiAudioEngine.setVSamplerRootFolder(dossierInstruments);
    const updatedConfig: VSamplerSongConfig = {
      ...config,
      fichier_sampler: fichierSampler.trim() || undefined,
      fichier_instrument: fichierSampler.trim() || undefined,
      dossier_racine: dossierInstruments.trim() || undefined,
    };

    // 1. Save in localStorage for persistent recall
    try {
      const existing = localStorage.getItem('hamide_vsampler_song_configs');
      const map = existing ? JSON.parse(existing) : {};
      map[currentSong.id] = updatedConfig;
      localStorage.setItem('hamide_vsampler_song_configs', JSON.stringify(map));
    } catch (err) {
      console.error(err);
    }

    // 2. Update song object in parent state
    if (onUpdateSong) {
      onUpdateSong({
        ...currentSong,
        fichier_sampler: fichierSampler.trim() || undefined,
        fichier_instrument: fichierSampler.trim() || undefined,
        dossier_racine: dossierInstruments.trim() || undefined,
        vSamplerConfig: updatedConfig,
        updatedAt: Date.now(),
      });
    }

    setIsSaved(true);
    notify(`💾 Configuration VSampler 3 (.vs3 sur Disque D:) enregistrée pour "${currentSong.title}" !`);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Apply JSON text into active configuration
  const handleApplyJson = () => {
    setJsonError(null);
    try {
      // Remove any standard single-line JS/JSON comments (// ...)
      const cleanJson = jsonText.replace(/\/\/.*$/gm, '');
      const parsed = JSON.parse(cleanJson);

      const targetFile = parsed.fichier_sampler || parsed.fichier_instrument;
      if (targetFile) {
        const cleanName = (targetFile.includes('/') || targetFile.includes('\\'))
          ? targetFile.split(/[/\\]/).pop() || ''
          : targetFile;
        setFichierSampler(cleanName);
      }

      if (parsed.dossier_racine) {
        setDossierInstruments(parsed.dossier_racine);
        midiAudioEngine.setVSamplerRootFolder(parsed.dossier_racine);
      }

      const targetInstruments = parsed.instruments || parsed;
      if (targetInstruments && typeof targetInstruments === 'object') {
        const newConfig = midiAudioEngine.parseSimpleInstrumentsConfig(
          parsed.titre || currentSong.title,
          targetInstruments
        );
        newConfig.fichier_sampler = targetFile || fichierSampler;
        newConfig.fichier_instrument = targetFile || fichierSampler;
        newConfig.dossier_racine = parsed.dossier_racine || dossierInstruments;
        setConfig(newConfig);
      }

      notify(`✨ Configuration JSON appliquée avec succès !`);
      setActiveTab('matrix');
    } catch (err: any) {
      console.error(err);
      setJsonError(err.message || 'Erreur de syntaxe JSON. Vérifiez vos guillemets et virgules.');
    }
  };

  // Copy JSON text to clipboard
  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText);
    setIsJsonCopied(true);
    notify('📋 JSON copié dans le presse-papier !');
    setTimeout(() => setIsJsonCopied(false), 2000);
  };

  // Load Gainsbourg "Couleur Café" Quick Preset into JSON (User requested format)
  const handleLoadCouleurCafePreset = () => {
    const preset = {
      titre: "Couleur Cafe",
      fichier_midi: "couleur_cafe.mid",
      fichier_sampler: "couleur_cafe.vs3",
      instruments: {
        "canal_1": 33,
        "canal_3": 22,
        "canal_10": 0
      }
    };
    setJsonText(JSON.stringify(preset, null, 2));
    setFichierSampler("couleur_cafe.vs3");
    notify('☕ Préréglage "Couleur Café" (.vs3) chargé avec structure relative pour disque D: !');
  };

  // Re-extract from active MIDI tracks
  const handleExtractFromMidi = () => {
    const extracted = midiAudioEngine.generateDefaultVSamplerConfig(currentSong.title, engineState.tracks);
    setConfig(extracted);
    notify('📥 Configuration régénérée depuis les pistes MIDI');
  };

  // Update a specific channel property
  const updateChannel = (channelIndex: number, field: keyof VSamplerChannelConfig, value: any) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const updated = [...prev.channels];
      updated[channelIndex] = {
        ...updated[channelIndex],
        [field]: value,
      };

      // Auto update instrument label if program changes and user hasn't heavily customized it
      if (field === 'program' && channelIndex !== 9) {
        const gmName = GM_INSTRUMENTS[value] || `Instrument ${value}`;
        updated[channelIndex].name = gmName;
      }

      return {
        ...prev,
        channels: updated,
      };
    });
  };

  // Test slot by triggering a sample note
  const handleTestSlot = (channelNumber: number) => {
    setActiveTestChannel(channelNumber);

    // Note pitch: 60 (Middle C) for instruments, or 36 (Bass Drum) / 38 (Snare) for drums
    const note = channelNumber === 9 ? 38 : 60;
    const velocity = 0.9;
    const now = window.performance.now();

    midiAudioEngine.sendMidiNoteOn(channelNumber, note, velocity, now);
    midiAudioEngine.sendMidiNoteOff(channelNumber, note, now + 400);

    setTimeout(() => {
      setActiveTestChannel(null);
    }, 450);
  };

  const activeChannelsCount = config.channels.filter((c) => c.enabled).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div className="bg-zinc-950 border border-zinc-700 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-purple-950/40 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-600/20 border border-purple-500/40 rounded-xl text-purple-400">
              <Piano className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">
                  Routeur Automatique VSampler 3
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  16 Canaux Multi-timbraux
                </span>
                {engineState.midiActivityTx && (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" title="Signal MIDI en cours d'émission"></span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Morceau actif : <strong className="text-orange-400">{currentSong.title}</strong> ({currentSong.artist}) • {activeChannelsCount} canaux actifs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide((prev) => !prev)}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-zinc-700"
              title="Guide de configuration VSampler 3"
            >
              <HelpCircle className="w-4 h-4 text-orange-400" />
              <span className="hidden sm:inline">Guide VSampler</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg cursor-pointer transition"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Port MIDI & Connection Status Toolbar */}
        <div className="px-4 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-zinc-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-400" /> Port loopMIDI / Sortie :
            </span>

            <select
              value={engineState.selectedMidiOutputId}
              onChange={(e) => midiAudioEngine.setSelectedMidiOutput(e.target.value)}
              className="bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-white font-mono font-bold focus:outline-none focus:border-purple-500"
            >
              <option value="all">⚡ Tous les ports MIDI connectés (Recommandé)</option>
              {engineState.midiOutputs.map((out) => (
                <option key={out.id} value={out.id}>
                  🎹 {out.name} {out.manufacturer ? `(${out.manufacturer})` : ''}
                </option>
              ))}
              <option value="none">Désactivé (Aucune sortie externe)</option>
            </select>

            <button
              onClick={() => midiAudioEngine.initWebMidi()}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 cursor-pointer"
              title="Rafraîchir les ports MIDI détectés"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Routing Mode */}
            <div className="flex items-center bg-zinc-950 p-0.5 rounded border border-zinc-800 ml-2">
              <button
                onClick={() => midiAudioEngine.setOutputMode('web_midi')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  engineState.outputMode === 'web_midi' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
                title="Envoie uniquement les ordres et notes vers VSampler 3"
              >
                VSampler 3 (Web MIDI)
              </button>
              <button
                onClick={() => midiAudioEngine.setOutputMode('both')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                  engineState.outputMode === 'both' ? 'bg-orange-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
                title="Envoie vers VSampler 3 ET joue le synthé du navigateur en simultané"
              >
                Les deux
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer text-zinc-300 font-medium">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 accent-purple-500 cursor-pointer"
              />
              <span>Envoyer automatiquement au choix de la chanson</span>
            </label>
          </div>
        </div>

        {/* Collapsible Setup Guide */}
        {showGuide && (
          <div className="p-4 bg-purple-950/20 border-b border-purple-800/40 text-xs text-zinc-300 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between font-bold text-purple-300">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Comment configurer VSampler 3 pour automatiser vos instruments en 1 clic :
              </span>
              <button onClick={() => setShowGuide(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                <strong className="text-orange-400 block mb-1">1. loopMIDI (Câble Virtuel)</strong>
                Créez un port virtuel nommé <code>loopMIDI Port</code> dans l'utilitaire loopMIDI gratuit sous Windows.
              </div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                <strong className="text-orange-400 block mb-1">2. VSampler 3 Standalone</strong>
                Dans VSampler 3 : Menu <strong>Options &gt; MIDI</strong> &gt; cochez <em>loopMIDI Port</em> comme MIDI IN. Activez le mode <strong>Multi-Timbral (Omni)</strong>.
              </div>
              <div className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                <strong className="text-orange-400 block mb-1">3. C'est Prêt !</strong>
                Dès que vous appelez « Couleur Café » ou une autre chanson, VSampler 3 charge et assigne instantanément la batterie canal 10, la basse canal 2, le piano canal 3, etc. !
              </div>
            </div>
          </div>
        )}

        {/* Native Preset File (.vs3 / .vsp) Direct Loader Section — 2nd Drive (D:) */}
        <div className="p-3.5 bg-gradient-to-r from-amber-950/40 via-zinc-950 to-purple-950/30 border-b border-zinc-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <FileCode className="w-4 h-4" />
              </span>
              <div>
                <span className="text-xs font-black text-amber-300 tracking-wide uppercase flex items-center gap-1.5">
                  Preset Natif VSampler 3 (.vs3 / .vsp) — Disque D:
                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold">
                    Recommandé 100% Fiable Scène
                  </span>
                </span>
                <p className="text-[11px] text-zinc-400">
                  Préparez la chanson dans VSampler 3 avec vos banques personnalisées, puis sauvegardez le fichier dans le dossier de la chanson sur votre 2ème disque.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAdvancedPath(!showAdvancedPath)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1 cursor-pointer"
              >
                <Terminal className="w-3 h-3" />
                <span>{showAdvancedPath ? 'Masquer réglages chemins' : 'Dossier racine & VSampler.exe'}</span>
              </button>
            </div>
          </div>

          {/* Dual Input Controls: Root Folder & Song Preset File */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
            <div className="sm:col-span-8 relative">
              <label className="text-[10px] text-zinc-400 font-bold block mb-1 flex items-center gap-1">
                <FileCode className="w-3 h-3 text-amber-400" />
                <span>Fichier Preset (.vs3 / .vsp) de la chanson :</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={fichierSampler}
                  onChange={(e) => setFichierSampler(e.target.value)}
                  placeholder="Ex: couleur_cafe.vs3"
                  className="w-full bg-zinc-900/90 border border-zinc-700 focus:border-amber-500 rounded-lg px-3 py-2 text-xs font-mono text-amber-200 placeholder:text-zinc-600 focus:outline-none transition"
                />
                {fichierSampler && (
                  <button
                    type="button"
                    onClick={() => setFichierSampler('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    title="Effacer le nom de fichier"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-4 self-end">
              <button
                type="button"
                onClick={handleTestOpenPreset}
                disabled={isOpeningPreset || !fichierSampler}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-black font-extrabold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/20"
                title="Exécute l'ordre Windows pour ouvrir ce fichier sur le 2ème disque dans VSampler 3"
              >
                <FolderOpen className={`w-3.5 h-3.5 ${isOpeningPreset ? 'animate-spin' : ''}`} />
                <span>{isOpeningPreset ? 'Ouverture...' : 'Tester l\'ouverture (.vs3)'}</span>
              </button>
            </div>
          </div>

          {/* Dynamic Reconstructed Path Preview */}
          <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 text-xs space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-zinc-300 font-bold text-[11px]">
                <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                <span>Reconstitution automatique du chemin sur le 2ème disque :</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Dossier dynamique</span>
            </div>

            <div className="font-mono text-amber-300 text-[11px] bg-zinc-950 px-2.5 py-1.5 rounded border border-zinc-800 break-all select-all flex items-center justify-between gap-2">
              <span>{midiAudioEngine.buildDynamicVSamplerPath(currentSong.title, fichierSampler || 'setup.vs3', dossierInstruments)}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded shrink-0">Disque D:</span>
            </div>

            <div className="text-[10px] text-zinc-500 font-mono">
              Commande système Windows : <span className="text-zinc-400">exec(&quot;{vsamplerExePath}&quot; &quot;{midiAudioEngine.buildDynamicVSamplerPath(currentSong.title, fichierSampler || 'setup.vs3', dossierInstruments)}&quot;)</span>
            </div>
          </div>

          {showAdvancedPath && (
            <div className="p-3 bg-zinc-900/95 rounded-lg border border-zinc-800 text-xs space-y-2.5">
              <div>
                <label className="text-[10px] text-zinc-400 font-bold block mb-1 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-amber-400" />
                  <span>Dossier racine des instruments sur le 2ème disque (D:) :</span>
                </label>
                <input
                  type="text"
                  value={dossierInstruments}
                  onChange={(e) => {
                    setDossierInstruments(e.target.value);
                    midiAudioEngine.setVSamplerRootFolder(e.target.value);
                  }}
                  placeholder="D:\MaMusique\Chansons_Scene\"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-zinc-500 block mt-0.5">
                  Variable globale <code>DOSSIER_INSTRUMENTS</code> partagée par toutes vos chansons.
                </span>
              </div>

              <div>
                <label className="text-[10px] text-zinc-400 font-bold block mb-1 flex items-center gap-1">
                  <Terminal className="w-3 h-3 text-purple-400" />
                  <span>Chemin de l'exécutable VSampler 3 (Windows) :</span>
                </label>
                <input
                  type="text"
                  value={vsamplerExePath}
                  onChange={(e) => setVsamplerExePath(e.target.value)}
                  placeholder="C:\Program Files\VSampler3\VSampler3.exe"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1 text-xs font-mono text-zinc-300 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendBurst}
              disabled={isSending}
              className="py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs tracking-wide uppercase transition cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-600/30 active:scale-95"
              title="Transmet immédiatement les 16 ordres de banque, program change, volume et panoramique à VSampler 3"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-bounce' : ''}`} />
              <span>{isSending ? 'Envoi en cours...' : '⚡ Envoyer les ordres à VSampler 3'}</span>
            </button>

            <button
              onClick={handleExtractFromMidi}
              className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Scanne les pistes du lecteur MIDI et prépare les slots automatiquement"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Détecter depuis le fichier MIDI</span>
            </button>

            {/* View Switcher: Matrix vs JSON */}
            <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 ml-2">
              <button
                onClick={() => setActiveTab('matrix')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'matrix' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Matrice 16 Canaux</span>
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'json' ? 'bg-purple-600 text-white shadow' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Code className="w-3.5 h-3.5 text-amber-400" />
                <span>Éditeur JSON Rapide</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer"
              title="Mémorise cette configuration pour ce morceau spécifique"
            >
              {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{isSaved ? 'Enregistré !' : 'Sauvegarder pour cette chanson'}</span>
            </button>
          </div>
        </div>

        {/* Tab 1: 16-Channel Rack Matrix */}
        {activeTab === 'matrix' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-zinc-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {config.channels.map((ch, idx) => {
                const isDrums = ch.channel === 9;
                const isTesting = activeTestChannel === ch.channel;

                return (
                  <div
                    key={ch.channel}
                    className={`p-3 rounded-xl border transition-all ${
                      ch.enabled
                        ? isDrums
                          ? 'bg-amber-950/20 border-amber-600/40 hover:border-amber-500'
                          : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                        : 'bg-zinc-950/60 border-zinc-900 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={ch.enabled}
                          onChange={(e) => updateChannel(idx, 'enabled', e.target.checked)}
                          className="w-4 h-4 accent-purple-500 cursor-pointer"
                          title={ch.enabled ? 'Désactiver ce canal' : 'Activer ce canal'}
                        />

                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-extrabold ${
                            isDrums
                              ? 'bg-amber-500 text-black shadow'
                              : ch.enabled
                              ? 'bg-purple-600 text-white shadow'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          CANAL {ch.channel + 1} {isDrums ? '(PERC/BATTERIE)' : ''}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleTestSlot(ch.channel)}
                        className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                          isTesting
                            ? 'bg-emerald-500 text-black animate-pulse font-extrabold shadow-lg'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                        }`}
                        title="Joue une note de test sur ce canal dans VSampler 3"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{isTesting ? 'Son en cours...' : 'Tester'}</span>
                      </button>
                    </div>

                    {/* Channel Configuration Fields */}
                    <div className="space-y-2">
                      {/* Custom Instrument Name */}
                      <div>
                        <input
                          type="text"
                          value={ch.name}
                          onChange={(e) => updateChannel(idx, 'name', e.target.value)}
                          placeholder={`Instrument Canal ${ch.channel + 1}`}
                          className="w-full bg-zinc-950 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-purple-500"
                        />
                      </div>

                      {/* Program Change & Bank Select */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Program Change Selector */}
                        <div>
                          <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                            Programme (PC 0-127) :
                          </label>
                          <select
                            value={ch.program}
                            onChange={(e) => updateChannel(idx, 'program', parseInt(e.target.value, 10))}
                            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-orange-300 font-mono focus:outline-none focus:border-purple-500"
                          >
                            {isDrums ? (
                              <>
                                <option value="0">Standard Drum Kit (0)</option>
                                <option value="8">Room Drum Kit (8)</option>
                                <option value="16">Power Drum Kit (16)</option>
                                <option value="24">Electronic / Synth Kit (24)</option>
                                <option value="25">TR-808 Dance Kit (25)</option>
                                <option value="32">Jazz Drum Kit (32)</option>
                                <option value="40">Brush Drum Kit (40)</option>
                                <option value="48">Orchestral Kit (48)</option>
                                <option value="56">SFX / Latin Percussion Kit (56)</option>
                              </>
                            ) : (
                              GM_INSTRUMENTS.map((name, pIdx) => (
                                <option key={pIdx} value={pIdx}>
                                  #{pIdx} - {name}
                                </option>
                              ))
                            )}
                          </select>
                        </div>

                        {/* Bank MSB (CC0) & LSB (CC32) */}
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                              Banque MSB (CC0) :
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="127"
                              value={ch.bankMsb}
                              onChange={(e) => updateChannel(idx, 'bankMsb', parseInt(e.target.value, 10) || 0)}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-400 font-medium block mb-0.5">
                              LSB (CC32) :
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="127"
                              value={ch.bankLsb}
                              onChange={(e) => updateChannel(idx, 'bankLsb', parseInt(e.target.value, 10) || 0)}
                              className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Volume (CC 7) & Pan (CC 10) */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-zinc-800/80">
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>Volume (CC 7) :</span>
                            <span className="font-mono text-orange-400 font-bold">{ch.volume}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="127"
                            value={ch.volume}
                            onChange={(e) => updateChannel(idx, 'volume', parseInt(e.target.value, 10))}
                            className="w-full h-1.5 accent-orange-500 bg-zinc-800 rounded cursor-pointer"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-400">
                            <span>Panoramique (CC 10) :</span>
                            <span className="font-mono text-purple-400 font-bold">
                              {ch.pan === 64 ? 'Centre (64)' : ch.pan < 64 ? `G ${64 - ch.pan}` : `D ${ch.pan - 64}`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="127"
                            value={ch.pan}
                            onChange={(e) => updateChannel(idx, 'pan', parseInt(e.target.value, 10))}
                            className="w-full h-1.5 accent-purple-500 bg-zinc-800 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Compact JSON Editor */}
        {activeTab === 'json' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-3">
            <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl text-xs text-zinc-300 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-purple-400" />
                <span>
                  <strong>Structure JSON compacte :</strong> Collez votre configuration simple ci-dessous (ex : <code className="text-orange-300 font-mono">"canal_1": 33</code> pour la basse, <code className="text-orange-300 font-mono">"canal_3": 22</code> pour l'accordéon, <code className="text-orange-300 font-mono">"canal_10": 0</code> pour la batterie).
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadCouleurCafePreset}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-orange-400 border border-zinc-700 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Charger l'exemple Couleur Café"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Exemple "Couleur Café"</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  {isJsonCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isJsonCopied ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
            </div>

            {jsonError && (
              <div className="p-2.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg flex items-center gap-2">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="flex-1 min-h-[260px] relative">
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setJsonError(null);
                }}
                spellCheck={false}
                placeholder={`{\n  "titre": "Couleur Cafe",\n  "fichier_midi": "couleur_cafe.mid",\n  "fichier_instrument": "C:/SetupsVSampler/couleur_cafe.vs3",\n  "instruments": {\n    "canal_1": 33,\n    "canal_3": 22,\n    "canal_10": 0\n  }\n}`}
                className="w-full h-full min-h-[260px] p-4 bg-zinc-950 font-mono text-xs text-emerald-300 border border-zinc-800 rounded-xl focus:outline-none focus:border-purple-500 resize-none leading-relaxed"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-zinc-400">
                💡 Les numéros de programmes (PC) correspondent aux 128 sons standard General MIDI (0-127).
              </span>

              <button
                type="button"
                onClick={handleApplyJson}
                className="py-2 px-5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold rounded-lg text-xs tracking-wide uppercase transition cursor-pointer flex items-center gap-2 shadow-lg shadow-purple-600/30"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Appliquer le JSON aux 16 Canaux</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Summary */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Les ordres de banques et de presets sont expédiés via le protocole MIDI standard compatible VSampler 3, Kontakt, Halion et cartes sons externes.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg cursor-pointer transition"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};
