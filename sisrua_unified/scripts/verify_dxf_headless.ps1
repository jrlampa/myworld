param (
    [string]$DxfPath = "test_plugin_fix_v3.dxf"
)

$Accore = "C:\Program Files\Autodesk\AutoCAD 2026\accoreconsole.exe"
$RootDir = Get-Location
$AbsDxfPath = Resolve-Path $DxfPath
$AbsScriptPath = Join-Path $RootDir "scripts/audit_dxf.scr"

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   AutoCAD Headless Audit started" -ForegroundColor Cyan
Write-Host "   Target: $AbsDxfPath" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

if (-not (Test-Path $AbsDxfPath)) {
    Write-Host "ERROR: File $AbsDxfPath not found." -ForegroundColor Red
    exit 1
}

# Run AutoCAD headless with absolute paths
& $Accore /i "$AbsDxfPath" /s "$AbsScriptPath" /l en-US

if (Test-Path "audit_log.txt") {
    Write-Host ""
    Write-Host "--- Audit Result ---" -ForegroundColor Green
    Get-Content "audit_log.txt" | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    Write-Host "======================================" -ForegroundColor Green
    Remove-Item "audit_log.txt"
}
else {
    Write-Host "ERROR: Audit log not generated. Check AutoCAD execution." -ForegroundColor Red
}
