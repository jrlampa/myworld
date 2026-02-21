#!/bin/bash
# Script to check version consistency across all project files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_FILE="$PROJECT_ROOT/VERSION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if VERSION file exists
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${RED}ERROR: VERSION file not found at $VERSION_FILE${NC}"
    exit 1
fi

EXPECTED_VERSION=$(cat "$VERSION_FILE" | tr -d '\n')

echo -e "${YELLOW}Checking version consistency...${NC}"
echo ""
echo "VERSION file: ${GREEN}$EXPECTED_VERSION${NC}"

# Check package.json
PKG_VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
if [ "$PKG_VERSION" = "$EXPECTED_VERSION" ]; then
    echo "package.json: ${GREEN}$PKG_VERSION ✓${NC}"
else
    echo "package.json: ${RED}$PKG_VERSION ✗ (expected $EXPECTED_VERSION)${NC}"
    exit 1
fi

# Check package-lock.json
PKG_LOCK_VERSION=$(grep '"version"' "$PROJECT_ROOT/package-lock.json" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')
if [ "$PKG_LOCK_VERSION" = "$EXPECTED_VERSION" ]; then
    echo "package-lock.json: ${GREEN}$PKG_LOCK_VERSION ✓${NC}"
else
    echo "package-lock.json: ${RED}$PKG_LOCK_VERSION ✗ (expected $EXPECTED_VERSION)${NC}"
    exit 1
fi

# Check Python constants
PY_VERSION=$(grep "PROJECT_VERSION = " "$PROJECT_ROOT/py_engine/constants.py" | sed "s/.*PROJECT_VERSION = '\(.*\)'.*/\1/")
if [ "$PY_VERSION" = "$EXPECTED_VERSION" ]; then
    echo "py_engine/constants.py: ${GREEN}$PY_VERSION ✓${NC}"
else
    echo "py_engine/constants.py: ${RED}$PY_VERSION ✗ (expected $EXPECTED_VERSION)${NC}"
    exit 1
fi

# Check TypeScript file
TS_VERSION=$(grep "const PROJECT_VERSION = " "$PROJECT_ROOT/src/hooks/useFileOperations.ts" | sed "s/.*const PROJECT_VERSION = '\(.*\)'.*/\1/")
if [ "$TS_VERSION" = "$EXPECTED_VERSION" ]; then
    echo "src/hooks/useFileOperations.ts: ${GREEN}$TS_VERSION ✓${NC}"
else
    echo "src/hooks/useFileOperations.ts: ${RED}$TS_VERSION ✗ (expected $EXPECTED_VERSION)${NC}"
    exit 1
fi

# Check src/constants.ts APP_VERSION
SRC_CONSTANTS_VERSION=$(grep "APP_VERSION = " "$PROJECT_ROOT/src/constants.ts" | sed 's/.*APP_VERSION = "\(.*\)".*/\1/')
if [ "$SRC_CONSTANTS_VERSION" = "$EXPECTED_VERSION" ]; then
    echo "src/constants.ts: ${GREEN}$SRC_CONSTANTS_VERSION ✓${NC}"
else
    echo "src/constants.ts: ${RED}$SRC_CONSTANTS_VERSION ✗ (expected $EXPECTED_VERSION)${NC}"
    exit 1
fi

# Check server/version.ts SERVER_VERSION
SERVER_VERSION=$(grep "SERVER_VERSION = " "$PROJECT_ROOT/server/version.ts" | sed "s/.*SERVER_VERSION = '\(.*\)'.*/\1/")
if [ "$SERVER_VERSION" = "$EXPECTED_VERSION" ]; then
    echo "server/version.ts: ${GREEN}$SERVER_VERSION ✓${NC}"
else
    echo "server/version.ts: ${RED}$SERVER_VERSION ✗ (expected $EXPECTED_VERSION)${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ All versions are consistent!${NC}"
