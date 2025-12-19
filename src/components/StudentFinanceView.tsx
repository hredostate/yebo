
import React, { useState, useEffect, useMemo } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { Student, UserProfile, FeeItem, StudentInvoice, Term, BaseDataObject, Payment, InvoiceStatus } from '../types';
import Spinner from './common/Spinner';
import { BanknotesIcon, PlusCircleIcon, TrashIcon, EditIcon } from './common/icons';
import DVAManager from './DVAManager';
import FeesCsvManager from './FeesCsvManager';

// --- Sub-components ---

const InvoiceGenerator: React.FC<{
    students: Student[];
    terms: Term[];
    feeItems: FeeItem[];
    onGenerate: (studentIds: number[], termId: number, feeItemIds: number[], dueDate: string) => Promise<void>;
}> = ({ students, terms, feeItems, onGenerate }) => {
    const [selectedTerm, setSelectedTerm] = useState<string>('');
    const [dueDate, setDueDate] = useState('');
    const [selectedFees, setSelectedFees] = useState<Set<number>>(new Set());
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);

    const filteredStudents = useMemo(() => {
        if (!selectedClass) return [];
        return students.filter(s => s.class_id === Number(selectedClass));
    }, [students, selectedClass]);

    const handleGenerate = async () => {
        if (!selectedTerm || !dueDate || selectedFees.size === 0 || filteredStudents.length === 0) return;
        setIsGenerating(true);
        await onGenerate(filteredStudents.map(s => s.id), Number(selectedTerm), Array.from(selectedFees), dueDate);
        setIsGenerating(false);
    };

    // Get unique classes from students
    const classes = useMemo(() => {
        const uniqueClasses = new Map<number, string>();
        students.forEach(s => {
            if (s.class_id && s.class?.name) uniqueClasses.set(s.class_id, s.class.name);
        });
        return Array.from(uniqueClasses.entries()).map(([id, name]) => ({ id, name }));
    }, [students]);

    return (
        <div className="space-y-4">
            <h3 className="font-bold">Generate Invoices</h3>
            <div className="grid grid-cols-2 gap-4">
                <select value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)} className="p-2 border rounded w-full">
                    <option value="">Select Term</option>
                    {terms.map(t => <option key={t.id} value={t.id}>{t.session_label} - {t.term_label}</option>)}
                </select>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="p-2 border rounded w-full">
                    <option value="">Select Class</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="p-2 border rounded w-full" placeholder="Due Date" />
            </div>
            <div className="p-2 border rounded max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold mb-2">Select Fee Items</p>
                {feeItems.map(f => (
                    <label key={f.id} className="flex items-center gap-2 p-1 hover:bg-slate-50">
                        <input type="checkbox" checked={selectedFees.has(f.id)} onChange={() => {
                            const newSet = new Set(selectedFees);
                            if (newSet.has(f.id)) newSet.delete(f.id);
                            else newSet.add(f.id);
                            setSelectedFees(newSet);
                        }} />
                        <span className="text-sm">{f.name} - ₦{f.amount.toLocaleString()}</span>
                    </label>
                ))}
            </div>
            <button onClick={handleGenerate} disabled={isGenerating} className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-blue-400">
                {isGenerating ? <Spinner size="sm" /> : `Generate for ${filteredStudents.length} Students`}
            </button>
        </div>
    );
};

const PaymentRecorder: React.FC<{
    invoices: StudentInvoice[];
    onRecordPayment: (invoiceId: number, amount: number, method: string, reference: string) => Promise<void>;
}> = ({ invoices, onRecordPayment }) => {
    const [invoiceId, setInvoiceId] = useState<string>('');
    const [amount, setAmount] = useState<number>(0);
    const [method, setMethod] = useState('Cash');
    const [reference, setReference] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const selectedInvoice = invoices.find(i => i.id === Number(invoiceId));

    const handleRecord = async () => {
        if (!invoiceId || amount <= 0) return;
        setIsSaving(true);
        await onRecordPayment(Number(invoiceId), amount, method, reference);
        setIsSaving(false);
        setInvoiceId('');
        setAmount(0);
        setReference('');
    };

    return (
        <div className="space-y-4">
            <h3 className="font-bold">Record Payment</h3>
            <select value={invoiceId} onChange={e => setInvoiceId(e.target.value)} className="p-2 border rounded w-full">
                <option value="">Select Invoice (Unpaid/Partial)</option>
                {invoices.filter(i => i.status !== 'Paid').map(i => (
                    <option key={i.id} value={i.id}>{i.invoice_number} - {i.student?.name} (₦{(i.total_amount - i.amount_paid).toLocaleString()} due)</option>
                ))}
            </select>
            {selectedInvoice && (
                <div className="p-2 bg-slate-50 text-sm rounded border">
                    <p>Total: ₦{selectedInvoice.total_amount.toLocaleString()}</p>
                    <p>Paid: ₦{selectedInvoice.amount_paid.toLocaleString()}</p>
                    <p className="font-bold">Balance: ₦{(selectedInvoice.total_amount - selectedInvoice.amount_paid).toLocaleString()}</p>
                </div>
            )}
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} placeholder="Amount" className="p-2 border rounded w-full" />
            <div className="grid grid-cols-2 gap-4">
                <select value={method} onChange={e => setMethod(e.target.value)} className="p-2 border rounded w-full">
                    <option>Cash</option>
                    <option>Bank Transfer</option>
                    <option>POS</option>
                </select>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} placeholder="Ref / Receipt No" className="p-2 border rounded w-full" />
            </div>
            <button onClick={handleRecord} disabled={isSaving || !invoiceId} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg disabled:bg-green-400">
                {isSaving ? <Spinner size="sm" /> : 'Record Payment'}
            </button>
        </div>
    );
};

const FeeItemManager: React.FC<{
    feeItems: FeeItem[];
    classes: BaseDataObject[];
    terms: Term[];
    onSave: (item: Partial<FeeItem>) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}> = ({ feeItems, classes, terms, onSave, onDelete }) => {
    const [newItem, setNewItem] = useState<Partial<FeeItem>>({ 
        name: '', 
        amount: 0, 
        is_compulsory: true,
        allow_installments: false,
        installments: [],
        priority: 1
    });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showInstallmentEditor, setShowInstallmentEditor] = useState(false);
    const [editInstallments, setEditInstallments] = useState<Array<{ name: string; amount: number; due_date: string }>>([]);

    const handleSave = () => {
        if (!newItem.name || !newItem.amount) return;
        const itemToSave = { 
            ...newItem,
            installments: newItem.allow_installments ? editInstallments : []
        };
        onSave(itemToSave);
        setNewItem({ name: '', amount: 0, is_compulsory: true, allow_installments: false, installments: [], priority: 1 });
        setEditInstallments([]);
        setShowInstallmentEditor(false);
        setEditingId(null);
    };

    const handleEdit = (item: FeeItem) => {
        setEditingId(item.id);
        setNewItem(item);
        setEditInstallments(item.installments || []);
        setShowInstallmentEditor(item.allow_installments || false);
    };

    const addInstallment = () => {
        const totalInstallments = editInstallments.length;
        const remainingAmount = (newItem.amount || 0) - editInstallments.reduce((sum, i) => sum + i.amount, 0);
        setEditInstallments([
            ...editInstallments,
            { 
                name: `${totalInstallments + 1}${totalInstallments === 0 ? 'st' : totalInstallments === 1 ? 'nd' : totalInstallments === 2 ? 'rd' : 'th'} Installment`,
                amount: Math.max(0, remainingAmount),
                due_date: ''
            }
        ]);
    };

    const updateInstallment = (index: number, field: string, value: string | number) => {
        const updated = [...editInstallments];
        updated[index] = { ...updated[index], [field]: value };
        setEditInstallments(updated);
    };

    const removeInstallment = (index: number) => {
        setEditInstallments(editInstallments.filter((_, i) => i !== index));
    };

    const totalInstallmentAmount = editInstallments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
    const isInstallmentValid = !newItem.allow_installments || (editInstallments.length > 0 && totalInstallmentAmount === (newItem.amount || 0));

    return (
        <div className="space-y-4">
            <h3 className="font-bold">Manage Fee Items</h3>
            
            {/* Fee Item Form */}
            <div className="border p-4 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                        <label className="text-xs font-medium block mb-1">Fee Name *</label>
                        <input 
                            type="text" 
                            value={newItem.name} 
                            onChange={e => setNewItem({...newItem, name: e.target.value})} 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" 
                            placeholder="e.g., Tuition Fee"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1">Amount (₦) *</label>
                        <input 
                            type="number" 
                            value={newItem.amount} 
                            onChange={e => setNewItem({...newItem, amount: Number(e.target.value)})} 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" 
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium block mb-1">Priority</label>
                        <input 
                            type="number" 
                            min="1"
                            value={newItem.priority || 1} 
                            onChange={e => setNewItem({...newItem, priority: Number(e.target.value)})} 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" 
                            placeholder="1 = highest"
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={newItem.is_compulsory} 
                            onChange={e => setNewItem({...newItem, is_compulsory: e.target.checked})} 
                        />
                        <span className="text-sm">Compulsory Fee</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={newItem.allow_installments} 
                            onChange={e => {
                                setNewItem({...newItem, allow_installments: e.target.checked});
                                setShowInstallmentEditor(e.target.checked);
                                if (!e.target.checked) setEditInstallments([]);
                            }} 
                        />
                        <span className="text-sm">Allow Installments</span>
                    </label>
                </div>

                {/* Installment Editor */}
                {showInstallmentEditor && (
                    <div className="mt-4 p-4 bg-white dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-blue-700 dark:text-blue-400">Installment Schedule</h4>
                            <button 
                                onClick={addInstallment}
                                className="text-sm px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200"
                            >
                                + Add Installment
                            </button>
                        </div>
                        
                        {editInstallments.length === 0 ? (
                            <p className="text-sm text-slate-500 py-4 text-center">No installments defined. Click "Add Installment" to create payment schedule.</p>
                        ) : (
                            <div className="space-y-2">
                                {editInstallments.map((inst, idx) => (
                                    <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                                        <div className="col-span-4">
                                            <input 
                                                type="text"
                                                value={inst.name}
                                                onChange={e => updateInstallment(idx, 'name', e.target.value)}
                                                className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                                placeholder="Installment name"
                                            />
                                        </div>
                                        <div className="col-span-3">
                                            <input 
                                                type="number"
                                                value={inst.amount}
                                                onChange={e => updateInstallment(idx, 'amount', Number(e.target.value))}
                                                className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                                placeholder="Amount"
                                            />
                                        </div>
                                        <div className="col-span-4">
                                            <input 
                                                type="date"
                                                value={inst.due_date}
                                                onChange={e => updateInstallment(idx, 'due_date', e.target.value)}
                                                className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600"
                                            />
                                        </div>
                                        <div className="col-span-1 text-center">
                                            <button 
                                                onClick={() => removeInstallment(idx)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                
                                <div className={`text-sm p-2 rounded ${totalInstallmentAmount === (newItem.amount || 0) ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    Total: ₦{totalInstallmentAmount.toLocaleString()} / ₦{(newItem.amount || 0).toLocaleString()}
                                    {totalInstallmentAmount !== (newItem.amount || 0) && (
                                        <span className="ml-2">(Difference: ₦{Math.abs((newItem.amount || 0) - totalInstallmentAmount).toLocaleString()})</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-2">
                    <button 
                        onClick={handleSave} 
                        disabled={!isInstallmentValid}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                        {editingId ? 'Update Fee' : 'Add Fee'}
                    </button>
                    {editingId && (
                        <button 
                            onClick={() => {
                                setEditingId(null);
                                setNewItem({ name: '', amount: 0, is_compulsory: true, allow_installments: false, installments: [], priority: 1 });
                                setEditInstallments([]);
                                setShowInstallmentEditor(false);
                            }}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {/* Fee Items List */}
            <div className="space-y-2">
                {feeItems.length === 0 ? (
                    <p className="text-center py-8 text-slate-500">No fee items defined yet.</p>
                ) : feeItems.map(item => (
                    <div key={item.id} className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-lg">{item.name}</span>
                                    <span className="text-green-600 font-semibold">₦{item.amount.toLocaleString()}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded ${item.is_compulsory ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>
                                        {item.is_compulsory ? 'Compulsory' : 'Optional'}
                                    </span>
                                    {item.priority && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                            Priority: {item.priority}
                                        </span>
                                    )}
                                    {item.allow_installments && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                            Installments Allowed
                                        </span>
                                    )}
                                </div>
                                
                                {/* Show installments if any */}
                                {item.installments && item.installments.length > 0 && (
                                    <div className="mt-2 pl-4 border-l-2 border-blue-200">
                                        <p className="text-xs text-slate-500 mb-1">Payment Schedule:</p>
                                        {item.installments.map((inst, idx) => (
                                            <div key={idx} className="text-sm flex gap-4">
                                                <span className="font-medium">{inst.name}</span>
                                                <span>₦{inst.amount.toLocaleString()}</span>
                                                <span className="text-slate-500">Due: {inst.due_date ? new Date(inst.due_date).toLocaleDateString() : 'Not set'}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => handleEdit(item)} 
                                    className="text-blue-600 hover:text-blue-800 p-1"
                                    title="Edit"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => onDelete(item.id)} 
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Delete"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Main View ---

const StudentFinanceView: React.FC<{
    addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    students: Student[];
    userProfile: UserProfile;
}> = ({ addToast, students: propStudents, userProfile }) => {
    const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'fees' | 'payments' | 'debtors' | 'dva'>('dashboard');
    const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
    const [invoices, setInvoices] = useState<StudentInvoice[]>([]);
    const [terms, setTerms] = useState<Term[]>([]);
    const [classes, setClasses] = useState<BaseDataObject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('All');

    // Calculate stats
    const stats = useMemo(() => {
        const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
        const totalCollected = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
        const totalOutstanding = totalInvoiced - totalCollected;
        const paidInvoices = invoices.filter(inv => inv.status === 'Paid').length;
        const partiallyPaid = invoices.filter(inv => inv.status === 'Partially Paid').length;
        const overdueInvoices = invoices.filter(inv => inv.status === 'Overdue' || (inv.status !== 'Paid' && inv.due_date && new Date(inv.due_date) < new Date())).length;
        const unpaidInvoices = invoices.filter(inv => inv.status === 'Unpaid').length;
        const collectionRate = totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 0;
        
        // Students with debt
        const studentDebts = new Map<number, { name: string; total: number; paid: number }>();
        invoices.forEach(inv => {
            if (inv.student_id && inv.status !== 'Paid') {
                const existing = studentDebts.get(inv.student_id) || { name: inv.student?.name || `Student #${inv.student_id}`, total: 0, paid: 0 };
                existing.total += inv.total_amount || 0;
                existing.paid += inv.amount_paid || 0;
                studentDebts.set(inv.student_id, existing);
            }
        });
        const debtors = Array.from(studentDebts.entries())
            .map(([id, data]) => ({ id, ...data, outstanding: data.total - data.paid }))
            .filter(d => d.outstanding > 0)
            .sort((a, b) => b.outstanding - a.outstanding);
        
        return { totalInvoiced, totalCollected, totalOutstanding, paidInvoices, partiallyPaid, overdueInvoices, unpaidInvoices, collectionRate, debtors };
    }, [invoices]);

    // Filtered invoices
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesSearch = inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  inv.student?.name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [invoices, searchQuery, statusFilter]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            // Fetch base data filtering by school_id
            const schoolId = userProfile.school_id;

            const [feesRes, invRes, termRes, classRes, payRes] = await Promise.all([
                supabase.from('fee_items').select('*').eq('school_id', schoolId),
                supabase.from('student_invoices').select('*, student:students(name, admission_number), line_items:invoice_line_items(*)').eq('school_id', schoolId).order('created_at', { ascending: false }),
                supabase.from('terms').select('*').eq('school_id', schoolId).order('start_date', { ascending: false }),
                supabase.from('classes').select('*'), // Classes are shared dictionaries usually, or filtered if needed
                supabase.from('payments').select('*, invoice:student_invoices(invoice_number, student:students(name))').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(20)
            ]);

            if (feesRes.data) setFeeItems(feesRes.data);
            if (invRes.data) setInvoices(invRes.data);
            if (termRes.data) setTerms(termRes.data);
            if (classRes.data) setClasses(classRes.data);
            if (payRes.data) setRecentPayments(payRes.data);
            
            setIsLoading(false);
        };
        loadData();
    }, [userProfile.school_id]);

    const handleSaveFee = async (item: Partial<FeeItem>) => {
        const payload = { ...item, school_id: userProfile.school_id };
        if (item.id) {
            await supabase.from('fee_items').update(payload).eq('id', item.id);
        } else {
            await supabase.from('fee_items').insert(payload);
        }
        const { data } = await supabase.from('fee_items').select('*').eq('school_id', userProfile.school_id);
        setFeeItems(data || []);
        addToast('Fee item saved.', 'success');
    };

    const handleDeleteFee = async (id: number) => {
        if (window.confirm('Delete this fee item?')) {
            await supabase.from('fee_items').delete().eq('id', id);
            setFeeItems(prev => prev.filter(i => i.id !== id));
            addToast('Fee item deleted.', 'success');
        }
    };

    const handleGenerateInvoices = async (studentIds: number[], termId: number, feeItemIds: number[], dueDate: string) => {
        // Fetch fee details
        const fees = feeItems.filter(f => feeItemIds.includes(f.id));
        const totalAmount = fees.reduce((sum, f) => sum + f.amount, 0);
        
        // Generate invoices in loop
        for (const studentId of studentIds) {
            const invoiceNumber = `INV-${Date.now()}-${studentId}`; // Simple generation
            const { data: invoice, error } = await supabase.from('student_invoices').insert({
                school_id: userProfile.school_id,
                student_id: studentId,
                term_id: termId,
                invoice_number: invoiceNumber,
                total_amount: totalAmount,
                due_date: dueDate,
                status: 'Unpaid'
            }).select().single();

            if (invoice) {
                const lines = fees.map(f => ({
                    invoice_id: invoice.id,
                    fee_item_id: f.id,
                    description: f.name,
                    amount: f.amount
                }));
                await supabase.from('invoice_line_items').insert(lines);
            }
        }
        
        // Refresh invoices
        const { data } = await supabase.from('student_invoices').select('*, student:students(name, admission_number), line_items:invoice_line_items(*)').eq('school_id', userProfile.school_id).order('created_at', { ascending: false });
        setInvoices(data || []);
        addToast(`Generated invoices for ${studentIds.length} students.`, 'success');
    };

    const handleRecordPayment = async (invoiceId: number, amount: number, method: string, reference: string) => {
        const invoice = invoices.find(i => i.id === invoiceId);
        if (!invoice) return;
        
        // Record payment
        await supabase.from('payments').insert({
            school_id: userProfile.school_id,
            invoice_id: invoiceId,
            amount,
            payment_method: method,
            reference,
            recorded_by: userProfile.id,
            verified: true 
        });

        // Update invoice
        const newPaid = invoice.amount_paid + amount;
        // Fix: Use enum from types if possible, or string cast
        let status: any = 'Partially Paid';
        if (newPaid >= invoice.total_amount) status = 'Paid';
        
        await supabase.from('student_invoices').update({
            amount_paid: newPaid,
            status
        }).eq('id', invoiceId);
        
        // Refresh
        const { data: invData } = await supabase.from('student_invoices').select('*, student:students(name, admission_number), line_items:invoice_line_items(*)').eq('school_id', userProfile.school_id).order('created_at', { ascending: false });
        setInvoices(invData || []);
        
        const { data: payData } = await supabase.from('payments').select('*, invoice:student_invoices(invoice_number, student:students(name))').eq('school_id', userProfile.school_id).order('created_at', { ascending: false }).limit(20);
        setRecentPayments(payData || []);

        addToast('Payment recorded successfully.', 'success');
    };

    const handleImportFees = async (fees: Partial<FeeItem>[]) => {
        const schoolId = userProfile.school_id;
        
        for (const fee of fees) {
            // Validate required fields
            if (!fee.name || !fee.amount) {
                continue; // Skip invalid fees
            }

            const feeData = {
                school_id: schoolId,
                name: fee.name,
                description: fee.description || '',
                amount: Number(fee.amount),
                is_compulsory: fee.is_compulsory === true || fee.is_compulsory === 'Yes' || fee.is_compulsory === 'yes',
                allow_installments: fee.allow_installments === true || fee.allow_installments === 'Yes' || fee.allow_installments === 'yes',
                priority: fee.priority ? Number(fee.priority) : 1,
            };

            // Check if fee with same name exists (update) or create new
            const existing = feeItems.find(f => f.name?.toLowerCase() === feeData.name.toLowerCase());
            if (existing) {
                await supabase.from('fee_items').update(feeData).eq('id', existing.id);
            } else {
                await supabase.from('fee_items').insert(feeData);
            }
        }

        // Refresh fee items
        const { data } = await supabase.from('fee_items').select('*').eq('school_id', schoolId);
        setFeeItems(data || []);
    };

    const handleImportInvoices = async (invoicesData: Partial<StudentInvoice>[]) => {
        const schoolId = userProfile.school_id;
        
        // Validate we have at least one term
        if (!terms || terms.length === 0) {
            addToast('Cannot import invoices: No terms available. Please create at least one term first.', 'error');
            return;
        }

        const defaultTermId = terms[0].id;
        
        for (const invData of invoicesData) {
            // Find student by admission number or name
            const admissionNumber = invData.student?.admission_number || (invData as any).admission_number;
            const studentName = invData.student?.name || (invData as any).student_name;
            
            let student = null;
            if (admissionNumber) {
                student = propStudents.find(s => s.admission_number === admissionNumber);
            } else if (studentName) {
                student = propStudents.find(s => s.name.toLowerCase() === studentName.toLowerCase());
            }

            if (!student) continue; // Skip if student not found

            const invoiceData = {
                school_id: schoolId,
                student_id: student.id,
                term_id: invData.term_id || defaultTermId,
                invoice_number: invData.invoice_number || `INV-${Date.now()}-${student.id}`,
                total_amount: Number(invData.total_amount),
                amount_paid: Number(invData.amount_paid || 0),
                status: invData.status || 'Unpaid',
                due_date: invData.due_date,
            };

            // Check if invoice with same number exists (update) or create new
            const existing = invoices.find(i => i.invoice_number === invoiceData.invoice_number);
            if (existing) {
                await supabase.from('student_invoices').update(invoiceData).eq('id', existing.id);
            } else {
                await supabase.from('student_invoices').insert(invoiceData);
            }
        }

        // Refresh invoices
        const { data } = await supabase.from('student_invoices')
            .select('*, student:students(name, admission_number), line_items:invoice_line_items(*)')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });
        setInvoices(data || []);
    };

    if (isLoading) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <BanknotesIcon className="w-8 h-8 text-green-600" />
                    Student Finance (Bursary)
                </h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Manage fees, generate invoices, and track student payments.</p>
            </div>
            
            <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Dashboard</button>
                <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'invoices' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Invoices</button>
                <button onClick={() => setActiveTab('fees')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'fees' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Fee Configuration</button>
                <button onClick={() => setActiveTab('payments')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'payments' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Payment History</button>
                <button onClick={() => setActiveTab('debtors')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'debtors' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Debtors List</button>
                <button onClick={() => setActiveTab('dva')} className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'dva' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Virtual Accounts</button>
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-blue-100 text-sm">Total Invoiced</p>
                                    <p className="text-3xl font-bold mt-1">₦{stats.totalInvoiced.toLocaleString()}</p>
                                    <p className="text-xs text-blue-200 mt-1">{invoices.length} invoices</p>
                                </div>
                                <BanknotesIcon className="w-8 h-8 text-blue-200" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-green-100 text-sm">Total Collected</p>
                                    <p className="text-3xl font-bold mt-1">₦{stats.totalCollected.toLocaleString()}</p>
                                    <p className="text-xs text-green-200 mt-1">{stats.collectionRate}% collection rate</p>
                                </div>
                                <BanknotesIcon className="w-8 h-8 text-green-200" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-5 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-red-100 text-sm">Outstanding</p>
                                    <p className="text-3xl font-bold mt-1">₦{stats.totalOutstanding.toLocaleString()}</p>
                                    <p className="text-xs text-red-200 mt-1">{stats.debtors.length} debtors</p>
                                </div>
                                <BanknotesIcon className="w-8 h-8 text-red-200" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 text-white">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-amber-100 text-sm">Overdue</p>
                                    <p className="text-3xl font-bold mt-1">{stats.overdueInvoices}</p>
                                    <p className="text-xs text-amber-200 mt-1">invoices overdue</p>
                                </div>
                                <BanknotesIcon className="w-8 h-8 text-amber-200" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions + Top Debtors */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => setActiveTab('invoices')} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-left hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                    <p className="font-bold text-blue-700 dark:text-blue-300">Generate Invoices</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Create invoices for students</p>
                                </button>
                                <button onClick={() => setActiveTab('invoices')} className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-left hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
                                    <p className="font-bold text-green-700 dark:text-green-300">Record Payment</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Log a new payment</p>
                                </button>
                                <button onClick={() => setActiveTab('fees')} className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-left hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
                                    <p className="font-bold text-purple-700 dark:text-purple-300">Configure Fees</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Set up fee items</p>
                                </button>
                                <button onClick={() => setActiveTab('debtors')} className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-left hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                    <p className="font-bold text-red-700 dark:text-red-300">View Debtors</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{stats.debtors.length} students owe fees</p>
                                </button>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                Top Debtors
                            </h3>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {stats.debtors.slice(0, 5).map(debtor => (
                                    <div key={debtor.id} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                        <div>
                                            <p className="font-medium text-sm">{debtor.name}</p>
                                            <p className="text-xs text-slate-500">Owes: ₦{debtor.outstanding.toLocaleString()}</p>
                                        </div>
                                        <button 
                                            onClick={() => { setSearchQuery(debtor.name); setActiveTab('invoices'); }}
                                            className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                                        >
                                            View
                                        </button>
                                    </div>
                                ))}
                                {stats.debtors.length === 0 && (
                                    <p className="text-slate-500 text-center py-4">No outstanding debts! 🎉</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Invoice Status Breakdown */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                        <h3 className="text-lg font-bold mb-4">Invoice Status Breakdown</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                <p className="font-bold text-2xl text-green-700 dark:text-green-300">{stats.paidInvoices}</p>
                                <p className="text-xs text-slate-500">Paid</p>
                            </div>
                            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                <p className="font-bold text-2xl text-yellow-700 dark:text-yellow-300">{stats.partiallyPaid}</p>
                                <p className="text-xs text-slate-500">Partially Paid</p>
                            </div>
                            <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                                <p className="font-bold text-2xl text-slate-700 dark:text-slate-300">{stats.unpaidInvoices}</p>
                                <p className="text-xs text-slate-500">Unpaid</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                <p className="font-bold text-2xl text-red-700 dark:text-red-300">{stats.overdueInvoices}</p>
                                <p className="text-xs text-slate-500">Overdue</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {activeTab === 'invoices' && (
                    <>
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                                <InvoiceGenerator students={propStudents} terms={terms} feeItems={feeItems} onGenerate={handleGenerateInvoices} />
                            </div>
                            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                                <PaymentRecorder invoices={invoices} onRecordPayment={handleRecordPayment} />
                            </div>
                        </div>
                        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold">Invoices</h3>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="p-2 text-sm border rounded"
                                    />
                                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 text-sm border rounded">
                                        <option value="All">All Status</option>
                                        <option value="Paid">Paid</option>
                                        <option value="Partially Paid">Partially Paid</option>
                                        <option value="Unpaid">Unpaid</option>
                                        <option value="Overdue">Overdue</option>
                                    </select>
                                </div>
                            </div>
                             <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="p-3">Invoice #</th>
                                            <th className="p-3">Student</th>
                                            <th className="p-3">Total</th>
                                            <th className="p-3">Paid</th>
                                            <th className="p-3">Status</th>
                                            <th className="p-3">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredInvoices.slice(0, 20).map(inv => (
                                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-3">{inv.invoice_number}</td>
                                                <td className="p-3">{inv.student?.name}</td>
                                                <td className="p-3">₦{inv.total_amount.toLocaleString()}</td>
                                                <td className="p-3">₦{inv.amount_paid.toLocaleString()}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                        inv.status === 'Paid' ? 'bg-green-100 text-green-800' : 
                                                        inv.status === 'Overdue' ? 'bg-red-100 text-red-800' : 
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="p-3"><button className="text-blue-600 hover:underline text-xs">Print</button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    </>
                )}
                
                {activeTab === 'fees' && (
                    <div className="lg:col-span-3 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                            <FeeItemManager feeItems={feeItems} classes={classes} terms={terms} onSave={handleSaveFee} onDelete={handleDeleteFee} />
                        </div>
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                            <h3 className="text-lg font-bold mb-4">Import / Export</h3>
                            <FeesCsvManager
                                feeItems={feeItems}
                                invoices={invoices}
                                students={propStudents}
                                classes={classes}
                                terms={terms}
                                onImportFees={handleImportFees}
                                onImportInvoices={handleImportInvoices}
                                addToast={addToast}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'payments' && (
                     <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                        <h3 className="font-bold mb-4">Recent Payments</h3>
                         <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Student</th>
                                            <th className="p-3">Invoice</th>
                                            <th className="p-3">Amount</th>
                                            <th className="p-3">Method</th>
                                            <th className="p-3">Ref</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {recentPayments.map(pay => (
                                            <tr key={pay.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="p-3">{new Date(pay.payment_date).toLocaleDateString()}</td>
                                                <td className="p-3">{pay.invoice?.student?.name || 'Unknown'}</td>
                                                <td className="p-3">{pay.invoice?.invoice_number}</td>
                                                <td className="p-3 font-bold text-green-600">₦{pay.amount.toLocaleString()}</td>
                                                <td className="p-3">{pay.payment_method}</td>
                                                <td className="p-3 text-xs font-mono">{pay.reference}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                         </div>
                    </div>
                )}

                {activeTab === 'debtors' && (
                    <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">Debtors List ({stats.debtors.length} students)</h3>
                            <p className="text-sm text-slate-500">Total Outstanding: <span className="font-bold text-red-600">₦{stats.totalOutstanding.toLocaleString()}</span></p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mb-4 border border-red-200 dark:border-red-800">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                <strong>Note:</strong> Students with outstanding fees are blocked from viewing their results until cleared.
                            </p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 dark:bg-slate-800 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="p-3">Student</th>
                                        <th className="p-3">Total Invoiced</th>
                                        <th className="p-3">Amount Paid</th>
                                        <th className="p-3">Outstanding</th>
                                        <th className="p-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                    {stats.debtors.map(debtor => (
                                        <tr key={debtor.id} className="hover:bg-red-50 dark:hover:bg-red-900/10">
                                            <td className="p-3 font-medium">{debtor.name}</td>
                                            <td className="p-3">₦{debtor.total.toLocaleString()}</td>
                                            <td className="p-3 text-green-600">₦{debtor.paid.toLocaleString()}</td>
                                            <td className="p-3 font-bold text-red-600">₦{debtor.outstanding.toLocaleString()}</td>
                                            <td className="p-3">
                                                <button 
                                                    onClick={() => { setSearchQuery(debtor.name); setActiveTab('invoices'); }}
                                                    className="text-blue-600 hover:underline text-xs"
                                                >
                                                    View Invoices
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {stats.debtors.length === 0 && (
                                <div className="text-center py-10 text-slate-500">
                                    <p className="text-lg">🎉 No outstanding debts!</p>
                                    <p className="text-sm">All students are up to date with their fees.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* DVA Tab */}
                {activeTab === 'dva' && (
                    <div className="lg:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
                        <DVAManager 
                            students={propStudents}
                            schoolId={userProfile.school_id}
                            campusId={userProfile.campus_id}
                            addToast={addToast}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default StudentFinanceView;
