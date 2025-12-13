import React, { useState } from 'react';
import type { RewardStoreItem } from '../types';
import Spinner from './common/Spinner';
import { PlusCircleIcon } from './common/icons';

interface RewardsManagerProps {
    rewards: RewardStoreItem[];
    onSave: (reward: Partial<RewardStoreItem>) => Promise<boolean>;
    onDelete: (id: number) => Promise<boolean>;
}

const RewardsManager: React.FC<RewardsManagerProps> = ({ rewards, onSave, onDelete }) => {
    const [editing, setEditing] = useState<Partial<RewardStoreItem> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: Partial<RewardStoreItem>) => {
        setIsSaving(true);
        const success = await onSave(data);
        if (success) {
            setEditing(null);
        }
        setIsSaving(false);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold">Manage Rewards Store</h3>
            {!editing && (
                <button onClick={() => setEditing({})} className="flex items-center gap-2 text-sm font-semibold text-blue-600 p-2 rounded-md hover:bg-blue-100">
                    <PlusCircleIcon className="w-5 h-5"/> Add New Reward
                </button>
            )}
            {editing && (
                <ItemForm 
                    item={editing} 
                    onSave={handleSave} 
                    onCancel={() => setEditing(null)} 
                    isSaving={isSaving} 
                />
            )}
            <div className="space-y-2">
                {rewards.map(reward => (
                    <div key={reward.id} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                            <p className="font-semibold">{reward.icon} {reward.name}</p>
                            <p className="text-sm">Cost: {reward.cost} points, Stock: {reward.stock}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setEditing(reward)} className="text-sm font-semibold">Edit</button>
                            <button onClick={() => {
                                if (window.confirm('Are you sure you want to delete this reward? This action cannot be undone and may affect students who have purchased this reward.')) {
                                    onDelete(reward.id);
                                }
                            }} className="text-sm font-semibold text-red-600">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ItemForm: React.FC<{
    item: Partial<RewardStoreItem>;
    onSave: (item: Partial<RewardStoreItem>) => void;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ item, onSave, onCancel, isSaving }) => {
    const [localItem, setLocalItem] = useState(item);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setLocalItem(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="p-4 border rounded-lg bg-slate-500/5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input name="name" value={localItem.name || ''} onChange={handleChange} placeholder="Reward Name" className="p-2 border rounded col-span-2"/>
                <input name="icon" value={localItem.icon || ''} onChange={handleChange} placeholder="Icon (emoji)" className="p-2 border rounded text-center"/>
                <input name="cost" type="number" value={localItem.cost || ''} onChange={handleChange} placeholder="Cost (points)" className="p-2 border rounded"/>
            </div>
            <textarea name="description" value={localItem.description || ''} onChange={handleChange} placeholder="Description" rows={2} className="w-full p-2 border rounded"/>
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel}>Cancel</button>
                <button onClick={() => onSave(localItem)} disabled={isSaving}>{isSaving ? <Spinner size="sm"/> : 'Save'}</button>
            </div>
        </div>
    );
};

export default RewardsManager;