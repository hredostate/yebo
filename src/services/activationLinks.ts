import { requireSupabaseClient } from './supabaseClient';

export interface ActivationLinkRequest {
  studentIds: number[];
  expiryHours?: number;
  phoneField?: 'parent_phone_number_1' | 'parent_phone_number_2' | 'student_phone';
  template?: string;
}

export interface ActivationLinkResult {
  student_id: number;
  status: 'created' | 'error' | 'skipped';
  activation_link?: string;
  expires_at?: string;
  student_name?: string;
  admission_number?: string;
  class_name?: string | null;
  arm_name?: string | null;
  phone_1?: string | null;
  phone_2?: string | null;
  student_phone?: string | null;
  username?: string;
  error?: string;
}

export async function generateActivationLinks(request: ActivationLinkRequest) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('activation-links', {
    body: {
      action: 'generate',
      student_ids: request.studentIds,
      expiry_hours: request.expiryHours ?? 72,
      recipient_phone_field: request.phoneField || 'parent_phone_number_1',
      template: request.template,
    },
  });

  if (error) throw error;
  return data as { success: boolean; results: ActivationLinkResult[]; expires_at: string };
}

export async function activateAccountWithToken(token: string, newPassword: string) {
  const supabase = requireSupabaseClient();
  const { data, error } = await supabase.functions.invoke('activation-links', {
    body: {
      action: 'activate',
      token,
      new_password: newPassword,
    },
  });

  if (error) throw error;
  return data as { success: boolean; error?: string };
}
