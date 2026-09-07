import React, { useState } from 'react';
import {
  Monitor,
  X,
  Terminal,
  Check,
  Copy,
  Zap,
  Package,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Download,
} from 'lucide-react';

interface TauriDesktopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TauriDesktopModal: React.FC<TauriDesktopModalProps> = ({ isOpen, onClose }) => {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center text-blue-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Hamide Litime Software (Windows 11)</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/40 rounded font-bold">
                  Tauri v2 Prêt
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Installeur Windows (.exe / .msi) autonome & ultra-rapide avec support direct de VSampler 3
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-5">
          {/* Key Advantages Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                <Zap className="w-3.5 h-3.5" />
                <span>Zéro Latence MIDI</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Accès direct aux ports <strong>loopMIDI</strong> et <strong>VSampler 3</strong> sans restriction de navigateur.
              </p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                <Package className="w-3.5 h-3.5" />
                <span>Exécutable Léger</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Moteur natif Windows 11 (WebView2), démarre en moins d'une seconde et consomme 5x moins de RAM qu'Electron.
              </p>
            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>100% Hors-Ligne</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Fonctionne sur scène sans connexion Internet avec toutes vos SoundFonts et vos banques SF2 locales.
              </p>
            </div>
          </div>

          {/* Compilation Steps */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              Commandes pour compiler sur Windows 11
            </h4>

            {/* Step 1: Dev command */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">1. Lancer en mode bureau (Développement)</span>
                <button
                  onClick={() => handleCopy('npm run tauri:dev', 'cmd1')}
                  className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded transition cursor-pointer"
                >
                  {copiedCmd === 'cmd1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'cmd1' ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
              <pre className="bg-zinc-950 p-2.5 rounded font-mono text-xs text-blue-300 border border-zinc-800 overflow-x-auto">
                npm run tauri:dev
              </pre>
            </div>

            {/* Step 2: Build command */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">2. Générer l'Installeur Windows (.exe / .msi)</span>
                <button
                  onClick={() => handleCopy('npm run tauri:build', 'cmd2')}
                  className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] rounded transition cursor-pointer"
                >
                  {copiedCmd === 'cmd2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCmd === 'cmd2' ? 'Copié !' : 'Copier'}</span>
                </button>
              </div>
              <pre className="bg-zinc-950 p-2.5 rounded font-mono text-xs text-emerald-300 border border-zinc-800 overflow-x-auto">
                npm run tauri:build
              </pre>
              <p className="text-[11px] text-zinc-500">
                Sortie : <code className="text-zinc-400">src-tauri/target/release/bundle/nsis/Hamide Litime Software_1.0.0_x64-setup.exe</code>
              </p>
            </div>
          </div>

          {/* GitHub Actions Cloud Build */}
          <div className="bg-blue-950/30 border border-blue-800/40 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-300 font-bold text-xs">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Compilation Automatique Cloud (GitHub Actions)</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Le fichier de workflow <code className="px-1 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-blue-300">.github/workflows/build-windows-installer.yml</code> a été créé. Si vous hébergez ce code sur GitHub, l'installeur Windows sera compilé automatiquement lors de chaque version !
            </p>
          </div>

          {/* Configuration files review */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-400">Fichiers de configuration inclus :</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-400">
              <div className="flex items-center gap-1.5 bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <FileCode className="w-3.5 h-3.5 text-orange-400" />
                <span>src-tauri/tauri.conf.json</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <FileCode className="w-3.5 h-3.5 text-orange-400" />
                <span>src-tauri/Cargo.toml</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>src-tauri/src/main.rs</span>
              </div>
              <div className="flex items-center gap-1.5 bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>src-tauri/src/lib.rs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-zinc-500">
            Guide détaillé dans <strong>TAURI_WINDOWS_11_BUILD_GUIDE.md</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
