import React, { useState, useEffect } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { DedicatedVirtualAccount } from '../types';
import Spinner from './common/Spinner';

interface StudentWalletWidgetProps {
    studentRecordId: number;
}

const StudentWalletWidget: React.FC<StudentWalletWidgetProps> = ({ studentRecordId }) => {
    const [dva, setDva] = useState<DedicatedVirtualAccount | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDVA();
    }, [studentRecordId]);

    const loadDVA = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('dedicated_virtual_accounts')
                .select('*')
                .eq('student_id', studentRecordId)
                .eq('active', true)
                .maybeSingle();

            if (error) {
                console.error('Error fetching DVA:', error);
            } else {
                setDva(data);
            }
        } catch (error) {
            console.error('Error loading DVA:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex justify-center items-center py-8">
                    <Spinner size="md" />
                </div>
            </div>
        );
    }

    if (!dva) {
        return (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="text-center py-8">
                    <div className="text-4xl mb-4">🏦</div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
                        My Payment Wallet
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                        No virtual account set up yet. Contact your school accountant.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg text-white">
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-blue-100 text-sm font-medium">My Payment Wallet</p>
                    <h3 className="text-2xl font-bold mt-1">Virtual Account</h3>
                </div>
                <div className="bg-white/20 rounded-lg p-2">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/>
                        <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/>
                    </svg>
                </div>
            </div>
            
            <div className="space-y-3">
                <div>
                    <p className="text-blue-100 text-xs font-medium mb-1">Account Number</p>
                    <p className="text-3xl font-mono font-bold tracking-wider">{dva.account_number}</p>
                </div>
                
                <div>
                    <p className="text-blue-100 text-xs font-medium mb-1">Bank Name</p>
                    <p className="text-lg font-semibold">{dva.bank_name}</p>
                </div>
                
                <div>
                    <p className="text-blue-100 text-xs font-medium mb-1">Account Name</p>
                    <p className="text-sm font-medium">{dva.account_name}</p>
                </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/20">
                <div className="flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    <span className="text-blue-50">Active & Ready for Payments</span>
                </div>
            </div>

            <div className="mt-4 p-3 bg-white/10 rounded-lg text-xs text-blue-50">
                <p className="font-semibold mb-1">💡 How to pay:</p>
                <p>Transfer your school fees to this account number from any bank. Payments are automatically tracked.</p>
            </div>
        </div>
    );
};

export default StudentWalletWidget;
