import React, { useState } from 'react';

// Placeholder components - will be created next
const TransportRouteEditor = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Route Editor - Coming Soon</div>
);
const TransportStopEditor = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Stop Editor - Coming Soon</div>
);
const TransportBusEditor = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Bus Editor - Coming Soon</div>
);
const TransportRequestsList = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Requests List - Coming Soon</div>
);
const TransportSubscriptionsList = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Subscriptions List - Coming Soon</div>
);
const TransportManifest = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Manifest - Coming Soon</div>
);
const TransportTripGenerator = ({ onClose }: { onClose: () => void }) => (
  <div className="p-4">Trip Generator - Coming Soon</div>
);

interface TransportManagerProps {
  schoolId: number;
  currentTermId: number;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

type TabKey = 'routes' | 'stops' | 'buses' | 'requests' | 'subscriptions' | 'manifest' | 'trips';

export default function TransportManager({
  schoolId,
  currentTermId,
  addToast,
}: TransportManagerProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('routes');

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
    const props = { onClose: () => {} }; // Placeholder for now
    
    switch (activeTab) {
      case 'routes':
        return <TransportRouteEditor {...props} />;
      case 'stops':
        return <TransportStopEditor {...props} />;
      case 'buses':
        return <TransportBusEditor {...props} />;
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
