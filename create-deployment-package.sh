#!/bin/bash

# Post-Build Script for School Guardian 360
# This script updates the unified zip file after a successful build

set -e  # Exit on error

echo "================================================"
echo "School Guardian 360 - Post-Build Packaging"
echo "================================================"
echo ""

# Get current date and time for versioning
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
VERSION=$(node -p "require('./package.json').version")
ZIP_NAME="school-guardian-360-v${VERSION}-${TIMESTAMP}.zip"

echo "📦 Creating deployment package..."
echo "Version: ${VERSION}"
echo "Timestamp: ${TIMESTAMP}"
echo "Output: ${ZIP_NAME}"
echo ""

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ Error: dist/ folder not found. Please run 'npm run build' first."
    exit 1
fi

# Create a temporary directory for packaging
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="${TEMP_DIR}/school-guardian-360"

echo "📋 Preparing files..."

# Create package directory structure
mkdir -p "${PACKAGE_DIR}"

# Copy dist folder
echo "  - Copying dist/ folder..."
cp -r dist "${PACKAGE_DIR}/"

# Copy documentation files
echo "  - Copying documentation..."
cp README.md "${PACKAGE_DIR}/"
cp BUILD_GUIDE.md "${PACKAGE_DIR}/"
cp DEPLOYMENT.md "${PACKAGE_DIR}/"
cp CACHE_BUSTING_GUIDE.md "${PACKAGE_DIR}/"
cp QUICKSTART.md "${PACKAGE_DIR}/"
cp DVA_USER_GUIDE.md "${PACKAGE_DIR}/" 2>/dev/null || true
cp DVA_IMPLEMENTATION_SUMMARY.md "${PACKAGE_DIR}/" 2>/dev/null || true
cp DVA_ARCHITECTURE.md "${PACKAGE_DIR}/" 2>/dev/null || true
cp PAYROLL_PAYSTACK_INTEGRATION.md "${PACKAGE_DIR}/" 2>/dev/null || true
cp PAYSTACK_FLOW_DIAGRAM.md "${PACKAGE_DIR}/" 2>/dev/null || true
cp USER_GUIDE_RESULTS_MANAGEMENT.md "${PACKAGE_DIR}/" 2>/dev/null || true

# Copy essential config files
echo "  - Copying configuration..."
cp .htaccess "${PACKAGE_DIR}/"
cp package.json "${PACKAGE_DIR}/"

# Copy database schema
echo "  - Copying database schema..."
cp database_schema.sql "${PACKAGE_DIR}/" 2>/dev/null || true

# Copy supabase migrations if they exist
if [ -d "supabase/migrations" ]; then
    echo "  - Copying database migrations..."
    mkdir -p "${PACKAGE_DIR}/supabase"
    cp -r supabase/migrations "${PACKAGE_DIR}/supabase/"
fi

# Copy supabase functions if they exist
if [ -d "supabase/functions" ]; then
    echo "  - Copying edge functions..."
    cp -r supabase/functions "${PACKAGE_DIR}/supabase/"
fi

# Create a deployment info file
echo "  - Creating deployment info..."
cat > "${PACKAGE_DIR}/DEPLOYMENT_INFO.txt" << EOF
School Guardian 360 - Deployment Package
=========================================

Version: ${VERSION}
Build Date: $(date +"%Y-%m-%d %H:%M:%S %Z")
Build Timestamp: ${TIMESTAMP}

Package Contents:
- dist/ - Production build files (deploy these to your web server)
- *.md - Documentation files
- .htaccess - Apache configuration for proper caching and routing
- database_schema.sql - Complete database schema
- supabase/ - Database migrations and edge functions

Quick Deployment Steps:
1. Upload contents of dist/ folder to your web server
2. Ensure .htaccess is in the same directory as index.html
3. Clear CDN cache if applicable
4. Verify deployment by testing in incognito mode

For detailed instructions, see:
- DEPLOYMENT.md - Complete deployment guide
- CACHE_BUSTING_GUIDE.md - Cache management and troubleshooting
- BUILD_GUIDE.md - Build and setup instructions

Important Notes:
- All JavaScript/CSS files have content hashes for automatic cache busting
- Service worker will auto-update on user's next visit
- Some users may need to hard refresh (Ctrl+F5) to see updates immediately
- Always deploy ALL files from dist/, not just changed files

Support:
For issues or questions, refer to the documentation files included.
EOF

# Create the zip file
echo ""
echo "🗜️  Creating zip archive..."
cd "${TEMP_DIR}"
zip -r -q "${ZIP_NAME}" school-guardian-360/

# Move zip to project root
mv "${ZIP_NAME}" "${OLDPWD}/"
cd "${OLDPWD}"

# Clean up temp directory
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ Package created successfully!"
echo ""
echo "📦 Output: ${ZIP_NAME}"
echo "📏 Size: $(du -h ${ZIP_NAME} | cut -f1)"
echo ""
echo "🚀 Ready for deployment!"
echo ""
echo "Next steps:"
echo "  1. Upload the dist/ folder contents to your web server"
echo "  2. Clear CDN cache (if applicable)"
echo "  3. Test in incognito mode"
echo "  4. Inform users about the update"
echo ""
echo "For detailed deployment instructions, see DEPLOYMENT.md"
echo "For cache management, see CACHE_BUSTING_GUIDE.md"
echo ""
echo "================================================"
