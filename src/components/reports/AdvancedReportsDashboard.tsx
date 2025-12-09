import React, { useState, useEffect } from 'react';
import { getLocalTemplates, ReportTemplate, deleteTemplateLocally } from '../../services/reportBuilderService';

interface AdvancedReportsDashboardProps {
  onOpenReport?: (reportType: string, templateId?: number) => void;
  onCreateCustomReport?: () => void;
  isDarkMode?: boolean;
}

export const AdvancedReportsDashboard: React.FC<AdvancedReportsDashboardProps> = ({
  onOpenReport,
  onCreateCustomReport,
  isDarkMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'available' | 'templates' | 'recent'>('available');
  const [savedTemplates, setSavedTemplates] = useState<ReportTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const templates = getLocalTemplates();
    setSavedTemplates(templates);
  };

  const handleDeleteTemplate = (templateId: number) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteTemplateLocally(templateId);
      loadTemplates();
    }
  };

  const reportTypes = [
    {
      id: 'academic-progress',
      title: 'Academic Progress Report',
      description: 'Detailed trend analysis and comparative charts for student academic performance',
      icon: '📊',
      color: 'from-blue-500 to-blue-600',
    },
    {
      id: 'financial',
      title: 'Financial Report',
      description: 'Revenue forecasting and payment analytics for school finance management',
      icon: '💰',
      color: 'from-green-500 to-green-600',
    },
    {
      id: 'attendance-pattern',
      title: 'Attendance Pattern Report',
      description: 'Heatmaps and anomaly detection for attendance patterns',
      icon: '📅',
      color: 'from-purple-500 to-purple-600',
    },
    {
      id: 'teacher-performance',
      title: 'Teacher Performance Report',
      description: 'Rating trends and student feedback analysis for teachers',
      icon: '👨‍🏫',
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      id: 'custom',
      title: 'Custom Report Builder',
      description: 'Create custom reports with drag-and-drop interface',
      icon: '🎨',
      color: 'from-pink-500 to-pink-600',
    },
  ];

  const recentReports = [
    { name: 'Q1 Financial Summary', type: 'Financial', date: '2024-01-15', author: 'Admin' },
    { name: 'Class 10A Progress Report', type: 'Academic', date: '2024-01-14', author: 'Teacher' },
    { name: 'December Attendance Analysis', type: 'Attendance', date: '2024-01-13', author: 'Admin' },
  ];

  const filteredTemplates = savedTemplates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Advanced Reports Dashboard</h1>
        <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Generate comprehensive reports with interactive visualizations
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search reports and templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full md:w-96 p-3 rounded-lg ${isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-300'} border focus:outline-none focus:ring-2 focus:ring-blue-500`}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-300 dark:border-gray-700 mb-6">
        {['available', 'templates', 'recent'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              activeTab === tab
                ? `border-b-2 ${isDarkMode ? 'border-blue-400 text-blue-400' : 'border-blue-600 text-blue-600'}`
                : isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {tab === 'available' ? 'Available Reports' : tab === 'templates' ? 'Saved Templates' : 'Recent Reports'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'available' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reportTypes.map((report) => (
            <div
              key={report.id}
              className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} hover:shadow-lg transition-shadow cursor-pointer`}
              onClick={() => {
                if (report.id === 'custom' && onCreateCustomReport) {
                  onCreateCustomReport();
                } else if (onOpenReport) {
                  onOpenReport(report.id);
                }
              }}
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${report.color} flex items-center justify-center text-2xl mb-4`}>
                {report.icon}
              </div>
              <h3 className="text-lg font-bold mb-2">{report.title}</h3>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {report.description}
              </p>
              <button
                className={`mt-4 w-full py-2 rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (report.id === 'custom' && onCreateCustomReport) {
                    onCreateCustomReport();
                  } else if (onOpenReport) {
                    onOpenReport(report.id);
                  }
                }}
              >
                {report.id === 'custom' ? 'Create Report' : 'Generate Report'}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div>
          {filteredTemplates.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <div className="text-6xl mb-4">📋</div>
              <p className="text-lg mb-2">No saved templates yet</p>
              <p className="text-sm">Create custom reports and save them as templates for quick access</p>
              <button
                onClick={onCreateCustomReport}
                className={`mt-4 px-6 py-2 rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors`}
              >
                Create Custom Report
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold">{template.name}</h3>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-500 hover:text-red-600"
                      title="Delete template"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
                    {template.description || 'No description'}
                  </p>
                  <div className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-500'} mb-4`}>
                    <p>Created: {new Date(template.createdAt).toLocaleDateString()}</p>
                    <p>Components: {template.components.length}</p>
                    <p>By: {template.createdBy}</p>
                  </div>
                  <button
                    onClick={() => onOpenReport && onOpenReport('custom', template.id)}
                    className={`w-full py-2 rounded ${isDarkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white transition-colors`}
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'recent' && (
        <div>
          {recentReports.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg">No recent reports</p>
            </div>
          ) : (
            <div className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <table className="w-full">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-medium">Report Name</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Generated By</th>
                    <th className="px-6 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {recentReports.map((report, index) => (
                    <tr key={index} className={isDarkMode ? 'hover:bg-gray-750' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 text-sm font-medium">{report.name}</td>
                      <td className="px-6 py-4 text-sm">{report.type}</td>
                      <td className="px-6 py-4 text-sm">{new Date(report.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm">{report.author}</td>
                      <td className="px-6 py-4 text-sm">
                        <button className="text-blue-500 hover:text-blue-600 mr-3">View</button>
                        <button className="text-green-500 hover:text-green-600 mr-3">Download</button>
                        <button className="text-red-500 hover:text-red-600">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-blue-500 to-blue-600'} text-white`}>
          <p className="text-sm opacity-90">Total Reports</p>
          <p className="text-3xl font-bold">{reportTypes.length}</p>
        </div>
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-green-500 to-green-600'} text-white`}>
          <p className="text-sm opacity-90">Saved Templates</p>
          <p className="text-3xl font-bold">{savedTemplates.length}</p>
        </div>
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-purple-500 to-purple-600'} text-white`}>
          <p className="text-sm opacity-90">Recent Reports</p>
          <p className="text-3xl font-bold">{recentReports.length}</p>
        </div>
        <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-br from-yellow-500 to-yellow-600'} text-white`}>
          <p className="text-sm opacity-90">This Month</p>
          <p className="text-3xl font-bold">{recentReports.length}</p>
        </div>
      </div>
    </div>
  );
};

export default AdvancedReportsDashboard;
