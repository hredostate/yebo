
import React, { useState, useRef, useMemo, useEffect } from 'react';
import type { InventoryItem } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon, UploadCloudIcon, SearchIcon } from './common/icons';
import { uploadCheckinPhoto } from '../services/checkins'; // Reusing existing upload util
import Pagination from './common/Pagination';

interface InventoryManagerProps {
    inventory: InventoryItem[];
    onSave: (item: Partial<InventoryItem>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const InventoryManager: React.FC<InventoryManagerProps> = ({ inventory, onSave, onDelete }) => {
    const [editing, setEditing] = useState<Partial<InventoryItem> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('All');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // Extract categories
    const categories = useMemo(() => {
        const cats = new Set(inventory.map(i => i.category));
        return ['All', ...Array.from(cats).sort()];
    }, [inventory]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, categoryFilter]);

    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchQuery, categoryFilter]);

    const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
    const paginatedInventory = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredInventory.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredInventory, currentPage]);

    const handleSave = async (data: Partial<InventoryItem>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h3 className="text-lg font-semibold">Manage Inventory</h3>
                {!editing && (
                    <button onClick={() => setEditing({ is_published: false, price: 0, stock: 0, category: 'General' })} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100 transition-colors">
                        <PlusCircleIcon className="w-5 h-5"/> Add New Item
                    </button>
                )}
            </div>

            {!editing && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                         <div className="relative w-full md:w-64">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search items..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 p-2 text-sm border rounded-md bg-white dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List */}
                    <div className="space-y-2">
                        {paginatedInventory.map(item => {
                            const isLowStock = item.stock <= (item.low_stock_threshold || 5);
                            return (
                                <div key={item.id} className="p-3 border rounded-lg flex justify-between items-center bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-3">
                                        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-12 h-12 object-cover rounded-md border border-slate-200 dark:border-slate-700" /> : <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-xs text-slate-400 border border-slate-200 dark:border-slate-700">No Img</div>}
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-white">{item.name} <span className="text-xs text-slate-500 font-normal">({item.category})</span></p>
                                            <div className="flex gap-2 text-sm items-center mt-0.5">
                                                <span>₦{Number(item.price).toLocaleString()}</span>
                                                <span className="text-slate-300">•</span>
                                                <span className={isLowStock ? 'text-red-600 font-bold flex items-center gap-1' : 'text-slate-600 dark:text-slate-400'}>
                                                    {item.stock} in stock
                                                    {isLowStock && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">LOW</span>}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className={`text-xs font-bold ${item.is_published ? 'text-green-600' : 'text-amber-600'}`}>
                                                    {item.is_published ? 'Published' : 'Draft'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => setEditing(item)} className="text-sm font-semibold text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">Edit</button>
                                        <button onClick={() => {
                                            if (window.confirm('Are you sure you want to delete this inventory item? This action cannot be undone and may affect related transactions.')) {
                                                onDelete(item.id);
                                            }
                                        }} className="text-sm font-semibold text-red-600 hover:underline px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                        {paginatedInventory.length === 0 && (
                            <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                No inventory items found.
                            </div>
                        )}
                    </div>

                    <Pagination 
                        currentPage={currentPage} 
                        totalPages={totalPages} 
                        onPageChange={setCurrentPage} 
                        itemsPerPage={ITEMS_PER_PAGE}
                        totalItems={filteredInventory.length}
                    />
                </div>
            )}

            {editing && (
                <ItemForm 
                    item={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving} 
                />
            )}
        </div>
    );
};

const ItemForm: React.FC<{
    item: Partial<InventoryItem>;
    onSave: (item: Partial<InventoryItem>) => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ item, onSave, onCancel, isSaving }) => {
    const [localItem, setLocalItem] = useState(item);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
             const checked = (e.target as HTMLInputElement).checked;
             setLocalItem(prev => ({ ...prev, [name]: checked }));
        } else if (type === 'number') {
             setLocalItem(prev => ({ ...prev, [name]: Number(value) }));
        } else {
            setLocalItem(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsUploading(true);
            const res = await uploadCheckinPhoto(file, 'inventory');
            if (res && res.publicUrl) {
                setLocalItem(prev => ({ ...prev, image_url: res.publicUrl }));
            } else {
                alert('Failed to upload image.');
            }
            setIsUploading(false);
        }
    };

    return (
        <div className="p-6 border rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-6 animate-fade-in shadow-sm">
            <h4 className="font-bold text-lg text-slate-800 dark:text-white">{localItem.id ? 'Edit Item' : 'New Inventory Item'}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Item Name</label>
                    <input name="name" value={localItem.name || ''} onChange={handleChange} placeholder="e.g. School Polo Shirt" className="p-2 border rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"/>
                </div>
                <div>
                     <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Category</label>
                     {/* Editable or Selectable Category */}
                     <div className="relative">
                        <input 
                            name="category" 
                            value={localItem.category || ''} 
                            onChange={handleChange} 
                            list="category-options"
                            placeholder="Select or Type Category" 
                            className="p-2 border rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"
                        />
                        <datalist id="category-options">
                            <option value="General" />
                            <option value="Uniforms" />
                            <option value="Books" />
                            <option value="Stationery" />
                            <option value="IT" />
                            <option value="Maintenance" />
                            <option value="Library" />
                        </datalist>
                     </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                     <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Current Stock</label>
                    <input name="stock" type="number" value={localItem.stock || 0} onChange={handleChange} className="p-2 border rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"/>
                </div>
                <div>
                     <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Low Stock Alert</label>
                    <input name="low_stock_threshold" type="number" value={localItem.low_stock_threshold || 5} onChange={handleChange} className="p-2 border rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"/>
                </div>
                <div>
                     <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Unit Price (₦)</label>
                    <input name="price" type="number" value={localItem.price || 0} onChange={handleChange} className="p-2 border rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"/>
                </div>
            </div>

            <div>
                 <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Description</label>
                <textarea name="description" value={localItem.description || ''} onChange={handleChange} placeholder="Item details..." rows={3} className="p-2 border rounded w-full bg-white dark:bg-slate-900 dark:border-slate-700"/>
            </div>
            
            <div className="flex items-center gap-6 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex-shrink-0">
                     {localItem.image_url ? (
                         <img src={localItem.image_url} alt="Preview" className="h-20 w-20 object-cover rounded-md border border-slate-200" />
                     ) : (
                         <div className="h-20 w-20 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-300">No Image</div>
                     )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">Product Image</label>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md flex items-center gap-2 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                        <UploadCloudIcon className="w-4 h-4"/> {isUploading ? 'Uploading...' : 'Upload Image'}
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="is_published" checked={!!localItem.is_published} onChange={handleChange} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"/> 
                    <span className="font-medium text-slate-700 dark:text-slate-200">Publish to School Store</span>
                </label>

                <div className="flex gap-3">
                    <button type="button" onClick={onCancel} className="px-5 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">Cancel</button>
                    <button onClick={() => onSave(localItem)} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 flex items-center gap-2">
                        {isSaving ? <Spinner size="sm"/> : 'Save Item'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InventoryManager;
