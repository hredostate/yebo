# Cache Busting Guide

## Problem: Updates Not Showing After Deployment

When you deploy updated versions of the School Guardian 360 application, users may still see the old version due to aggressive browser caching and Service Worker caching. This guide explains how to ensure users see the latest updates.

---

## Why This Happens

The application uses several caching mechanisms:

1. **Browser Cache** - Browsers cache static assets (JS, CSS, images) for performance
2. **Service Worker Cache** - The PWA service worker caches files for offline functionality
3. **CDN Cache** - If using a CDN, it may cache your files at edge locations

When you deploy updates without proper cache invalidation, users continue to receive cached old versions.

---

## Solution 1: Automatic Cache Busting (Recommended)

The application is now configured to automatically handle cache invalidation:

### What Changed

1. **Content-Hash Filenames**: Vite now generates unique filenames with content hashes (e.g., `index-abc123def.js`)
2. **Service Worker Auto-Update**: Service worker automatically updates and clears old caches
3. **Improved .htaccess**: Better cache control headers for different file types

### How It Works

When you run `npm run build`:
- Each file gets a unique hash based on its content
- If content changes, the hash changes, creating a new filename
- The HTML always loads the latest hashed files
- Service worker automatically detects and installs updates

### Build and Deploy Steps

```bash
# 1. Build the application
npm run build

# 2. The dist/ folder now contains:
#    - index.html (never cached)
#    - sw.js (never cached - service worker)
#    - assets/*.js with unique hashes
#    - assets/*.css with unique hashes

# 3. Deploy the ENTIRE dist/ folder to your server
#    - Upload all files, replacing the old ones
#    - Make sure index.html is replaced
#    - Make sure sw.js is replaced

# 4. Clear your CDN cache (if applicable)
#    - Cloudflare: Purge Everything
#    - AWS CloudFront: Create Invalidation for /*
#    - Other CDNs: Check their documentation
```

---

## Solution 2: Manual Cache Clearing (For Developers/Testers)

If you're testing and want to force-clear all caches:

### For Chrome/Edge:
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

### For Firefox:
1. Press Ctrl+Shift+Delete
2. Select "Cached Web Content"
3. Select "Everything" for time range
4. Click "Clear Now"

### For All Browsers (Nuclear Option):
```javascript
// Open browser console (F12) and run:
caches.keys().then(keys => {
    keys.forEach(key => caches.delete(key));
    console.log('All caches cleared');
    location.reload(true);
});
```

---

## Solution 3: User Instructions (For End Users)

When you deploy an update, inform users to:

### Option A: Simple Hard Refresh
- **Windows/Linux**: Press `Ctrl + F5`
- **Mac**: Press `Cmd + Shift + R`

### Option B: Clear App Data (for PWA users)
1. Go to browser settings
2. Find "Site Settings" or "Storage"
3. Search for your domain
4. Click "Clear Data" or "Clear Storage"
5. Refresh the page

---

## Solution 4: Version Display (Recommended)

Add a version number to help users verify they have the latest version:

### Update package.json

```json
{
  "name": "school-guardian-360",
  "version": "2.0.0"  // Increment this with each release
}
```

### Display Version in App

The version should be displayed in the footer or settings page, so users can confirm they're on the latest version.

---

## Best Practices for Deployment

### ✅ DO:
- Always increment the version number in package.json before building
- Run a full `npm run build` for production deployments
- Upload ALL files from the dist/ folder
- Test in an incognito/private window after deployment
- Keep deployment notes with version numbers
- Clear CDN cache after deployment

### ❌ DON'T:
- Don't deploy only changed files - always deploy the full dist/ folder
- Don't skip the build step and deploy source files
- Don't forget to clear CDN cache
- Don't test in a cached browser session

---

## Troubleshooting

### Issue: Users still see old version after deployment

**Solution:**
1. Verify the correct files are on the server (check file timestamps)
2. Check that index.html has been updated (view source and check asset hashes)
3. Clear CDN cache if applicable
4. Ask users to hard refresh (Ctrl+F5)

### Issue: Service Worker not updating

**Solution:**
1. Check that sw.js file was uploaded and replaced
2. In DevTools → Application → Service Workers, click "Unregister"
3. Refresh the page
4. New service worker should install

### Issue: Some users see mixed versions (old JS with new HTML)

**Solution:**
1. This means partial deployment - some files weren't uploaded
2. Re-upload ALL files from dist/ folder
3. Clear CDN cache
4. Verify all asset files have new timestamps

---

## Verification Checklist

After deployment, verify:

- [ ] index.html shows current date/time as last modified
- [ ] sw.js shows current date/time as last modified
- [ ] Assets folder contains files with new hashes
- [ ] Opening in incognito window shows new version
- [ ] DevTools → Network shows 200 OK (not 304 Not Modified) for main files
- [ ] No console errors in browser
- [ ] Version number in app matches package.json

---

## Emergency Cache Clear (Server-Side)

If you need to force all users to get fresh content immediately, you can temporarily modify .htaccess:

```apache
# Add this temporarily at the top of .htaccess
<IfModule mod_headers.c>
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
</IfModule>
```

**Warning:** This will slow down your site. Remove it after users have updated (typically 24-48 hours).

---

## Contact & Support

If users continue to experience caching issues after following this guide:

1. Check server logs for any errors
2. Verify file permissions (files should be readable)
3. Test from multiple browsers and devices
4. Check for any proxy servers or corporate firewalls that might be caching

---

**Version**: 1.0  
**Last Updated**: December 6, 2025  
**Status**: ✅ Tested and Verified
