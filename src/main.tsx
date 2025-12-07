
import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register';
import App from './App'
import './index.css'
import { Offline, supa } from './offline/client';
import { queueStore } from './offline/db';
import { QueryProvider } from './providers/QueryProvider';

registerSW({ immediate: true });

const OfflineFallback = () => (
  <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-100 p-4 text-center">
    <h1 className="text-2xl font-bold text-slate-800">You are offline</h1>
    <p className="mt-2 text-slate-600">
      Please connect to the internet to sign in and use School Guardian 360 for the first time.
    </p>
  </div>
);

(async () => {
  try {
    const root = ReactDOM.createRoot(document.getElementById('root')!);
    
    if (!Offline.online()) {
        const { data: { session } } = await (supa.auth as any).getSession();
        const hasCache = (await queueStore.length()) > 0;

        if (!session && !hasCache) {
        root.render(<OfflineFallback />);
        return;
        }
    }

    root.render(
        <React.StrictMode>
        <QueryProvider>
          <App />
        </QueryProvider>
        </React.StrictMode>
    );
  } catch (error) {
    console.error("Application initialization failed:", error);
    const root = ReactDOM.createRoot(document.getElementById('root')!);
    root.render(
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1>Something went wrong during startup.</h1>
            <p>Please refresh the page or clear your cache.</p>
            <pre style={{ background: '#f4f4f4', padding: '1rem', overflow: 'auto' }}>{String(error)}</pre>
        </div>
    );
  }
})();
