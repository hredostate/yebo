import React, { useState, useMemo } from 'react';
import type { RiskPrediction, Student } from '../../types';
import { 
  predictStudentRisk, 
  batchPredictRisks, 
  generateAIRiskAnalysis 
} from '../../services/predictiveAnalytics';
import { AlertCircleIcon, TrendingDownIcon, TrendingUpIcon, MinusIcon, ActivityIcon } from '../common/icons';

interface EarlyWarningSystemProps {
  students: Student[];
  onViewStudent: (student: Student) => void;
}

const EarlyWarningSystem: React.FC<EarlyWarningSystemProps> = ({ 
  students, 
  onViewStudent 
}) => {
  const [predictions, setPredictions] = useState<RiskPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPrediction, setSelectedPrediction] = useState<RiskPrediction | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [filterLevel, setFilterLevel] = useState<string>('all');

  // Generate predictions for all students
  const generatePredictions = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration - in production, fetch from API
      const studentsData = students.slice(0, 20).map(student => ({
        student,
        attendanceRate: 70 + Math.random() * 30,
        gradeAverage: 40 + Math.random() * 50,
        behaviorIncidents: Math.floor(Math.random() * 7),
        assignmentCompletionRate: 60 + Math.random() * 40,
        recentGrades: Array(6).fill(0).map(() => 40 + Math.random() * 50),
        recentAttendance: Array(10).fill(false).map(() => Math.random() > 0.2),
      }));

      const results = await batchPredictRisks(studentsData);
      setPredictions(results);
    } catch (error) {
      console.error('Error generating predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get AI analysis for selected prediction
  const getAIAnalysis = async (prediction: RiskPrediction) => {
    setSelectedPrediction(prediction);
    setAiAnalysis('Generating analysis...');
    
    try {
      const analysis = await generateAIRiskAnalysis(prediction);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('Error getting AI analysis:', error);
      setAiAnalysis('Unable to generate analysis at this time.');
    }
  };

  // Filter predictions by risk level
  const filteredPredictions = useMemo(() => {
    if (filterLevel === 'all') return predictions;
    return predictions.filter(p => p.riskLevel === filterLevel);
  }, [predictions, filterLevel]);

  // Calculate risk distribution
  const riskDistribution = useMemo(() => {
    const dist = { low: 0, moderate: 0, high: 0, critical: 0 };
    predictions.forEach(p => dist[p.riskLevel]++);
    return dist;
  }, [predictions]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700';
      case 'high': return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700';
      case 'moderate': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700';
      case 'low': return 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700';
      default: return 'bg-slate-500/10 text-slate-700 dark:text-slate-300';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUpIcon className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'declining': return <TrendingDownIcon className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default: return <MinusIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ActivityIcon className="w-6 h-6" />
            Early Warning System
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            AI-powered student risk predictions 2-4 weeks ahead
          </p>
        </div>
        <button
          onClick={generatePredictions}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Analyzing...' : 'Generate Predictions'}
        </button>
      </div>

      {predictions.length > 0 && (
        <>
          {/* Risk Distribution Summary */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-500/10 border border-green-300 dark:border-green-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {riskDistribution.low}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Low Risk</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                {riskDistribution.moderate}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Moderate Risk</div>
            </div>
            <div className="bg-orange-500/10 border border-orange-300 dark:border-orange-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {riskDistribution.high}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">High Risk</div>
            </div>
            <div className="bg-red-500/10 border border-red-300 dark:border-red-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                {riskDistribution.critical}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">Critical Risk</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterLevel === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              All ({predictions.length})
            </button>
            <button
              onClick={() => setFilterLevel('critical')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterLevel === 'critical'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              Critical ({riskDistribution.critical})
            </button>
            <button
              onClick={() => setFilterLevel('high')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filterLevel === 'high'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              High ({riskDistribution.high})
            </button>
          </div>

          {/* Predictions List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Top At-Risk Students
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredPredictions.slice(0, 10).map((prediction) => (
                  <div
                    key={prediction.studentId}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => getAIAnalysis(prediction)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">
                          {prediction.studentName}
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Predicted issue date: {prediction.predictedDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(prediction.trend)}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(prediction.riskLevel)}`}>
                          {prediction.riskScore}/100
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-medium">Confidence:</span> {prediction.confidence}%
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          Risk Factors:
                        </div>
                        {prediction.factors.slice(0, 3).map((factor, idx) => (
                          <div
                            key={idx}
                            className="text-xs text-slate-600 dark:text-slate-400 pl-2"
                          >
                            • {factor.name}: {factor.currentValue.toFixed(1)} (threshold: {factor.threshold})
                          </div>
                        ))}
                      </div>

                      {prediction.recommendedActions.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Recommended Actions:
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {prediction.recommendedActions[0]}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Analysis Panel */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                AI Analysis
              </h3>
              {selectedPrediction ? (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 space-y-4">
                  <div>
                    <h4 className="font-semibold text-lg text-slate-900 dark:text-white mb-1">
                      {selectedPrediction.studentName}
                    </h4>
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getRiskColor(selectedPrediction.riskLevel)}`}>
                      {selectedPrediction.riskLevel.toUpperCase()} RISK - Score: {selectedPrediction.riskScore}/100
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Trend:</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-400 capitalize">
                        {selectedPrediction.trend}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">Confidence:</span>
                      <span className="ml-2 text-slate-600 dark:text-slate-400">
                        {selectedPrediction.confidence}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      AI Analysis:
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {aiAnalysis}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Detailed Risk Factors:
                    </div>
                    <div className="space-y-2">
                      {selectedPrediction.factors.map((factor, idx) => (
                        <div key={idx} className="text-sm">
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {factor.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 ml-2">
                            {factor.description}
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-1">
                            <div
                              className={`h-2 rounded-full ${
                                factor.currentValue < factor.threshold
                                  ? 'bg-red-500'
                                  : 'bg-green-500'
                              }`}
                              style={{
                                width: `${Math.min(
                                  (factor.currentValue / factor.threshold) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Recommended Interventions:
                    </div>
                    <ul className="space-y-1">
                      {selectedPrediction.recommendedActions.map((action, idx) => (
                        <li key={idx} className="text-sm text-slate-600 dark:text-slate-400 flex items-start">
                          <AlertCircleIcon className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                  <AlertCircleIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400">
                    Click on a student to view detailed AI analysis
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {predictions.length === 0 && !loading && (
        <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-12 text-center">
          <ActivityIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Click "Generate Predictions" to analyze student risk factors
          </p>
        </div>
      )}
    </div>
  );
};

export default EarlyWarningSystem;
