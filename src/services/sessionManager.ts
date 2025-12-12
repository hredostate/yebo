import { supa as supabase } from '../offline/client';

export interface UserSession {
  id: string;
  user_id: string;
  device_info: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_active: string;
  session_token: string;
  is_active: boolean;
}

export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  fingerprint: string;
}

/**
 * Generate a simple device fingerprint based on available browser information
 */
function generateDeviceFingerprint(): string {
  const nav = window.navigator;
  const screen = window.screen;
  
  const components = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
  ];
  
  // Simple hash function
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Extract device information from user agent
 */
function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'Desktop';
  
  // Detect browser
  if (ua.indexOf('Firefox') > -1) {
    browser = 'Firefox';
  } else if (ua.indexOf('Chrome') > -1) {
    browser = 'Chrome';
  } else if (ua.indexOf('Safari') > -1) {
    browser = 'Safari';
  } else if (ua.indexOf('Edge') > -1) {
    browser = 'Edge';
  }
  
  // Detect OS
  if (ua.indexOf('Win') > -1) {
    os = 'Windows';
  } else if (ua.indexOf('Mac') > -1) {
    os = 'macOS';
  } else if (ua.indexOf('Linux') > -1) {
    os = 'Linux';
  } else if (ua.indexOf('Android') > -1) {
    os = 'Android';
    device = 'Mobile';
  } else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) {
    os = 'iOS';
    device = ua.indexOf('iPad') > -1 ? 'Tablet' : 'Mobile';
  }
  
  const fingerprint = generateDeviceFingerprint();
  
  return { browser, os, device, fingerprint };
}

/**
 * Get user's IP address (from a free API)
 */
async function getIPAddress(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip || null;
  } catch (error) {
    console.warn('Failed to fetch IP address:', error);
    return null;
  }
}

/**
 * Create a new session for the current user
 */
export async function createSession(userId: string): Promise<{ success: boolean; sessionToken?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Supabase client not initialized' };
  }
  
  try {
    const deviceInfo = getDeviceInfo();
    const ipAddress = await getIPAddress();
    const sessionToken = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const deviceInfoStr = `${deviceInfo.device} - ${deviceInfo.browser} on ${deviceInfo.os}`;
    
    const { error } = await supabase.from('user_sessions').insert({
      user_id: userId,
      device_info: deviceInfoStr,
      ip_address: ipAddress,
      user_agent: navigator.userAgent,
      session_token: sessionToken,
      is_active: true,
    });
    
    if (error) {
      console.error('Failed to create session:', error);
      return { success: false, error: error.message };
    }
    
    // Store session token in sessionStorage for heartbeat
    sessionStorage.setItem('yeo_session_token', sessionToken);
    
    return { success: true, sessionToken };
  } catch (error: any) {
    console.error('Error creating session:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update session heartbeat (last_active timestamp)
 */
export async function updateSessionHeartbeat(sessionToken?: string): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    const token = sessionToken || sessionStorage.getItem('yeo_session_token');
    if (!token) return false;
    
    const { error } = await supabase
      .from('user_sessions')
      .update({ last_active: new Date().toISOString() })
      .eq('session_token', token)
      .eq('is_active', true);
    
    if (error) {
      console.error('Failed to update heartbeat:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating heartbeat:', error);
    return false;
  }
}

/**
 * Get active session count for a user
 */
export async function getActiveSessionCount(userId: string): Promise<number> {
  if (!supabase) return 0;
  
  try {
    // Clean up expired sessions first
    await cleanupExpiredSessions(userId);
    
    const { count, error } = await supabase
      .from('user_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('last_active', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes
    
    if (error) {
      console.error('Failed to get session count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error getting session count:', error);
    return 0;
  }
}

/**
 * Get all active sessions for a user
 */
export async function getActiveSessions(userId: string): Promise<UserSession[]> {
  if (!supabase) return [];
  
  try {
    // Clean up expired sessions first
    await cleanupExpiredSessions(userId);
    
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .gte('last_active', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .order('last_active', { ascending: false });
    
    if (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error getting active sessions:', error);
    return [];
  }
}

/**
 * Clean up expired sessions (inactive for more than 5 minutes)
 */
async function cleanupExpiredSessions(userId: string): Promise<void> {
  if (!supabase) return;
  
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true)
      .lt('last_active', fiveMinutesAgo);
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

/**
 * Terminate a specific session
 */
export async function terminateSession(sessionToken: string): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    const { error } = await supabase
      .from('user_sessions')
      .update({ is_active: false })
      .eq('session_token', sessionToken);
    
    if (error) {
      console.error('Failed to terminate session:', error);
      return false;
    }
    
    // If this is the current session, clear it from sessionStorage
    if (sessionStorage.getItem('yeo_session_token') === sessionToken) {
      sessionStorage.removeItem('yeo_session_token');
    }
    
    return true;
  } catch (error) {
    console.error('Error terminating session:', error);
    return false;
  }
}

/**
 * Terminate the oldest active session for a user
 */
export async function terminateOldestSession(userId: string): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    const sessions = await getActiveSessions(userId);
    if (sessions.length === 0) return false;
    
    // Sort by created_at (oldest first)
    sessions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    return await terminateSession(sessions[0].session_token);
  } catch (error) {
    console.error('Error terminating oldest session:', error);
    return false;
  }
}

/**
 * Terminate current session (logout)
 */
export async function terminateCurrentSession(): Promise<boolean> {
  const token = sessionStorage.getItem('yeo_session_token');
  if (!token) return true; // No active session
  
  const result = await terminateSession(token);
  sessionStorage.removeItem('yeo_session_token');
  return result;
}

/**
 * Check if device limit is reached (max 2 devices)
 */
export async function isDeviceLimitReached(userId: string): Promise<{ limitReached: boolean; currentCount: number }> {
  const currentCount = await getActiveSessionCount(userId);
  return {
    limitReached: currentCount >= 2,
    currentCount,
  };
}
