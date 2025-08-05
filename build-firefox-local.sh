#!/usr/bin/env bash
set -e

echo "Building Trilium Web Clipper Plus for Firefox (local development)..."

# Get version from manifest
VERSION=$(jq -r ".version" manifest-firefox.json)
echo "Version: $VERSION"

# Create build directory
BUILD_DIR="firefox-build"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy necessary files
echo "Copying files..."
cp -r icons lib options popup i18n *.js "$BUILD_DIR"
cp manifest-firefox.json "$BUILD_DIR/manifest.json"

cd "$BUILD_DIR"

# Update manifest for Firefox
echo "Updating manifest for Firefox..."
# Remove the name suffix for local build
if command -v jq > /dev/null; then
    # Use jq if available
    jq '.name = "Trilium Web Clipper Plus"' manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
    # Remove any Chrome-specific settings that might exist
    jq 'del(.chrome_settings_overrides)' manifest.json > manifest.json.tmp && mv manifest.json.tmp manifest.json
else
    # Fallback to sed if jq is not available
    sed -i 's/"Trilium Web Clipper Plus (dev)"/"Trilium Web Clipper Plus"/' manifest.json
    # Remove Chrome-specific settings if they exist
    sed -i '/chrome_settings_overrides/,/}/d' manifest.json
fi

# Create zip file for Firefox
EXT_FILE_NAME="trilium-web-clipper-${VERSION}-firefox-local.zip"
echo "Creating Firefox extension package: $EXT_FILE_NAME"
zip -r "../$EXT_FILE_NAME" .

cd ..
rm -rf "$BUILD_DIR"

echo ""
echo "✅ Firefox extension created: $EXT_FILE_NAME"
echo ""
echo "📋 To install in Firefox:"
echo "1. Open Firefox and go to about:debugging"
echo "2. Click 'This Firefox' in the left sidebar"
echo "3. Click 'Load Temporary Add-on...'"
echo "4. Select the $EXT_FILE_NAME file or any file in the extracted folder"
echo ""
echo "📋 Alternative installation method:"
echo "1. Extract the $EXT_FILE_NAME file to a folder"
echo "2. Go to about:debugging#/runtime/this-firefox"
echo "3. Click 'Load Temporary Add-on...'"
echo "4. Navigate to the extracted folder and select manifest.json"
echo ""
echo "⚠️  Note: Temporary add-ons are removed when Firefox restarts"
echo "   For permanent installation, you need to sign the extension"
echo ""
echo "🔧 For Firefox Developer Edition:"
echo "   You can set xpinstall.signatures.required to false in about:config"
echo "   to install unsigned extensions permanently"
