/**
 * Attendance Analytics Service
 * Provides attendance pattern analysis and anomaly detection
 */

export interface AttendanceOverview {
  averageAttendance: number;
  totalDays: number;
  totalStudents: number;
  chronicAbsentees: number;
  perfectAttendance: number;
}

export interface HeatmapData {
  date: string;
  dayOfWeek: number;
  week: number;
  attendanceRate: number;
  totalPresent: number;
  totalAbsent: number;
}

export interface DayOfWeekAnalysis {
  day: string;
  averageAttendance: number;
  mostAbsentDay: boolean;
}

export interface AttendanceAnomaly {
  date: string;
  expectedRate: number;
  actualRate: number;
  deviation: number;
  possibleReasons: string[];
}

export interface StudentPattern {
  studentId: number;
  name: string;
  attendanceRate: number;
  pattern: 'regular' | 'irregular' | 'chronic';
  riskLevel: 'low' | 'medium' | 'high';
  commonAbsenceDays: string[];
}

export interface AttendancePatternData {
  overview: AttendanceOverview;
  heatmapData: HeatmapData[];
  dayOfWeekAnalysis: DayOfWeekAnalysis[];
  anomalies: AttendanceAnomaly[];
  studentPatterns: StudentPattern[];
}

/**
 * Calculate attendance overview statistics
 */
export const calculateAttendanceOverview = (
  attendanceRecords: any[],
  students: any[]
): AttendanceOverview => {
  const uniqueDates = new Set(attendanceRecords.map(r => r.date));
  const totalDays = uniqueDates.size;
  const totalStudents = students.length;

  // Calculate average attendance
  const dailyAttendance = Array.from(uniqueDates).map(date => {
    const dayRecords = attendanceRecords.filter(r => r.date === date);
    const present = dayRecords.filter(r => r.status === 'Present' || r.status === 'present').length;
    return { date, present, total: dayRecords.length };
  });

  const averageAttendance = dailyAttendance.length > 0
    ? dailyAttendance.reduce((sum, d) => sum + (d.total > 0 ? (d.present / d.total) * 100 : 0), 0) / dailyAttendance.length
    : 0;

  // Count chronic absentees (< 90% attendance)
  const studentAttendance = students.map(student => {
    const studentRecords = attendanceRecords.filter(r => r.student_id === student.id);
    const present = studentRecords.filter(r => r.status === 'Present' || r.status === 'present').length;
    const rate = studentRecords.length > 0 ? (present / studentRecords.length) * 100 : 0;
    return { studentId: student.id, rate };
  });

  const chronicAbsentees = studentAttendance.filter(s => s.rate < 90).length;
  const perfectAttendance = studentAttendance.filter(s => s.rate === 100).length;

  return {
    averageAttendance,
    totalDays,
    totalStudents,
    chronicAbsentees,
    perfectAttendance,
  };
};

/**
 * Generate heatmap data for attendance visualization
 */
export const generateHeatmapData = (attendanceRecords: any[]): HeatmapData[] => {
  const dateMap: Map<string, { present: number; absent: number; total: number }> = new Map();

  attendanceRecords.forEach(record => {
    const date = record.date;
    if (!dateMap.has(date)) {
      dateMap.set(date, { present: 0, absent: 0, total: 0 });
    }
    const dayData = dateMap.get(date)!;
    dayData.total += 1;
    if (record.status === 'Present' || record.status === 'present') {
      dayData.present += 1;
    } else {
      dayData.absent += 1;
    }
  });

  return Array.from(dateMap.entries()).map(([date, data]) => {
    const dateObj = new Date(date);
    return {
      date,
      dayOfWeek: dateObj.getDay(),
      week: Math.floor((dateObj.getDate() - 1) / 7) + 1,
      attendanceRate: data.total > 0 ? (data.present / data.total) * 100 : 0,
      totalPresent: data.present,
      totalAbsent: data.absent,
    };
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Analyze attendance patterns by day of week
 */
export const analyzeDayOfWeek = (heatmapData: HeatmapData[]): DayOfWeekAnalysis[] => {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayMap: Map<number, number[]> = new Map();

  heatmapData.forEach(data => {
    if (!dayMap.has(data.dayOfWeek)) {
      dayMap.set(data.dayOfWeek, []);
    }
    dayMap.get(data.dayOfWeek)!.push(data.attendanceRate);
  });

  const analysis = Array.from(dayMap.entries()).map(([dayNum, rates]) => {
    const average = rates.reduce((sum, r) => sum + r, 0) / rates.length;
    return {
      day: dayNames[dayNum],
      averageAttendance: average,
      dayNum,
    };
  });

  const minAttendance = Math.min(...analysis.map(a => a.averageAttendance));

  return analysis.map(a => ({
    day: a.day,
    averageAttendance: a.averageAttendance,
    mostAbsentDay: a.averageAttendance === minAttendance,
  })).sort((a, b) => {
    const order = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
    return (order[a.day as keyof typeof order] || 0) - (order[b.day as keyof typeof order] || 0);
  });
};

/**
 * Detect attendance anomalies
 */
export const detectAnomalies = (heatmapData: HeatmapData[]): AttendanceAnomaly[] => {
  if (heatmapData.length < 5) return [];

  const rates = heatmapData.map(d => d.attendanceRate);
  const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  const variance = rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
  const stdDev = Math.sqrt(variance);

  const anomalies: AttendanceAnomaly[] = [];

  heatmapData.forEach(data => {
    const deviation = Math.abs(data.attendanceRate - mean);
    if (deviation > stdDev * 2) {
      const possibleReasons: string[] = [];
      
      if (data.attendanceRate < mean) {
        possibleReasons.push('Low attendance day');
        if (data.dayOfWeek === 1) possibleReasons.push('Monday effect');
        if (data.dayOfWeek === 5) possibleReasons.push('Friday effect');
      } else {
        possibleReasons.push('High attendance day');
      }

      anomalies.push({
        date: data.date,
        expectedRate: mean,
        actualRate: data.attendanceRate,
        deviation,
        possibleReasons,
      });
    }
  });

  return anomalies.sort((a, b) => b.deviation - a.deviation).slice(0, 10);
};

/**
 * Analyze individual student attendance patterns
 */
export const analyzeStudentPatterns = (
  attendanceRecords: any[],
  students: any[]
): StudentPattern[] => {
  return students.map(student => {
    const studentRecords = attendanceRecords.filter(r => r.student_id === student.id);
    const totalRecords = studentRecords.length;
    const present = studentRecords.filter(r => r.status === 'Present' || r.status === 'present').length;
    const attendanceRate = totalRecords > 0 ? (present / totalRecords) * 100 : 0;

    // Analyze common absence days
    const absentRecords = studentRecords.filter(r => r.status !== 'Present' && r.status !== 'present');
    const dayFrequency: { [key: number]: number } = {};
    absentRecords.forEach(record => {
      const day = new Date(record.date).getDay();
      dayFrequency[day] = (dayFrequency[day] || 0) + 1;
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const commonAbsenceDays = Object.entries(dayFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([day]) => dayNames[parseInt(day)]);

    // Determine pattern and risk level
    let pattern: StudentPattern['pattern'];
    let riskLevel: StudentPattern['riskLevel'];

    if (attendanceRate >= 95) {
      pattern = 'regular';
      riskLevel = 'low';
    } else if (attendanceRate >= 90) {
      pattern = 'regular';
      riskLevel = 'low';
    } else if (attendanceRate >= 80) {
      pattern = 'irregular';
      riskLevel = 'medium';
    } else {
      pattern = 'chronic';
      riskLevel = 'high';
    }

    return {
      studentId: student.id,
      name: student.name,
      attendanceRate,
      pattern,
      riskLevel,
      commonAbsenceDays,
    };
  }).sort((a, b) => a.attendanceRate - b.attendanceRate);
};

/**
 * Generate complete attendance pattern report data
 */
export const generateAttendancePatternData = (
  attendanceRecords: any[],
  students: any[]
): AttendancePatternData => {
  const overview = calculateAttendanceOverview(attendanceRecords, students);
  const heatmapData = generateHeatmapData(attendanceRecords);
  const dayOfWeekAnalysis = analyzeDayOfWeek(heatmapData);
  const anomalies = detectAnomalies(heatmapData);
  const studentPatterns = analyzeStudentPatterns(attendanceRecords, students);

  return {
    overview,
    heatmapData,
    dayOfWeekAnalysis,
    anomalies,
    studentPatterns,
  };
};
