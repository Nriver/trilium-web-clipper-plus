#!/usr/bin/env bash
set -e

echo "Building Trilium Web Clipper Plus for Chrome (local development)..."

# Get version from manifest
VERSION=$(jq -r ".version" manifest.json)
echo "Version: $VERSION"

# Create build directory
BUILD_DIR="chrome-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy necessary files
echo "Copying files..."
cp -r icons lib options popup i18n *.js manifest.json "$BUILD_DIR"

cd "$BUILD_DIR"

# Update manifest for Chrome
echo "Updating manifest for Chrome..."
# Remove the name suffix for local build
if command -v jq > /dev/null; then
    # Use jq if available
    jq '.name = "Trilium Web Clipper Plus"' manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
    jq 'del(.browser_specific_settings)' manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
else
    # Fallback to sed if jq is not available
    sed -i 's/"Trilium Web Clipper Plus (dev)"/"Trilium Web Clipper Plus"/' manifest.json
    # Remove Firefox-specific browser_specific_settings section
    sed -i '/browser_specific_settings/,/}/d' manifest.json
fi

# Create zip file
EXT_FILE_NAME="trilium-web-clipper-${VERSION}-chrome-local.zip"
echo "Creating Chrome extension package: $EXT_FILE_NAME"
zip -r "../$EXT_FILE_NAME" .

cd ..
rm -rf "$BUILD_DIR"

echo ""
echo "✅ Chrome extension created: $EXT_FILE_NAME"
echo ""
echo "📋 To install in Chrome/Chromium:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (toggle in top right)"
echo "3. Click 'Load unpacked' and select the extracted folder, OR"
echo "4. Drag and drop the $EXT_FILE_NAME file onto the extensions page"
echo ""
echo "📋 Alternative installation method:"
echo "1. Extract the $EXT_FILE_NAME file to a folder"
echo "2. Go to chrome://extensions/"
echo "3. Enable 'Developer mode'"
echo "4. Click 'Load unpacked' and select the extracted folder"
echo ""
echo "🔧 For other Chromium-based browsers (Edge, Brave, etc.):"
echo "   Follow similar steps in their respective extension management pages"
