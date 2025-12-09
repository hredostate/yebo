import { aiClient } from './aiClient';
import type { RiskPrediction, RiskFactor, Student } from '../types';

/**
 * Predictive Analytics Service
 * Handles ML-powered risk predictions for students
 */

interface StudentData {
  student: Student;
  attendanceRate?: number;
  gradeAverage?: number;
  behaviorIncidents?: number;
  assignmentCompletionRate?: number;
  recentGrades?: number[];
  recentAttendance?: boolean[];
}

/**
 * Analyzes a risk factor and returns its contribution
 */
function analyzeRiskFactor(
  name: string,
  currentValue: number,
  threshold: number,
  weight: number,
  isHigherBetter: boolean,
  description: string
): RiskFactor {
  const difference = isHigherBetter 
    ? threshold - currentValue 
    : currentValue - threshold;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(difference) < threshold * 0.1) {
    trend = 'stable';
  } else if (difference > 0) {
    trend = isHigherBetter ? 'down' : 'up';
  } else {
    trend = isHigherBetter ? 'up' : 'down';
  }

  return {
    name,
    weight,
    currentValue,
    threshold,
    trend,
    description,
  };
}

/**
 * Calculate risk score based on multiple factors
 */
export function calculateRiskScore(data: StudentData): number {
  let totalRisk = 0;
  let totalWeight = 0;

  // Attendance risk (lower is worse)
  if (data.attendanceRate !== undefined) {
    const attendanceWeight = 0.25;
    const attendanceThreshold = 85;
    if (data.attendanceRate < attendanceThreshold) {
      const attendanceRisk = ((attendanceThreshold - data.attendanceRate) / attendanceThreshold) * 100;
      totalRisk += attendanceRisk * attendanceWeight;
    }
    totalWeight += attendanceWeight;
  }

  // Grade trajectory risk (lower is worse)
  if (data.gradeAverage !== undefined) {
    const gradeWeight = 0.30;
    const gradeThreshold = 50;
    if (data.gradeAverage < gradeThreshold) {
      const gradeRisk = ((gradeThreshold - data.gradeAverage) / gradeThreshold) * 100;
      totalRisk += gradeRisk * gradeWeight;
    }
    totalWeight += gradeWeight;
  }

  // Behavior incidents risk (higher is worse)
  if (data.behaviorIncidents !== undefined) {
    const behaviorWeight = 0.20;
    const behaviorThreshold = 3;
    if (data.behaviorIncidents > behaviorThreshold) {
      const behaviorRisk = Math.min(data.behaviorIncidents / behaviorThreshold * 50, 100);
      totalRisk += behaviorRisk * behaviorWeight;
    }
    totalWeight += behaviorWeight;
  }

  // Assignment completion risk (lower is worse)
  if (data.assignmentCompletionRate !== undefined) {
    const assignmentWeight = 0.25;
    const assignmentThreshold = 80;
    if (data.assignmentCompletionRate < assignmentThreshold) {
      const assignmentRisk = ((assignmentThreshold - data.assignmentCompletionRate) / assignmentThreshold) * 100;
      totalRisk += assignmentRisk * assignmentWeight;
    }
    totalWeight += assignmentWeight;
  }

  // Normalize by total weight
  return totalWeight > 0 ? Math.min(Math.round(totalRisk / totalWeight), 100) : 0;
}

/**
 * Determine risk level from score
 */
export function getRiskLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (score >= 76) return 'critical';
  if (score >= 51) return 'high';
  if (score >= 26) return 'moderate';
  return 'low';
}

/**
 * Generate risk factors for a student
 */
export function generateRiskFactors(data: StudentData): RiskFactor[] {
  const factors: RiskFactor[] = [];

  if (data.attendanceRate !== undefined) {
    factors.push(analyzeRiskFactor(
      'Attendance Rate',
      data.attendanceRate,
      85,
      0.25,
      true,
      `Current attendance is ${data.attendanceRate.toFixed(1)}%. Target is 85%+`
    ));
  }

  if (data.gradeAverage !== undefined) {
    factors.push(analyzeRiskFactor(
      'Grade Average',
      data.gradeAverage,
      50,
      0.30,
      true,
      `Current average is ${data.gradeAverage.toFixed(1)}%. Target is 50%+`
    ));
  }

  if (data.behaviorIncidents !== undefined) {
    factors.push(analyzeRiskFactor(
      'Behavior Incidents',
      data.behaviorIncidents,
      3,
      0.20,
      false,
      `${data.behaviorIncidents} incidents recorded. Target is 3 or fewer`
    ));
  }

  if (data.assignmentCompletionRate !== undefined) {
    factors.push(analyzeRiskFactor(
      'Assignment Completion',
      data.assignmentCompletionRate,
      80,
      0.25,
      true,
      `${data.assignmentCompletionRate.toFixed(1)}% of assignments completed. Target is 80%+`
    ));
  }

  return factors;
}

/**
 * Generate recommended interventions based on risk factors
 */
export function generateRecommendedActions(
  riskLevel: string,
  factors: RiskFactor[]
): string[] {
  const actions: string[] = [];

  // Check each factor and recommend specific actions
  factors.forEach(factor => {
    if (factor.name === 'Attendance Rate' && factor.currentValue < factor.threshold) {
      actions.push('Contact parents regarding attendance concerns');
      actions.push('Schedule meeting to identify attendance barriers');
    }
    
    if (factor.name === 'Grade Average' && factor.currentValue < factor.threshold) {
      actions.push('Arrange peer tutoring or additional academic support');
      actions.push('Review learning style and adjust teaching approach');
    }
    
    if (factor.name === 'Behavior Incidents' && factor.currentValue > factor.threshold) {
      actions.push('Refer to counselor for behavioral assessment');
      actions.push('Implement positive behavior intervention plan');
    }
    
    if (factor.name === 'Assignment Completion' && factor.currentValue < factor.threshold) {
      actions.push('Check for understanding of assignment requirements');
      actions.push('Provide organizational support and deadline reminders');
    }
  });

  // General recommendations based on risk level
  if (riskLevel === 'critical' || riskLevel === 'high') {
    actions.push('Schedule immediate parent-teacher conference');
    actions.push('Develop comprehensive intervention plan');
  }

  return [...new Set(actions)]; // Remove duplicates
}

/**
 * Predict risk for a student using available data
 */
export async function predictStudentRisk(
  data: StudentData
): Promise<RiskPrediction> {
  const riskScore = calculateRiskScore(data);
  const riskLevel = getRiskLevel(riskScore);
  const factors = generateRiskFactors(data);
  const recommendedActions = generateRecommendedActions(riskLevel, factors);

  // Calculate confidence based on data availability
  let confidence = 0;
  const dataPoints = [
    data.attendanceRate,
    data.gradeAverage,
    data.behaviorIncidents,
    data.assignmentCompletionRate
  ].filter(x => x !== undefined).length;
  confidence = (dataPoints / 4) * 100;

  // Determine trend based on recent data
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (data.recentGrades && data.recentGrades.length >= 3) {
    const recentAvg = data.recentGrades.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const olderAvg = data.recentGrades.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    if (recentAvg > olderAvg + 5) trend = 'improving';
    else if (recentAvg < olderAvg - 5) trend = 'declining';
  }

  // Calculate predicted date (2-4 weeks from now if at risk)
  const daysAhead = riskLevel === 'critical' ? 14 : riskLevel === 'high' ? 21 : 28;
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + daysAhead);

  return {
    studentId: data.student.id,
    studentName: data.student.name,
    riskScore,
    riskLevel,
    confidence: Math.round(confidence),
    predictedDate: predictedDate.toISOString().split('T')[0],
    factors,
    recommendedActions,
    trend,
  };
}

/**
 * Generate AI-enhanced risk analysis using Gemini
 */
export async function generateAIRiskAnalysis(
  prediction: RiskPrediction,
  additionalContext?: string
): Promise<string> {
  if (!aiClient) {
    return `Student ${prediction.studentName} has been identified as ${prediction.riskLevel} risk (score: ${prediction.riskScore}/100). Key factors: ${prediction.factors.map(f => f.name).join(', ')}.`;
  }

  try {
    const prompt = `You are an educational counselor analyzing student risk factors. 

Student: ${prediction.studentName}
Risk Score: ${prediction.riskScore}/100 (${prediction.riskLevel} risk)
Trend: ${prediction.trend}
Confidence: ${prediction.confidence}%

Risk Factors:
${prediction.factors.map(f => `- ${f.name}: ${f.currentValue} (threshold: ${f.threshold}) - ${f.description}`).join('\n')}

${additionalContext ? `Additional Context: ${additionalContext}` : ''}

Provide a brief (2-3 sentences), compassionate analysis of this student's situation and suggest the most important next step.`;

    const response = await aiClient.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      model: 'gemini-1.5-flash',
    });

    return response.text || 'Analysis unavailable';
  } catch (error) {
    console.error('AI analysis error:', error);
    return `Student ${prediction.studentName} has been identified as ${prediction.riskLevel} risk (score: ${prediction.riskScore}/100). Immediate attention recommended.`;
  }
}

/**
 * Batch predict risks for multiple students
 */
export async function batchPredictRisks(
  studentsData: StudentData[]
): Promise<RiskPrediction[]> {
  const predictions = await Promise.all(
    studentsData.map(data => predictStudentRisk(data))
  );

  // Sort by risk score (highest first)
  return predictions.sort((a, b) => b.riskScore - a.riskScore);
}
