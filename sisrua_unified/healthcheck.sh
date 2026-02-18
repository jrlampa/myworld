#!/usr/bin/env bash
# Quick health check for SIS RUA Unified development environment
# Run this to verify all components are working before testing

set -e

echo "=== SIS RUA Unified - Health Check ==="
echo ""

# Check Node.js
echo "[1/5] Checking Node.js..."
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi
NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"

# Check Python
echo "[2/5] Checking Python..."
if ! command -v python3 &> /dev/null; then
  echo "❌ Python not found. Install Python 3.9+"
  exit 1
fi
PYTHON_VERSION=$(python3 --version)
echo "✅ Python: $PYTHON_VERSION"

# Check npm dependencies
echo "[3/5] Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
  echo "  Installing npm packages..."
  npm ci --prefer-offline
fi
echo "✅ npm dependencies ready"

# Check Python dependencies
echo "[4/5] Checking Python dependencies..."
if ! python3 -c "import osmnx; import folium; import requests" &> /dev/null; then
  echo "  Installing Python packages from py_engine/requirements.txt..."
  python3 -m pip install -r py_engine/requirements.txt --quiet
fi
echo "✅ Python dependencies ready"

# Check environment
echo "[5/5] Checking environment..."
if [ ! -f ".env" ]; then
  echo "  Note: No .env file found. Creating .env.example for reference."
  cat > .env.example << 'EOF'
# Development environment variables
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GCP_PROJECT=sisrua-producao
CLOUD_TASKS_LOCATION=southamerica-east1
CLOUD_TASKS_QUEUE=sisrua-queue
CLOUD_RUN_BASE_URL=http://localhost:3001
EOF
fi
echo "✅ Environment ready"

echo ""
echo "=== ✅ All Checks Passed ==="
echo ""
echo "Next steps:"
echo "1. Terminal 1: npm run server"
echo "2. Terminal 2: npm run client" 
echo "3. Open http://localhost:3000 in browser"
echo "4. Test with coordinates: -23.566390, -46.656081 (São Paulo)"
echo ""
