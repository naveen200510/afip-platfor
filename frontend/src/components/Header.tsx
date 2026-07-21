import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, MessageSquare, ShieldAlert, Sun, Moon } from 'lucide-react';
import VoiceButton from './VoiceButton';
import api from '../utils/api';

interface HeaderProps {
  title: string;
  onSearch: (results: any[]) => void;
  onVoiceCommand: (text: string) => void;
  onToggleChat: () => void;
}

interface Toast {
  id: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  dismissing?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title, onSearch, onVoiceCommand, onToggleChat }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showAlertsDropdown, setShowAlertsDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const isFirstLoad = useRef(true);
  const lastAlertId = useRef(0);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('afip_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('theme-light');
    } else {
      root.classList.remove('theme-light');
    }
    localStorage.setItem('afip_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const formatAlertMessage = (msg: string) => {
    const cur = localStorage.getItem('afip_currency') || 'USD';
    if (cur === 'USD') return msg;

    const rate = cur === 'INR' ? 83.0 : 0.92;
    const symbol = cur === 'INR' ? '₹' : '€';

    return msg.replace(/\$([0-9,.]+)/g, (match, p1) => {
      const rawVal = parseFloat(p1.replace(/,/g, ''));
      if (isNaN(rawVal)) return match;
      const converted = rawVal * rate;
      
      if (cur === 'INR') {
        if (converted >= 10000000) return `₹${(converted / 10000000).toFixed(2)} Cr`;
        if (converted >= 100000) return `₹${(converted / 100000).toFixed(2)} L`;
        return `₹${converted.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
      } else {
        if (converted >= 1000000000) return `${symbol}${(converted / 1000000000).toFixed(2)}B`;
        if (converted >= 1000000) return `${symbol}${(converted / 1000000).toFixed(2)}M`;
        return `${symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      }
    });
  };

  const triggerDismiss = (id: number) => {
    setTimeout(() => {
      // Mark as dismissing first to trigger fade out animation
      setToasts(prev => prev.map(t => t.id === id ? { ...t, dismissing: true } : t));
      
      // Remove from state after animation completes (400ms)
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 400);
    }, 5000);
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/admin/alerts');
      const data = response.data;
      setAlerts(data);
      setUnreadCount(data.filter((a: any) => !a.is_read).length);

      // Extract new alerts for toasts
      if (data.length > 0) {
        const sortedData = [...data].sort((a: any, b: any) => a.id - b.id);
        const maxId = sortedData[sortedData.length - 1].id;

        if (isFirstLoad.current) {
          // First load: show up to 3 unread alerts
          const initialToasts = sortedData
            .filter((a: any) => !a.is_read)
            .slice(-3)
            .map((a: any) => ({
              id: a.id,
              type: a.type,
              message: a.message,
              isRead: a.is_read,
              createdAt: a.created_at
            }));
          
          if (initialToasts.length > 0) {
            setToasts(initialToasts);
            initialToasts.forEach((t: any) => triggerDismiss(t.id));
          }
          isFirstLoad.current = false;
        } else if (maxId > lastAlertId.current) {
          // New alert detected! Add it to toasts
          const newAlerts = sortedData.filter((a: any) => a.id > lastAlertId.current);
          newAlerts.forEach((a: any) => {
            setToasts(prev => [...prev, {
              id: a.id,
              type: a.type,
              message: a.message,
              isRead: a.is_read,
              createdAt: a.created_at
            }]);
            triggerDismiss(a.id);
          });
        }
        lastAlertId.current = maxId;
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Poll alerts every 15 seconds
    const interval = setInterval(fetchAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await api.get(`/data/search?query=${searchQuery}`);
      onSearch(response.data);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/admin/alerts/${id}/read`);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  return (
    <header className="app-header">
      {/* Title */}
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
      </div>

      {/* Global Search and Tools */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        
        {/* Smart Search Form */}
        <form onSubmit={handleSearchSubmit} className="search-container">
          <Search size={16} color="#9ca3af" />
          <input
            type="text"
            className="search-input"
            placeholder="Search across years (salary, fuel, repair)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        {/* Voice Assistant Trigger */}
        <VoiceButton onTranscript={onVoiceCommand} />

        {/* Theme Toggle Switch */}
        <button
          onClick={toggleTheme}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            padding: '10px',
            borderRadius: '50%',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Alerts and Notifications */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAlertsDropdown(!showAlertsDropdown)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-color)',
              padding: '10px',
              borderRadius: '50%',
              color: unreadCount > 0 ? '#f43f5e' : '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                background: '#f43f5e',
                color: '#ffffff',
                fontSize: '9px',
                fontWeight: 700,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 8px rgba(244, 63, 94, 0.6)'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {/* Alerts Dropdown List */}
          {showAlertsDropdown && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '50px',
              width: '320px',
              maxHeight: '400px',
              overflowY: 'auto',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
              zIndex: 90,
              padding: '12px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '10px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                  <ShieldAlert size={14} color="#f43f5e" /> Real-time Alerts
                </h4>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{alerts.length} total</span>
              </div>

              {alerts.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0', fontSize: '13px' }}>
                  No warnings detected.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      style={{
                        padding: '10px',
                        background: alert.is_read ? 'rgba(255, 255, 255, 0.02)' : 'rgba(244, 63, 94, 0.05)',
                        border: alert.is_read ? '1px solid var(--border-color)' : '1px solid rgba(244, 63, 94, 0.2)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        cursor: 'pointer'
                      }}
                      onClick={() => !alert.is_read && markAsRead(alert.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span style={{ color: alert.type === 'Budget Overrun' ? '#f43f5e' : '#f59e0b' }}>
                          {alert.type}
                        </span>
                        <span style={{ fontSize: '9px', color: '#9ca3af' }}>
                          {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>{formatAlertMessage(alert.message)}</p>
                      {!alert.is_read && (
                        <span style={{ fontSize: '9px', color: '#00f2fe', textAlign: 'right', marginTop: '2px' }}>
                          Mark as read
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* AI Chatbot Floating Drawer Toggle */}
        <button
          onClick={onToggleChat}
          style={{
            background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))',
            color: '#ffffff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)'
          }}
        >
          <MessageSquare size={16} />
          AI Copilot
        </button>
      </div>

      {/* Floating Toast Notifications Overlay */}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-alert-card ${t.dismissing ? 'dismissing' : ''} ${t.type !== 'Budget Overrun' ? 'warning' : ''}`}
          >
            <ShieldAlert size={20} color={t.type === 'Budget Overrun' ? '#f43f5e' : '#f59e0b'} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: t.type === 'Budget Overrun' ? '#f43f5e' : '#f59e0b' }}>
                {t.type}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {formatAlertMessage(t.message)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </header>
  );
};

export default Header;
