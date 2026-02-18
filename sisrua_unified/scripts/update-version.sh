#!/bin/bash
# Script to update version across all project files
# Usage: ./update-version.sh [new_version]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VERSION_FILE="$PROJECT_ROOT/VERSION"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Read current version
if [ ! -f "$VERSION_FILE" ]; then
    echo -e "${RED}ERROR: VERSION file not found at $VERSION_FILE${NC}"
    exit 1
fi

CURRENT_VERSION=$(cat "$VERSION_FILE" | tr -d '\n')
echo -e "${GREEN}Current version: $CURRENT_VERSION${NC}"

# Get new version from argument or prompt user
if [ -z "$1" ]; then
    echo -e "${YELLOW}Enter new version (current: $CURRENT_VERSION):${NC}"
    read NEW_VERSION
else
    NEW_VERSION="$1"
fi

# Validate version format (semantic versioning)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    echo -e "${RED}ERROR: Invalid version format. Use semantic versioning (e.g., 1.0.0, 1.0.0-alpha.1, 1.0.0+build.123)${NC}"
    exit 1
fi

echo -e "${YELLOW}Updating version from $CURRENT_VERSION to $NEW_VERSION...${NC}"

# Update VERSION file
echo "$NEW_VERSION" > "$VERSION_FILE"
echo -e "${GREEN}✓ Updated VERSION file${NC}"

# Update package.json
if [ -f "$PROJECT_ROOT/package.json" ]; then
    # Use Node.js to update package.json properly
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('$PROJECT_ROOT/package.json', 'utf8'));
        pkg.version = '$NEW_VERSION';
        fs.writeFileSync('$PROJECT_ROOT/package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo -e "${GREEN}✓ Updated package.json${NC}"
fi

# Update package-lock.json
if [ -f "$PROJECT_ROOT/package-lock.json" ]; then
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('$PROJECT_ROOT/package-lock.json', 'utf8'));
        pkg.version = '$NEW_VERSION';
        if (pkg.packages && pkg.packages['']) {
            pkg.packages[''].version = '$NEW_VERSION';
        }
        fs.writeFileSync('$PROJECT_ROOT/package-lock.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo -e "${GREEN}✓ Updated package-lock.json${NC}"
fi

# Update Python constants.py
CONSTANTS_FILE="$PROJECT_ROOT/py_engine/constants.py"
if [ -f "$CONSTANTS_FILE" ]; then
    sed -i "s/PROJECT_VERSION = '[^']*'/PROJECT_VERSION = '$NEW_VERSION'/" "$CONSTANTS_FILE"
    echo -e "${GREEN}✓ Updated py_engine/constants.py${NC}"
fi

# Update TypeScript useFileOperations.ts
TS_FILE="$PROJECT_ROOT/src/hooks/useFileOperations.ts"
if [ -f "$TS_FILE" ]; then
    sed -i "s/const PROJECT_VERSION = '[^']*'/const PROJECT_VERSION = '$NEW_VERSION'/" "$TS_FILE"
    echo -e "${GREEN}✓ Updated src/hooks/useFileOperations.ts${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Version updated successfully to $NEW_VERSION!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update CHANGELOG.md with the changes for this version"
echo "2. Commit the changes: git add . && git commit -m \"chore: bump version to $NEW_VERSION\""
echo "3. Create a git tag: git tag -a v$NEW_VERSION -m \"Release v$NEW_VERSION\""
echo "4. Push changes and tags: git push && git push --tags"
