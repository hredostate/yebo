import { getAIClient, getCurrentModel } from './aiClient';
import { textFromAI } from '../utils/ai';
import type { 
  GeneratedReport, 
  ReportGenerationRequest, 
  SubjectComment 
} from '../types';

/**
 * Report Generator Service
 * Generates automated teacher comments using AI
 */

/**
 * Generate a class teacher comment using rule-based logic (FREE - no API calls)
 */
export function generateRuleBasedTeacherComment(
    studentFirstName: string,
    averageScore: number,
    positionInClass: number,
    classSize: number,
    attendanceRate?: number
): string {
    // Top performers (top 10%)
    if (positionInClass <= Math.ceil(classSize * 0.1)) {
        if (averageScore >= 80) {
            return `${studentFirstName} has demonstrated exceptional academic excellence this term. Outstanding performance across all subjects. Keep up the excellent work!`;
        }
        return `${studentFirstName} is among the top performers in the class. Commendable effort and dedication shown throughout the term.`;
    }
    
    // Above average (top 30%)
    if (positionInClass <= Math.ceil(classSize * 0.3)) {
        if (averageScore >= 70) {
            return `${studentFirstName} has shown very good academic performance this term. Continue striving for excellence.`;
        }
        return `${studentFirstName} has made good progress this term. With continued effort, even better results are achievable.`;
    }
    
    // Average performers (middle 40%)
    if (positionInClass <= Math.ceil(classSize * 0.7)) {
        if (averageScore >= 60) {
            return `${studentFirstName} has shown satisfactory progress this term. More consistent effort will lead to improved results.`;
        }
        return `${studentFirstName} has potential to do better. Regular study habits and more focus on weak areas are recommended.`;
    }
    
    // Below average (bottom 30%)
    if (averageScore >= 50) {
        return `${studentFirstName} needs to put in more effort to improve academic performance. Extra attention to studies and seeking help when needed is advised.`;
    }
    
    // Struggling students
    return `${studentFirstName} requires significant improvement in academic work. A parent-teacher meeting is recommended to discuss support strategies.`;
}

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
export async function generateSubjectComment(
  subjectName: string,
  score: number,
  grade: string,
  effort: string,
  tone: string,
  length: string,
  previousScore?: number
): Promise<string> {
  const aiClient = getAIClient();
  if (!aiClient) {
    // Fallback template-based comment (4-8 words, very brief)
    const improvement = previousScore ? score - previousScore : 0;
    
    if (score >= 80) {
      return `Outstanding performance and understanding shown`;
    } else if (score >= 65) {
      return `Good understanding clearly demonstrated`;
    } else if (score >= 50) {
      if (improvement > 5) {
        return `Steady improvement this term`;
      }
      return `Satisfactory progress made overall`;
    } else {
      return `Needs additional support currently`;
    }
  }

  try {
    const improvementText = previousScore 
      ? `Previous score: ${previousScore}%. Current improvement: ${(score - previousScore).toFixed(1)}%.`
      : '';

    const lengthGuide = {
      brief: '4-6 words',
      standard: '5-7 words',
      detailed: '6-8 words',
    };

    const prompt = `You are a teacher writing a VERY SHORT report card comment for a single subject.

Subject: ${subjectName}
Current Score: ${score}%
Grade: ${grade}
Effort Level: ${effort}
${improvementText}

STRICT FORMATTING RULES - YOU MUST FOLLOW THESE:
- Write EXACTLY one (1) sentence only
- Keep it VERY short: ${lengthGuide[length as keyof typeof lengthGuide]} total
- NO semicolons (;)
- NO bullet points
- NO numbering
- Be natural and specific to the student's data

${tone === 'encouraging' ? 'Focus on strengths and potential.' : ''}
${tone === 'constructive' ? 'Include specific areas for improvement.' : ''}
${tone === 'formal' ? 'Use professional academic language.' : ''}
${tone === 'balanced' ? 'Acknowledge both strengths and areas to develop.' : ''}

Do not include the subject name in the comment as it will be shown under the subject heading.

Examples of good comments (notice they are very short):
- "Demonstrates excellent analytical skills"
- "Shows steady improvement"
- "Needs more practice here"
- "Outstanding performance this term"`;

    const response = await aiClient.chat.completions.create({
      model: getCurrentModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    return textFromAI(response).trim() || 'Working towards improvement';
  } catch (error) {
    console.error('AI comment generation error:', error);
    return 'Consistent effort shown this term';
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
  const aiClient = getAIClient();
  if (!aiClient) {
    // Fallback template-based comment (3-6 sentences, comprehensive)
    const avgScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
    const strongSubjects = data.subjectScores.filter(s => s.score >= 70);
    const weakSubjects = data.subjectScores.filter(s => s.score < 50);
    
    let comment = `${studentName} has `;
    
    if (avgScore >= 75) {
      comment += 'demonstrated excellent academic performance this term. ';
    } else if (avgScore >= 60) {
      comment += 'shown good progress across most subjects this term. ';
    } else {
      comment += 'worked on developing foundational academic skills. ';
    }

    if (strongSubjects.length > 0) {
      comment += `Particular strengths are evident in ${strongSubjects.slice(0, 2).map(s => s.subjectName).join(' and ')}. `;
    }

    if (weakSubjects.length > 0) {
      comment += `Additional support would benefit performance in ${weakSubjects[0].subjectName}. `;
    }

    if (data.attendanceRate) {
      if (data.attendanceRate >= 90) {
        comment += 'Attendance has been excellent. ';
      } else if (data.attendanceRate < 80) {
        comment += 'More consistent attendance would support learning. ';
      }
    }

    comment += 'Continue working hard next term!';
    return comment;
  }

  try {
    const avgScore = data.subjectScores.reduce((sum, s) => sum + s.score, 0) / data.subjectScores.length;
    const strongSubjects = data.subjectScores.filter(s => s.score >= 70).map(s => s.subjectName);
    const weakSubjects = data.subjectScores.filter(s => s.score < 50).map(s => s.subjectName);
    const improving = data.subjectScores.filter(s => s.previousScore && s.score > s.previousScore + 5).map(s => s.subjectName);
    const declining = data.subjectScores.filter(s => s.previousScore && s.score < s.previousScore - 5).map(s => s.subjectName);

    const lengthGuide = {
      brief: '3-4 sentences',
      standard: '4-5 sentences',
      detailed: '5-6 sentences',
    };

    const prompt = `You are a school principal writing an overall term report comment (this is the principal's comment, not a teacher's subject comment).

Student: ${studentName}
Average Score: ${avgScore.toFixed(1)}%
Strong Subjects: ${strongSubjects.length > 0 ? strongSubjects.join(', ') : 'Building foundation across subjects'}
Areas Needing Support: ${weakSubjects.length > 0 ? weakSubjects.join(', ') : 'None identified'}
${improving.length > 0 ? `Improving In: ${improving.join(', ')}` : ''}
${declining.length > 0 ? `Declining In: ${declining.join(', ')}` : ''}
${data.attendanceRate ? `Attendance Rate: ${data.attendanceRate}%` : ''}
${data.participationLevel ? `Class Participation: ${data.participationLevel}` : ''}
${data.behaviorNotes && data.behaviorNotes.length > 0 ? `Behavior Notes: ${data.behaviorNotes.join('; ')}` : ''}

STRICT FORMATTING RULES - YOU MUST FOLLOW THESE:
- Write ${lengthGuide[length as keyof typeof lengthGuide]} total
- Make this BROADER and MORE EXPANSIVE than individual subject comments
- This should reflect the student's OVERALL performance across the full result
- Cover relevant aspects from:
  * Subject performance patterns (strengths/weaknesses across subjects)
  * Consistency of performance
  * Improvement or decline trends
  * Attitude and effort (if data suggests it)
  * Behavior (ONLY if behavior notes are provided above)
  * Attendance/punctuality (ONLY if attendance data is provided above)
  * Clear next steps or recommendations
- DO NOT repeat the same phrases across many students - keep comments natural and specific to THIS student's actual data
- If data is missing for a component (e.g., no behavior notes), do NOT invent it - simply omit that reference
- Be ${tone} in tone

Write a comprehensive principal's comment that reflects this student's overall academic journey this term.`;

    const response = await aiClient.chat.completions.create({
      model: getCurrentModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    return textFromAI(response).trim() || `${studentName} has made progress this term and should continue working diligently.`;
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

/**
 * Generate rule-based teacher comment (no AI, instant, free)
 * This is simpler and cheaper than principal comments
 */
export function generateRuleBasedTeacherComment(
  studentName: string,
  average: number,
  position: number,
  classSize: number,
  attendanceRate?: number
): string {
  const firstName = studentName ? studentName.split(' ')[0] : 'Student';
  
  // Excellent performance (80+)
  if (average >= 80) {
    if (position <= 3) {
      return `${firstName} has demonstrated outstanding academic excellence this term. Keep up the exceptional work!`;
    }
    return `${firstName} has shown excellent performance across subjects. Continue this impressive effort!`;
  }
  
  // Good performance (70-79)
  if (average >= 70) {
    if (attendanceRate && attendanceRate < 85) {
      return `${firstName} shows good ability but attendance needs improvement. More consistency would help achieve better results.`;
    }
    return `${firstName} has shown good effort and achieved commendable results. Continue striving for excellence.`;
  }
  
  // Satisfactory performance (60-69)
  if (average >= 60) {
    if (attendanceRate && attendanceRate < 85) {
      return `${firstName} has made satisfactory progress but irregular attendance is affecting performance. Consistent presence is important.`;
    }
    return `${firstName} has made satisfactory progress this term. With more consistent effort, better results are achievable.`;
  }
  
  // Below average (50-59)
  if (average >= 50) {
    if (position > classSize * 0.75) {
      return `${firstName} needs to put in significantly more effort to improve. Extra study time and seeking help when needed is recommended.`;
    }
    return `${firstName} needs to put in more effort to improve academic performance. Additional support and practice is recommended.`;
  }
  
  // Poor performance (below 50)
  if (attendanceRate && attendanceRate < 75) {
    return `${firstName} requires significant improvement. Poor attendance is severely affecting learning. Parent-teacher consultation is urgently advised.`;
  }
  return `${firstName} requires significant improvement in academic work. Parent-teacher consultation and extra support are strongly advised.`;
}

/**
 * Generate AI-powered teacher comment (optional, more personalized)
 * Falls back to rule-based if AI is not available
 */
export async function generateTeacherComment(
  studentName: string,
  average: number,
  position: number,
  classSize: number,
  attendanceRate?: number,
  useAI: boolean = false
): Promise<string> {
  // If AI not requested or not available, use rule-based
  if (!useAI) {
    return generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  }
  
  const aiClient = getAIClient();
  if (!aiClient) {
    return generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  }
  
  try {
    const firstName = studentName ? studentName.split(' ')[0] : 'Student';
    
    // Simple, short prompt for teacher comments (cheaper than principal)
    const prompt = `You are a class teacher writing a brief term report comment.

Student: ${firstName}
Average Score: ${average.toFixed(1)}%
Position: ${position} of ${classSize}
${attendanceRate ? `Attendance: ${attendanceRate.toFixed(1)}%` : ''}

Write a SHORT comment (3-4 sentences) that:
1. Acknowledges effort level based on the score
2. Mentions one specific strength or area of concern
3. Provides brief, actionable advice for improvement or encouragement

Keep it natural, personal, and constructive. Focus on the student's journey this term.`;

    const response = await aiClient.chat.completions.create({
      model: getCurrentModel(),
      messages: [{ role: 'user', content: prompt }],
    });

    const comment = textFromAI(response).trim();
    return comment || generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  } catch (error) {
    console.error('AI teacher comment generation error:', error);
    // Fallback to rule-based
    return generateRuleBasedTeacherComment(studentName, average, position, classSize, attendanceRate);
  }
}
