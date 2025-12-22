import React from 'react';
import { SearchIcon, CloseIcon } from './icons';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    className = ''
}) => {
    return (
        <div className={`relative ${className}`}>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>
            <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-10 pr-10 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600"
            />
            {value && (
                <button
                    onClick={() => onChange('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-slate-600 dark:hover:text-slate-300"
                >
                    <CloseIcon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                </button>
            )}
        </div>
    );
};

export default SearchInput;
