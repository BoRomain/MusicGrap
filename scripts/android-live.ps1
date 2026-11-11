# Live reload on a USB-connected phone: the app loads the UI from the Vite dev server
# (through `adb reverse`), so React/CSS edits show up without rebuilding the APK.
# Usage: ./scripts/android-live.ps1          install the live APK, then run Vite (Ctrl+C to stop)
#        ./scripts/android-live.ps1 -NoInstall   only re-arm adb reverse and run Vite
# The Go core (.aar) must already be built (./scripts/build-android.ps1 once).
# The live APK shows a blank page without the dev server: run ./scripts/build-android.ps1
# and reinstall to get a standalone build back.
param([switch]$NoInstall)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if ($env:JAVA_HOME) { $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }

Push-Location $root
try {
    if (-not (Test-Path android/app/libs/wave.aar)) { throw 'android/app/libs/wave.aar missing: run ./scripts/build-android.ps1 first' }
    adb reverse tcp:5173 tcp:5173
    if ($LASTEXITCODE) { throw 'adb reverse failed (phone connected, USB debugging on?)' }

    Push-Location frontend
    if (-not $NoInstall) {
        npm run build:android
        if ($LASTEXITCODE) { throw 'frontend build failed' }
        $env:CAP_LIVE = '1'
        npx cap sync android
        $code = $LASTEXITCODE
        Remove-Item Env:CAP_LIVE
        if ($code) { throw 'cap sync failed' }

        Push-Location ../android
        ./gradlew.bat installDebug
        if ($LASTEXITCODE) { throw 'gradle installDebug failed' }
        Pop-Location
        adb shell am start -n com.borom.wave/.MainActivity | Out-Null
    }
    npx vite --mode android --host 127.0.0.1 --port 5173 --strictPort
} finally {
    Pop-Location
}
