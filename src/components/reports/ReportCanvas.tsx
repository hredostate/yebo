import React, { useState } from 'react';
import { ReportComponent, ReportTemplate, ChartConfig, DataSourceConfig } from '../../services/reportBuilderService';

interface ReportCanvasProps {
  components: ReportComponent[];
  onComponentClick?: (component: ReportComponent) => void;
  onComponentRemove?: (componentId: string) => void;
  isDarkMode?: boolean;
}

export const ReportCanvas: React.FC<ReportCanvasProps> = ({
  components,
  onComponentClick,
  onComponentRemove,
  isDarkMode = false,
}) => {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  const handleComponentClick = (component: ReportComponent) => {
    setSelectedComponent(component.id);
    if (onComponentClick) {
      onComponentClick(component);
    }
  };

  const renderComponentPreview = (component: ReportComponent) => {
    const { type, config } = component;

    switch (type) {
      case 'chart':
        const chartConfig = config as ChartConfig;
        return (
          <div className={`h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded`}>
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p className="font-medium">{chartConfig.title}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {chartConfig.chartType.toUpperCase()} Chart
              </p>
            </div>
          </div>
        );

      case 'table':
        return (
          <div className={`h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded`}>
            <div className="text-center">
              <div className="text-4xl mb-2">📋</div>
              <p className="font-medium">Data Table</p>
            </div>
          </div>
        );

      case 'metric':
        return (
          <div className={`h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded`}>
            <div className="text-center">
              <div className="text-4xl mb-2">📈</div>
              <p className="font-medium">Metric Card</p>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className={`h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded p-4`}>
            <div className="text-center">
              <div className="text-4xl mb-2">📝</div>
              <p className="font-medium">Text Block</p>
            </div>
          </div>
        );

      default:
        return (
          <div className={`h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} rounded`}>
            <p>Unknown Component</p>
          </div>
        );
    }
  };

  return (
    <div className={`p-4 min-h-[600px] ${isDarkMode ? 'bg-gray-800' : 'bg-white'} border ${isDarkMode ? 'border-gray-700' : 'border-gray-300'} rounded-lg`}>
      {components.length === 0 ? (
        <div className={`h-full flex items-center justify-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          <div className="text-center">
            <p className="text-xl mb-2">Drop components here to build your report</p>
            <p className="text-sm">Select from the component palette on the left</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 auto-rows-[100px]">
          {components.map((component) => (
            <div
              key={component.id}
              className={`cursor-pointer transition-all ${
                selectedComponent === component.id
                  ? `ring-2 ${isDarkMode ? 'ring-blue-500' : 'ring-blue-600'}`
                  : ''
              }`}
              style={{
                gridColumn: `span ${component.position.w}`,
                gridRow: `span ${component.position.h}`,
              }}
              onClick={() => handleComponentClick(component)}
            >
              <div className="relative h-full">
                {renderComponentPreview(component)}
                {onComponentRemove && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onComponentRemove(component.id);
                    }}
                    className={`absolute top-2 right-2 w-6 h-6 rounded-full ${isDarkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white flex items-center justify-center`}
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportCanvas;
