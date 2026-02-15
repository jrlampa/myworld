# sisRUA Unified - Dev Mode Launcher
# Simple launcher for development

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   sisRUA Unified - Dev Mode" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Kill existing processes on ports
function Stop-PortProcess {
    param([int]$Port)
    
    $process = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | 
    Select-Object -ExpandProperty OwningProcess -Unique
    
    if ($process) {
        Write-Host "  Stopping process on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    }
}

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "WARNING: Python not found - DXF generation will not work" -ForegroundColor Yellow
}

# Kill existing processes
Write-Host "Cleaning up ports..." -ForegroundColor Cyan
Stop-PortProcess -Port 3000
Stop-PortProcess -Port 3001

Write-Host ""
Write-Host "Starting development server..." -ForegroundColor Green
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Gray
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Wait a bit before opening browser
Start-Sleep -Seconds 3

# Open browser in background
Start-Job -Name "BrowserLauncher" -ScriptBlock {
    Start-Sleep -Seconds 5
    Start-Process "http://localhost:3000"
} | Out-Null

# Run npm dev (this will block until Ctrl+C)
try {
    npm run dev
}
finally {
    Write-Host ""
    Write-Host "Cleaning up..." -ForegroundColor Yellow
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Stop-PortProcess -Port 3000
    Stop-PortProcess -Port 3001
    Write-Host "Stopped!" -ForegroundColor Green
    Write-Host ""
}
