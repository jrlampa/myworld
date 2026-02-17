# sisRUA Unified - Dev Mode Launcher
# Enhanced launcher with dependency checks and health verification

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

# Check health of a service
function Test-ServiceHealth {
    param([string]$Url, [int]$MaxRetries = 10)
    
    for ($i = 0; $i -lt $MaxRetries; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                return $true
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

Write-Host "Checking dependencies..." -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  ❌ Node.js not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
} else {
    $nodeVersion = node --version
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
}

# Check Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "  ⚠️  Python not found - DXF generation will not work" -ForegroundColor Yellow
} else {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✅ Python: $pythonVersion" -ForegroundColor Green
    
    # Check Python dependencies
    $requirementsFile = "py_engine\requirements.txt"
    if (Test-Path $requirementsFile) {
        Write-Host "  💡 Tip: Ensure Python packages are installed (pip install -r $requirementsFile)" -ForegroundColor Gray
    }
}

# Check Redis (Docker)
Write-Host ""
Write-Host "Checking Redis..." -ForegroundColor Cyan
$redisRunning = $false
try {
    $dockerPs = docker ps --format "{{.Names}}" 2>$null
    if ($dockerPs -match "sisrua-redis") {
        Write-Host "  ✅ Redis container: sisrua-redis (running)" -ForegroundColor Green
        $redisRunning = $true
    } else {
        Write-Host "  ⚠️  Redis container not running" -ForegroundColor Yellow
        Write-Host "     Start with: docker run -d --name sisrua-redis -p 6379:6379 redis:7-alpine" -ForegroundColor Gray
        Write-Host "     Note: Async job queue features will not work without Redis" -ForegroundColor Gray
    }
}
catch {
    Write-Host "  ⚠️  Docker not available - could not check Redis" -ForegroundColor Yellow
    Write-Host "     Async job queue features require Redis at redis://127.0.0.1:6379" -ForegroundColor Gray
}


# Kill existing processes
Write-Host ""
Write-Host "Cleaning up ports..." -ForegroundColor Cyan
Stop-PortProcess -Port 3000
Stop-PortProcess -Port 3001
Stop-PortProcess -Port 5173

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Starting Development Server..." -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Services will be available at:" -ForegroundColor White
Write-Host "  🌐 Frontend:    http://localhost:3000" -ForegroundColor Cyan
Write-Host "  🔧 Backend API: http://localhost:3001" -ForegroundColor Cyan
Write-Host "  📚 Swagger UI:  http://localhost:3001/api-docs" -ForegroundColor Cyan
if ($redisRunning) {
    Write-Host "  🔴 Redis:       redis://127.0.0.1:6379 ✅" -ForegroundColor Cyan
} else {
    Write-Host "  🔴 Redis:       Not Running ⚠️" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Open browser in background after services are ready
Start-Job -Name "BrowserLauncher" -ScriptBlock {
    Start-Sleep -Seconds 8
    
    # Try to verify backend is up
    $backendReady = $false
    for ($i = 0; $i -lt 20; $i++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $backendReady = $true
                break
            }
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
    }
    
    # Open browser
    Start-Process "http://localhost:3000"
} | Out-Null

# Run npm dev (this will block until Ctrl+C)
try {
    npm run dev
}
finally {
    Write-Host ""
    Write-Host "======================================" -ForegroundColor Yellow
    Write-Host "Shutting down..." -ForegroundColor Yellow
    Write-Host "======================================" -ForegroundColor Yellow
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -ErrorAction SilentlyContinue
    Stop-PortProcess -Port 3000
    Stop-PortProcess -Port 3001
    Stop-PortProcess -Port 5173
    Write-Host ""
    Write-Host "✅ All services stopped!" -ForegroundColor Green
    Write-Host ""
}
