import React, { useState, useRef } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { exportReportToPDF, exportReportToExcel, printReport } from '../../utils/reportExport';
import { ExcelColumn } from '../../utils/excelExport';
import { FinancialReportData } from '../../services/financialAnalytics';

interface FinancialReportProps {
  data: FinancialReportData;
  schoolName?: string;
  schoolLogo?: string;
  isDarkMode?: boolean;
}

export const FinancialReport: React.FC<FinancialReportProps> = ({
  data,
  schoolName,
  schoolLogo,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'revenue' | 'payments' | 'outstanding'>('summary');
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      await exportReportToPDF(
        'Financial Report',
        reportRef.current,
        {
          subtitle: `Revenue & Payment Analytics`,
          schoolName,
          schoolLogo,
          generatedBy: 'Finance System',
        }
      );
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const revenueColumns: ExcelColumn[] = [
        { key: 'month', header: 'Month', width: 20 },
        { key: 'expected', header: 'Expected Revenue', width: 20, type: 'currency' },
        { key: 'actual', header: 'Actual Revenue', width: 20, type: 'currency' },
        { key: 'forecast', header: 'Forecast', width: 20, type: 'currency' },
      ];

      await exportReportToExcel(
        data.revenueByMonth,
        revenueColumns,
        'Financial_Report',
        'Revenue by Month'
      );
    } catch (error) {
      console.error('Error exporting Excel:', error);
      alert('Failed to export Excel. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (reportRef.current) {
      printReport(reportRef.current);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(value);
  };

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Financial Report</h1>
            <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Revenue & Payment Analytics
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors disabled:opacity-50`}
            >
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors disabled:opacity-50`}
            >
              Export Excel
            </button>
            <button
              onClick={handlePrint}
              className={`px-4 py-2 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-500 hover:bg-gray-600'} text-white transition-colors`}
            >
              Print
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-300 dark:border-gray-700">
          {['summary', 'revenue', 'payments', 'outstanding'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium capitalize transition-colors ${
                activeTab === tab
                  ? `border-b-2 ${isDarkMode ? 'border-blue-400 text-blue-400' : 'border-blue-600 text-blue-600'}`
                  : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div ref={reportRef} className="space-y-6">
        {activeTab === 'summary' && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-blue-500 to-blue-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Expected Revenue</p>
                <p className="text-3xl font-bold">{formatCurrency(data.summary.totalExpectedRevenue)}</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-green-500 to-green-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Total Collected</p>
                <p className="text-3xl font-bold">{formatCurrency(data.summary.totalCollected)}</p>
                <p className="text-sm mt-1">
                  {data.summary.comparedToLastTerm > 0 ? '↑' : '↓'} {Math.abs(data.summary.comparedToLastTerm).toFixed(1)}% vs last term
                </p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-red-500 to-red-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Outstanding</p>
                <p className="text-3xl font-bold">{formatCurrency(data.summary.totalOutstanding)}</p>
              </div>
              <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-purple-500 to-purple-600'} text-white`}>
                <p className="text-sm opacity-90 mb-2">Collection Rate</p>
                <p className="text-3xl font-bold">{data.summary.collectionRate.toFixed(1)}%</p>
              </div>
            </div>

            {/* Revenue Forecast */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Revenue Forecast</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Next Month</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.forecast.nextMonth)}</p>
                </div>
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Next Quarter</p>
                  <p className="text-2xl font-bold">{formatCurrency(data.forecast.nextQuarter)}</p>
                </div>
                <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Confidence</p>
                  <p className="text-2xl font-bold">{data.forecast.confidence.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'revenue' && (
          <>
            {/* Revenue Trend */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Revenue Trend with Forecast</h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={data.revenueByMonth}>
                  <defs>
                    <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="month" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="expected" stroke="#3b82f6" fillOpacity={1} fill="url(#colorExpected)" name="Expected" />
                  <Area type="monotone" dataKey="actual" stroke="#10b981" fillOpacity={1} fill="url(#colorActual)" name="Actual" />
                  {data.revenueByMonth.some(m => m.forecast) && (
                    <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeDasharray="5 5" fill="none" name="Forecast" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Performance */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Monthly Performance</h3>
              <div className="overflow-x-auto">
                <table className={`w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}>
                    <tr>
                      <th className="px-4 py-2 text-left">Month</th>
                      <th className="px-4 py-2 text-right">Expected</th>
                      <th className="px-4 py-2 text-right">Actual</th>
                      <th className="px-4 py-2 text-right">Difference</th>
                      <th className="px-4 py-2 text-right">Achievement %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revenueByMonth.map((month, index) => {
                      const difference = month.actual - month.expected;
                      const achievement = month.expected > 0 ? (month.actual / month.expected) * 100 : 0;
                      return (
                        <tr
                          key={index}
                          className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                        >
                          <td className="px-4 py-2">{month.month}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(month.expected)}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(month.actual)}</td>
                          <td className={`px-4 py-2 text-right font-medium ${difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {difference >= 0 ? '+' : ''}{formatCurrency(difference)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={`font-bold ${achievement >= 100 ? 'text-green-600' : achievement >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {achievement.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'payments' && (
          <>
            {/* Payment Methods Distribution */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Payment Method Distribution</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.paymentMethods}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.method}: ${entry.percentage.toFixed(1)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {data.paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="space-y-3">
                  {data.paymentMethods.map((method, index) => (
                    <div key={index} className={`p-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{method.method}</span>
                        <span className="text-sm">{method.count} transactions</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-2xl font-bold">{formatCurrency(method.amount)}</span>
                        <span className={`px-3 py-1 rounded text-sm font-medium`} style={{ backgroundColor: COLORS[index % COLORS.length], color: 'white' }}>
                          {method.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'outstanding' && (
          <>
            {/* Outstanding by Class */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Outstanding Fees by Class</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={data.outstandingByClass}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis dataKey="className" stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <YAxis stroke={isDarkMode ? '#9ca3af' : '#6b7280'} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      color: isDarkMode ? '#fff' : '#000',
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                  <Legend />
                  <Bar dataKey="totalOutstanding" fill="#ef4444" name="Total Outstanding" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Outstanding Details Table */}
            <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <h3 className="text-lg font-bold mb-4">Outstanding Details by Class</h3>
              <div className="overflow-x-auto">
                <table className={`w-full ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}>
                  <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-200'}>
                    <tr>
                      <th className="px-4 py-2 text-left">Class</th>
                      <th className="px-4 py-2 text-center">Total Students</th>
                      <th className="px-4 py-2 text-center">Students with Outstanding</th>
                      <th className="px-4 py-2 text-right">Total Outstanding</th>
                      <th className="px-4 py-2 text-center">% with Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outstandingByClass.map((classData, index) => {
                      const percentage = classData.totalStudents > 0
                        ? (classData.studentsWithOutstanding / classData.totalStudents) * 100
                        : 0;
                      return (
                        <tr
                          key={index}
                          className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                        >
                          <td className="px-4 py-2 font-medium">{classData.className}</td>
                          <td className="px-4 py-2 text-center">{classData.totalStudents}</td>
                          <td className="px-4 py-2 text-center">{classData.studentsWithOutstanding}</td>
                          <td className="px-4 py-2 text-right font-bold text-red-600">
                            {formatCurrency(classData.totalOutstanding)}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className={`px-2 py-1 rounded text-sm ${percentage > 50 ? 'bg-red-200 text-red-800' : percentage > 25 ? 'bg-yellow-200 text-yellow-800' : 'bg-green-200 text-green-800'}`}>
                              {percentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default FinancialReport;
