import { useState, useEffect, useCallback } from 'react';
import UploadPage from './components/UploadPage';
import ImportPreview from './components/ImportPreview';
import Dashboard from './components/Dashboard';

const STORAGE_KEY = 'football-dashboard-v1';

export default function App() {
  const [view, setView] = useState('upload');
  const [players, setPlayers] = useState([]);
  const [budget, setBudget] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Restore persisted data on first load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { players: p, budget: b } = JSON.parse(saved);
        if (Array.isArray(p) && p.length > 0) {
          setPlayers(p);
          setBudget(b);
          setView('dashboard');
        }
      }
    } catch {
      // Ignore corrupted storage
    }
  }, []);

  const handleFilesParsed = useCallback((data) => {
    setPreviewData(data);
    setView('preview');
  }, []);

  const handleImportConfirm = useCallback(() => {
    const { players: newPlayers, totalBudget } = previewData;
    setPlayers(newPlayers);
    setBudget(totalBudget);
    setPreviewData(null);
    setView('dashboard');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ players: newPlayers, budget: totalBudget }));
    } catch {
      // Storage may be unavailable (private browsing)
    }
  }, [previewData]);

  const handleImportCancel = useCallback(() => {
    setPreviewData(null);
    setView(players.length > 0 ? 'dashboard' : 'upload');
  }, [players.length]);

  const handleClearData = useCallback(() => {
    setPlayers([]);
    setBudget(null);
    localStorage.removeItem(STORAGE_KEY);
    setView('upload');
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {view === 'upload' && (
        <UploadPage
          onParsed={handleFilesParsed}
          hasExistingData={players.length > 0}
          onViewDashboard={() => setView('dashboard')}
        />
      )}
      {view === 'preview' && previewData && (
        <ImportPreview
          data={previewData}
          onConfirm={handleImportConfirm}
          onCancel={handleImportCancel}
        />
      )}
      {view === 'dashboard' && (
        <Dashboard
          players={players}
          budget={budget}
          onUploadNew={() => setView('upload')}
          onClearData={handleClearData}
        />
      )}
    </div>
  );
}
