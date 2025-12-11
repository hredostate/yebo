

import { supa, Offline } from '../offline/client';
import type { TeacherCheckin, TeacherCheckinStatus, TeacherMood, WeeklyCheckinRow } from '../types';

export async function checkInToday(
  payload: {
    is_remote: boolean;
    mood?: TeacherMood | null;
    energy?: number | null;
    notes?: string | null;
    geo_lat?: number | null;
    geo_lng?: number | null;
    photo_url?: string | null;
    campus_id?: number | null;
  }
): Promise<{ data: TeacherCheckin | null; error: string | null; offlineQueued?: boolean }> {
  try {
    const rpcArgs = {
      p_is_remote: payload.is_remote,
      p_mood: payload.mood ?? null,
      p_energy: payload.energy ?? null,
      p_notes: payload.notes ?? null,
      p_geo_lat: payload.geo_lat ?? null,
      p_geo_lng: payload.geo_lng ?? null,
      p_photo_url: payload.photo_url ?? null,
      p_campus_id: payload.campus_id ?? null,
    };

    const result = await Offline.rpc('teacher_check_in', rpcArgs);

    if (result && 'offlineQueued' in result && result.offlineQueued) {
      return { data: null, error: null, offlineQueued: true };
    }

    const { data, error } = result;

    if (error) {
      return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e.message ?? 'Unknown error' };
  }
}

export async function checkOutToday(
  notes: string | null
): Promise<{ data: TeacherCheckin | null; error: string | null; offlineQueued?: boolean }> {
  try {
    const rpcArgs = { p_notes: notes };
    const result = await Offline.rpc('teacher_check_out', rpcArgs);
    
    if (result && 'offlineQueued' in result && result.offlineQueued) {
        return { data: null, error: null, offlineQueued: true };
    }

    const { data, error } = result;

    if (error) {
        return { data: null, error: error.message };
    }
    return { data, error: null };
  } catch (e: any) {
      return { data: null, error: e.message ?? 'Unknown error' };
  }
}


export async function fetchMyCheckins(
  teacherId: string,
  opts?: { from?: string; to?: string; limit?: number }
): Promise<{ data: TeacherCheckin[]; error: string | null }> {
  try {
    let q = supa.from('teacher_checkins').select('*').eq('teacher_id', teacherId).order('checkin_date', { ascending: false });
    if (opts?.from) q = q.gte('checkin_date', opts.from);
    if (opts?.to) q = q.lte('checkin_date', opts.to);
    if (opts?.limit) q = q.limit(opts.limit);

    const { data, error } = await q;
    if (error) return { data: [], error: error.message };
    return { data: data as TeacherCheckin[], error: null };
  } catch (e: any) {
    return { data: [], error: e.message ?? 'Unknown error' };
  }
}

export async function fetchWeeklyForSchool(
  schoolId: number,
  weekStartISO: string
): Promise<{ data: WeeklyCheckinRow[]; error: string | null }> {
  try {
    const { data, error } = await (supa.rpc as any)('teacher_checkin_weekly', {
      p_school_id: schoolId,
      p_week_start: weekStartISO,
    });
    if (error) return { data: [], error: error.message };
    return { data: data as WeeklyCheckinRow[], error: null };
  } catch (e: any) {
    return { data: [], error: e.message ?? 'Unknown error' };
  }
}

export async function uploadCheckinPhoto(file: File, pathHint: string) {
    const filePath = `${pathHint}/${Date.now()}_${file.name}`;
    const result = await Offline.upload('report_images', filePath, file, {
        cacheControl: '3600',
        upsert: false,
    });
    
    if (result && 'offlineQueued' in result) {
        // Can't get public URL when offline
        return { publicUrl: null, path: filePath, offline: true };
    }
    
    if (result.error) {
        console.error('Upload error:', result.error.message);
        return null;
    }
    
    // Get public URL for online success
    const { data } = supa.storage.from('report_images').getPublicUrl(filePath);
    return { publicUrl: data.publicUrl, path: filePath };
}


export function todayISO(): string {
  const d = new Date();
  // Adjust for timezone offset to get the correct local date
  const tzOffset = d.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
  return localISOTime;
}