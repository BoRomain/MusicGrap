# Wave — lecteur de musique

Lecteur de musique en Go (Wails + Svelte) pour Windows et Linux, avec une version Android (Capacitor).

- Égaliseur 10 bandes (31 Hz → 16 kHz, ±12 dB) avec presets
- Mode **slowed + reverb** : vitesse 0.5x–1x (le pitch descend comme un vinyle ralenti), reverb Freeverb réglable
- **Fondu enchaîné** façon Spotify (0–12 s, 0 = enchaînement sans blanc), optionnel sur les changements manuels
- Fond qui prend les couleurs de la pochette (k-means sur la pochette, transition animée)
- Interface façon Spotify : Albums, Artistes, Titres (colonnes triables), pages album / artiste, recherche
- **Playlists** : création, renommage, suppression, ajout par clic droit sur un titre
- Bibliothèque : dossier scanné (MP3, FLAC, OGG Vorbis, WAV ; M4A/AAC/ALAC et Opus via ffmpeg sur PC, via les décodeurs du système sur Android), file d'attente, aléatoire, répétition
- Raccourcis : `Espace` lecture/pause, `←/→` ±5 s, `Ctrl+←/→` précédent/suivant, `Alt+←/→` (ou boutons latéraux de la souris) navigation, `F` mode cinéma, `F11` plein écran

Réglages, playlists et cache de bibliothèque : `%AppData%\wave-player` (Windows), `~/.config/wave-player` (Linux).

## Prérequis

Go ≥ 1.23, Node.js LTS, puis la CLI Wails :

```sh
go install github.com/wailsapp/wails/v2/cmd/wails@latest
wails doctor
```

### Linux

| Distribution | Paquets |
|---|---|
| Arch | `sudo pacman -S go nodejs npm gtk3 webkit2gtk-4.1 alsa-lib base-devel` |
| Fedora | `sudo dnf install golang nodejs npm gtk3-devel webkit2gtk4.1-devel alsa-lib-devel gcc` |
| Debian 12+ / Ubuntu 24.04+ | `sudo apt install golang nodejs npm libgtk-3-dev libwebkit2gtk-4.1-dev libasound2-dev build-essential` |

L'audio passe par ALSA, donc fonctionne aussi avec PipeWire et PulseAudio (couche de compatibilité ALSA).
À l'exécution il suffit de `gtk3`, `webkit2gtk-4.1` et `alsa-lib`.

Pour lire les .m4a et .opus sur PC, installer ffmpeg (`ffmpeg` et `ffprobe` dans le PATH). Sans lui, ces fichiers sont ignorés au scan.

## Développement

```sh
wails dev            # hot reload
go test ./...        # tests (DSP, crossfade, file d'attente, palette, scan)
```

## Build

```sh
wails build                     # Windows → build/bin/musicplayer.exe
wails build -tags webkit2_41    # Linux   → build/bin/musicplayer
```

## Android

Même moteur Go (compilé en `.aar` par gomobile) et même interface Svelte (WebView Capacitor).
Lecture en arrière-plan, contrôles dans la notification, sur l'écran de verrouillage et au casque ; pause quand le casque est débranché.
La bibliothèque vient d'un dossier choisi dans le sélecteur Android (stockage interne ou carte SD, pas les dossiers cloud).

Prérequis : SDK Android avec un NDK (`ANDROID_HOME`), JDK 17+ (`JAVA_HOME`), Node.js, puis :

```sh
go install golang.org/x/mobile/cmd/gomobile@latest
go install golang.org/x/mobile/cmd/gobind@latest
gomobile init
```

Build (Windows, PowerShell) :

```powershell
./scripts/build-android.ps1           # → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Le script enchaîne `gomobile bind ./mobile`, `npm run build:android` (le front utilise alors le pont Capacitor au lieu de Wails), `npx cap sync android` et Gradle.

## Architecture

```
app.go / main.go          app de bureau : liaison Wails de internal/core
mobile                    point d'entrée Android (gomobile) : appels et events en JSON
android                   projet Capacitor : WavePlugin (pont JS ↔ Go), PlaybackService (notification, MediaSession)
internal/core             API commune au bureau et à Android, events, pochettes /cover/{id}
internal/audio            moteur : decks A/B → crossfade → EQ → reverb → volume → sortie
internal/queue            file d'attente, aléatoire, répétition
internal/library          scan du dossier, tags, pochettes, cache JSON
internal/playlist         playlists (JSON)
internal/palette          couleurs extraites des pochettes
internal/settings         réglages persistés
frontend/src              interface Svelte 5 ; lib/backend choisit Wails ou Capacitor au build
```
