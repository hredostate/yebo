import React, { useState } from 'react';
import type { CheckinAnomaly } from '../types';
import { WandIcon, UsersIcon, MapPinIcon, ClockIcon, RepeatIcon } from './common/icons';
import Spinner from './common/Spinner';
import { VIEWS } from '../constants';


interface TeacherPulseViewProps {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  // New props for anomaly detection
  checkinAnomalies: CheckinAnomaly[];
  onAnalyzeCheckinAnomalies: () => Promise<void>;
  onNavigate: (view: string) => void;
}

const AnomalyCard: React.FC<{ anomaly: CheckinAnomaly; onNavigate: (v: string) => void }> = ({ anomaly, onNavigate }) => {
    const icons: Record<CheckinAnomaly['anomaly_type'], React.ReactNode> = {
        Location: <MapPinIcon className="w-5 h-5 text-red-500" />,
        Time: <ClockIcon className="w-5 h-5 text-yellow-500" />,
        Pattern: <RepeatIcon className="w-5 h-5 text-indigo-500" />,
    };

    return (
        <div className="p-4 rounded-lg border bg-slate-100 dark:bg-slate-800 animate-fade-in">
            <div className="flex justify-between items-start">
                <div>
                    <div className="flex items-center gap-2">
                        {icons[anomaly.anomaly_type]}
                        <h4 className="font-bold">{anomaly.anomaly_type} Anomaly</h4>
                    </div>
                    <p className="text-sm font-semibold mt-1">{anomaly.teacher_name}</p>
                    <p className="text-xs text-slate-500">Date: {new Date(anomaly.date + 'T00:00:00').toLocaleDateString()}</p>
                </div>
                <button
                    onClick={() => onNavigate(VIEWS.USER_MANAGEMENT)} // simple navigation for now
                    className="text-xs font-semibold text-blue-600 hover:underline"
                >
                    View Staff
                </button>
            </div>
            <p className="text-sm mt-2 italic">"{anomaly.description}"</p>
        </div>
    );
};


const TeacherPulseView: React.FC<TeacherPulseViewProps> = ({ addToast, checkinAnomalies = [], onAnalyzeCheckinAnomalies, onNavigate }) => {
  const [isLoading, setIsLoading] = useState(false);

    const handleAnalyze = async () => {
        setIsLoading(true);
        await onAnalyzeCheckinAnomalies();
        setIsLoading(false);
    };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <UsersIcon className="w-8 h-8 text-indigo-500" />
            Teacher Pulse
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mt-1">
          AI-driven insights into staff attendance patterns and well-being.
        </p>
      </div>
       <div className="p-4 rounded-xl border border-slate-200/60 bg-white/60 dark:bg-slate-900/40">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-lg">Check-in Anomaly Detection</h2>
                <button onClick={handleAnalyze} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2">
                    {isLoading ? <Spinner size="sm" /> : <WandIcon className="w-5 h-5"/>}
                    {isLoading ? 'Analyzing...' : 'Run Analysis'}
                </button>
            </div>
            <p className="text-sm text-slate-500 mt-2">Scan the last 30 days of check-in data to identify unusual patterns in time, location, or behavior.</p>
            
            <div className="mt-4 pt-4 border-t">
                {isLoading && checkinAnomalies.length === 0 && <div className="flex justify-center p-8"><Spinner size="lg"/></div>}
                {!isLoading && checkinAnomalies.length === 0 && <p className="text-center text-slate-500 p-8">No anomalies detected, or analysis has not been run.</p>}
                {checkinAnomalies.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {checkinAnomalies.map(anomaly => <AnomalyCard key={anomaly.checkin_id} anomaly={anomaly} onNavigate={onNavigate} />)}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default TeacherPulseView;
