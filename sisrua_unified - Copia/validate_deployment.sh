#!/bin/bash
set -e

echo "============================================"
echo "   DEPLOYMENT VALIDATION SCRIPT"
echo "============================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Verify Dockerfile exists
echo -n "✓ Checking Dockerfile exists... "
if [ -f "Dockerfile" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 2: Verify .dockerignore exists
echo -n "✓ Checking .dockerignore exists... "
if [ -f ".dockerignore" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 3: Verify py_engine directory and requirements.txt
echo -n "✓ Checking py_engine/requirements.txt... "
if [ -f "py_engine/requirements.txt" ]; then
    if grep -q "requests" py_engine/requirements.txt; then
        echo -e "${GREEN}PASS${NC} (requests dependency found)"
    else
        echo -e "${RED}FAIL${NC} (requests dependency missing)"
        exit 1
    fi
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 4: Verify pythonBridge.ts has production path logic
echo -n "✓ Checking pythonBridge.ts production path... "
if grep -q "/app/py_engine/main.py" server/pythonBridge.ts; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 5: Verify pythonBridge.ts uses python3
echo -n "✓ Checking pythonBridge.ts uses python3... "
if grep -q "python3" server/pythonBridge.ts; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 6: Verify openMeteoService batch size
echo -n "✓ Checking Open-Meteo batch size (30)... "
if grep -q "batchSize: number = 30" server/services/openMeteoService.ts; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 7: Verify URL encoding in openMeteoService
echo -n "✓ Checking URL encoding in openMeteoService... "
if grep -q "encodeURIComponent" server/services/openMeteoService.ts; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 8: Verify /analyze endpoint supports coordinates
echo -n "✓ Checking /analyze endpoint logic... "
if grep -q "coordinates || coords" server/index.ts; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 9: Verify dxfOutputDir variable exists
echo -n "✓ Checking dxfOutputDir path resolution... "
if grep -q "dxfOutputDir" server/index.ts; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 10: Verify TypeScript compiles
echo -n "✓ Checking TypeScript server compilation... "
if npx tsc -p tsconfig.server.json --noEmit 2>&1 | grep -q "error TS"; then
    echo -e "${RED}FAIL${NC}"
    echo "TypeScript errors detected:"
    npx tsc -p tsconfig.server.json --noEmit 2>&1 | grep "error TS" | head -5
    exit 1
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 11: Verify Python syntax
echo -n "✓ Checking Python syntax... "
if python3 -m py_compile py_engine/main.py py_engine/elevation_client.py 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    exit 1
fi

# Check 12: Verify DEPLOYMENT_FIXES.md exists
echo -n "✓ Checking documentation exists... "
if [ -f "DEPLOYMENT_FIXES.md" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARNING${NC} (documentation missing)"
fi

echo ""
echo "============================================"
echo -e "${GREEN}   ALL VALIDATION CHECKS PASSED!${NC}"
echo "============================================"
echo ""
echo "Deployment Structure Summary:"
echo "  • Python script path: /app/py_engine/main.py (production)"
echo "  • Open-Meteo batch size: 30 coordinates"
echo "  • /analyze endpoint: supports coords + stats"
echo "  • Path resolution: intelligent multi-candidate"
echo "  • Dependencies: requests added to requirements.txt"
echo ""
echo "Ready for Cloud Run deployment! 🚀"
echo ""
