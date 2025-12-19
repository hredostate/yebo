import React, { useState } from 'react';
import Spinner from './common/Spinner';
import { MegaphoneIcon } from './common/icons';
import { requireSupabaseClient } from '../services/supabaseClient';

interface EmergencyBroadcastProps {
  onSendBroadcast: (title: string, message: string) => Promise<void>;
}

const EmergencyBroadcast: React.FC<EmergencyBroadcastProps> = ({ onSendBroadcast }) => {
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('Urgent School-Wide Alert');
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [sendToParents, setSendToParents] = useState(false);
  const [whatsappProgress, setWhatsappProgress] = useState<{ sent: number; total: number; errors: number } | null>(null);

  const handleSend = async () => {
    if (!message.trim() || !title.trim()) return;
    setShowConfirmation(false);
    setIsLoading(true);
    
    try {
      // Send to staff (existing functionality)
      await onSendBroadcast(title, message);
      
      // Send to parents via WhatsApp if checkbox is checked
      if (sendToParents) {
        await sendWhatsAppToParents();
      }
    } finally {
      setIsLoading(false);
      setMessage('');
      setSendToParents(false);
      setWhatsappProgress(null);
    }
  };

  const sendWhatsAppToParents = async () => {
    try {
      // Fetch all students with parent phone numbers
      const { data: students, error } = await supabase
        .from('students')
        .select('id, first_name, last_name, parent_phone_number_1')
        .not('parent_phone_number_1', 'is', null)
        .neq('parent_phone_number_1', '');

      if (error) {
        console.error('Error fetching students:', error);
        return;
      }

      if (!students || students.length === 0) {
        console.warn('No students with parent phone numbers found');
        return;
      }

      // Get unique phone numbers to avoid duplicates
      const uniquePhones = new Map<string, string>();
      students.forEach(student => {
        if (student.parent_phone_number_1) {
          const phone = student.parent_phone_number_1.trim();
          if (!uniquePhones.has(phone)) {
            uniquePhones.set(phone, `${student.first_name} ${student.last_name}`);
          }
        }
      });

      const totalParents = uniquePhones.size;
      let sentCount = 0;
      let errorCount = 0;

      setWhatsappProgress({ sent: 0, total: totalParents, errors: 0 });

      // Send SMS messages to each parent
      for (const [phoneNumber, studentName] of uniquePhones) {
        try {
          const smsMessage = `URGENT SCHOOL ALERT\n\n${title}\n\n${message}\n\nThis is an official emergency broadcast from the school. Please acknowledge receipt.`;

          const { error: sendError } = await supabase.functions.invoke('kudisms-send', {
            body: {
              phone_number: phoneNumber,
              message: smsMessage,
            }
          });

          if (sendError) {
            console.error(`Failed to send to ${phoneNumber}:`, sendError);
            errorCount++;
          } else {
            sentCount++;
          }
        } catch (err) {
          console.error(`Error sending to ${phoneNumber}:`, err);
          errorCount++;
        }

        // Update progress
        setWhatsappProgress({ sent: sentCount, total: totalParents, errors: errorCount });
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`WhatsApp broadcast complete: ${sentCount} sent, ${errorCount} errors out of ${totalParents} total`);
    } catch (error) {
      console.error('Error sending WhatsApp messages:', error);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center">
            <MegaphoneIcon className="w-8 h-8 mr-3 text-red-600"/>
            Emergency Broadcast
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">Send an urgent alert to all staff members. This should be used for critical information only.</p>
      </div>

      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 backdrop-blur-xl shadow-xl dark:border-red-500/40 dark:bg-red-900/20">
        <div className="space-y-4">
           <div>
              <label htmlFor="broadcast-title" className="block text-sm font-medium text-red-800 dark:text-red-200">Broadcast Title</label>
              <input 
                id="broadcast-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full p-2 bg-white/50 dark:bg-slate-800/50 border border-red-300/60 dark:border-red-700/60 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>
          <div>
            <label htmlFor="broadcast-message" className="block text-sm font-medium text-red-800 dark:text-red-200">Message</label>
            <textarea
              id="broadcast-message"
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Example: The school is now under lockdown. Please follow all safety protocols immediately."
              className="mt-1 w-full p-2 bg-white/50 dark:bg-slate-800/50 border border-red-300/60 dark:border-red-700/60 rounded-md focus:ring-red-500 focus:border-red-500"
            />
          </div>
          
          <div className="flex items-center space-x-2 p-3 bg-white/30 dark:bg-slate-800/30 rounded-md border border-red-300/40 dark:border-red-700/40">
            <input
              type="checkbox"
              id="send-to-parents"
              checked={sendToParents}
              onChange={(e) => setSendToParents(e.target.checked)}
              className="w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
            />
            <label htmlFor="send-to-parents" className="text-sm font-medium text-red-800 dark:text-red-200 cursor-pointer">
              Also send to parents via WhatsApp
            </label>
          </div>

          {whatsappProgress && (
            <div className="p-3 bg-white/40 dark:bg-slate-800/40 rounded-md border border-red-300/40 dark:border-red-700/40">
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-medium">WhatsApp Broadcast Progress:</p>
                <p className="mt-1">Sent: {whatsappProgress.sent} / {whatsappProgress.total}</p>
                {whatsappProgress.errors > 0 && (
                  <p className="text-red-600 dark:text-red-400">Errors: {whatsappProgress.errors}</p>
                )}
                <div className="w-full bg-red-200 dark:bg-red-900 rounded-full h-2 mt-2">
                  <div 
                    className="bg-red-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(whatsappProgress.sent / whatsappProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowConfirmation(true)}
            disabled={isLoading || !message.trim() || !title.trim()}
            className="w-full px-6 py-3 bg-red-600 text-white font-bold text-lg rounded-lg hover:bg-red-700 disabled:bg-red-400 flex items-center justify-center"
          >
            {isLoading ? <Spinner /> : 'SEND BROADCAST'}
          </button>
        </div>
      </div>
      
      {showConfirmation && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-lg max-w-sm w-full">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Are you absolutely sure?</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  This will send an alert to <strong className="text-red-600 dark:text-red-400">all staff members immediately</strong>
                  {sendToParents && <span> and <strong className="text-red-600 dark:text-red-400">all parents via WhatsApp</strong></span>}. 
                  This action cannot be undone.
                </p>
                <div className="flex justify-end space-x-3 mt-4">
                    <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 font-semibold rounded-md">Cancel</button>
                    <button onClick={handleSend} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md">Yes, Send Alert</button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default EmergencyBroadcast;
