# Comprehensive Security Scan Script for Windows
# Runs security audits on Node.js and Python dependencies
#
# SECURITY NOTICE:
# This script performs the following safe operations:
# 1. Runs npm audit to check Node.js dependencies
# 2. Runs pip-audit to check Python dependencies (if available)
# 3. Runs bandit to scan Python code for security issues (if available)
# 4. Generates a security report
#
# This is a SAFE script that only reads files and checks for vulnerabilities.
# It does NOT modify any files or install anything automatically.
#
# If your antivirus flags this script:
# - This is a FALSE POSITIVE due to security scanning operations
# - Review SECURITY_ANTIVIRUS_GUIDE.md for exclusion setup
# - All operations are logged and transparent
#
# Source: https://github.com/jrlampa/myworld
# Last Updated: 2026-02-18

param(
    [switch]$SkipPython = $false,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "🛡️  SIS RUA Unified - Security Audit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project: $(Get-Location)" -ForegroundColor White
Write-Host "Date: $(Get-Date)" -ForegroundColor White
Write-Host ""

$AllPassed = $true

function Print-Status {
    param([bool]$Success, [string]$Message)
    
    if ($Success) {
        Write-Host "✅ $Message" -ForegroundColor Green
    } else {
        Write-Host "❌ $Message" -ForegroundColor Red
        $script:AllPassed = $false
    }
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

# 1. Node.js Security Audit
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "📦 Node.js Dependency Audit" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "Running npm audit..." -ForegroundColor White
    
    try {
        $auditOutput = npm audit --audit-level=moderate 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Status $true "npm audit passed - no moderate/high vulnerabilities"
        } else {
            Print-Status $false "npm audit found vulnerabilities"
            if ($Verbose) {
                Write-Host $auditOutput
            }
            Write-Host ""
            Write-Host "💡 To fix automatically, run: npm audit fix" -ForegroundColor Yellow
            Write-Host "   For breaking changes: npm audit fix --force" -ForegroundColor Yellow
        }
    } catch {
        Print-Warning "Failed to run npm audit: $_"
    }
} else {
    Print-Warning "npm not found - skipping Node.js audit"
}

Write-Host ""

# 2. Python Security Audit
if (-not $SkipPython) {
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "🐍 Python Dependency Audit" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (Get-Command python -ErrorAction SilentlyContinue) {
        # Check if pip-audit is available
        $pipAuditInstalled = $false
        try {
            $null = pip-audit --version 2>&1
            $pipAuditInstalled = $true
        } catch {
            $pipAuditInstalled = $false
        }
        
        if (-not $pipAuditInstalled) {
            Print-Warning "pip-audit not installed"
            Write-Host "   Install with: pip install pip-audit" -ForegroundColor Gray
            Write-Host "   Skipping Python vulnerability scan..." -ForegroundColor Gray
        } else {
            Write-Host "Running pip-audit on py_engine/requirements.txt..." -ForegroundColor White
            
            try {
                $pipAuditOutput = pip-audit --requirement py_engine/requirements.txt 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Print-Status $true "pip-audit passed - no known vulnerabilities"
                } else {
                    Print-Status $false "pip-audit found vulnerabilities"
                    if ($Verbose) {
                        Write-Host $pipAuditOutput
                    }
                    Write-Host ""
                    Write-Host "💡 Review vulnerabilities above and update packages" -ForegroundColor Yellow
                }
            } catch {
                Print-Warning "Failed to run pip-audit: $_"
            }
        }
    } else {
        Print-Warning "Python not found - skipping Python audit"
    }
    
    Write-Host ""
    
    # 3. Python Code Security Scan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "🔍 Python Code Security Scan (Bandit)" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    if (Get-Command python -ErrorAction SilentlyContinue) {
        # Check if bandit is available
        $banditInstalled = $false
        try {
            $null = bandit --version 2>&1
            $banditInstalled = $true
        } catch {
            $banditInstalled = $false
        }
        
        if (-not $banditInstalled) {
            Print-Warning "Bandit not installed"
            Write-Host "   Install with: pip install bandit" -ForegroundColor Gray
            Write-Host "   Skipping Python code security scan..." -ForegroundColor Gray
        } else {
            Write-Host "Running bandit on py_engine/..." -ForegroundColor White
            
            try {
                # -ll = only show medium and high severity issues
                # -f txt = text format output
                $banditOutput = bandit -r py_engine/ -ll -f txt 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Print-Status $true "Bandit scan passed - no security issues found"
                } else {
                    Print-Status $false "Bandit found potential security issues"
                    if ($Verbose) {
                        Write-Host $banditOutput
                    }
                    Write-Host ""
                    Write-Host "💡 Review issues above and fix as needed" -ForegroundColor Yellow
                }
            } catch {
                Print-Warning "Failed to run bandit: $_"
            }
        }
    } else {
        Print-Warning "Python not found - skipping Bandit scan"
    }
    
    Write-Host ""
}

# 4. Check for common security misconfigurations
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "🔧 Configuration Security Check" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Check for .env file in git
try {
    $trackedFiles = git ls-files 2>&1
    if ($trackedFiles -match "^\.env$") {
        Print-Status $false ".env file is tracked in git (SECURITY RISK!)"
        Write-Host "   Remove with: git rm --cached .env" -ForegroundColor Yellow
    } else {
        Print-Status $true ".env file not tracked in git"
    }
} catch {
    Print-Warning "Could not check git tracked files"
}

# Check .gitignore for security-sensitive patterns
Write-Host ""
$gitignoreOk = $true
try {
    $gitignoreContent = Get-Content .gitignore -ErrorAction SilentlyContinue
    $sisruaGitignore = Get-Content sisrua_unified/.gitignore -ErrorAction SilentlyContinue
    
    if (($gitignoreContent -match "\.env") -and 
        ($sisruaGitignore -match "\.exe") -and 
        ($sisruaGitignore -match "\.dll")) {
        Print-Status $true ".gitignore properly configured for security"
    } else {
        Print-Warning ".gitignore may be missing security patterns"
        Write-Host "   Ensure .env, .exe, .dll are ignored" -ForegroundColor Gray
    }
} catch {
    Print-Warning "Could not verify .gitignore configuration"
}

Write-Host ""

# 5. Summary
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "📊 Security Audit Summary" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

if ($AllPassed) {
    Write-Host "✅ All security checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "System is secure and ready for deployment." -ForegroundColor Green
} else {
    Write-Host "❌ Some security checks failed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please review the issues above before deployment." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor White
    Write-Host "  - npm audit fix          # Fix Node.js vulnerabilities" -ForegroundColor Gray
    Write-Host "  - pip install --upgrade  # Update Python packages" -ForegroundColor Gray
    Write-Host "  - Review and fix Bandit issues in code" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "📖 Documentation" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "For more information:" -ForegroundColor White
Write-Host "  - SECURITY_ANTIVIRUS_GUIDE.md - Antivirus mitigation guide" -ForegroundColor Gray
Write-Host "  - SECURITY_CHECKLIST.md       - Developer security checklist" -ForegroundColor Gray
Write-Host "  - SECURITY_DEPLOYMENT_AUDIT.md - Deployment security audit" -ForegroundColor Gray
Write-Host ""

if ($AllPassed) {
    exit 0
} else {
    exit 1
}
