// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequestBody {
  action: 'generate' | 'activate' | string;
  student_ids?: number[];
  expiry_hours?: number;
  recipient_phone_field?: string;
  template?: string;
  token?: string;
  new_password?: string;
}

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

async function getCurrentUser(supabase: any, req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  return user;
}

function isAllowedRole(role: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase();
  return normalized.includes('super_admin') || normalized.includes('school_admin') || normalized === 'admin' || normalized === 'principal';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = requireEnv('SUPABASE_URL');
    const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const appUrl = Deno.env.get('APP_URL') || `${supabaseUrl.replace(/\/$/, '')}`;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });

    let body: GenerateRequestBody;
    try {
      body = (await req.json()) as GenerateRequestBody;
    } catch (_e) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const user = await getCurrentUser(supabaseAdmin, req);
    const { data: profile, error: profileError } = user
      ? await supabaseAdmin
          .from('profiles')
          .select('id, role, school_id')
          .eq('id', user.id)
          .maybeSingle()
      : { data: null, error: null } as any;

    if (body.action !== 'activate') {
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      if (profileError || !profile) {
        return new Response(JSON.stringify({ success: false, error: 'Profile not found for user' }), { status: 403, headers: corsHeaders });
      }

      if (!isAllowedRole(profile.role)) {
        return new Response(JSON.stringify({ success: false, error: 'Insufficient permissions' }), {
          status: 403,
          headers: corsHeaders,
        });
      }
    }

    if (body.action === 'generate') {
      const studentIds = body.student_ids || [];
      const expiryHours = body.expiry_hours && body.expiry_hours > 0 ? body.expiry_hours : 72;
      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return new Response(JSON.stringify({ success: false, error: 'student_ids required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
      const results: any[] = [];

      for (const studentId of studentIds) {
        const { data: student, error: studentError } = await supabaseAdmin
          .from('students')
          .select('id, name, admission_number, class:class_id(name), arm:arm_id(name), school_id, user_id, parent_phone_number_1, parent_phone_number_2, phone')
          .eq('id', studentId)
          .maybeSingle();

        if (studentError || !student) {
          results.push({ student_id: studentId, status: 'error', error: 'Student not found' });
          continue;
        }

        if (student.school_id !== profile.school_id) {
          results.push({ student_id: studentId, status: 'skipped', error: 'Cross-school access denied' });
          continue;
        }

        // Invalidate previous tokens
        await supabaseAdmin
          .from('account_activation_tokens')
          .update({ used_at: new Date().toISOString() })
          .eq('student_id', studentId)
          .is('used_at', null);

        const rawToken = generateRawToken();
        const tokenHash = await hashToken(rawToken);

        const { error: insertError, data: tokenRow } = await supabaseAdmin
          .from('account_activation_tokens')
          .insert({
            student_id: studentId,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            created_by: profile.id,
          })
          .select('id, expires_at')
          .maybeSingle();

        if (insertError || !tokenRow) {
          results.push({ student_id: studentId, status: 'error', error: insertError?.message || 'Unable to create token' });
          continue;
        }

        const activationLink = `${appUrl.replace(/\/$/, '')}/activate?token=${rawToken}`;
        results.push({
          student_id: studentId,
          status: 'created',
          activation_link: activationLink,
          expires_at: tokenRow.expires_at,
          student_name: student.name,
          admission_number: student.admission_number,
          class_name: (student as any).class?.name || null,
          arm_name: (student as any).arm?.name || null,
          phone_1: student.parent_phone_number_1,
          phone_2: student.parent_phone_number_2,
          student_phone: student.phone,
        });
      }

      // Audit log
      if (profile) {
        await supabaseAdmin.from('audit_log').insert({
          school_id: profile.school_id,
          actor_user_id: profile.id,
          action: 'activation_links_generated',
          details: { count: results.filter((r) => r.status === 'created').length, expiry_hours: expiryHours, phone_field: body.recipient_phone_field || 'parent_phone_number_1' },
        });
      }

      return new Response(
        JSON.stringify({ success: true, results, expires_at: expiresAt.toISOString() }),
        { status: 200, headers: corsHeaders },
      );
    }

    if (body.action === 'activate') {
      if (!body.token || !body.new_password) {
        return new Response(JSON.stringify({ success: false, error: 'token and new_password required' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const tokenHash = await hashToken(body.token);
      const nowIso = new Date().toISOString();
      const { data: tokenRow, error: tokenError } = await supabaseAdmin
        .from('account_activation_tokens')
        .select('id, student_id, expires_at, used_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (tokenError || !tokenRow) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid or expired token' }), { status: 400, headers: corsHeaders });
      }

      if (tokenRow.used_at) {
        return new Response(JSON.stringify({ success: false, error: 'Token already used' }), { status: 400, headers: corsHeaders });
      }

      if (new Date(tokenRow.expires_at) < new Date()) {
        return new Response(JSON.stringify({ success: false, error: 'Token expired' }), { status: 400, headers: corsHeaders });
      }

      const { data: student, error: studentError } = await supabaseAdmin
        .from('students')
        .select('id, user_id, school_id')
        .eq('id', tokenRow.student_id)
        .maybeSingle();

      if (studentError || !student) {
        return new Response(JSON.stringify({ success: false, error: 'Student not found' }), { status: 404, headers: corsHeaders });
      }

      if (!student.user_id) {
        return new Response(JSON.stringify({ success: false, error: 'Student account missing' }), { status: 400, headers: corsHeaders });
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(student.user_id, {
        password: body.new_password,
        user_metadata: { must_change_password_on_first_login: false },
      });

      if (updateError) {
        return new Response(JSON.stringify({ success: false, error: updateError.message }), { status: 400, headers: corsHeaders });
      }

      await supabaseAdmin
        .from('account_activation_tokens')
        .update({ used_at: nowIso })
        .eq('id', tokenRow.id);

      await supabaseAdmin.from('audit_log').insert({
        school_id: student.school_id,
        actor_user_id: user?.id || null,
        action: 'activation_link_used',
        details: { student_id: student.id },
      });

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unsupported action' }), { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error('Activation link error', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
