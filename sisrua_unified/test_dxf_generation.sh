#!/bin/bash
# Test DXF Generation with Real Coordinates
# Coordinates: -22.15018, -42.92189 (região do Brasil)
# Radius: 2km

echo "================================================"
echo "Testing DXF Generation with Real Coordinates"
echo "================================================"
echo ""
echo "Location: -22.15018, -42.92189"
echo "Radius: 2000m (2km)"
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Check Python installation
echo "Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi
echo "✅ Python 3 is installed: $(python3 --version)"

# Check if dependencies are installed
echo ""
echo "Checking Python dependencies..."
if ! python3 -c "import osmnx, ezdxf, geopandas" 2>/dev/null; then
    echo "⚠️  Python dependencies not installed. Installing..."
    pip3 install -q -r py_engine/requirements.txt
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "✅ Python dependencies are installed"
fi

# Create output directory if it doesn't exist
mkdir -p public/dxf

# Test DXF generation
echo ""
echo "Starting DXF generation test..."
echo "⏳ This may take a few minutes depending on the data volume..."
echo ""

OUTPUT_FILE="public/dxf/test_coords_-22.15018_-42.92189_r2000.dxf"

python3 generate_dxf.py \
    --lat -22.15018 \
    --lon -42.92189 \
    --radius 2000 \
    --output "$OUTPUT_FILE" \
    --selection-mode circle \
    --projection local

if [ $? -eq 0 ]; then
    echo ""
    echo "================================================"
    echo "✅ DXF GENERATION SUCCESSFUL!"
    echo "================================================"
    echo ""
    echo "Output file: $OUTPUT_FILE"
    if [ -f "$OUTPUT_FILE" ]; then
        FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
        echo "File size: $FILE_SIZE"
        echo ""
        echo "You can download this file from:"
        echo "http://localhost:3001/downloads/$(basename $OUTPUT_FILE)"
    fi
else
    echo ""
    echo "================================================"
    echo "❌ DXF GENERATION FAILED"
    echo "================================================"
    echo ""
    echo "Note: This test requires internet connectivity to fetch"
    echo "OpenStreetMap data from overpass-api.de"
    echo ""
    echo "If you're in a restricted environment, the test may fail"
    echo "due to network restrictions."
    exit 1
fi
