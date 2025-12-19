import React, { useState, useEffect, useRef, useCallback } from 'react';
import { requireSupabaseClient } from '../services/supabaseClient';
import type { GlobalSearchResult } from '../types';
import { SearchIcon, UsersIcon, FileTextIcon, ClipboardListIcon, BookOpenIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';

interface GlobalSearchBarProps {
    onNavigate: (view: string) => void;
}

const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GlobalSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Debounce search query
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        setIsLoading(true);
        const handler = setTimeout(async () => {
            const supabase = requireSupabaseClient();
            const { data, error } = await supabase.rpc('global_search', { p_query: query });
            if (error) {
                console.error("Global search error:", error);
                setResults([]);
            } else {
                setResults(data || []);
            }
            setIsLoading(false);
            setIsOpen(true);
        }, 300);

        return () => clearTimeout(handler);
    }, [query]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleResultClick = (result: GlobalSearchResult) => {
        let view = '';
        switch (result.result_type) {
            case 'Student':
                view = `${VIEWS.STUDENT_PROFILE}/${result.result_id}`;
                break;
            case 'Report':
                view = VIEWS.REPORT_FEED; // Future enhancement: scroll to report
                break;
            case 'Task':
                view = VIEWS.TASK_BOARD;
                break;
            case 'Lesson Plan':
                view = VIEWS.LESSON_PLANNER;
                break;
            case 'Staff':
                view = VIEWS.USER_MANAGEMENT;
                break;
        }
        if (view) {
            onNavigate(view);
        }
        setQuery('');
        setIsOpen(false);
    };
    
    const resultIcons: Record<GlobalSearchResult['result_type'], React.FC<any>> = {
        'Student': UsersIcon,
        'Staff': UsersIcon,
        'Report': FileTextIcon,
        'Task': ClipboardListIcon,
        'Lesson Plan': BookOpenIcon,
    };

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.result_type]) {
            acc[result.result_type] = [];
        }
        acc[result.result_type].push(result);
        return acc;
    }, {} as Record<string, GlobalSearchResult[]>);

    return (
        <div ref={searchRef} className="relative w-64 md:w-96">
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query && setIsOpen(true)}
                    placeholder="Search students, reports..."
                    className="w-full h-10 pl-10 pr-4 bg-slate-100 dark:bg-slate-800 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                 {isLoading && <div className="absolute inset-y-0 right-0 pr-3 flex items-center"><Spinner size="sm"/></div>}
            </div>

            {isOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-96 overflow-y-auto rounded-lg bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
                    {results.length > 0 ? (
                        Object.entries(groupedResults).map(([type, items]: [string, GlobalSearchResult[]]) => (
                            <div key={type}>
                                <h3 className="px-4 pt-2 pb-1 text-xs font-semibold text-slate-500 uppercase">{type}</h3>
                                <ul>
                                    {items.map(result => {
                                        const Icon = resultIcons[result.result_type as keyof typeof resultIcons] || FileTextIcon;
                                        return (
                                            <li key={`${result.result_type}-${result.result_id}`}>
                                                <button onClick={() => handleResultClick(result)} className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-3">
                                                    <Icon className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium text-sm text-slate-800 dark:text-white">{result.result_title}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{result.result_description}</p>
                                                    </div>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </div>
                        ))
                    ) : (
                        <div className="p-4 text-center text-sm text-slate-500">No results found.</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearchBar;