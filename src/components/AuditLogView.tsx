
import React, { useState, useMemo } from 'react';
import type { AuditLog } from '../types';
import { SearchIcon, CalendarIcon } from './common/icons';
import Pagination from './common/Pagination';
import { ExportButton } from './common/ExportButton';
import type { ExcelColumn } from '../utils/excelExport';

interface AuditLogViewProps {
  logs: AuditLog[];
}

const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // Filter and Sort Logs
  const filteredLogs = useMemo(() => {
      let result = [...logs];

      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          result = result.filter(log => 
              log.action.toLowerCase().includes(q) ||
              log.actor?.name.toLowerCase().includes(q) ||
              JSON.stringify(log.details).toLowerCase().includes(q)
          );
      }

      if (filterDate) {
          result = result.filter(log => log.created_at.startsWith(filterDate));
      }
      
      // Sort Descending
      return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, searchQuery, filterDate]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
      setCurrentPage(1);
  }
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilterDate(e.target.value);
      setCurrentPage(1);
  }

  // Prepare data for export
  const exportColumns: ExcelColumn[] = [
    { key: 'timestamp', header: 'Timestamp', width: 20, type: 'string' },
    { key: 'actor', header: 'Actor', width: 20, type: 'string' },
    { key: 'action', header: 'Action', width: 30, type: 'string' },
    { 
      key: 'details', 
      header: 'Details', 
      width: 50, 
      type: 'string',
      format: (value: any) => JSON.stringify(value)
    },
  ];

  const exportData = useMemo(() => {
    return filteredLogs.map(log => ({
      timestamp: new Date(log.created_at).toLocaleString(),
      actor: log.actor?.name || 'Unknown User',
      action: log.action,
      details: log.details,
    }));
  }, [filteredLogs]);

  return (
    <div className="space-y-4 min-w-0 w-full overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">System Audit Log</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">Track system changes and user actions.</p>
         </div>
         <div className="flex gap-2 w-full md:w-auto flex-wrap">
             <div className="relative flex-grow md:flex-grow-0">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search logs..." 
                    value={searchQuery} 
                    onChange={handleSearchChange}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800" 
                />
             </div>
             <div className="relative">
                 <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                 <input 
                    type="date" 
                    value={filterDate} 
                    onChange={handleDateChange}
                    className="pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
                 />
             </div>
             <ExportButton
               data={exportData}
               columns={exportColumns}
               filename="audit_logs.xlsx"
               sheetName="Audit Logs"
               label="Export"
               className="px-4 py-2 text-sm"
             />
         </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[600px] rounded-lg border border-slate-200/60 dark:border-slate-800/60">
        <table className="w-full text-sm text-left min-w-[700px]">
          <thead className="text-xs uppercase bg-slate-100 dark:bg-slate-800 sticky top-0 text-slate-700 dark:text-slate-300">
            <tr>
              <th className="px-6 py-3">Timestamp</th>
              <th className="px-6 py-3">Actor</th>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/60 dark:divide-slate-700/60 bg-white dark:bg-slate-900">
            {paginatedLogs.map(log => (
              <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-6 py-4 whitespace-nowrap text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{log.actor?.name || 'Unknown User'}</td>
                <td className="px-6 py-4 font-mono text-xs text-blue-600 dark:text-blue-400">{log.action}</td>
                <td className="px-6 py-4 max-w-[300px]">
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-mono truncate hover:whitespace-normal hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded cursor-help transition-all overflow-hidden" title={JSON.stringify(log.details, null, 2)}>
                    {JSON.stringify(log.details)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {paginatedLogs.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-white dark:bg-slate-900">No audit logs found matching your criteria.</div>
        )}
      </div>
      
      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={setCurrentPage} 
        itemsPerPage={ITEMS_PER_PAGE}
        totalItems={filteredLogs.length}
      />
    </div>
  );
};

export default AuditLogView;
