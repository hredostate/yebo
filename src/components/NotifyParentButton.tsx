import React, { useState } from 'react';
import { sendWhatsAppNotification, wasRecentlyNotified } from '../services/whatsappService';
import Spinner from './common/Spinner';
import { BellIcon, CheckCircleIcon, XCircleIcon } from './common/icons';

interface NotifyParentButtonProps {
    studentId: number;
    studentName: string;
    parentPhone: string;
    templateName: string;
    notificationType: 'homework_reminder' | 'homework_missing' | 'notes_incomplete' | 'lesson_published';
    variables: Record<string, string>;
    referenceId?: number;
    schoolId: number;
    userId: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

const NotifyParentButton: React.FC<NotifyParentButtonProps> = ({
    studentId,
    studentName,
    parentPhone,
    templateName,
    notificationType,
    variables,
    referenceId,
    schoolId,
    userId,
    onSuccess,
    onError
}) => {
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleNotify = async () => {
        if (!parentPhone) {
            setStatus('error');
            if (onError) onError('No parent phone number available');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }

        // Check if recently notified
        const recentlyNotified = await wasRecentlyNotified(studentId, notificationType, 60);
        if (recentlyNotified) {
            setStatus('error');
            if (onError) onError('Parent was notified in the last hour');
            setTimeout(() => setStatus('idle'), 3000);
            return;
        }

        setSending(true);
        try {
            const success = await sendWhatsAppNotification({
                schoolId,
                studentId,
                recipientPhone: parentPhone,
                templateName,
                variables: {
                    student_name: studentName,
                    ...variables
                },
                referenceId,
                notificationType,
                sentBy: userId
            });

            if (success) {
                setStatus('success');
                if (onSuccess) onSuccess();
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
                if (onError) onError('Failed to send notification');
                setTimeout(() => setStatus('idle'), 3000);
            }
        } catch (error) {
            console.error('Error sending notification:', error);
            setStatus('error');
            if (onError) onError('Failed to send notification');
            setTimeout(() => setStatus('idle'), 3000);
        } finally {
            setSending(false);
        }
    };

    const getButtonContent = () => {
        if (sending) {
            return (
                <>
                    <Spinner size="xs" />
                    Sending...
                </>
            );
        }

        if (status === 'success') {
            return (
                <>
                    <CheckCircleIcon className="h-4 w-4" />
                    Sent
                </>
            );
        }

        if (status === 'error') {
            return (
                <>
                    <XCircleIcon className="h-4 w-4" />
                    Failed
                </>
            );
        }

        return (
            <>
                <BellIcon className="h-4 w-4" />
                Notify Parent
            </>
        );
    };

    const getButtonClass = () => {
        const baseClass = "flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50";
        
        if (status === 'success') {
            return `${baseClass} bg-green-500 text-white`;
        }
        
        if (status === 'error') {
            return `${baseClass} bg-red-500 text-white`;
        }
        
        return `${baseClass} bg-blue-500 hover:bg-blue-600 text-white`;
    };

    return (
        <button
            onClick={handleNotify}
            disabled={sending || status !== 'idle'}
            className={getButtonClass()}
            title={`Send WhatsApp notification to parent via ${parentPhone}`}
        >
            {getButtonContent()}
        </button>
    );
};

export default NotifyParentButton;
