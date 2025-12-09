/**
 * Report Builder Service
 * Manages custom report templates and configurations
 */

export interface DataSourceConfig {
  entity: 'students' | 'attendance' | 'grades' | 'fees' | 'teachers' | 'reports';
  filters: Filter[];
  groupBy?: string;
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max';
  dateRange?: { start: string; end: string };
}

export interface Filter {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'between';
  value: any;
}

export interface ChartConfig {
  chartType: 'line' | 'bar' | 'pie' | 'area' | 'scatter' | 'radar' | 'heatmap' | 'gauge';
  title: string;
  xAxis?: string;
  yAxis?: string;
  series: string[];
  colors?: string[];
  showLegend: boolean;
  showLabels: boolean;
}

export interface TableConfig {
  columns: {
    key: string;
    header: string;
    width?: number;
    type?: 'string' | 'number' | 'date' | 'currency';
  }[];
  sortable: boolean;
  filterable: boolean;
}

export interface MetricConfig {
  label: string;
  value: string;
  format?: 'number' | 'currency' | 'percentage';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

export interface TextConfig {
  content: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
}

export interface ReportComponent {
  id: string;
  type: 'chart' | 'table' | 'metric' | 'text' | 'image';
  config: ChartConfig | TableConfig | MetricConfig | TextConfig;
  position: { x: number; y: number; w: number; h: number };
  dataSource: DataSourceConfig;
}

export interface ReportParameter {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  defaultValue?: any;
  options?: string[];
  required: boolean;
}

export interface ReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'termly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'email';
}

export interface ReportTemplate {
  id: number;
  name: string;
  description: string;
  components: ReportComponent[];
  parameters: ReportParameter[];
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  schedules?: ReportSchedule[];
}

/**
 * Create a new report template
 */
export const createReportTemplate = (
  name: string,
  description: string,
  components: ReportComponent[],
  parameters: ReportParameter[],
  createdBy: string,
  isPublic: boolean = false
): ReportTemplate => {
  return {
    id: Date.now(), // Temporary ID until saved to database
    name,
    description,
    components,
    parameters,
    createdBy,
    createdAt: new Date().toISOString(),
    isPublic,
    schedules: [],
  };
};

/**
 * Validate report template
 */
export const validateReportTemplate = (template: ReportTemplate): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!template.name || template.name.trim().length === 0) {
    errors.push('Template name is required');
  }

  if (!template.components || template.components.length === 0) {
    errors.push('Template must have at least one component');
  }

  template.components.forEach((component, index) => {
    if (!component.id) {
      errors.push(`Component ${index + 1} is missing an ID`);
    }
    if (!component.type) {
      errors.push(`Component ${index + 1} is missing a type`);
    }
    if (!component.dataSource) {
      errors.push(`Component ${index + 1} is missing a data source`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Apply filters to data
 */
export const applyFilters = (data: any[], filters: Filter[]): any[] => {
  return data.filter(item => {
    return filters.every(filter => {
      const value = item[filter.field];
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'notEquals':
          return value !== filter.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'greaterThan':
          return Number(value) > Number(filter.value);
        case 'lessThan':
          return Number(value) < Number(filter.value);
        case 'between':
          return Number(value) >= Number(filter.value[0]) && Number(value) <= Number(filter.value[1]);
        default:
          return true;
      }
    });
  });
};

/**
 * Apply aggregation to data
 */
export const applyAggregation = (
  data: any[],
  field: string,
  aggregation: DataSourceConfig['aggregation']
): number => {
  if (!aggregation || data.length === 0) return 0;

  const values = data.map(item => Number(item[field]) || 0);

  switch (aggregation) {
    case 'sum':
      return values.reduce((sum, v) => sum + v, 0);
    case 'avg':
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    case 'count':
      return values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    default:
      return 0;
  }
};

/**
 * Group data by field
 */
export const groupDataBy = (data: any[], field: string): { [key: string]: any[] } => {
  return data.reduce((groups, item) => {
    const key = item[field] || 'Unknown';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as { [key: string]: any[] });
};

/**
 * Process data source configuration
 */
export const processDataSource = (
  data: any[],
  config: DataSourceConfig
): any[] => {
  let processedData = [...data];

  // Apply filters
  if (config.filters && config.filters.length > 0) {
    processedData = applyFilters(processedData, config.filters);
  }

  // Apply date range filter
  if (config.dateRange) {
    processedData = processedData.filter(item => {
      const itemDate = new Date(item.date || item.created_at);
      const start = new Date(config.dateRange!.start);
      const end = new Date(config.dateRange!.end);
      return itemDate >= start && itemDate <= end;
    });
  }

  // Apply grouping
  if (config.groupBy) {
    const grouped = groupDataBy(processedData, config.groupBy);
    processedData = Object.entries(grouped).map(([key, items]) => {
      const result: any = { [config.groupBy!]: key };
      
      // Apply aggregation if specified
      if (config.aggregation) {
        // Aggregate all numeric fields
        const numericFields = Object.keys(items[0] || {}).filter(
          field => typeof items[0][field] === 'number'
        );
        
        numericFields.forEach(field => {
          result[field] = applyAggregation(items, field, config.aggregation);
        });
      } else {
        // Return count if no aggregation specified
        result.count = items.length;
      }
      
      return result;
    });
  }

  return processedData;
};

/**
 * Generate chart data from processed data
 */
export const generateChartData = (
  data: any[],
  config: ChartConfig
): any => {
  // Format data based on chart type
  switch (config.chartType) {
    case 'pie':
      return data.map(item => ({
        name: item[config.xAxis || 'name'],
        value: item[config.series[0]],
      }));

    case 'line':
    case 'bar':
    case 'area':
      return data.map(item => {
        const dataPoint: any = {
          name: item[config.xAxis || 'name'],
        };
        config.series.forEach(series => {
          dataPoint[series] = item[series];
        });
        return dataPoint;
      });

    case 'scatter':
      return config.series.map(series => ({
        name: series,
        data: data.map(item => ({
          x: item[config.xAxis || 'x'],
          y: item[series],
        })),
      }));

    case 'radar':
      return {
        labels: data.map(item => item[config.xAxis || 'name']),
        datasets: config.series.map(series => ({
          label: series,
          data: data.map(item => item[series]),
        })),
      };

    default:
      return data;
  }
};

/**
 * Save report template to local storage
 */
export const saveTemplateLocally = (template: ReportTemplate): void => {
  const templates = getLocalTemplates();
  const existingIndex = templates.findIndex(t => t.id === template.id);
  
  if (existingIndex >= 0) {
    templates[existingIndex] = template;
  } else {
    templates.push(template);
  }
  
  localStorage.setItem('report_templates', JSON.stringify(templates));
};

/**
 * Get report templates from local storage
 */
export const getLocalTemplates = (): ReportTemplate[] => {
  const stored = localStorage.getItem('report_templates');
  return stored ? JSON.parse(stored) : [];
};

/**
 * Delete report template from local storage
 */
export const deleteTemplateLocally = (templateId: number): void => {
  const templates = getLocalTemplates();
  const filtered = templates.filter(t => t.id !== templateId);
  localStorage.setItem('report_templates', JSON.stringify(filtered));
};
