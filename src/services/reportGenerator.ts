import { aiClient } from './aiClient';
import type { 
  GeneratedReport, 
  ReportGenerationRequest, 
  SubjectComment 
} from '../types';

/**
 * Report Generator Service
 * Generates automated teacher comments using AI
 */

interface StudentReportData {
  studentName: string;
  subjectScores: { 
    subjectId: number; 
    subjectName: string; 
    score: number; 
    grade: string;
    previousScore?: number;
  }[];
  attendanceRate?: number;
  behaviorNotes?: string[];
  participationLevel?: 'excellent' | 'good' | 'fair' | 'poor';
}

/**
 * Determine effort level based on score and trend
 */
function determineEffort(
  score: number, 
  previousScore?: number
): 'excellent' | 'good' | 'satisfactory' | 'needs improvement' {
  const improvement = previousScore ? score - previousScore : 0;
  
  if (score >= 80 || improvement >= 10) return 'excellent';
  if (score >= 65 || improvement >= 5) return 'good';
  if (score >= 50 || improvement >= 0) return 'satisfactory';
  return 'needs improvement';
}

/**
 * Generate a comment for a specific subject
 */
async function generateSubjectComment(
  subjectName: string,
  score: number,
  grade: string,
  effort: string,
  tone: string,
  length: string,
  previousScore?: number
): Promise<string> {
  if (!aiClient) {
    // Fallback template-based comment
    const improvement = previousScore ? score - previousScore : 0;
    let comment = `${subjectName}: `;
    
    if (score >= 80) {
      comment += `Outstanding performance with a score of ${score}%. `;
    } else if (score >= 65) {
      comment += `Good understanding demonstrated with ${score}%. `;
    } else if (score >= 50) {
      comment += `Satisfactory progress with ${score}%. `;
    } else {
      comment += `Requires additional support (${score}%). `;
    }

    if (improvement > 5) {
      comment += `Shows excellent improvement from previous term.`;
    } else if (improvement < -5) {
      comment += `Needs to focus on consistent performance.`;
    }

    return comment;
  }

  try {
    const improvementText = previousScore 
      ? `Previous score: ${previousScore}%. Current improvement: ${(score - previousScore).toFixed(1)}%.`
      : '';

    const lengthGuide = {
      brief: '1-2 sentences',
      standard: '2-3 sentences',
      detailed: '3-4 sentences',
    };

    const prompt = `You are a teacher writing a report card comment.

Subject: ${subjectName}
Current Score: ${score}%
Grade: ${grade}
Effort Level: ${effort}
${improvementText}

Write a ${tone} comment (${lengthGuide[length as keyof typeof lengthGuide]}) about this student's performance in ${subjectName}. 
${tone === 'encouraging' ? 'Focus on strengths and potential.' : ''}
${tone === 'constructive' ? 'Include specific areas for improvement.' : ''}
${tone === 'formal' ? 'Use professional academic language.' : ''}
${tone === 'balanced' ? 'Acknowledge both strengths and areas to develop.' : ''}

Do not include the subject name in the comment as it will be shown under the subject heading.`;

    const response = await aiClient.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      model: 'gemini-1.5-flash',
    });

    return response.text?.trim() || `Demonstrates ${effort} effort in ${subjectName}.`;
  } catch (error) {
    console.error('AI comment generation error:', error);
    return `Shows ${effort} performance with ${score}% in ${subjectName}.`;
  }
}

/**
 * Generate overall term comment
 */
async function generateOverallComment(
  studentName: string,
  data: StudentReportData,
  tone: string,
  length: string
): Promise<string> {
  if (!aiClient) {
    const avgScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
    let comment = `${studentName} has `;
    
    if (avgScore >= 75) {
      comment += 'demonstrated excellent academic performance this term. ';
    } else if (avgScore >= 60) {
      comment += 'shown good progress this term. ';
    } else {
      comment += 'worked on developing their academic skills. ';
    }

    if (data.attendanceRate && data.attendanceRate >= 90) {
      comment += 'Attendance has been excellent. ';
    }

    return comment + 'Keep up the good work!';
  }

  try {
    const avgScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
    const strongSubjects = data.subjectScores.filter(s => s.score >= 70).map(s => s.subjectName);
    const weakSubjects = data.subjectScores.filter(s => s.score < 50).map(s => s.subjectName);

    const lengthGuide = {
      brief: '2-3 sentences',
      standard: '4-5 sentences',
      detailed: '6-8 sentences',
    };

    const prompt = `You are a teacher writing an overall term report comment.

Student: ${studentName}
Average Score: ${avgScore.toFixed(1)}%
Strong Subjects: ${strongSubjects.join(', ') || 'Building foundation across subjects'}
Areas Needing Support: ${weakSubjects.join(', ') || 'None identified'}
Attendance Rate: ${data.attendanceRate ? `${data.attendanceRate}%` : 'Not recorded'}
${data.participationLevel ? `Class Participation: ${data.participationLevel}` : ''}

Write a ${tone} overall term comment (${lengthGuide[length as keyof typeof lengthGuide]}) that:
1. Summarizes the student's overall performance
2. Highlights key strengths
3. Identifies areas for growth
4. Provides encouragement and next steps

Tone: ${tone}`;

    const response = await aiClient.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      model: 'gemini-1.5-flash',
    });

    return response.text?.trim() || `${studentName} has made progress this term and should continue to work hard.`;
  } catch (error) {
    console.error('AI overall comment generation error:', error);
    return `${studentName} has completed the term with consistent effort across all subjects.`;
  }
}

/**
 * Identify student strengths based on performance
 */
function identifyStrengths(data: StudentReportData): string[] {
  const strengths: string[] = [];

  // Academic strengths
  const strongSubjects = data.subjectScores
    .filter(s => s.score >= 70)
    .map(s => s.subjectName);
  
  if (strongSubjects.length > 0) {
    strengths.push(`Strong performance in ${strongSubjects.slice(0, 3).join(', ')}`);
  }

  // Improvement trends
  const improving = data.subjectScores.filter(s => 
    s.previousScore && s.score > s.previousScore + 5
  );
  
  if (improving.length > 0) {
    strengths.push(`Showing improvement in ${improving.map(s => s.subjectName).join(', ')}`);
  }

  // Attendance
  if (data.attendanceRate && data.attendanceRate >= 95) {
    strengths.push('Excellent attendance record');
  }

  // Participation
  if (data.participationLevel === 'excellent') {
    strengths.push('Active class participation');
  }

  return strengths;
}

/**
 * Identify areas for improvement
 */
function identifyAreasForImprovement(data: StudentReportData): string[] {
  const areas: string[] = [];

  // Academic areas
  const weakSubjects = data.subjectScores
    .filter(s => s.score < 50)
    .map(s => s.subjectName);
  
  if (weakSubjects.length > 0) {
    areas.push(`Needs additional support in ${weakSubjects.join(', ')}`);
  }

  // Declining performance
  const declining = data.subjectScores.filter(s => 
    s.previousScore && s.score < s.previousScore - 5
  );
  
  if (declining.length > 0) {
    areas.push(`Address declining performance in ${declining.map(s => s.subjectName).join(', ')}`);
  }

  // Attendance
  if (data.attendanceRate && data.attendanceRate < 85) {
    areas.push('Improve attendance consistency');
  }

  // Participation
  if (data.participationLevel === 'poor' || data.participationLevel === 'fair') {
    areas.push('Increase class participation');
  }

  return areas;
}

/**
 * Generate goals for next term
 */
function generateNextTermGoals(data: StudentReportData): string[] {
  const goals: string[] = [];

  // Academic goals
  const weakSubjects = data.subjectScores.filter(s => s.score < 60);
  if (weakSubjects.length > 0) {
    goals.push(`Aim to raise scores above 60% in ${weakSubjects[0].subjectName}`);
  }

  const averageScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
  if (averageScore < 70) {
    goals.push('Achieve an overall average of 70% or higher');
  } else {
    goals.push('Maintain current high performance standards');
  }

  // Attendance goals
  if (data.attendanceRate && data.attendanceRate < 90) {
    goals.push('Achieve 90%+ attendance rate');
  }

  return goals;
}

/**
 * Generate recommendations for parents
 */
function generateParentRecommendations(data: StudentReportData): string[] {
  const recommendations: string[] = [];

  const weakSubjects = data.subjectScores.filter(s => s.score < 50);
  if (weakSubjects.length > 0) {
    recommendations.push(`Consider arranging extra tutoring in ${weakSubjects.map(s => s.subjectName).join(', ')}`);
  }

  if (data.attendanceRate && data.attendanceRate < 90) {
    recommendations.push('Please ensure consistent attendance to support learning continuity');
  }

  const averageScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
  if (averageScore >= 70) {
    recommendations.push('Continue to provide encouragement and support for academic excellence');
  } else {
    recommendations.push('Schedule a meeting with teachers to discuss support strategies');
  }

  return recommendations;
}

/**
 * Generate a complete automated report
 */
export async function generateReport(
  request: ReportGenerationRequest,
  data: StudentReportData
): Promise<GeneratedReport> {
  const subjectComments: SubjectComment[] = [];

  // Generate comments for each subject
  for (const subjectScore of data.subjectScores) {
    if (request.subjects.includes(subjectScore.subjectId)) {
      const effort = determineEffort(subjectScore.score, subjectScore.previousScore);
      const comment = await generateSubjectComment(
        subjectScore.subjectName,
        subjectScore.score,
        subjectScore.grade,
        effort,
        request.tone,
        request.length,
        subjectScore.previousScore
      );

      subjectComments.push({
        subjectId: subjectScore.subjectId,
        subjectName: subjectScore.subjectName,
        comment,
        grade: subjectScore.grade,
        effort,
      });
    }
  }

  // Generate overall comment
  const overallComment = await generateOverallComment(
    data.studentName,
    data,
    request.tone,
    request.length
  );

  return {
    studentId: request.studentId,
    subjectComments,
    overallComment,
    strengthsHighlighted: identifyStrengths(data),
    areasForImprovement: identifyAreasForImprovement(data),
    goalsForNextTerm: generateNextTermGoals(data),
    parentRecommendations: generateParentRecommendations(data),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Batch generate reports for multiple students
 */
export async function batchGenerateReports(
  requests: ReportGenerationRequest[],
  studentsData: StudentReportData[]
): Promise<GeneratedReport[]> {
  const reports: GeneratedReport[] = [];

  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    const data = studentsData.find(d => d.studentName === studentsData[i]?.studentName);
    
    if (data) {
      const report = await generateReport(request, data);
      reports.push(report);
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return reports;
}

/**
 * Customize generated comment
 */
export function customizeComment(
  originalComment: string,
  customizations: { find: string; replace: string }[]
): string {
  let customized = originalComment;
  
  customizations.forEach(({ find, replace }) => {
    customized = customized.replace(new RegExp(find, 'gi'), replace);
  });

  return customized;
}
