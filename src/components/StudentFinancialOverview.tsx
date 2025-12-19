import React, { useEffect, useMemo, useState } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Payment, StudentInvoice, StudentProfile } from '../types';
import Spinner from './common/Spinner';
import { BanknotesIcon, ClipboardListIcon, DownloadIcon, FilterIcon, ShieldIcon } from './common/icons';
import StudentWalletWidget from './StudentWalletWidget';
import { VIEWS } from '../constants';

interface StudentFinancialOverviewProps {
  studentProfile: StudentProfile;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  onNavigate: (view: string) => void;
}

const cardBase = 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm';

const StudentFinancialOverview: React.FC<StudentFinancialOverviewProps> = ({ studentProfile, addToast, onNavigate }) => {
  const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadFinanceData = async () => {
      try {
        setIsLoading(true);
        const { data: invoiceData, error } = await supabase
          .from('student_invoices')
          .select('*, term:terms(term_label, session_label)')
          .eq('student_id', studentProfile.student_record_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const invoiceIds = invoiceData?.map((invoice) => invoice.id) || [];
        setInvoices(invoiceData || []);

        if (invoiceIds.length > 0) {
          const { data: paymentData, error: paymentError } = await supabase
            .from('payments')
            .select('*, invoice:student_invoices(invoice_number)')
            .in('invoice_id', invoiceIds)
            .order('payment_date', { ascending: false });

          if (paymentError) throw paymentError;
          setPayments(paymentData || []);
        } else {
          setPayments([]);
        }
      } catch (err: any) {
        console.error('Failed to load finance data', err);
        addToast('Unable to load your finance details right now.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    if (studentProfile.student_record_id) {
      loadFinanceData();
    }
  }, [studentProfile.student_record_id, addToast]);

  const totals = useMemo(() => {
    const billed = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const paid = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
    const outstanding = Math.max(0, billed - paid);
    const dueSoon = invoices.filter((inv) => inv.status !== 'Paid').slice(0, 3);
    return { billed, paid, outstanding, dueSoon };
  }, [invoices]);

  const filteredPayments = useMemo(() => {
    if (!search) return payments.slice(0, 6);
    const term = search.toLowerCase();
    return payments
      .filter((p) =>
        (p.reference || '').toLowerCase().includes(term) ||
        (p.invoice?.invoice_number || '').toLowerCase().includes(term)
      )
      .slice(0, 10);
  }, [payments, search]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-6xl mx-auto animate-fade-in">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-indigo-500">Finances</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Wallet & Payments</h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">Keep track of balances, invoices, and receipts in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate(VIEWS.STUDENT_REPORTS)}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:translate-y-[-1px] transition-transform"
          >
            Download receipts
          </button>
          <button
            onClick={() => addToast('Fee payment portal coming soon', 'info')}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200 border border-indigo-100 dark:border-indigo-800"
          >
            Pay fees
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${cardBase} p-4 sm:p-5 flex flex-col gap-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Outstanding</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">₦{totals.outstanding.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-200">
              <ShieldIcon className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Sum of unpaid and partially paid invoices.</p>
        </div>
        <div className={`${cardBase} p-4 sm:p-5 flex flex-col gap-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Total Paid</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">₦{totals.paid.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-200">
              <BanknotesIcon className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Payments recorded against your invoices.</p>
        </div>
        <div className={`${cardBase} p-4 sm:p-5 flex flex-col gap-3`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Invoices</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{invoices.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-200">
              <ClipboardListIcon className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">Latest billing across sessions and terms.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className={`${cardBase} p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Fees & Invoices</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">Track what’s due and when to pay.</p>
              </div>
              <button
                onClick={() => onNavigate(VIEWS.STUDENT_DASHBOARD)}
                className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                See dashboard
              </button>
            </div>
            {invoices.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                <p className="text-slate-600 dark:text-slate-400">No invoices yet. You’ll see bills and fees here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice) => {
                  const balance = Math.max(0, (invoice.total_amount || 0) - (invoice.amount_paid || 0));
                  return (
                    <div key={invoice.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{invoice.invoice_number}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{invoice.term?.session_label} • {invoice.term?.term_label}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="text-right">
                          <p className="text-slate-500">Balance</p>
                          <p className="font-semibold text-slate-900 dark:text-white">₦{balance.toLocaleString()}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${invoice.status === 'Paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200'}`}>
                          {invoice.status}
                        </span>
                        {invoice.due_date && (
                          <span className="text-xs text-slate-500">Due {new Date(invoice.due_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${cardBase} p-4 sm:p-5`}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Payments</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Search references or receipts.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <FilterIcon className="w-4 h-4" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search payments"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
            {filteredPayments.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">No payments recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {filteredPayments.map((payment) => (
                  <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">₦{payment.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{payment.invoice?.invoice_number || 'Invoice'} • {new Date(payment.payment_date).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span className="px-2 py-1 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-700 dark:text-slate-200">{payment.payment_method}</span>
                      {payment.reference && <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">{payment.reference}</span>}
                      <button
                        onClick={() => addToast('Receipt download coming soon', 'info')}
                        className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-300 font-semibold"
                      >
                        <DownloadIcon className="w-4 h-4" />
                        Receipt
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${cardBase} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Wallet</h3>
              <button
                onClick={() => onNavigate(VIEWS.STUDENT_DASHBOARD)}
                className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 hover:underline"
              >
                View in dashboard
              </button>
            </div>
            <StudentWalletWidget studentRecordId={studentProfile.student_record_id} />
          </div>

          <div className={`${cardBase} p-4 sm:p-5`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Upcoming dues</h3>
            </div>
            {totals.dueSoon.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">You’re all caught up. No pending invoices.</p>
            ) : (
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {totals.dueSoon.map((inv) => (
                  <li key={inv.id} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3">
                    <div>
                      <p className="font-semibold">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-500">Due {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'soon'}</p>
                    </div>
                    <span className="text-sm font-semibold text-rose-600 dark:text-rose-300">₦{Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0)).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default StudentFinancialOverview;
