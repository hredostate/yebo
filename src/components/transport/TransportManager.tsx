import React, { useState, useEffect } from 'react';
import type { Campus } from '../../types';
import { requireSupabaseClient } from '../../services/supabaseClient';
import TransportRouteEditor from './TransportRouteEditor';
import TransportStopEditor from './TransportStopEditor';
import TransportBusEditor from './TransportBusEditor';
import TransportRequestsList from './TransportRequestsList';
import TransportSubscriptionsList from './TransportSubscriptionsList';
import TransportManifest from './TransportManifest';
import TransportTripGenerator from './TransportTripGenerator';

interface TransportManagerProps {
  schoolId: number;
  currentTermId: number;
  campuses: Campus[];
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabKey = 'routes' | 'stops' | 'buses' | 'requests' | 'subscriptions' | 'manifest' | 'trips';

export default function TransportManager({
  schoolId,
  currentTermId,
  campuses: initialCampuses,
  addToast,
}: TransportManagerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('routes');
  const [campuses, setCampuses] = useState<Campus[]>(initialCampuses);
  const [loadingCampuses, setLoadingCampuses] = useState(false);

  useEffect(() => {
    loadCampuses();
  }, [schoolId]);

  const loadCampuses = async () => {
    setLoadingCampuses(true);
    try {
      const supabase = requireSupabaseClient();
      const { data, error } = await supabase
        .from('campuses')
        .select('*')
        .eq('school_id', schoolId)
        .order('name');

      if (error) throw error;
      setCampuses(data || []);
    } catch (error: any) {
      console.error('Error loading campuses:', error);
      addToast(error.message || 'Failed to load campuses', 'error');
    } finally {
      setLoadingCampuses(false);
    }
  };

  const tabs = [
    { key: 'routes' as TabKey, label: 'Routes', icon: '🛣️' },
    { key: 'stops' as TabKey, label: 'Stops', icon: '📍' },
    { key: 'buses' as TabKey, label: 'Buses', icon: '🚌' },
    { key: 'requests' as TabKey, label: 'Requests', icon: '📝' },
    { key: 'subscriptions' as TabKey, label: 'Subscriptions', icon: '✅' },
    { key: 'manifest' as TabKey, label: 'Manifest', icon: '📋' },
    { key: 'trips' as TabKey, label: 'Trip Generator', icon: '📅' },
  ];

  const renderTabContent = () => {
    const props = {
      schoolId,
      currentTermId,
      campuses,
      addToast,
    };
    
    if (loadingCampuses) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }
    
    switch (activeTab) {
      case 'routes':
        return <TransportRouteEditor {...props} />;
      case 'stops':
        return <TransportStopEditor {...props} />;
      case 'buses':
        return <TransportBusEditor schoolId={schoolId} campuses={campuses} addToast={addToast} />;
      case 'requests':
        return <TransportRequestsList {...props} />;
      case 'subscriptions':
        return <TransportSubscriptionsList {...props} />;
      case 'manifest':
        return <TransportManifest {...props} />;
      case 'trips':
        return <TransportTripGenerator {...props} />;
      default:
        return <div>Select a tab</div>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transport Manager</h1>
        <p className="text-gray-600 mt-1">Manage school bus routes, stops, and student subscriptions</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {renderTabContent()}
      </div>
    </div>
  );
}
