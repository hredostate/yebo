import React, { useState } from 'react';
import type { LearningPath, Student } from '../../types';
import { 
  generateLearningPath, 
  generateAILearningRecommendations,
  updateLearningPathProgress,
  generateProgressReport
} from '../../services/learningPathGenerator';
import { BookOpenIcon, TargetIcon, TrendingUpIcon, CheckCircleIcon, CircleIcon } from '../common/icons';

interface PersonalizedLearningPathProps {
  students: Student[];
}

const PersonalizedLearningPath: React.FC<PersonalizedLearningPathProps> = ({ 
  students 
}) => {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [aiRecommendations, setAiRecommendations] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const generatePath = async (student: Student) => {
    setLoading(true);
    setSelectedStudent(student);
    
    try {
      // Mock performance data - in production, fetch from API
      const performanceData = {
        student,
        subjectScores: [
          { subjectId: 1, subjectName: 'Mathematics', scores: [65, 70, 68, 72, 75] },
          { subjectId: 2, subjectName: 'English', scores: [78, 80, 82, 85, 83] },
          { subjectId: 3, subjectName: 'Science', scores: [55, 58, 60, 62, 65] },
          { subjectId: 4, subjectName: 'History', scores: [70, 72, 74, 76, 78] },
        ],
        strengths: ['English comprehension', 'History analysis'],
        weaknesses: ['Science concepts', 'Math problem-solving'],
        learningPace: 'average' as const,
      };

      const path = await generateLearningPath(performanceData);
      setLearningPath(path);

      const recommendations = await generateAILearningRecommendations(path);
      setAiRecommendations(recommendations);
    } catch (error) {
      console.error('Error generating learning path:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGoalCompletion = (goalId: string) => {
    if (!learningPath) return;
    
    const completedGoals = learningPath.weeklyGoals
      .filter(g => g.completed)
      .map(g => g.id);
    
    if (completedGoals.includes(goalId)) {
      completedGoals.splice(completedGoals.indexOf(goalId), 1);
    } else {
      completedGoals.push(goalId);
    }

    const updated = updateLearningPathProgress(learningPath, completedGoals);
    setLearningPath(updated);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
      case 'advanced': return 'bg-green-500/10 text-green-700 dark:text-green-300';
      default: return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
      case 'medium': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'low': return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
      default: return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <BookOpenIcon className="w-6 h-6" />
          Personalized Learning Paths
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          AI-generated curriculum recommendations based on student performance
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student Selection */}
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">
            Select Student
          </h3>
          
          <input
            type="text"
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredStudents.slice(0, 20).map((student) => (
              <button
                key={student.id}
                onClick={() => generatePath(student)}
                disabled={loading}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedStudent?.id === student.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-700'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-white">
                  {student.name}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  Grade {student.grade || 'N/A'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Learning Path Display */}
        <div className="lg:col-span-2 space-y-4">
          {loading && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-slate-600 dark:text-slate-400">
                Generating personalized learning path...
              </p>
            </div>
          )}

          {!loading && learningPath && (
            <>
              {/* Overview */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Learning Path for {selectedStudent?.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Generated: {new Date(learningPath.generatedAt).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Valid until: {new Date(learningPath.validUntil).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      {learningPath.overallProgress}%
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Overall Progress
                    </div>
                  </div>
                </div>

                {aiRecommendations && (
                  <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                    <div className="font-medium text-indigo-900 dark:text-indigo-300 mb-2">
                      AI Recommendations:
                    </div>
                    <p className="text-sm text-indigo-800 dark:text-indigo-200">
                      {aiRecommendations}
                    </p>
                  </div>
                )}
              </div>

              {/* Subject Paths */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Subject Progress
                </h3>
                <div className="grid gap-4">
                  {learningPath.subjects.map((subject) => (
                    <div
                      key={subject.subjectId}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">
                            {subject.subjectName}
                          </h4>
                          <div className="flex gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(subject.currentLevel)}`}>
                              Current: {subject.currentLevel}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              → Target: {subject.targetLevel}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          {subject.estimatedTimeToTarget}
                        </div>
                      </div>

                      {subject.strengths.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                            Strengths:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {subject.strengths.map((strength, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded text-xs"
                              >
                                {strength}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {subject.areasForImprovement.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                            Areas for Improvement:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {subject.areasForImprovement.map((area, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded text-xs"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {subject.suggestedTopics.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Suggested Topics:
                          </div>
                          <div className="space-y-1">
                            {subject.suggestedTopics.slice(0, 3).map((topic) => (
                              <div
                                key={topic.id}
                                className="text-xs text-slate-600 dark:text-slate-400 flex justify-between"
                              >
                                <span>• {topic.title}</span>
                                <span className="text-slate-500">{topic.estimatedHours}h</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Goals */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <TargetIcon className="w-5 h-5" />
                  Weekly Goals
                </h3>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="space-y-2">
                    {learningPath.weeklyGoals.map((goal) => (
                      <div
                        key={goal.id}
                        className="flex items-start gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                        onClick={() => toggleGoalCompletion(goal.id)}
                      >
                        {goal.completed ? (
                          <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CircleIcon className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className={`text-sm ${goal.completed ? 'line-through text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                            Week {goal.week}: {goal.description}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Due: {new Date(goal.dueDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUpIcon className="w-5 h-5" />
                  Recommendations
                </h3>
                <div className="grid gap-3">
                  {learningPath.recommendations.slice(0, 6).map((rec, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 dark:text-white">
                            {rec.title}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {rec.description}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border flex-shrink-0 ml-2 ${getPriorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                        <span className="capitalize">{rec.type}</span>
                        <span>{rec.estimatedDuration}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!loading && !learningPath && (
            <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
              <BookOpenIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Select a student to generate their personalized learning path
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonalizedLearningPath;
