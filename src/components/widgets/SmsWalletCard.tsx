
import React from 'react';
import { useSmsBalance } from '../../hooks/useSmsBalance';
import Spinner from '../common/Spinner';

const SmsWalletCard: React.FC = () => {
    const { loading, error, balanceFormatted } = useSmsBalance();

    return (
        <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-4 backdrop-blur-xl shadow-xl dark:border-slate-800/60 dark:bg-slate-900/40 col-span-1 flex flex-col justify-between">
            <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Termii Balance</h3>
                <div className="mt-4 text-center">
                    {loading && <div className="flex justify-center items-center h-16"><Spinner /></div>}
                    {error && <p className="text-red-600 dark:text-red-400 text-sm font-semibold">{error}</p>}
                    {!loading && !error && balanceFormatted && (
                        <p className="text-4xl font-bold text-slate-800 dark:text-white">{balanceFormatted}</p>
                    )}
                </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
                Used for WhatsApp notifications, payment receipts, attendance alerts, and fee reminders.
            </p>
        </div>
    );
}

export default SmsWalletCard;
