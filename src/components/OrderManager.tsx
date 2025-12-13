
import React, { useState, useMemo, useEffect } from 'react';
import type { Order, OrderStatus, UserProfile, OrderNote } from '../types';
import Spinner from './common/Spinner';
import { SearchIcon, ChevronDownIcon, TrashIcon, PlusCircleIcon, EditIcon } from './common/icons';
import Pagination from './common/Pagination';

interface OrderManagerProps {
    orders: Order[];
    users: UserProfile[];
    onUpdateStatus: (orderId: number, status: OrderStatus) => Promise<void>;
    onAddNote: (orderId: number, note: string) => Promise<void>;
    onDeleteNote: (noteId: number) => Promise<void>;
}

const statusColors: Record<OrderStatus, string> = {
    'Pending': 'bg-yellow-100 text-yellow-800',
    'Paid': 'bg-blue-100 text-blue-800',
    'Delivered': 'bg-green-100 text-green-800',
    'Returned': 'bg-red-100 text-red-800',
    'Cancelled': 'bg-slate-200 text-slate-600',
};

const OrderManager: React.FC<OrderManagerProps> = ({ orders, users, onUpdateStatus, onAddNote, onDeleteNote }) => {
    const [statusFilter, setStatusFilter] = useState<OrderStatus | 'All'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
    const [newNote, setNewNote] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isAddingNote, setIsAddingNote] = useState(false);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, searchQuery]);

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            const matchesStatus = statusFilter === 'All' || order.status === statusFilter;
            const matchesSearch = 
                order.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                String(order.id).includes(searchQuery) ||
                order.payment_reference?.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesStatus && matchesSearch;
        }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [orders, statusFilter, searchQuery]);

    const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
    const paginatedOrders = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredOrders.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredOrders, currentPage]);

    const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
        setIsUpdating(true);
        await onUpdateStatus(orderId, newStatus);
        setIsUpdating(false);
    };

    const handleAddNoteSubmit = async (orderId: number) => {
        if (!newNote.trim()) return;
        setIsAddingNote(true);
        await onAddNote(orderId, newNote);
        setIsAddingNote(false);
        setNewNote('');
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Order Management</h1>
                <p className="text-slate-600 dark:text-slate-300 mt-1">Track and fulfill store orders.</p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                 <div className="relative flex-grow">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search order ID, customer name..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'All')}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Returned">Returned</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </div>

            <div className="space-y-4">
                {paginatedOrders.map(order => (
                    <div key={order.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div 
                            className="p-4 flex flex-col md:flex-row justify-between items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        >
                            <div className="flex items-center gap-4 w-full md:w-auto">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg font-bold text-blue-700 dark:text-blue-300">
                                    #{order.id}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-white">{order.user?.name || 'Unknown User'}</p>
                                    <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                <span className="font-bold text-lg text-slate-900 dark:text-white">₦{Number(order.total_amount).toLocaleString()}</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusColors[order.status] || 'bg-gray-100'}`}>
                                    {order.status}
                                </span>
                                <ChevronDownIcon className={`w-5 h-5 transition-transform ${expandedOrderId === order.id ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                        
                        {expandedOrderId === order.id && (
                            <div className="border-t border-slate-200 dark:border-slate-700 p-6 bg-slate-50 dark:bg-slate-900/50">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Order Details */}
                                    <div className="lg:col-span-2 space-y-4">
                                        <h3 className="font-bold text-sm uppercase text-slate-500">Items</h3>
                                        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-100 dark:bg-slate-700 text-left">
                                                    <tr>
                                                        <th className="p-3 font-semibold">Item</th>
                                                        <th className="p-3 font-semibold text-center">Qty</th>
                                                        <th className="p-3 font-semibold text-right">Price</th>
                                                        <th className="p-3 font-semibold text-right">Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {order.items?.map(item => (
                                                        <tr key={item.id} className="border-t border-slate-200 dark:border-slate-700">
                                                            <td className="p-3 flex items-center gap-3">
                                                                {item.inventory_item?.image_url && <img src={item.inventory_item.image_url} className="w-8 h-8 rounded object-cover" />}
                                                                {item.inventory_item?.name || 'Unknown Item'}
                                                            </td>
                                                            <td className="p-3 text-center">{item.quantity}</td>
                                                            <td className="p-3 text-right">₦{Number(item.unit_price).toLocaleString()}</td>
                                                            <td className="p-3 text-right font-medium">₦{(item.quantity * Number(item.unit_price)).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        
                                        <div className="flex justify-between items-center pt-4">
                                            <div>
                                                <p className="text-sm text-slate-500">Payment Ref: <span className="font-mono text-slate-700 dark:text-slate-300">{order.payment_reference || 'N/A'}</span></p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <label className="text-sm font-medium">Change Status:</label>
                                                <select 
                                                    value={order.status} 
                                                    onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                                                    disabled={isUpdating}
                                                    className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold"
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Paid">Paid</option>
                                                    <option value="Delivered">Delivered</option>
                                                    <option value="Returned">Returned</option>
                                                    <option value="Cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes Section */}
                                    <div className="space-y-4 border-l border-slate-200 dark:border-slate-700 pl-0 lg:pl-8">
                                        <h3 className="font-bold text-sm uppercase text-slate-500">Admin Notes</h3>
                                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                            {order.notes?.length === 0 && <p className="text-sm text-slate-500 italic">No notes yet.</p>}
                                            {order.notes?.map(note => (
                                                <div key={note.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 relative group">
                                                    <p className="text-sm text-slate-800 dark:text-slate-200">{note.note}</p>
                                                    <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
                                                        <span>{note.author?.name} • {new Date(note.created_at).toLocaleDateString()}</span>
                                                        <button onClick={() => {
                                                            if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
                                                                onDeleteNote(note.id);
                                                            }
                                                        }} className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <TrashIcon className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={newNote}
                                                onChange={e => setNewNote(e.target.value)}
                                                placeholder="Add internal note..."
                                                className="flex-grow p-2 text-sm border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                                            />
                                            <button 
                                                onClick={() => handleAddNoteSubmit(order.id)} 
                                                disabled={isAddingNote || !newNote.trim()}
                                                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:bg-blue-400"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {filteredOrders.length === 0 && (
                    <div className="text-center py-20 text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        No orders found matching your filters.
                    </div>
                )}
            </div>
            
            <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
                itemsPerPage={ITEMS_PER_PAGE}
                totalItems={filteredOrders.length}
            />
        </div>
    );
};

export default OrderManager;
