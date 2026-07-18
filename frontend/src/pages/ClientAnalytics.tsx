import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Award, TrendingUp, Sparkles, Building, ArrowUpRight } from 'lucide-react';
import api from '../utils/api';

const COLORS = ['#00f2fe', '#10b981', '#6366f1', '#f43f5e', '#f59e0b', '#a855f7', '#ec4899', '#3b82f6'];

const ClientAnalytics: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchClientData = async () => {
    try {
      const response = await api.get('/dashboard/clients');
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch client analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#9ca3af' }}>
        Calculating client revenue streams and training predictive models...
      </div>
    );
  }

  // Format currency dynamically
  const getSymbol = () => {
    const cur = localStorage.getItem('afip_currency') || 'USD';
    return cur === 'INR' ? '₹' : (cur === 'EUR' ? '€' : '$');
  };
  const symbol = getSymbol();
  const cur = localStorage.getItem('afip_currency') || 'USD';
  const rate = cur === 'INR' ? 83.0 : (cur === 'EUR' ? 0.92 : 1.0);

  const formatCurrency = (val: number) => {
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

  const formatChartValue = (v: number) => {
    if (cur === 'INR') {
      if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
      if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
      return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    } else {
      const sym = cur === 'EUR' ? '€' : '$';
      if (v >= 1000000000) return `${sym}${(v / 1000000000).toFixed(2)}B`;
      if (v >= 1000000) return `${sym}${(v / 1000000).toFixed(2)}M`;
      return `${sym}${(v / 1000).toFixed(0)}K`;
    }
  };

  const formatYAxisTick = (v: number) => {
    if (cur === 'INR') {
      if (v >= 10000000) return `₹${(v/10000000).toFixed(1)} Cr`;
      if (v >= 100000) return `₹${(v/100000).toFixed(1)} L`;
      return `₹${v}`;
    } else {
      const sym = cur === 'EUR' ? '€' : '$';
      if (v >= 1000000000) return `${sym}${(v/1000000000).toFixed(1)}B`;
      if (v >= 1000000) return `${sym}${(v/1000000).toFixed(1)}M`;
      return `${sym}${(v/1000).toFixed(0)}K`;
    }
  };

  const shortenClientName = (name: string) => {
    if (!name) return 'N/A';
    let clean = name
      .replace(/PVT\.?\s*LTD\.?/gi, '')
      .replace(/LTD\.?/gi, '')
      .replace(/CORPORATION/gi, 'Corp')
      .replace(/COMPANY/gi, 'Co')
      .replace(/SHIPPING/gi, '')
      .replace(/SERVICES/gi, '')
      .replace(/AGENCY/gi, '')
      .replace(/AGENCIES/gi, '')
      .replace(/INDIA/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (clean.includes("MSC Mediterranean")) return "MSC Line";
    if (clean.includes("BHARAT PETROLEUM") && clean.includes("KOCHI")) return "BPCL Kochi Refinery";
    if (clean.includes("BHARAT PETROLEUM")) return "BPCL Corp";
    if (clean.includes("INDIAN OIL")) return "IOCL Terminal";
    if (clean.includes("ATLANTIC GLOBAL")) return "Atlantic Global";
    if (clean.includes("INTEROCEAN")) return "Interocean";
    if (clean.includes("UNIFEEDER")) return "Unifeeder";
    if (clean.includes("THE SHIPPING CORPORATION")) return "SCI";

    if (clean.length > 20) {
      return clean.substring(0, 18) + "...";
    }
    return clean;
  };

  // Get distinct client names from timeline_data to draw chart lines
  const clientNames = Object.keys(data.timeline_data[0]).filter(k => k !== 'year');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Client Metric Cards */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card profit">
          <span className="metric-title">Top Current Client</span>
          <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
            <Building size={20} color="#00f2fe" />
            {data.current_rankings[0] ? shortenClientName(data.current_rankings[0].client) : 'N/A'}
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            Revenue: {data.current_rankings[0] ? formatCurrency(data.current_rankings[0].revenue) : '0'}
          </span>
        </div>

        <div className="glass-panel metric-card health">
          <span className="metric-title">Top Projected Client (2025)</span>
          <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px', color: '#f59e0b' }}>
            <Award size={20} />
            {data.top_projected_client ? shortenClientName(data.top_projected_client) : 'N/A'}
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            Projected: {data.predicted_rankings[0] ? formatCurrency(data.predicted_rankings[0].predicted_2025) : '0'}
          </span>
        </div>

        <div className="glass-panel metric-card revenue">
          <span className="metric-title">Highest Growth Outlook</span>
          <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
            <TrendingUp size={20} color="#10b981" />
            {data.highest_growth_client ? shortenClientName(data.highest_growth_client) : 'N/A'}
          </div>
          <span className="metric-growth growth-up" style={{ fontSize: '11px' }}>
            <ArrowUpRight size={12} /> +{data.highest_growth_pct.toFixed(1)}% YoY Proj
          </span>
        </div>
      </div>

      {/* Trajectory Timeline Chart */}
      {(() => {
        const scaledTimelineData = data.timeline_data.map((d: any) => {
          const copy = { ...d };
          for (const key of Object.keys(copy)) {
            if (key !== 'year') {
              copy[key] = copy[key] * rate;
            }
          }
          return copy;
        });

        return (
          <div className="glass-panel" style={{ padding: '24px', height: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Client Revenue Trajectories (Historical & Forecast)</h3>
              <span style={{ fontSize: '12px', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={14} color="#00f2fe" /> ML Trend Extrapolations
              </span>
            </div>
            
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={scaledTimelineData}>
                <XAxis dataKey="year" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
                <Tooltip 
                  formatter={(value: any, name: any) => [formatChartValue(Number(value)), shortenClientName(String(name))]} 
                  contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} 
                />
            <Legend formatter={(value) => shortenClientName(value)} />
            {clientNames.map((client, idx) => (
              <Line
                key={client}
                type="monotone"
                dataKey={client}
                stroke={COLORS[idx % COLORS.length]}
                strokeWidth={client === data.top_projected_client ? 3 : 1.5}
                dot={{ r: client === data.top_projected_client ? 4 : 2 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  })()}

      {/* Current vs Predicted Rankings Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
        
        {/* Left: Current Rankings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>Current Rankings (FY 2024-25)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                  <th style={{ padding: '8px' }}>Rank</th>
                  <th style={{ padding: '8px' }}>Client</th>
                  <th style={{ padding: '8px' }}>Invoices</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.current_rankings.map((r: any) => (
                  <tr key={r.rank} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: r.rank === 1 ? '#00f2fe' : '#9ca3af' }}>#{r.rank}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600, color: '#ffffff' }}>{r.client}</td>
                    <td style={{ padding: '10px 8px' }}>{r.transactions_count} billings</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Predicted Future Rankings */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>Projected Rankings (FY 2025-26)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                  <th style={{ padding: '8px' }}>Rank</th>
                  <th style={{ padding: '8px' }}>Client</th>
                  <th style={{ padding: '8px' }}>YoY Outlook</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Predicted Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.predicted_rankings.map((r: any) => (
                  <tr key={r.projected_rank} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700, color: r.projected_rank === 1 ? '#f59e0b' : '#9ca3af' }}>#{r.projected_rank}</td>
                    <td style={{ padding: '10px 8px', fontWeight: 600, color: '#ffffff' }}>{r.client}</td>
                    <td style={{ padding: '10px 8px', color: r.projected_growth_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                      {r.projected_growth_pct >= 0 ? `+${r.projected_growth_pct.toFixed(1)}%` : `${r.projected_growth_pct.toFixed(1)}%`}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, color: '#00f2fe' }}>{formatCurrency(r.predicted_2025)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ClientAnalytics;
