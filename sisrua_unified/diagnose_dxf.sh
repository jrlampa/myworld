#!/bin/bash

# DXF Generation Diagnostic Script
# Helps identify issues with DXF generation between f34b5ea and current version

set +e  # Don't exit on errors, we want to collect all diagnostics

echo "========================================="
echo "DXF Generation Diagnostic Tool"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
ISSUES_FOUND=0

# 1. Check Python availability
echo "1. Checking Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo -e "${GREEN}✓${NC} python3 found: $PYTHON_VERSION"
else
    echo -e "${RED}✗${NC} python3 not found"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if command -v python &> /dev/null; then
    PYTHON_VERSION=$(python --version 2>&1)
    echo -e "${GREEN}✓${NC} python found: $PYTHON_VERSION"
else
    echo -e "${YELLOW}!${NC} python command not found (this is OK if python3 exists)"
fi
echo ""

# 2. Check Python dependencies
echo "2. Checking Python dependencies..."
DEPS_OK=true

for package in osmnx ezdxf geopandas shapely networkx scipy matplotlib; do
    if python3 -c "import $package" 2>/dev/null; then
        VERSION=$(python3 -c "import $package; print(getattr($package, '__version__', 'unknown'))" 2>/dev/null)
        echo -e "${GREEN}✓${NC} $package installed (version: $VERSION)"
    else
        echo -e "${RED}✗${NC} $package NOT installed"
        DEPS_OK=false
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

if [ "$DEPS_OK" = false ]; then
    echo ""
    echo -e "${YELLOW}To install missing dependencies:${NC}"
    echo "  pip3 install -r py_engine/requirements.txt"
fi
echo ""

# 3. Check OSM API connectivity
echo "3. Checking OSM API connectivity..."
if curl -s --max-time 10 "https://overpass-api.de/api/status" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} OSM Overpass API is reachable"
else
    echo -e "${RED}✗${NC} Cannot reach OSM Overpass API"
    echo "  This could cause DXF generation to fail or timeout"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 4. Check Node.js and npm
echo "4. Checking Node.js environment..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version 2>&1)
    echo -e "${GREEN}✓${NC} Node.js found: $NODE_VERSION"
else
    echo -e "${RED}✗${NC} Node.js not found"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${YELLOW}!${NC} node_modules not found"
    echo "  Run: npm install"
fi
echo ""

# 5. Check directories
echo "5. Checking required directories..."
DIRS_OK=true

for dir in py_engine public/dxf; do
    if [ -d "$dir" ]; then
        echo -e "${GREEN}✓${NC} $dir exists"
    else
        echo -e "${RED}✗${NC} $dir not found"
        DIRS_OK=false
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
done

if [ "$DIRS_OK" = false ]; then
    echo ""
    echo -e "${YELLOW}To create missing directories:${NC}"
    echo "  mkdir -p public/dxf"
fi
echo ""

# 6. Check Python engine files
echo "6. Checking Python engine files..."
if [ -f "py_engine/main.py" ]; then
    echo -e "${GREEN}✓${NC} main.py exists"
else
    echo -e "${RED}✗${NC} main.py not found"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi

if [ -f "py_engine/requirements.txt" ]; then
    echo -e "${GREEN}✓${NC} requirements.txt exists"
else
    echo -e "${RED}✗${NC} requirements.txt not found"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 7. Test simple Python execution
echo "7. Testing Python DXF generation..."
echo "   Running: python3 py_engine/main.py --help"
if python3 py_engine/main.py --help > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Python engine can be executed"
else
    echo -e "${RED}✗${NC} Python engine execution failed"
    echo "  Try running manually to see the error:"
    echo "  python3 py_engine/main.py --help"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
fi
echo ""

# 8. Environment variables
echo "8. Checking environment variables..."
if [ -n "$PYTHON_COMMAND" ]; then
    echo -e "${GREEN}✓${NC} PYTHON_COMMAND is set to: $PYTHON_COMMAND"
else
    echo -e "${YELLOW}!${NC} PYTHON_COMMAND not set (will default to python3)"
fi

if [ -n "$GROQ_API_KEY" ]; then
    echo -e "${GREEN}✓${NC} GROQ_API_KEY is configured"
else
    echo -e "${YELLOW}!${NC} GROQ_API_KEY not set (AI analysis will be disabled)"
fi
echo ""

# Summary
echo "========================================="
echo "Diagnostic Summary"
echo "========================================="
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No issues found!${NC}"
    echo ""
    echo "Your environment appears to be correctly configured."
    echo "If DXF generation still fails, the issue might be:"
    echo "  1. Network timeout when fetching OSM data (try smaller radius)"
    echo "  2. Specific coordinates causing issues"
    echo "  3. Server-side configuration in production"
    echo ""
    echo "Try a test generation:"
    echo "  python3 py_engine/main.py --lat -22.15018 --lon -42.92189 --radius 50 --output /tmp/test.dxf --no-preview"
else
    echo -e "${RED}✗ Found $ISSUES_FOUND issue(s)${NC}"
    echo ""
    echo "Please fix the issues above before attempting DXF generation."
    echo ""
    echo "Quick fixes:"
    echo "  - Install Python deps: pip3 install -r py_engine/requirements.txt"
    echo "  - Install Node deps: npm install"
    echo "  - Create directories: mkdir -p public/dxf"
fi
echo ""
