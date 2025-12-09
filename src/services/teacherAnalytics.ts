/**
 * Teacher Analytics Service
 * Provides teacher performance metrics and feedback analysis
 */

export interface TeacherInfo {
  id: string;
  name: string;
  subjects: string[];
  classes: string[];
  yearsOfExperience: number;
}

export interface RatingBreakdown {
  category: string;
  rating: number;
  trend: 'up' | 'down' | 'stable';
}

export interface RatingHistory {
  period: string;
  rating: number;
}

export interface TeacherRatings {
  overall: number;
  breakdown: RatingBreakdown[];
  history: RatingHistory[];
}

export interface ClassPerformance {
  className: string;
  subject: string;
  averageScore: number;
  passRate: number;
  improvementRate: number;
  comparedToSchoolAverage: number;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface FeedbackTheme {
  theme: string;
  count: number;
  sentiment: 'positive' | 'negative';
}

export interface RecentFeedback {
  date: string;
  rating: number;
  comment: string;
  sentiment: string;
}

export interface FeedbackAnalysis {
  totalFeedbacks: number;
  sentimentBreakdown: SentimentBreakdown;
  commonThemes: FeedbackTheme[];
  recentFeedback: RecentFeedback[];
}

export interface TeacherKPIs {
  lessonPlanCompletion: number;
  attendanceRate: number;
  averageClassPerformance: number;
  studentSatisfaction: number;
}

export interface TeacherPerformanceData {
  teacher: TeacherInfo;
  ratings: TeacherRatings;
  classPerformance: ClassPerformance[];
  feedbackAnalysis: FeedbackAnalysis;
  kpis: TeacherKPIs;
}

/**
 * Calculate teacher ratings from feedback
 */
export const calculateTeacherRatings = (feedbackRecords: any[]): TeacherRatings => {
  if (feedbackRecords.length === 0) {
    return {
      overall: 0,
      breakdown: [],
      history: [],
    };
  }

  // Calculate overall rating
  const overall = feedbackRecords.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbackRecords.length;

  // Group by category
  const categoryMap: Map<string, number[]> = new Map();
  feedbackRecords.forEach(feedback => {
    const category = feedback.category || 'General';
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(feedback.rating || 0);
  });

  // Calculate breakdown with trends
  const breakdown: RatingBreakdown[] = Array.from(categoryMap.entries()).map(([category, ratings]) => {
    const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    
    // Simple trend calculation: compare first half vs second half
    const midpoint = Math.floor(ratings.length / 2);
    const firstHalf = ratings.slice(0, midpoint);
    const secondHalf = ratings.slice(midpoint);
    
    const firstAvg = firstHalf.length > 0 
      ? firstHalf.reduce((sum, r) => sum + r, 0) / firstHalf.length 
      : 0;
    const secondAvg = secondHalf.length > 0 
      ? secondHalf.reduce((sum, r) => sum + r, 0) / secondHalf.length 
      : 0;
    
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (secondAvg > firstAvg + 0.2) trend = 'up';
    else if (secondAvg < firstAvg - 0.2) trend = 'down';

    return {
      category,
      rating: avgRating,
      trend,
    };
  });

  // Calculate history (by month)
  const monthMap: Map<string, number[]> = new Map();
  feedbackRecords.forEach(feedback => {
    const date = new Date(feedback.created_at || feedback.date);
    const monthKey = date.toISOString().slice(0, 7);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(feedback.rating || 0);
  });

  const history: RatingHistory[] = Array.from(monthMap.entries())
    .map(([period, ratings]) => ({
      period: new Date(period).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      rating: ratings.reduce((sum, r) => sum + r, 0) / ratings.length,
    }))
    .sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());

  return {
    overall,
    breakdown,
    history,
  };
};

/**
 * Analyze class performance for a teacher
 */
export const analyzeClassPerformance = (
  teacherAssignments: any[],
  assessmentScores: any[],
  schoolAverageScore: number
): ClassPerformance[] => {
  return teacherAssignments.map(assignment => {
    const classScores = assessmentScores.filter(
      score => score.class_id === assignment.class_id && score.subject === assignment.subject
    );

    const averageScore = classScores.length > 0
      ? classScores.reduce((sum, s) => sum + (s.score || 0), 0) / classScores.length
      : 0;

    const passRate = classScores.length > 0
      ? (classScores.filter(s => (s.score || 0) >= 50).length / classScores.length) * 100
      : 0;

    // Calculate improvement rate (comparing first vs last assessments)
    const sortedScores = classScores.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    let improvementRate = 0;
    if (sortedScores.length >= 2) {
      const firstAvg = sortedScores.slice(0, Math.ceil(sortedScores.length / 2))
        .reduce((sum, s) => sum + (s.score || 0), 0) / Math.ceil(sortedScores.length / 2);
      const lastAvg = sortedScores.slice(Math.ceil(sortedScores.length / 2))
        .reduce((sum, s) => sum + (s.score || 0), 0) / Math.floor(sortedScores.length / 2);
      improvementRate = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : 0;
    }

    return {
      className: assignment.class_name || 'Unknown',
      subject: assignment.subject || 'Unknown',
      averageScore,
      passRate,
      improvementRate,
      comparedToSchoolAverage: averageScore - schoolAverageScore,
    };
  });
};

/**
 * Analyze sentiment of feedback text
 */
const analyzeSentiment = (text: string): 'positive' | 'neutral' | 'negative' => {
  const positiveWords = ['excellent', 'great', 'good', 'outstanding', 'amazing', 'helpful', 'clear'];
  const negativeWords = ['poor', 'bad', 'terrible', 'unclear', 'confusing', 'difficult', 'unhelpful'];
  
  const lowerText = text.toLowerCase();
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
};

/**
 * Analyze teacher feedback
 */
export const analyzeFeedback = (feedbackRecords: any[]): FeedbackAnalysis => {
  const totalFeedbacks = feedbackRecords.length;

  // Sentiment breakdown
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  feedbackRecords.forEach(feedback => {
    const sentiment = feedback.sentiment || analyzeSentiment(feedback.comment || '');
    if (sentiment === 'positive') positive++;
    else if (sentiment === 'negative') negative++;
    else neutral++;
  });

  // Extract common themes (simple keyword extraction)
  const themeMap: Map<string, { count: number; sentiment: 'positive' | 'negative' }> = new Map();
  const keywords = ['teaching', 'explanation', 'patience', 'knowledge', 'engagement', 'clarity'];

  feedbackRecords.forEach(feedback => {
    const text = (feedback.comment || '').toLowerCase();
    const sentiment = feedback.sentiment || analyzeSentiment(feedback.comment || '');
    
    keywords.forEach(keyword => {
      if (text.includes(keyword)) {
        const existing = themeMap.get(keyword) || { count: 0, sentiment: sentiment as 'positive' | 'negative' };
        existing.count++;
        themeMap.set(keyword, existing);
      }
    });
  });

  const commonThemes: FeedbackTheme[] = Array.from(themeMap.entries())
    .map(([theme, data]) => ({
      theme,
      count: data.count,
      sentiment: data.sentiment,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent feedback
  const recentFeedback: RecentFeedback[] = feedbackRecords
    .sort((a, b) => new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime())
    .slice(0, 5)
    .map(feedback => ({
      date: new Date(feedback.created_at || feedback.date).toLocaleDateString(),
      rating: feedback.rating || 0,
      comment: feedback.comment || '',
      sentiment: feedback.sentiment || analyzeSentiment(feedback.comment || ''),
    }));

  return {
    totalFeedbacks,
    sentimentBreakdown: {
      positive,
      neutral,
      negative,
    },
    commonThemes,
    recentFeedback,
  };
};

/**
 * Calculate teacher KPIs
 */
export const calculateTeacherKPIs = (
  lessonPlans: any[],
  attendanceRecords: any[],
  classPerformance: ClassPerformance[],
  feedbackRecords: any[]
): TeacherKPIs => {
  // Lesson plan completion
  const completedPlans = lessonPlans.filter(p => p.status === 'Completed' || p.is_completed).length;
  const lessonPlanCompletion = lessonPlans.length > 0
    ? (completedPlans / lessonPlans.length) * 100
    : 0;

  // Teacher attendance rate
  const presentDays = attendanceRecords.filter(r => r.status === 'Present' || r.status === 'present').length;
  const attendanceRate = attendanceRecords.length > 0
    ? (presentDays / attendanceRecords.length) * 100
    : 0;

  // Average class performance
  const averageClassPerformance = classPerformance.length > 0
    ? classPerformance.reduce((sum, c) => sum + c.averageScore, 0) / classPerformance.length
    : 0;

  // Student satisfaction (from feedback ratings)
  const studentSatisfaction = feedbackRecords.length > 0
    ? (feedbackRecords.reduce((sum, f) => sum + (f.rating || 0), 0) / feedbackRecords.length / 5) * 100
    : 0;

  return {
    lessonPlanCompletion,
    attendanceRate,
    averageClassPerformance,
    studentSatisfaction,
  };
};

/**
 * Generate complete teacher performance report data
 */
export const generateTeacherPerformanceData = (
  teacher: TeacherInfo,
  feedbackRecords: any[],
  teacherAssignments: any[],
  assessmentScores: any[],
  lessonPlans: any[],
  attendanceRecords: any[],
  schoolAverageScore: number
): TeacherPerformanceData => {
  const ratings = calculateTeacherRatings(feedbackRecords);
  const classPerformance = analyzeClassPerformance(teacherAssignments, assessmentScores, schoolAverageScore);
  const feedbackAnalysis = analyzeFeedback(feedbackRecords);
  const kpis = calculateTeacherKPIs(lessonPlans, attendanceRecords, classPerformance, feedbackRecords);

  return {
    teacher,
    ratings,
    classPerformance,
    feedbackAnalysis,
    kpis,
  };
};
