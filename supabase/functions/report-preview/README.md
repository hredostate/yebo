# Report Preview Edge Function

## Purpose
This Supabase Edge Function generates dynamic Open Graph meta tags for report card links, enabling proper previews on WhatsApp and other social media platforms.

## Features
- Dynamic OG tags based on student name, term, and school info
- Automatic token validation and sanitization
- Expiry checking
- School logo integration
- Graceful redirect to the actual report page
- Caching for performance

## Deployment

### Prerequisites
- Supabase CLI installed: `npm install -g supabase`
- Logged into Supabase: `supabase login`
- Linked to your project: `supabase link --project-ref <your-project-ref>`

### Deploy the Function
```bash
supabase functions deploy report-preview
```

### Environment Variables Required
The function uses these environment variables (automatically available in Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access

## Usage

### Option 1: Direct Edge Function URL (Recommended for Social Media)
When sharing on WhatsApp/social media, use:
```
https://<your-project-ref>.supabase.co/functions/v1/report-preview/<token>
```

Example:
```
https://tyvufbldcucgmmlattct.supabase.co/functions/v1/report-preview/john-doe-123-1234567890-abc123
```

This URL will:
1. Display proper OG tags to social media crawlers
2. Show a loading page to users
3. Automatically redirect to the actual report page

### Option 2: Direct Report Link (Works but no custom preview)
```
https://www.schoolguardian360.com/report/<token>
```

This works but will show generic site meta tags on social media.

## Testing

### Test the Edge Function
```bash
# Local testing
supabase functions serve report-preview

# Test with curl
curl http://localhost:54321/functions/v1/report-preview/your-test-token
```

### Test WhatsApp Preview
1. Deploy the function
2. Generate a test report link
3. Use WhatsApp Web (https://web.whatsapp.com)
4. Send the edge function URL to yourself
5. Verify the preview shows student name and term info

## Implementation Notes

### Token Sanitization
The function automatically sanitizes tokens by removing:
- Query parameters (`?foo=bar`)
- Hash fragments (`#section`)
- Port numbers (`:1`)

### Caching
Responses are cached for 5 minutes (`Cache-Control: public, max-age=300`) to reduce database queries.

### Error Handling
- 400: Token not provided
- 404: Report not found
- 410: Link expired
- 500: Internal server error

## Integration with Report Generation

When generating report links in `StudentReportView.tsx`, you can provide both URLs:

```typescript
const directUrl = `${window.location.origin}/report/${publicToken}`;
const previewUrl = `https://<project-ref>.supabase.co/functions/v1/report-preview/${publicToken}`;

// Use previewUrl for SMS/WhatsApp messages
// Use directUrl for email or in-app sharing
```

## Maintenance

### Update Function
After making changes:
```bash
supabase functions deploy report-preview
```

### View Logs
```bash
supabase functions logs report-preview
```

### Monitor Performance
Check Supabase dashboard → Edge Functions → report-preview for:
- Invocation count
- Error rate
- Average response time
