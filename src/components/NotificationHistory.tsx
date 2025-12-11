import React, { useState, useEffect } from 'react';
import type { WhatsAppNotification, Student, UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import Spinner from './common/Spinner';
import { CheckCircleIcon, XCircleIcon, ClockIcon, BellIcon } from './common/icons';

interface NotificationHistoryProps {
    userProfile: UserProfile;
}

const NotificationHistory: React.FC<NotificationHistoryProps> = ({ userProfile }) => {
    const [notifications, setNotifications] = useState<(WhatsAppNotification & { student?: Student })[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');

    useEffect(() => {
        loadNotifications();
    }, [userProfile.school_id]);

    const loadNotifications = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('whatsapp_notifications')
                .select(`
                    *,
                    student:students(*)
                `)
                .eq('school_id', userProfile.school_id)
                .order('created_at', { ascending: false })
                .limit(100);

            // If not admin/principal, only show notifications sent by this user
            if (!['Admin', 'Principal'].includes(userProfile.role)) {
                query = query.eq('sent_by', userProfile.id);
            }

            const { data, error } = await query;

            if (error) throw error;
            setNotifications(data || []);
        } catch (error) {
            console.error('Error loading notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'sent':
            case 'delivered':
                return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
            case 'failed':
                return <XCircleIcon className="h-5 w-5 text-red-500" />;
            case 'pending':
                return <ClockIcon className="h-5 w-5 text-yellow-500" />;
            default:
                return <BellIcon className="h-5 w-5 text-slate-400" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const classes = "px-2 py-1 text-xs font-medium rounded-md";
        switch (status) {
            case 'sent':
            case 'delivered':
                return <span className={`${classes} bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300`}>Sent</span>;
            case 'failed':
                return <span className={`${classes} bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300`}>Failed</span>;
            case 'pending':
                return <span className={`${classes} bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300`}>Pending</span>;
            default:
                return <span className={`${classes} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400`}>{status}</span>;
        }
    };

    const getTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            homework_reminder: 'Homework Reminder',
            homework_missing: 'Homework Missing',
            notes_incomplete: 'Notes Incomplete',
            lesson_published: 'Lesson Published'
        };
        return labels[type] || type;
    };

    const filteredNotifications = notifications.filter(notif => {
        if (filterStatus !== 'all' && notif.status !== filterStatus) return false;
        if (filterType !== 'all' && notif.notification_type !== filterType) return false;
        return true;
    });

    const stats = {
        total: notifications.length,
        sent: notifications.filter(n => n.status === 'sent' || n.status === 'delivered').length,
        failed: notifications.filter(n => n.status === 'failed').length,
        pending: notifications.filter(n => n.status === 'pending').length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">
                Notification History
            </h1>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Total</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.total}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Sent</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.sent}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Failed</p>
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.failed}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                    <option value="all">All Statuses</option>
                    <option value="sent">Sent</option>
                    <option value="delivered">Delivered</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                </select>

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                >
                    <option value="all">All Types</option>
                    <option value="homework_reminder">Homework Reminder</option>
                    <option value="homework_missing">Homework Missing</option>
                    <option value="notes_incomplete">Notes Incomplete</option>
                    <option value="lesson_published">Lesson Published</option>
                </select>
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
                {filteredNotifications.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                        No notifications found
                    </div>
                ) : (
                    filteredNotifications.map(notif => (
                        <div
                            key={notif.id}
                            className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
                        >
                            <div className="flex items-start gap-4">
                                {getStatusIcon(notif.status)}
                                <div className="flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-white">
                                                {notif.student?.name}
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                {notif.recipient_phone} • {getTypeLabel(notif.notification_type)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {getStatusBadge(notif.status)}
                                            <span className="text-xs text-slate-500 dark:text-slate-400">
                                                {new Date(notif.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {notif.message_content && (
                                        <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg mt-2">
                                            {notif.message_content}
                                        </p>
                                    )}

                                    {notif.error_message && (
                                        <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                                            Error: {notif.error_message}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default NotificationHistory;
