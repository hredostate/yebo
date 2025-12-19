
import { useState, useEffect, useCallback } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { SmsBalance } from '../types';

export const useSmsBalance = () => {
  const [balanceData, setBalanceData] = useState<SmsBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    try {
      const supabase = requireSupabaseClient();
      
      // Don't show loader for background refetches
      if (!balanceData) {
          setLoading(true);
      }
      setError(null);

      const { data, error: invokeError } = await supabase.functions.invoke('sms-balance');

      if (invokeError) {
        throw invokeError;
      }
      
      if (!data.ok) {
        setError(data.friendlyMessage || 'Failed to fetch SMS balance.');
      }
      setBalanceData(data);

    } catch (e: any) {
      console.error("Error fetching SMS balance:", e);
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }, [balanceData]);

  useEffect(() => {
    // Fetch immediately on mount
    fetchBalance();

    // Then refetch every 10 minutes
    const intervalId = setInterval(fetchBalance, 10 * 60 * 1000); // 600,000 ms

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [fetchBalance]);

  return {
    loading,
    error: error || (balanceData && !balanceData.ok ? balanceData.friendlyMessage : null),
    balanceFormatted: balanceData?.balanceFormatted || null,
    friendlyMessage: balanceData?.friendlyMessage || null,
  };
};
