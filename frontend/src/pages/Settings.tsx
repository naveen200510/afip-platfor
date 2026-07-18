import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';

const Settings: React.FC = () => {
  const [theme, setTheme] = useState('dark');
  const [language, setLanguage] = useState('en');
  const [currency, setCurrency] = useState('USD');
  const [financialYear, setFinancialYear] = useState('2024-25');
  const [success, setSuccess] = useState('');

  const fetchSettings = async () => {
    try {
      const response = await api.get('/admin/settings');
      const s = response.data;
      setTheme(s.theme);
      setLanguage(s.language);
      setCurrency(s.currency);
      setFinancialYear(s.financial_year);
      localStorage.setItem('afip_currency', s.currency);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    try {
      await api.put(`/admin/settings?theme=${theme}&language=${language}&currency=${currency}&financial_year=${financialYear}`);
      setSuccess('Settings updated successfully!');
      localStorage.setItem('afip_currency', currency);
      
      // If theme changed, apply class to body
      const body = document.body;
      if (theme === 'light') {
        body.classList.add('theme-light');
      } else {
        body.classList.remove('theme-light');
      }
      
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '30px', maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
        <SettingsIcon size={22} color="#00f2fe" />
        <h3 style={{ fontSize: '20px', fontWeight: 600 }}>System Settings</h3>
      </div>

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          color: '#10b981',
          padding: '10px 14px',
          borderRadius: '8px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="form-group">
          <label className="form-label">UI Theme Mode</label>
          <select
            className="form-input"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            style={{ background: '#0e172a' }}
          >
            <option value="dark"> Obsidian Dark Terminal (Recommended) </option>
            <option value="light"> Professional Light Mode </option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Display Currency</label>
          <select
            className="form-input"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            style={{ background: '#0e172a' }}
          >
            <option value="INR">INR (₹ — Indian Rupee)</option>
            <option value="USD">USD ($ — United States Dollar)</option>
            <option value="EUR">EUR (€ — Euro)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Default Language</label>
          <select
            className="form-input"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ background: '#0e172a' }}
          >
            <option value="en">English (UK/US)</option>
            <option value="en-IN">English (India)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Active Financial Year</label>
          <select
            className="form-input"
            value={financialYear}
            onChange={(e) => setFinancialYear(e.target.value)}
            style={{ background: '#0e172a' }}
          >
            <option value="2024-25">2024-25</option>
            <option value="2023-24">2023-24</option>
            <option value="2022-23">2022-23</option>
            <option value="2021-22">2021-22</option>
          </select>
        </div>

        <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '12px', marginTop: '10px' }}>
          <Save size={16} /> Save Preference Changes
        </button>
      </form>
    </div>
  );
};

export default Settings;
