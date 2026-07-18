import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatBot from './components/ChatBot';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import YearComparison from './pages/YearComparison';
import DepartmentAnalytics from './pages/DepartmentAnalytics';
import ClientAnalytics from './pages/ClientAnalytics';
import ScenarioSimulator from './components/ScenarioSimulator';
import AdminPanel from './pages/AdminPanel';
import Settings from './pages/Settings';
import { X, Table, ShieldAlert } from 'lucide-react';

const App: React.FC = () => {
  const formatCurrency = (val: number) => {
    const cur = localStorage.getItem('afip_currency') || 'USD';
    const rate = cur === 'INR' ? 83.0 : (cur === 'EUR' ? 0.92 : 1.0);
    const converted = val * rate;
    
    if (cur === 'INR') {
      if (converted >= 10000000) return `₹${(converted / 10000000).toFixed(2)} Cr`;
      if (converted >= 100000) return `₹${(converted / 100000).toFixed(2)} L`;
      return `₹${converted.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    } else {
      const sym = cur === 'EUR' ? '€' : '$';
      if (converted >= 1000000000) return `${sym}${(converted / 1000000000).toFixed(2)}B`;
      if (converted >= 1000000) return `${sym}${(converted / 1000000).toFixed(2)}M`;
      return `${sym}${(converted / 1000).toFixed(0)}K`;
    }
  };

  const getSymbol = () => {
    const cur = localStorage.getItem('afip_currency') || 'USD';
    return cur === 'INR' ? '₹' : (cur === 'EUR' ? '€' : '$');
  };
  const symbol = getSymbol();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [nlFilterResult, setNlFilterResult] = useState<any[] | null>(null);
  const [nlFilterQuery, setNlFilterQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('afip_token');
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('afip_token');
    localStorage.removeItem('afip_user_role');
    setIsLoggedIn(false);
    window.location.href = '/login';
  };

  // Natural Language & Voice Dashboard Filters (Module 13 & 14)
  const handleVoiceOrTextCommand = async (text: string) => {
    const query = text.toLowerCase();
    
    // Command 1: "Show expenses above X Lakhs" / "show expenses above X"
    if (query.includes('expense') && (query.includes('above') || query.includes('greater than'))) {
      let amount = 1000000; // default 10 Lakhs
      const numbers = query.match(/\d+/g);
      if (numbers) {
        const parsed = parseInt(numbers[0]);
        if (query.includes('lakh')) {
          amount = parsed * 100000;
        } else {
          amount = parsed;
        }
      }
      
      setNlFilterQuery(`Expenses above ${formatCurrency(amount)}`);
      try {
        const response = await fetch(`http://localhost:8081/api/data/transactions?limit=250`);
        const txs = await response.json();
        const filtered = txs.filter((t: any) => t.type === 'Expense' && t.amount > amount);
        setNlFilterResult(filtered);
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Command 2: "Compare fuel expenses" / "compare salaries"
    if (query.includes('compare')) {
      setActiveTab('comparison');
      setVoiceTranscript(text);
      setChatOpen(true);
      return;
    }

    // Command 3: "Show dashboard"
    if (query.includes('dashboard') || query.includes('home')) {
      setActiveTab('dashboard');
      return;
    }

    // Otherwise, open AI Copilot to handle conversational queries
    setVoiceTranscript(text);
    setChatOpen(true);
  };

  // Helper mapping tab ID to page components
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'comparison':
        return <YearComparison />;
      case 'departments':
        return <DepartmentAnalytics />;
      case 'clients':
        return <ClientAnalytics />;
      case 'forecasting':
        return <ScenarioSimulator />;
      case 'settings':
        return <Settings />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Financial Intelligence Center';
      case 'comparison': return 'Year-over-Year Performance Ledger';
      case 'departments': return 'Department Cost Center Analytics';
      case 'clients': return 'Corporate Client Revenue Analytics & Predictions';
      case 'forecasting': return 'What-If Simulation and Forecasting';
      case 'settings': return 'User & Localization Preference Settings';
      case 'admin': return 'Corporate Administration Panel';
      default: return 'Financial Dashboard';
    }
  };

  // Simple Router Switch for Login/Register pages outside sidebar wrapper
  if (window.location.pathname.endsWith('/register')) {
    return <Register />;
  }

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      {/* Main Panel View Area */}
      <main className="main-content">
        <Header 
          title={getPageTitle()} 
          onSearch={setSearchResults} 
          onVoiceCommand={handleVoiceOrTextCommand} 
          onToggleChat={() => setChatOpen(!chatOpen)}
        />

        {/* Dynamic Search Results Panel overlay */}
        {searchResults && (
          <div className="glass-panel" style={{ padding: '24px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Table size={16} color="#00f2fe" /> Smart Search Results ({searchResults.length})
              </h3>
              <button 
                onClick={() => setSearchResults(null)} 
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            
            {searchResults.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No matches found across historical years.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Department</th>
                      <th style={{ padding: '8px' }}>Category</th>
                      <th style={{ padding: '8px' }}>Description</th>
                      <th style={{ padding: '8px' }}>Type</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 8px' }}>{r.date}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.department}</td>
                        <td style={{ padding: '10px 8px' }}>{r.category}</td>
                        <td style={{ padding: '10px 8px', color: '#d1d5db' }}>{r.description}</td>
                        <td style={{ padding: '10px 8px', color: r.type === 'Expense' ? '#f43f5e' : '#10b981' }}>{r.type}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Natural Language/Voice Filter Panel overlay */}
        {nlFilterResult && (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', color: '#00f2fe' }}>
                <ShieldAlert size={16} /> Dashboard NL Query: {nlFilterQuery} ({nlFilterResult.length})
              </h3>
              <button 
                onClick={() => setNlFilterResult(null)} 
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            
            {nlFilterResult.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
                No transactions match this filter criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '300px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                      <th style={{ padding: '8px' }}>Date</th>
                      <th style={{ padding: '8px' }}>Department</th>
                      <th style={{ padding: '8px' }}>Category</th>
                      <th style={{ padding: '8px' }}>Description</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nlFilterResult.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 8px' }}>{new Date(r.date).toLocaleDateString()}</td>
                        <td style={{ padding: '10px 8px', fontWeight: 600 }}>{r.department.name}</td>
                        <td style={{ padding: '10px 8px' }}>{r.category}</td>
                        <td style={{ padding: '10px 8px', color: '#d1d5db' }}>{r.description}</td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#f43f5e' }}>{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab pages render */}
        {renderTabContent()}
      </main>

      {/* Floating Chat Copilot drawer */}
      <ChatBot 
        isOpen={chatOpen} 
        onClose={() => setChatOpen(false)}
        voiceTranscript={voiceTranscript}
        onVoiceHandled={() => setVoiceTranscript('')}
      />
    </div>
  );
};

export default App;
