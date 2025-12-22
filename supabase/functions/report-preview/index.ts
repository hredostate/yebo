// Supabase Edge Function for generating dynamic Open Graph meta tags for report card preview
// This enables proper WhatsApp/social media previews with student name, term, and school info

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract token from URL path
    // Format can be: /report-preview/<token> or /report-preview/<token>/<slug>
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(p => p); // Remove empty parts
    // Find 'report-preview' and take the next part as token
    const previewIndex = pathParts.indexOf('report-preview');
    if (previewIndex === -1 || previewIndex >= pathParts.length - 1) {
      return new Response('Token not provided', { status: 400 });
    }
    
    const token = pathParts[previewIndex + 1];

    if (!token) {
      return new Response('Token not provided', { status: 400 });
    }

    // Sanitize token (remove any trailing characters like :1, query params, etc.)
    const cleanToken = token.split(/[?:#]/)[0].trim();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch report data
    const { data: report, error: reportError } = await supabase
      .from('student_term_reports')
      .select(`
        *,
        student:students!student_id (
          id,
          name,
          school_id
        ),
        term:terms!term_id (
          id,
          term_label,
          session_label
        ),
        academic_class:academic_classes!academic_class_id (
          id,
          name
        )
      `)
      .eq('public_token', cleanToken)
      .maybeSingle();

    if (reportError || !report) {
      return new Response('Report not found', { status: 404 });
    }

    // Check if token is expired
    if (report.token_expires_at) {
      const expiryDate = new Date(report.token_expires_at);
      if (expiryDate < new Date()) {
        return new Response('Link expired', { status: 410 });
      }
    }

    // Get school info for logo
    const student = Array.isArray(report.student) ? report.student[0] : report.student;
    const term = Array.isArray(report.term) ? report.term[0] : report.term;
    const academicClass = Array.isArray(report.academic_class) ? report.academic_class[0] : report.academic_class;

    let schoolLogo = 'https://tyvufbldcucgmmlattct.supabase.co/storage/v1/object/public/Images/imageedit_1_5058819643%20(1).png';
    let schoolName = 'School Guardian 360';

    if (student?.school_id) {
      const { data: schoolConfig } = await supabase
        .from('school_config')
        .select('logo_url, display_name')
        .eq('school_id', student.school_id)
        .maybeSingle();
      
      if (schoolConfig) {
        if (schoolConfig.logo_url) schoolLogo = schoolConfig.logo_url;
        if (schoolConfig.display_name) schoolName = schoolConfig.display_name;
      }
    }

    // Generate student slug for canonical URL
    const createStudentSlug = (name: string): string => {
      return name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-|-$/g, '');
    };

    const studentSlug = student?.name ? createStudentSlug(student.name) : '';

    // Generate dynamic meta tags
    const title = `Report Card for ${student?.name || 'Student'} - ${term?.term_label || 'Term'} ${term?.session_label || ''}`;
    const description = `${schoolName} - ${academicClass?.name || 'Academic'} Report Card`;
    const reportUrl = `${url.origin}/report/${cleanToken}${studentSlug ? '/' + studentSlug : ''}`;

    // Generate HTML with meta tags
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${title}</title>
  <meta name="title" content="${title}">
  <meta name="description" content="${description}">
  
  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${reportUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${schoolLogo}">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:site_name" content="${schoolName}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${reportUrl}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${schoolLogo}">
  
  <!-- Redirect to actual report page -->
  <meta http-equiv="refresh" content="0; url=${reportUrl}">
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .logo {
      width: 120px;
      height: 120px;
      margin: 0 auto 1.5rem;
      border-radius: 20px;
      background: white;
      padding: 1rem;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    h1 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    p {
      font-size: 1.125rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <img src="${schoolLogo}" alt="${schoolName}">
    </div>
    <h1>${title}</h1>
    <p>${description}</p>
    <div class="spinner"></div>
    <p style="font-size: 0.875rem; margin-top: 2rem;">Redirecting to report card...</p>
  </div>
  
  <script>
    // Fallback redirect if meta refresh doesn't work
    setTimeout(() => {
      window.location.href = '${reportUrl}';
    }, 100);
  </script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });

  } catch (error) {
    console.error('Error generating preview:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
