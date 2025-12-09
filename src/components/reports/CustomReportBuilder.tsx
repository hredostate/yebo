import React, { useState } from 'react';
import { ReportComponent, ReportTemplate, ChartConfig, TableConfig, MetricConfig, TextConfig, DataSourceConfig, createReportTemplate, validateReportTemplate, saveTemplateLocally, getLocalTemplates } from '../../services/reportBuilderService';
import ReportCanvas from './ReportCanvas';

interface CustomReportBuilderProps {
  isDarkMode?: boolean;
  onSave?: (template: ReportTemplate) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  isDarkMode = false,
  onSave,
  onShowToast,
}) => {
  const [components, setComponents] = useState<ReportComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<ReportComponent | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [validationError, setValidationError] = useState('');

  const componentTypes = [
    { type: 'chart', label: 'Chart', icon: '📊' },
    { type: 'table', label: 'Table', icon: '📋' },
    { type: 'metric', label: 'Metric', icon: '📈' },
    { type: 'text', label: 'Text', icon: '📝' },
  ];

  const chartTypes = ['line', 'bar', 'pie', 'area', 'scatter', 'radar', 'heatmap', 'gauge'];
  const dataEntities = ['students', 'attendance', 'grades', 'fees', 'teachers', 'reports'];

  const addComponent = (type: string) => {
    const newComponent: ReportComponent = {
      id: `component_${Date.now()}`,
      type: type as any,
      config: getDefaultConfig(type),
      position: { x: 0, y: components.length * 2, w: 6, h: 2 },
      dataSource: {
        entity: 'students',
        filters: [],
      },
    };

    setComponents([...components, newComponent]);
    setSelectedComponent(newComponent);
  };

  const getDefaultConfig = (type: string): any => {
    switch (type) {
      case 'chart':
        return {
          chartType: 'bar',
          title: 'New Chart',
          series: ['value'],
          showLegend: true,
          showLabels: true,
        } as ChartConfig;
      
      case 'table':
        return {
          columns: [{ key: 'name', header: 'Name', width: 150 }],
          sortable: true,
          filterable: true,
        } as TableConfig;
      
      case 'metric':
        return {
          label: 'Metric',
          value: 'value',
          format: 'number',
        } as MetricConfig;
      
      case 'text':
        return {
          content: 'Enter your text here',
          fontSize: 14,
          fontWeight: 'normal',
          align: 'left',
        } as TextConfig;
      
      default:
        return {};
    }
  };

  const removeComponent = (componentId: string) => {
    setComponents(components.filter(c => c.id !== componentId));
    if (selectedComponent?.id === componentId) {
      setSelectedComponent(null);
    }
  };

  const updateComponentConfig = (updates: Partial<any>) => {
    if (!selectedComponent) return;

    const updatedComponents = components.map(c => {
      if (c.id === selectedComponent.id) {
        return {
          ...c,
          config: { ...c.config, ...updates },
        };
      }
      return c;
    });

    setComponents(updatedComponents);
    setSelectedComponent({
      ...selectedComponent,
      config: { ...selectedComponent.config, ...updates },
    });
  };

  const updateDataSource = (updates: Partial<DataSourceConfig>) => {
    if (!selectedComponent) return;

    const updatedComponents = components.map(c => {
      if (c.id === selectedComponent.id) {
        return {
          ...c,
          dataSource: { ...c.dataSource, ...updates },
        };
      }
      return c;
    });

    setComponents(updatedComponents);
    setSelectedComponent({
      ...selectedComponent,
      dataSource: { ...selectedComponent.dataSource, ...updates },
    });
  };

  const handleSaveTemplate = () => {
    setValidationError('');
    
    if (!templateName.trim()) {
      setValidationError('Please enter a template name');
      return;
    }

    const template = createReportTemplate(
      templateName,
      templateDescription,
      components,
      [],
      'Current User',
      false
    );

    const validation = validateReportTemplate(template);
    if (!validation.valid) {
      setValidationError(validation.errors.join(', '));
      return;
    }

    saveTemplateLocally(template);
    
    if (onSave) {
      onSave(template);
    }

    if (onShowToast) {
      onShowToast('Template saved successfully!', 'success');
    }
    
    setShowSaveDialog(false);
    setTemplateName('');
    setTemplateDescription('');
    setValidationError('');
  };

  return (
    <div className={`h-screen flex ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      {/* Left Sidebar - Component Palette */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-300'} p-4`}>
        <h2 className="text-lg font-bold mb-4">Components</h2>
        <div className="space-y-2">
          {componentTypes.map((comp) => (
            <button
              key={comp.type}
              onClick={() => addComponent(comp.type)}
              className={`w-full p-3 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-50'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'} flex items-center gap-3 transition-colors`}
            >
              <span className="text-2xl">{comp.icon}</span>
              <span className="font-medium">{comp.label}</span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold mb-2">Actions</h3>
          <button
            onClick={() => setShowSaveDialog(true)}
            disabled={components.length === 0}
            className={`w-full p-2 rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors disabled:opacity-50`}
          >
            Save Template
          </button>
          <button
            onClick={() => setComponents([])}
            disabled={components.length === 0}
            className={`w-full p-2 rounded mt-2 ${isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white transition-colors disabled:opacity-50`}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="mb-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Custom Report Builder</h1>
          <div className={`px-3 py-1 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            {components.length} component{components.length !== 1 ? 's' : ''}
          </div>
        </div>
        
        <ReportCanvas
          components={components}
          onComponentClick={setSelectedComponent}
          onComponentRemove={removeComponent}
          isDarkMode={isDarkMode}
        />
      </div>

      {/* Right Sidebar - Properties Panel */}
      <div className={`w-80 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} border-l ${isDarkMode ? 'border-gray-700' : 'border-gray-300'} p-4 overflow-auto`}>
        <h2 className="text-lg font-bold mb-4">Properties</h2>
        
        {selectedComponent ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Component Type</label>
              <div className={`p-2 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
                {selectedComponent.type.toUpperCase()}
              </div>
            </div>

            {/* Chart Config */}
            {selectedComponent.type === 'chart' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={(selectedComponent.config as ChartConfig).title}
                    onChange={(e) => updateComponentConfig({ title: e.target.value })}
                    className={`w-full p-2 rounded ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Chart Type</label>
                  <select
                    value={(selectedComponent.config as ChartConfig).chartType}
                    onChange={(e) => updateComponentConfig({ chartType: e.target.value })}
                    className={`w-full p-2 rounded ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  >
                    {chartTypes.map(type => (
                      <option key={type} value={type}>{type.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(selectedComponent.config as ChartConfig).showLegend}
                      onChange={(e) => updateComponentConfig({ showLegend: e.target.checked })}
                    />
                    <span className="text-sm">Show Legend</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={(selectedComponent.config as ChartConfig).showLabels}
                      onChange={(e) => updateComponentConfig({ showLabels: e.target.checked })}
                    />
                    <span className="text-sm">Show Labels</span>
                  </label>
                </div>
              </>
            )}

            {/* Text Config */}
            {selectedComponent.type === 'text' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-2">Content</label>
                  <textarea
                    value={(selectedComponent.config as TextConfig).content}
                    onChange={(e) => updateComponentConfig({ content: e.target.value })}
                    rows={4}
                    className={`w-full p-2 rounded ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  />
                </div>
              </>
            )}

            {/* Data Source */}
            <div className="pt-4 border-t border-gray-300 dark:border-gray-700">
              <h3 className="text-sm font-bold mb-2">Data Source</h3>
              <div>
                <label className="block text-sm font-medium mb-2">Entity</label>
                <select
                  value={selectedComponent.dataSource.entity}
                  onChange={(e) => updateDataSource({ entity: e.target.value as any })}
                  className={`w-full p-2 rounded ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                >
                  {dataEntities.map(entity => (
                    <option key={entity} value={entity}>{entity.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        ) : (
          <p className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>
            Select a component to edit its properties
          </p>
        )}
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg w-96`}>
            <h2 className="text-xl font-bold mb-4">Save Report Template</h2>
            <div className="space-y-4">
              {validationError && (
                <div className="p-3 rounded bg-red-100 border border-red-400 text-red-700">
                  {validationError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => {
                    setTemplateName(e.target.value);
                    setValidationError('');
                  }}
                  className={`w-full p-2 rounded ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  placeholder="My Report Template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description (Optional)</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  rows={3}
                  className={`w-full p-2 rounded ${isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900'} border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
                  placeholder="Describe your report template..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setValidationError('');
                  }}
                  className={`px-4 py-2 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-300 hover:bg-gray-400'} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTemplate}
                  className={`px-4 py-2 rounded ${isDarkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white transition-colors`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomReportBuilder;
