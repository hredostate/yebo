import React, { useState } from 'react';
import { bulkSendWhatsAppNotifications } from '../services/whatsappService';
import type { Student } from '../types';
import Spinner from './common/Spinner';
import { BellIcon, CheckCircleIcon, XCircleIcon } from './common/icons';

interface BulkNotifyButtonProps {
    students: Student[];
    templateName: string;
    notificationType: 'homework_reminder' | 'homework_missing' | 'notes_incomplete' | 'lesson_published';
    getVariables: (student: Student) => Record<string, string>;
    referenceId?: number;
    schoolId: number;
    userId: string;
    onComplete?: (sent: number, failed: number) => void;
    filterCondition?: (student: Student) => boolean;
}

const BulkNotifyButton: React.FC<BulkNotifyButtonProps> = ({
    students,
    templateName,
    notificationType,
    getVariables,
    referenceId,
    schoolId,
    userId,
    onComplete,
    filterCondition
}) => {
    const [sending, setSending] = useState(false);
    const [progress, setProgress] = useState({ sent: 0, total: 0 });
    const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

    const handleBulkNotify = async () => {
        // Filter students who have parent phone numbers and meet condition
        const eligibleStudents = students.filter(s => {
            if (!s.parent_phone_number_1) return false;
            if (filterCondition && !filterCondition(s)) return false;
            return true;
        });

        if (eligibleStudents.length === 0) {
            alert('No eligible students to notify');
            return;
        }

        const confirmed = window.confirm(
            `Send WhatsApp notifications to ${eligibleStudents.length} parent(s)?`
        );

        if (!confirmed) return;

        setSending(true);
        setProgress({ sent: 0, total: eligibleStudents.length });
        setResult(null);

        try {
            const notifications = eligibleStudents.map(student => ({
                schoolId,
                studentId: student.id,
                recipientPhone: student.parent_phone_number_1!,
                templateName,
                variables: {
                    student_name: student.name,
                    ...getVariables(student)
                },
                referenceId,
                notificationType,
                sentBy: userId
            }));

            // Send in batches with progress tracking
            const batchSize = 10;
            let totalSent = 0;
            let totalFailed = 0;

            for (let i = 0; i < notifications.length; i += batchSize) {
                const batch = notifications.slice(i, i + batchSize);
                const batchResult = await bulkSendWhatsAppNotifications(batch);
                
                totalSent += batchResult.sent;
                totalFailed += batchResult.failed;
                
                setProgress({ sent: totalSent + totalFailed, total: notifications.length });
            }

            setResult({ sent: totalSent, failed: totalFailed });
            
            if (onComplete) {
                onComplete(totalSent, totalFailed);
            }

            setTimeout(() => {
                setResult(null);
            }, 5000);
        } catch (error) {
            console.error('Error sending bulk notifications:', error);
            alert('Failed to send notifications. Please try again.');
        } finally {
            setSending(false);
        }
    };

    const getButtonContent = () => {
        if (sending) {
            return (
                <>
                    <Spinner size="xs" />
                    Sending {progress.sent}/{progress.total}...
                </>
            );
        }

        if (result) {
            if (result.failed === 0) {
                return (
                    <>
                        <CheckCircleIcon className="h-4 w-4" />
                        Sent to {result.sent} parent(s)
                    </>
                );
            }
            return (
                <>
                    <XCircleIcon className="h-4 w-4" />
                    Sent: {result.sent}, Failed: {result.failed}
                </>
            );
        }

        const count = students.filter(s => {
            if (!s.parent_phone_number_1) return false;
            if (filterCondition && !filterCondition(s)) return false;
            return true;
        }).length;

        return (
            <>
                <BellIcon className="h-4 w-4" />
                Notify All Parents ({count})
            </>
        );
    };

    const getButtonClass = () => {
        const baseClass = "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50";
        
        if (result) {
            if (result.failed === 0) {
                return `${baseClass} bg-green-500 text-white`;
            }
            return `${baseClass} bg-yellow-500 text-white`;
        }
        
        return `${baseClass} bg-blue-500 hover:bg-blue-600 text-white`;
    };

    return (
        <button
            onClick={handleBulkNotify}
            disabled={sending}
            className={getButtonClass()}
        >
            {getButtonContent()}
        </button>
    );
};

export default BulkNotifyButton;
