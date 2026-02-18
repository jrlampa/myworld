# sisRUA Unified - Release Build Script (DEPRECATED)
# 
# ⚠️ DEPRECATION NOTICE ⚠️
# This script is DEPRECATED in favor of Docker-based builds.
# 
# RECOMMENDED APPROACH:
#   Use Docker for enterprise-level distribution:
#   npm run docker:build
#
# This legacy script remains for local Windows development only.
# It compiles the Python engine to .exe using PyInstaller, which:
# - May trigger antivirus false positives
# - Is Windows-only
# - Requires manual PyInstaller installation
# - Is NOT used in production (Docker/Cloud Run uses Python directly)
#
# For production deployments, always use Docker.
# ==========================================

$BuildStart = Get-Date
Write-Host ""
Write-Host "======================================" -ForegroundColor Yellow
Write-Host "   ⚠️  LEGACY BUILD (Deprecated)" -ForegroundColor Yellow
Write-Host "   Use 'npm run docker:build' instead" -ForegroundColor Yellow  
Write-Host "======================================" -ForegroundColor Yellow
Write-Host ""

$RootDir = Get-Location
$DistDir = Join-Path $RootDir "dist"

# 1. Clean Dist Folder
Write-Host "[1/4] Cleaning dist folder..." -ForegroundColor Cyan
if (Test-Path $DistDir) {
    Remove-Item -Path $DistDir -Recurse -Force
}
New-Item -ItemType Directory -Path $DistDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DistDir "server") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DistDir "engine") | Out-Null

# 2. Frontend Build (Vite)
Write-Host "[2/4] Compiling Frontend (Vite)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Frontend build failed" -ForegroundColor Red; exit 1 }

# 3. Backend Build (TypeScript)
Write-Host "[3/4] Compiling Backend (Node.js)..." -ForegroundColor Cyan
npx tsc -p tsconfig.server.json
if ($LASTEXITCODE -ne 0) { Write-Host "ERROR: Backend compilation failed" -ForegroundColor Red; exit 1 }

# 4. Python Engine (PyInstaller)
Write-Host "[4/4] Bundling Python Engine (PyInstaller)..." -ForegroundColor Cyan
cd py_engine
# Check if PyInstaller is available as a command or via python -m
if (Get-Command pyinstaller -ErrorAction SilentlyContinue) {
    $PyCmd = "pyinstaller"
}
elseif (& python -m PyInstaller --version) {
    $PyCmd = "python -m PyInstaller"
}

if (-not $PyCmd) {
    Write-Host "WARNING: PyInstaller not found. Skipping engine bundling." -ForegroundColor Yellow
}
else {
    Write-Host "Using $PyCmd for bundling..." -ForegroundColor Gray
    Invoke-Expression "$PyCmd --noconfirm engine.spec"
    if ($LASTEXITCODE -ne 0) { 
        Write-Host "ERROR: Engine bundling failed" -ForegroundColor Red
        cd ..
        exit 1 
    }
    # Move compiled engine to dist
    Move-Item -Path "dist/sisrua_engine.exe" -Destination (Join-Path $DistDir "engine/sisrua_engine.exe")
}
cd ..

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "   BUILD COMPLETE! Artefacts in /dist" -ForegroundColor Green
$Duration = (Get-Date) - $BuildStart
Write-Host "   Duration: $($Duration.Minutes)m $($Duration.Seconds)s" -ForegroundColor Gray
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
