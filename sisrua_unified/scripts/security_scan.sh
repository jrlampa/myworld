#!/bin/bash
# Comprehensive Security Scan Script
# Runs security audits on Node.js and Python dependencies
#
# SECURITY NOTICE:
# This script performs the following safe operations:
# 1. Runs npm audit to check Node.js dependencies
# 2. Runs pip-audit to check Python dependencies
# 3. Runs bandit to scan Python code for security issues
# 4. Generates a security report
#
# This is a SAFE script that only reads files and checks for vulnerabilities.
# It does NOT modify any files or install anything automatically.

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "================================================================"
echo "🛡️  SIS RUA Unified - Security Audit"
echo "================================================================"
echo ""
echo "Project: $PROJECT_DIR"
echo "Date: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SUCCESS=0

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        SUCCESS=1
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Change to project directory
cd "$PROJECT_DIR"

# 1. Node.js Security Audit
echo "================================================================"
echo "📦 Node.js Dependency Audit"
echo "================================================================"
echo ""

if command -v npm &> /dev/null; then
    echo "Running npm audit..."
    if npm audit --audit-level=moderate; then
        print_status 0 "npm audit passed - no moderate/high vulnerabilities"
    else
        print_status 1 "npm audit found vulnerabilities"
        echo ""
        echo "💡 To fix automatically, run: npm audit fix"
        echo "   For breaking changes: npm audit fix --force"
    fi
else
    print_warning "npm not found - skipping Node.js audit"
fi

echo ""

# 2. Python Security Audit
echo "================================================================"
echo "🐍 Python Dependency Audit"
echo "================================================================"
echo ""

if command -v python3 &> /dev/null; then
    # Check if pip-audit is available
    if ! command -v pip-audit &> /dev/null; then
        print_warning "pip-audit not installed"
        echo "   Install with: pip install pip-audit"
        echo "   Skipping Python vulnerability scan..."
    else
        echo "Running pip-audit on py_engine/requirements.txt..."
        if pip-audit --requirement py_engine/requirements.txt; then
            print_status 0 "pip-audit passed - no known vulnerabilities"
        else
            print_status 1 "pip-audit found vulnerabilities"
            echo ""
            echo "💡 Review vulnerabilities above and update packages"
        fi
    fi
else
    print_warning "Python not found - skipping Python audit"
fi

echo ""

# 3. Python Code Security Scan
echo "================================================================"
echo "🔍 Python Code Security Scan (Bandit)"
echo "================================================================"
echo ""

if command -v python3 &> /dev/null; then
    # Check if bandit is available
    if ! command -v bandit &> /dev/null; then
        print_warning "Bandit not installed"
        echo "   Install with: pip install bandit"
        echo "   Skipping Python code security scan..."
    else
        echo "Running bandit on py_engine/..."
        # -ll = only show medium and high severity issues
        # -f txt = text format output
        if bandit -r py_engine/ -ll -f txt; then
            print_status 0 "Bandit scan passed - no security issues found"
        else
            print_status 1 "Bandit found potential security issues"
            echo ""
            echo "💡 Review issues above and fix as needed"
        fi
    fi
else
    print_warning "Python not found - skipping Bandit scan"
fi

echo ""

# 4. Check for common security misconfigurations
echo "================================================================"
echo "🔧 Configuration Security Check"
echo "================================================================"
echo ""

# Check for .env file in git
if git ls-files | grep -q "^\.env$"; then
    print_status 1 ".env file is tracked in git (SECURITY RISK!)"
    echo "   Remove with: git rm --cached .env"
else
    print_status 0 ".env file not tracked in git"
fi

# Check for hardcoded secrets in recent commits
echo ""
echo "Checking for potential secrets in recent commits..."
if git log --all --full-history -10 --grep="password\|secret\|api_key\|token" -i | grep -q "password\|secret\|api_key\|token"; then
    print_warning "Found potential secret keywords in recent commits"
    echo "   Review commit messages manually"
else
    print_status 0 "No obvious secrets in recent commit messages"
fi

# Check .gitignore for security-sensitive patterns
echo ""
if (grep -q "\.env" .gitignore 2>/dev/null || grep -q "\.env" sisrua_unified/.gitignore 2>/dev/null) && \
   grep -q "\.exe" sisrua_unified/.gitignore 2>/dev/null && \
   grep -q "\.dll" sisrua_unified/.gitignore 2>/dev/null; then
    print_status 0 ".gitignore properly configured for security"
else
    print_warning ".gitignore may be missing security patterns"
    echo "   Ensure .env, .exe, .dll are ignored"
fi

echo ""

# 5. Summary
echo "================================================================"
echo "📊 Security Audit Summary"
echo "================================================================"
echo ""

if [ $SUCCESS -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo ""
    echo "System is secure and ready for deployment."
else
    echo -e "${RED}❌ Some security checks failed${NC}"
    echo ""
    echo "Please review the issues above before deployment."
    echo ""
    echo "Common fixes:"
    echo "  - npm audit fix          # Fix Node.js vulnerabilities"
    echo "  - pip install --upgrade  # Update Python packages"
    echo "  - Review and fix Bandit issues in code"
fi

echo ""
echo "================================================================"
echo "📖 Documentation"
echo "================================================================"
echo ""
echo "For more information:"
echo "  - SECURITY_ANTIVIRUS_GUIDE.md - Antivirus mitigation guide"
echo "  - SECURITY_CHECKLIST.md       - Developer security checklist"
echo "  - SECURITY_DEPLOYMENT_AUDIT.md - Deployment security audit"
echo ""

exit $SUCCESS
