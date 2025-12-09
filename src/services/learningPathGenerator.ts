import { aiClient } from './aiClient';
import type { 
  LearningPath, 
  SubjectPath, 
  Topic, 
  Recommendation, 
  WeeklyGoal,
  Student 
} from '../types';

/**
 * Learning Path Generator Service
 * Generates personalized learning paths based on student performance
 */

interface StudentPerformanceData {
  student: Student;
  subjectScores: { subjectId: number; subjectName: string; scores: number[] }[];
  strengths: string[];
  weaknesses: string[];
  learningPace?: 'fast' | 'average' | 'slow';
}

/**
 * Determine current level based on average score
 */
function determineLevel(averageScore: number): 'beginner' | 'intermediate' | 'advanced' {
  if (averageScore >= 80) return 'advanced';
  if (averageScore >= 60) return 'intermediate';
  return 'beginner';
}

/**
 * Generate suggested topics based on current level
 */
function generateTopicsForLevel(
  subjectName: string,
  currentLevel: 'beginner' | 'intermediate' | 'advanced',
  weakAreas: string[]
): Topic[] {
  const topics: Topic[] = [];

  // Basic topics for beginners
  if (currentLevel === 'beginner') {
    topics.push({
      id: `${subjectName}-foundations`,
      title: `${subjectName} Fundamentals`,
      description: 'Build a strong foundation in core concepts',
      difficulty: 'beginner',
      estimatedHours: 10,
    });
  }

  // Add topics based on weak areas
  weakAreas.forEach((area, index) => {
    topics.push({
      id: `${subjectName}-${area.toLowerCase().replace(/\s+/g, '-')}`,
      title: `Improve: ${area}`,
      description: `Focused practice on ${area}`,
      difficulty: currentLevel,
      estimatedHours: 5,
    });
  });

  // Advanced topics for high performers
  if (currentLevel === 'advanced') {
    topics.push({
      id: `${subjectName}-advanced-challenges`,
      title: `${subjectName} Advanced Challenges`,
      description: 'Extend your knowledge with complex problems',
      difficulty: 'advanced',
      estimatedHours: 8,
    });
  }

  return topics;
}

/**
 * Generate recommendations based on performance
 */
function generateRecommendations(
  subjectName: string,
  currentLevel: 'beginner' | 'intermediate' | 'advanced',
  weaknesses: string[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Add practice exercises for weak areas
  weaknesses.forEach(weakness => {
    recommendations.push({
      type: 'exercise',
      title: `Practice: ${weakness}`,
      description: `Complete targeted exercises to strengthen ${weakness}`,
      priority: 'high',
      estimatedDuration: '30-45 minutes',
      relatedSubject: subjectName,
    });
  });

  // Add resources based on level
  if (currentLevel === 'beginner') {
    recommendations.push({
      type: 'resource',
      title: `${subjectName} Tutorial Videos`,
      description: 'Watch explanatory videos to understand core concepts',
      priority: 'high',
      estimatedDuration: '1-2 hours',
      relatedSubject: subjectName,
    });
  }

  // Add assessments
  recommendations.push({
    type: 'assessment',
    title: `${subjectName} Progress Check`,
    description: 'Complete a diagnostic test to track improvement',
    priority: 'medium',
    estimatedDuration: '45-60 minutes',
    relatedSubject: subjectName,
  });

  return recommendations;
}

/**
 * Generate weekly goals for the learning path
 */
function generateWeeklyGoals(subjects: SubjectPath[]): WeeklyGoal[] {
  const goals: WeeklyGoal[] = [];
  const startDate = new Date();

  subjects.forEach((subject, index) => {
    const weekNumber = Math.floor(index / 2) + 1; // 2 subjects per week
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + (weekNumber * 7));

    goals.push({
      id: `week-${weekNumber}-${subject.subjectName}`,
      week: weekNumber,
      description: `Complete practice exercises for ${subject.subjectName}`,
      completed: false,
      dueDate: dueDate.toISOString().split('T')[0],
    });
  });

  return goals;
}

/**
 * Generate a personalized learning path for a student
 */
export async function generateLearningPath(
  data: StudentPerformanceData
): Promise<LearningPath> {
  const subjects: SubjectPath[] = [];

  // Process each subject
  data.subjectScores.forEach(({ subjectId, subjectName, scores }) => {
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const currentLevel = determineLevel(averageScore);
    
    // Determine target level
    let targetLevel = currentLevel;
    if (currentLevel === 'beginner') targetLevel = 'intermediate';
    else if (currentLevel === 'intermediate') targetLevel = 'advanced';
    else targetLevel = 'mastery';

    // Identify areas for improvement (subjects with scores below 60)
    const areasForImprovement = data.weaknesses.filter(w => 
      w.toLowerCase().includes(subjectName.toLowerCase())
    );

    const subjectPath: SubjectPath = {
      subjectId,
      subjectName,
      currentLevel,
      targetLevel,
      strengths: data.strengths.filter(s => 
        s.toLowerCase().includes(subjectName.toLowerCase())
      ),
      areasForImprovement,
      suggestedTopics: generateTopicsForLevel(subjectName, currentLevel, areasForImprovement),
      estimatedTimeToTarget: currentLevel === 'beginner' ? '8-12 weeks' : 
                             currentLevel === 'intermediate' ? '6-8 weeks' : '4-6 weeks',
    };

    subjects.push(subjectPath);
  });

  // Generate all recommendations
  const allRecommendations: Recommendation[] = [];
  subjects.forEach(subject => {
    const recs = generateRecommendations(
      subject.subjectName,
      subject.currentLevel,
      subject.areasForImprovement
    );
    allRecommendations.push(...recs);
  });

  // Sort recommendations by priority
  allRecommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const weeklyGoals = generateWeeklyGoals(subjects);

  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 90); // Valid for 90 days

  return {
    studentId: data.student.id,
    generatedAt: new Date().toISOString(),
    validUntil: validUntil.toISOString().split('T')[0],
    overallProgress: 0,
    subjects,
    weeklyGoals,
    recommendations: allRecommendations,
  };
}

/**
 * Generate AI-enhanced learning recommendations
 */
export async function generateAILearningRecommendations(
  learningPath: LearningPath
): Promise<string> {
  if (!aiClient) {
    return `Learning path generated for student with ${learningPath.subjects.length} subjects. Focus on completing weekly goals to track progress.`;
  }

  try {
    const prompt = `You are an educational advisor creating a personalized learning plan.

Student has ${learningPath.subjects.length} subjects in their learning path.

Subject Performance:
${learningPath.subjects.map(s => `- ${s.subjectName}: Currently ${s.currentLevel}, targeting ${s.targetLevel}
  Strengths: ${s.strengths.join(', ') || 'Building foundation'}
  Areas to improve: ${s.areasForImprovement.join(', ') || 'Continue current pace'}`).join('\n')}

Provide a brief (3-4 sentences), encouraging summary of the learning path and the most important focus areas for the next 2 weeks.`;

    const response = await aiClient.models.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      model: 'gemini-1.5-flash',
    });

    return response.text || 'Recommendations unavailable';
  } catch (error) {
    console.error('AI recommendations error:', error);
    return `Learning path generated for ${learningPath.subjects.length} subjects. Focus on high-priority recommendations and weekly goals.`;
  }
}

/**
 * Update learning path progress
 */
export function updateLearningPathProgress(
  learningPath: LearningPath,
  completedGoalIds: string[]
): LearningPath {
  const updatedGoals = learningPath.weeklyGoals.map(goal => ({
    ...goal,
    completed: completedGoalIds.includes(goal.id) || goal.completed,
  }));

  const completedCount = updatedGoals.filter(g => g.completed).length;
  const overallProgress = Math.round((completedCount / updatedGoals.length) * 100);

  return {
    ...learningPath,
    weeklyGoals: updatedGoals,
    overallProgress,
  };
}

/**
 * Generate progress report for learning path
 */
export function generateProgressReport(learningPath: LearningPath): string {
  const completedGoals = learningPath.weeklyGoals.filter(g => g.completed).length;
  const totalGoals = learningPath.weeklyGoals.length;
  const progressPercentage = learningPath.overallProgress;

  const subjectProgress = learningPath.subjects.map(s => {
    const relatedGoals = learningPath.weeklyGoals.filter(g => 
      g.description.includes(s.subjectName)
    );
    const completed = relatedGoals.filter(g => g.completed).length;
    return `${s.subjectName}: ${completed}/${relatedGoals.length} goals completed`;
  }).join('\n');

  return `Learning Path Progress Report

Overall Progress: ${progressPercentage}% (${completedGoals}/${totalGoals} goals completed)

Subject Progress:
${subjectProgress}

Keep up the great work!`;
}
