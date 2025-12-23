# Report Card Print Route - Quick Reference Guide

## For Users

### Accessing the Print Route

**URL Format**: `/report/<token>/<student-slug>/print`

**Example**:
```
https://your-school.com/report/5080-1-1766419518668-qyshsl/john-doe/print
```

### How to Use

1. **Get the Report Token**
   - Generated automatically when sharing report cards
   - Token is part of the public report URL

2. **Add `/print` to the URL**
   - Regular view: `/report/<token>/<slug>`
   - Print view: `/report/<token>/<slug>/print`

3. **Print or Save as PDF**
   - Click the "Print / Save PDF" button, OR
   - Use browser print: `Ctrl+P` (Windows) or `Cmd+P` (Mac)
   - Choose "Save as PDF" as the printer
   - Select A4 paper size and Portrait orientation

### Benefits

✅ **Print-Optimized Layout**: Designed specifically for A4 portrait
✅ **All Sections Visible**: No tabs or hidden content
✅ **Professional Look**: Same design as official report cards
✅ **Browser Print**: Works with any modern browser
✅ **No Installation**: No special software needed

---

## For Administrators

### Bulk PDF Generation

The bulk report card generator now produces PDFs that match the print route output:

1. Navigate to **Result Manager**
2. Select a **Term**
3. Switch to **By Class** view
4. Click **"Generate Report Cards"** on the class card
5. Select students (eligible students auto-selected)
6. Click **"Download as ZIP"**

### What's Improved

**Before**:
- Mismatched styling
- Inconsistent layout
- Different colors/fonts

**After**:
- ✅ Matches print route exactly
- ✅ Correct colors and styling
- ✅ Proper logo rendering
- ✅ A4 portrait format

### Technical Notes

- **No Server Required**: Works with static-only deployment
- **Multi-Page Support**: Handles reports with >15 subjects
- **Image Preloading**: Ensures school logo is included
- **Better Timing**: More reliable rendering

---

## For Developers

### Implementation Details

**Print Route Component**: `src/components/PublicReportPrintView.tsx`

**Shared Renderer**: `src/components/reports/ReportCardPrintRenderer.tsx`

**Key Features**:
- Token-based access (no auth required)
- Uses `UnifiedReportCard` component
- Applies print CSS automatically
- A4 portrait optimized

### Testing

Run print route tests:
```bash
npm run test:unit
# or specifically:
npx tsc tests/publicReportPrintRouting.test.ts && node build-tests/tests/publicReportPrintRouting.test.js
```

### Routing Logic

```typescript
// In App.tsx
if (pathname.startsWith('/report/')) {
    const isPrintRoute = pathname.includes('/print');
    
    if (isPrintRoute) {
        return <PublicReportPrintView />;
    } else {
        return <PublicReportView />;
    }
}
```

### CSS Classes

Apply these classes for print optimization:
- `.report-print-root` - Main container
- `.page-break-avoid` - Keep element together
- `.page-break-before` - Force page break before
- `.no-print` - Hide in print mode

### Customization

**Print Styles**: Edit `src/styles/report-card.print.css`

**A4 Sizing**: Already configured, no changes needed

**Margins**: Default 15mm, adjust in CSS:
```css
@page {
    size: A4 portrait;
    margin: 15mm; /* Adjust as needed */
}
```

---

## Troubleshooting

### Issue: Print route shows "Invalid Link"
**Solution**: Check that the token is in the URL and is valid

### Issue: Logo not appearing
**Solution**: 
1. Verify logo URL is accessible
2. Check CORS settings for the logo URL
3. Ensure logo file exists and is not deleted

### Issue: Layout looks different from expected
**Solution**:
1. Hard refresh the page (Ctrl+Shift+R)
2. Clear browser cache
3. Check that CSS files are loaded (inspect network tab)

### Issue: Multi-page report is truncated
**Solution**: This is a known limitation of html2canvas. The system splits reports with >15 subjects into multiple pages automatically.

### Issue: Colors don't print correctly
**Solution**: 
1. Enable "Background graphics" in print settings
2. Use Chrome or Firefox (best support)
3. Check printer settings allow color

---

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 90+     | ✅ Full support |
| Firefox | 88+     | ✅ Full support |
| Safari  | 14+     | ⚠️ Some CSS limitations |
| Edge    | 90+     | ✅ Full support |

---

## FAQ

**Q: Can I customize the print layout?**
A: Yes, edit `src/components/reports/UnifiedReportCard.tsx` and print CSS files.

**Q: Does it work on mobile?**
A: Yes, but desktop browsers have better print support.

**Q: Can I add a watermark?**
A: Yes, the system supports DRAFT/FINAL/NONE watermarks. Edit in the bulk generator.

**Q: How do I share print links with parents?**
A: Share the regular report URL. Parents can add `/print` themselves if they want the print view.

**Q: Does this require internet?**
A: Yes, it needs to fetch report data from the database.

**Q: Can I generate PDFs programmatically?**
A: Currently, PDFs are generated through the bulk generator UI. API support could be added in the future.

---

## Links

- [Full Implementation Guide](./PRINT_ROUTE_IMPLEMENTATION.md)
- [Bulk Generator Guide](./BULK_REPORT_CARD_GENERATOR_GUIDE.md)
- [Print CSS Reference](./src/styles/report-card.print.css)

---

**Last Updated**: December 2024
