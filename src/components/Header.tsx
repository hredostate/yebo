
import React, { useState, useEffect } from 'react';
import type { UserProfile, Notification, StudentProfile } from '../types';
import NotificationsPopover from './NotificationsPopover';
import GlobalSearchBar from './GlobalSearchBar';
import { Offline } from '../offline/client';
import { count as getQueueCount } from '../offline/queue';
import Spinner from './common/Spinner';
import { SunIcon, MoonIcon } from './common/icons';
import { getActiveSessionCount } from '../services/sessionManager';

const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueLength, setQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(async () => {
      const count = await getQueueCount();
      setQueueLength(count);
    }, 5000); // Poll every 5 seconds

    getQueueCount().then(setQueueLength); // Initial check

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    await Offline.sync();
    const count = await getQueueCount();
    setQueueLength(count);
    setIsSyncing(false);
  };

  return { isOnline, queueLength, isSyncing, handleSync };
};

const useDeviceCounter = (userProfile: UserProfile | StudentProfile) => {
  const [deviceCount, setDeviceCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchDeviceCount = async () => {
      if (!userProfile?.id) return;
      
      setLoading(true);
      try {
        const count = await getActiveSessionCount(userProfile.id);
        if (isMounted) {
          setDeviceCount(count);
        }
      } catch (error) {
        console.error('Failed to fetch device count:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDeviceCount();

    // Poll every 30 seconds to keep count updated
    const interval = setInterval(fetchDeviceCount, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userProfile?.id]);

  return { deviceCount, loading };
};

interface HeaderProps {
  userProfile: UserProfile | StudentProfile;
  onLogout: () => void;
  notifications: Notification[];
  onMarkNotificationsAsRead: () => void;
  onNavigate: (view: string) => void;
  onToggleSidebar: () => void;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ userProfile, notifications, onMarkNotificationsAsRead, onNavigate, onToggleSidebar, isDarkMode, toggleTheme }) => {
  const { isOnline, queueLength, isSyncing, handleSync } = useOfflineStatus();
  const { deviceCount, loading: deviceLoading } = useDeviceCounter(userProfile);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  
  // Determine color based on device count
  const getDeviceCountColor = () => {
    if (deviceCount === 0) return 'text-slate-500 dark:text-slate-400';
    if (deviceCount === 1) return 'text-green-600 dark:text-green-400';
    if (deviceCount === 2) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <header className="flex-shrink-0 flex items-center justify-between h-16 sm:h-16 px-4 sm:px-6 border-b border-white/40 dark:border-slate-700/40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl shadow-sm z-30 transition-all duration-300">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <button 
            onClick={onToggleSidebar}
            className="touch-target -ml-2 text-slate-600 dark:text-slate-300 rounded-lg md:hidden hover:bg-white/50 dark:hover:bg-slate-800 transition-colors active:bg-slate-200 dark:active:bg-slate-700"
            aria-label="Open sidebar"
        >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
        <div className="flex-1 min-w-0">
          <GlobalSearchBar onNavigate={onNavigate} />
        </div>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0">
        <button onClick={toggleTheme} className="touch-target rounded-full text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800 transition-colors">
            {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
        </button>
        
        {/* Device Counter */}
        {!deviceLoading && deviceCount > 0 && (
          <div 
            className="hidden sm:flex items-center gap-2 rounded-full bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 shadow-sm transition-colors hover:bg-white dark:hover:bg-slate-800 cursor-help"
            title={`You are logged in on ${deviceCount} of 2 allowed devices`}
          >
            <svg className={`w-4 h-4 ${getDeviceCountColor()}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className={getDeviceCountColor()}>
              {deviceCount}/2 devices
            </span>
          </div>
        )}
        
        {(!isOnline || queueLength > 0) && (
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shadow-sm">
            <span className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-red-500' : 'bg-amber-500'} animate-pulse`}></span>
            {!isOnline ? `Offline • ${queueLength} pending` : `${queueLength} pending`}
          </div>
        )}
        
        {isOnline && queueLength > 0 && (
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 shadow-md shadow-blue-500/20 transition-all active:scale-95"
          >
            {isSyncing ? <Spinner size="sm" /> : 'Sync now'}
          </button>
        )}
        
        <div className="border-l border-slate-300 dark:border-slate-600 h-6 mx-2"></div>
        
        <NotificationsPopover 
          notifications={notifications}
          unreadCount={unreadCount}
          onMarkAsRead={onMarkNotificationsAsRead}
        />
      </div>
    </header>
  );
};

export default Header;
