/**
 * Financial Analytics Service
 * Provides revenue forecasting and payment analytics
 */

export interface FinancialSummary {
  totalExpectedRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  comparedToLastTerm: number;
}

export interface RevenueByMonth {
  month: string;
  expected: number;
  actual: number;
  forecast?: number;
}

export interface PaymentMethod {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface OutstandingByClass {
  className: string;
  totalStudents: number;
  studentsWithOutstanding: number;
  totalOutstanding: number;
}

export interface RevenueForecast {
  nextMonth: number;
  nextQuarter: number;
  confidence: number;
}

export interface FinancialReportData {
  summary: FinancialSummary;
  revenueByMonth: RevenueByMonth[];
  paymentMethods: PaymentMethod[];
  outstandingByClass: OutstandingByClass[];
  forecast: RevenueForecast;
}

/**
 * Calculate financial summary from fee records
 */
export const calculateFinancialSummary = (
  feeRecords: any[],
  previousTermRecords?: any[]
): FinancialSummary => {
  const totalExpectedRevenue = feeRecords.reduce(
    (sum, record) => sum + (record.amount_due || 0),
    0
  );
  
  const totalCollected = feeRecords.reduce(
    (sum, record) => sum + (record.amount_paid || 0),
    0
  );
  
  const totalOutstanding = totalExpectedRevenue - totalCollected;
  const collectionRate = totalExpectedRevenue > 0 
    ? (totalCollected / totalExpectedRevenue) * 100 
    : 0;

  let comparedToLastTerm = 0;
  if (previousTermRecords && previousTermRecords.length > 0) {
    const previousCollected = previousTermRecords.reduce(
      (sum, record) => sum + (record.amount_paid || 0),
      0
    );
    if (previousCollected > 0) {
      comparedToLastTerm = ((totalCollected - previousCollected) / previousCollected) * 100;
    }
  }

  return {
    totalExpectedRevenue,
    totalCollected,
    totalOutstanding,
    collectionRate,
    comparedToLastTerm,
  };
};

/**
 * Group revenue by month
 */
export const groupRevenueByMonth = (
  feeRecords: any[],
  startDate: Date,
  endDate: Date
): RevenueByMonth[] => {
  const months: Map<string, { expected: number; actual: number }> = new Map();
  
  // Initialize months
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const monthKey = currentDate.toISOString().slice(0, 7);
    months.set(monthKey, { expected: 0, actual: 0 });
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  // Group records by month
  feeRecords.forEach((record) => {
    const recordDate = new Date(record.created_at || record.due_date);
    const monthKey = recordDate.toISOString().slice(0, 7);
    
    if (months.has(monthKey)) {
      const monthData = months.get(monthKey)!;
      monthData.expected += record.amount_due || 0;
      monthData.actual += record.amount_paid || 0;
    }
  });

  return Array.from(months.entries())
    .map(([month, data]) => ({
      month: new Date(month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      expected: data.expected,
      actual: data.actual,
    }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
};

/**
 * Analyze payment methods
 */
export const analyzePaymentMethods = (payments: any[]): PaymentMethod[] => {
  const methodMap: Map<string, { amount: number; count: number }> = new Map();
  
  payments.forEach((payment) => {
    const method = payment.payment_method || 'Unknown';
    const existing = methodMap.get(method) || { amount: 0, count: 0 };
    existing.amount += payment.amount || 0;
    existing.count += 1;
    methodMap.set(method, existing);
  });

  const totalAmount = Array.from(methodMap.values()).reduce(
    (sum, m) => sum + m.amount,
    0
  );

  return Array.from(methodMap.entries()).map(([method, data]) => ({
    method,
    amount: data.amount,
    count: data.count,
    percentage: totalAmount > 0 ? (data.amount / totalAmount) * 100 : 0,
  }));
};

/**
 * Calculate outstanding fees by class
 */
export const calculateOutstandingByClass = (
  feeRecords: any[],
  students: any[]
): OutstandingByClass[] => {
  const classMap: Map<string, {
    totalStudents: number;
    studentsWithOutstanding: number;
    totalOutstanding: number;
  }> = new Map();

  // Group students by class
  students.forEach((student) => {
    const className = student.class?.name || student.grade || 'Unknown';
    if (!classMap.has(className)) {
      classMap.set(className, {
        totalStudents: 0,
        studentsWithOutstanding: 0,
        totalOutstanding: 0,
      });
    }
    const classData = classMap.get(className)!;
    classData.totalStudents += 1;

    // Find student's fee records
    const studentRecords = feeRecords.filter((r) => r.student_id === student.id);
    const outstanding = studentRecords.reduce(
      (sum, r) => sum + ((r.amount_due || 0) - (r.amount_paid || 0)),
      0
    );

    if (outstanding > 0) {
      classData.studentsWithOutstanding += 1;
      classData.totalOutstanding += outstanding;
    }
  });

  return Array.from(classMap.entries()).map(([className, data]) => ({
    className,
    ...data,
  }));
};

/**
 * Simple revenue forecasting using linear regression
 */
export const forecastRevenue = (revenueData: RevenueByMonth[]): RevenueForecast => {
  if (revenueData.length < 2) {
    return {
      nextMonth: 0,
      nextQuarter: 0,
      confidence: 0,
    };
  }

  // Use simple moving average for forecast
  const recentMonths = revenueData.slice(-3);
  const avgRevenue = recentMonths.reduce((sum, m) => sum + m.actual, 0) / recentMonths.length;

  // Calculate trend
  const firstMonth = revenueData[0].actual;
  const lastMonth = revenueData[revenueData.length - 1].actual;
  const trend = revenueData.length > 1 ? (lastMonth - firstMonth) / revenueData.length : 0;

  const nextMonth = avgRevenue + trend;
  const nextQuarter = (avgRevenue + trend) * 3;

  // Simple confidence calculation based on data consistency
  const variance = recentMonths.reduce(
    (sum, m) => sum + Math.pow(m.actual - avgRevenue, 2),
    0
  ) / recentMonths.length;
  const stdDev = Math.sqrt(variance);
  const confidence = Math.max(0, Math.min(100, 100 - (stdDev / avgRevenue) * 100));

  return {
    nextMonth: Math.max(0, nextMonth),
    nextQuarter: Math.max(0, nextQuarter),
    confidence,
  };
};

/**
 * Generate complete financial report data
 */
export const generateFinancialReportData = (
  feeRecords: any[],
  payments: any[],
  students: any[],
  previousTermRecords?: any[]
): FinancialReportData => {
  const summary = calculateFinancialSummary(feeRecords, previousTermRecords);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  
  const revenueByMonth = groupRevenueByMonth(feeRecords, startDate, endDate);
  const paymentMethods = analyzePaymentMethods(payments);
  const outstandingByClass = calculateOutstandingByClass(feeRecords, students);
  const forecast = forecastRevenue(revenueByMonth);

  return {
    summary,
    revenueByMonth,
    paymentMethods,
    outstandingByClass,
    forecast,
  };
};
