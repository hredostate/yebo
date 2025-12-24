
import React from 'react';
import type { LinkedChild } from '../../types';

interface ChildSwitcherProps {
    children: LinkedChild[];
    selectedChild: LinkedChild | null;
    onSelectChild: (child: LinkedChild) => void;
}

const ChildSwitcher: React.FC<ChildSwitcherProps> = ({ children, selectedChild, onSelectChild }) => {
    if (children.length === 0) {
        return (
            <div className="text-sm text-slate-500 dark:text-slate-400">
                No children linked to your account
            </div>
        );
    }

    if (children.length === 1) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                    {children[0].name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div className="text-lg font-semibold text-slate-900 dark:text-white">
                        {children[0].name}
                    </div>
                    {children[0].class && children[0].arm && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            {children[0].class.name} {children[0].arm.name}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            <label htmlFor="child-selector" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select Child
            </label>
            <select
                id="child-selector"
                value={selectedChild?.id || ''}
                onChange={(e) => {
                    const child = children.find(c => c.id === Number(e.target.value));
                    if (child) onSelectChild(child);
                }}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
            >
                {children.map(child => (
                    <option key={child.id} value={child.id}>
                        {child.name}
                        {child.class && child.arm && ` - ${child.class.name} ${child.arm.name}`}
                        {child.relationship && ` (${child.relationship})`}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default ChildSwitcher;
