# Builds the Android APK: Go core (.aar) -> web UI -> Capacitor sync -> Gradle.
# Usage: ./scripts/build-android.ps1 [-Release]
# Needs ANDROID_HOME (SDK with an NDK installed), a JDK, gomobile (see README).
param([switch]$Release)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

if (-not $env:ANDROID_HOME) { throw 'ANDROID_HOME is not set' }
if (-not $env:ANDROID_NDK_HOME) {
    $ndk = Get-ChildItem (Join-Path $env:ANDROID_HOME 'ndk') -Directory | Sort-Object Name | Select-Object -Last 1
    if (-not $ndk) { throw "No NDK in $env:ANDROID_HOME\ndk" }
    $env:ANDROID_NDK_HOME = $ndk.FullName
}
if ($env:JAVA_HOME) { $env:PATH = "$env:JAVA_HOME\bin;$env:PATH" }

Push-Location $root
try {
    New-Item -ItemType Directory -Force android/app/libs | Out-Null
    gomobile bind -target='android/arm64,android/amd64' -androidapi 26 -javapkg com.borom.wave.core `
        -o android/app/libs/wave.aar ./mobile
    if ($LASTEXITCODE) { throw 'gomobile bind failed' }

    Push-Location frontend
    npm run build:android
    if ($LASTEXITCODE) { throw 'frontend build failed' }
    npx cap sync android
    if ($LASTEXITCODE) { throw 'cap sync failed' }
    Pop-Location

    Push-Location android
    if ($Release) { ./gradlew.bat assembleRelease } else { ./gradlew.bat assembleDebug }
    if ($LASTEXITCODE) { throw 'gradle build failed' }
    Pop-Location

    $kind = if ($Release) { 'release' } else { 'debug' }
    Write-Host "APK: android/app/build/outputs/apk/$kind/"
} finally {
    Pop-Location
}
