# 🚀 Guide de Compilation & Installation Tauri pour Windows 11
## Hamide Litime Software - Carnet de Chants & Studio MIDI VSampler 3 (Application Native Desktop)

Votre projet est désormais entièrement configuré pour **Tauri v2** sous le nom **Hamide Litime Software** avec support natif de **Windows 11** (x64 / ARM64 via WebView2).

---

### 🌟 Avantages de la version Tauri sous Windows 11 :
1. **Zéro Latence MIDI :** Communication directe ultra-rapide avec **loopMIDI**, les ports USB-MIDI et **VSampler 3**.
2. **Plein Écran & Mode Scène Dédié :** Pas d'onglets de navigateur, pas de barre d'URL ni de mise en veille inattendue sur scène.
3. **Poids Plume & Vitesse :** Exécutable natif ultra-léger (utilise le moteur Microsoft Edge WebView2 natif de Windows 11, sans la lourdeur d'Electron).
4. **Persistance des Fichiers Locale :** Sauvegarde et export direct de vos banques SoundFont SF2, fichiers `.mid`, `.msb` et partitions PDF.

---

### 💻 Méthode 1 : Compiler localement sur votre PC Windows 11

#### 1. Prérequis (à installer une seule fois) :
1. **Rust & Cargo :** Téléchargez et installez Rust depuis [rustup.rs](https://rustup.rs/) (sélectionnez le runtime MSVC C++ si demandé).
2. **Node.js (v18 ou v20+) :** [nodejs.org](https://nodejs.org/).
3. **Microsoft C++ Build Tools :** inclus avec Visual Studio Community ou Build Tools.

#### 2. Lancer en Mode Développement Desktop :
Ouvrez votre invite de commandes (PowerShell ou Terminal Windows) dans le dossier du projet :
```bash
# 1. Installer les dépendances
npm install

# 2. Lancer l'application native sous Windows 11 avec rechargement à chaud
npm run tauri:dev
```

#### 3. Générer l'Installeur Windows (.msi / .exe) :
```bash
npm run tauri:build
```
L'installeur final se trouvera automatiquement dans :
`src-tauri/target/release/bundle/nsis/Stage Prompter Pro_1.0.0_x64-setup.exe` ou `.msi`

---

### ☁️ Méthode 2 : Compilation automatique via GitHub Actions (Sans rien installer sur votre PC !)

Si vous publiez ce projet sur votre compte GitHub :
1. Poussez votre code sur GitHub (`git push origin main`).
2. L'action GitHub `.github/workflows/build-windows-installer.yml` va automatiquement compiler l'installeur Windows 11 dans le cloud.
3. Téléchargez directement votre fichier `.exe` ou `.msi` dans l'onglet **Releases** de votre dépôt GitHub !

---

### ⚙️ Structure des Fichiers Tauri v2 Ajoutée :
* `src-tauri/Cargo.toml` : Définition du projet Rust et des dépendances natives.
* `src-tauri/tauri.conf.json` : Configuration de la fenêtre Windows 11 (taille, titre, icônes, installeur NSIS).
* `src-tauri/src/main.rs` & `src-tauri/src/lib.rs` : Point d'entrée natif de l'application.
* `src-tauri/capabilities/default.json` : Permissions système pour Windows.
* `src-tauri/icons/` : Icônes d'application et d'installeur Windows (.ico, .png).
