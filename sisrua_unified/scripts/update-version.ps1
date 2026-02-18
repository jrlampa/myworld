# Script to update version across all project files
# Usage: .\update-version.ps1 [new_version]

param(
    [Parameter(Position=0)]
    [string]$NewVersion
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$VersionFile = Join-Path $ProjectRoot "VERSION"

# Read current version
if (-not (Test-Path $VersionFile)) {
    Write-Host "ERROR: VERSION file not found at $VersionFile" -ForegroundColor Red
    exit 1
}

$CurrentVersion = (Get-Content $VersionFile -Raw).Trim()
Write-Host "Current version: $CurrentVersion" -ForegroundColor Green

# Get new version from argument or prompt user
if ([string]::IsNullOrEmpty($NewVersion)) {
    $NewVersion = Read-Host "Enter new version (current: $CurrentVersion)"
}

# Validate version format (semantic versioning)
if ($NewVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$') {
    Write-Host "ERROR: Invalid version format. Use semantic versioning (e.g., 1.0.0, 1.0.0-alpha.1, 1.0.0+build.123)" -ForegroundColor Red
    exit 1
}

Write-Host "Updating version from $CurrentVersion to $NewVersion..." -ForegroundColor Yellow

# Update VERSION file
Set-Content -Path $VersionFile -Value $NewVersion -NoNewline
Write-Host "✓ Updated VERSION file" -ForegroundColor Green

# Update package.json
$PackageJsonPath = Join-Path $ProjectRoot "package.json"
if (Test-Path $PackageJsonPath) {
    $packageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $packageJson.version = $NewVersion
    $packageJson | ConvertTo-Json -Depth 100 | Set-Content $PackageJsonPath
    Write-Host "✓ Updated package.json" -ForegroundColor Green
}

# Update package-lock.json
$PackageLockPath = Join-Path $ProjectRoot "package-lock.json"
if (Test-Path $PackageLockPath) {
    $packageLock = Get-Content $PackageLockPath -Raw | ConvertFrom-Json
    $packageLock.version = $NewVersion
    if ($packageLock.packages -and $packageLock.packages.'') {
        $packageLock.packages.''.version = $NewVersion
    }
    $packageLock | ConvertTo-Json -Depth 100 | Set-Content $PackageLockPath
    Write-Host "✓ Updated package-lock.json" -ForegroundColor Green
}

# Update Python constants.py
$ConstantsFile = Join-Path $ProjectRoot "py_engine\constants.py"
if (Test-Path $ConstantsFile) {
    $content = Get-Content $ConstantsFile -Raw
    $content = $content -replace "PROJECT_VERSION = '[^']*'", "PROJECT_VERSION = '$NewVersion'"
    Set-Content -Path $ConstantsFile -Value $content -NoNewline
    Write-Host "✓ Updated py_engine/constants.py" -ForegroundColor Green
}

# Update TypeScript useFileOperations.ts
$TsFile = Join-Path $ProjectRoot "src\hooks\useFileOperations.ts"
if (Test-Path $TsFile) {
    $content = Get-Content $TsFile -Raw
    $content = $content -replace "const PROJECT_VERSION = '[^']*'", "const PROJECT_VERSION = '$NewVersion'"
    Set-Content -Path $TsFile -Value $content -NoNewline
    Write-Host "✓ Updated src/hooks/useFileOperations.ts" -ForegroundColor Green
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Version updated successfully to $NewVersion!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update CHANGELOG.md with the changes for this version"
Write-Host "2. Commit the changes: git add . && git commit -m `"chore: bump version to $NewVersion`""
Write-Host "3. Create a git tag: git tag -a v$NewVersion -m `"Release v$NewVersion`""
Write-Host "4. Push changes and tags: git push && git push --tags"
