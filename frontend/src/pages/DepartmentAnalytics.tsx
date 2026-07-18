import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Award } from 'lucide-react';
import api from '../utils/api';

const DepartmentAnalytics: React.FC = () => {
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = async () => {
    try {
      const response = await api.get('/dashboard/departments');
      setDepartments(response.data);
      if (response.data.length > 0) {
        setSelectedDeptId(response.data[0].id);
      }
    } catch (err) {
      console.error('Error fetching department analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  if (loading || selectedDeptId === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#9ca3af' }}>
        Compiling department ledgers...
      </div>
    );
  }

  const activeDept = departments.find(d => d.id === selectedDeptId);

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
      if (converted >= 1000000000) return `${sym}${(converted / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
      if (converted >= 1000000) return `${sym}${(converted / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
      return `${sym}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
  };

  const formatChartValue = (v: number) => {
    if (cur === 'INR') {
      if (v >= 10000000) return `₹${(v / 10000000).toFixed(2)} Cr`;
      if (v >= 100000) return `₹${(v / 100000).toFixed(2)} L`;
      return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
    } else {
      const sym = cur === 'EUR' ? '€' : '$';
      if (v >= 1000000000) return `${sym}${(v / 1000000000).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`;
      if (v >= 1000000) return `${sym}${(v / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
      return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Department Selector */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Department Cost Center Explorer</h3>
          <p style={{ fontSize: '13px', color: '#9ca3af' }}>Select a department to view detailed KPIs, rankings, and forecasts</p>
        </div>
        <select
          className="form-input"
          value={selectedDeptId}
          onChange={(e) => setSelectedDeptId(parseInt(e.target.value))}
          style={{ width: '220px', background: '#0e172a' }}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {activeDept && (
        <>
          {/* Department KPIs */}
          <div className="metrics-grid">
            <div className="glass-panel metric-card profit">
              <span className="metric-title">Cost Center Ranking</span>
              <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00f2fe' }}>
                <Award size={24} /> #{activeDept.expense_rank} <span style={{ fontSize: '12px', color: '#9ca3af' }}>of {departments.length}</span>
              </div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Sorted by total outlays</span>
            </div>

            <div className="glass-panel metric-card expenses">
              <span className="metric-title">Total Outlays</span>
              <div className="metric-value">{formatCurrency(activeDept.expenses)}</div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Recorded actual spending</span>
            </div>

            <div className="glass-panel metric-card revenue">
              <span className="metric-title">Revenue Generated</span>
              <div className="metric-value">{formatCurrency(activeDept.revenue)}</div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Operations / billing collections</span>
            </div>

            <div className="glass-panel metric-card">
              <span className="metric-title">Budget Utilized</span>
              <div className="metric-value">{activeDept.utilization_pct}%</div>
              <span style={{ fontSize: '11px', color: activeDept.utilization_pct > 100 ? '#f43f5e' : '#10b981' }}>
                {activeDept.utilization_pct > 100 ? 'Over Allocated Budget!' : 'Within limit'}
              </span>
            </div>

            <div className="glass-panel metric-card health">
              <span className="metric-title">2025 Forecast Spent</span>
              <div className="metric-value" style={{ color: '#f59e0b' }}>{formatCurrency(activeDept.forecast_spent_2025)}</div>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>Projected budget needed</span>
            </div>
          </div>

          {/* Department comparative list */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '25px' }}>
            
            {/* Rank list of all departments */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>Cost Center Hierarchy</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {departments.map((d, index) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDeptId(d.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: d.id === selectedDeptId ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                      border: d.id === selectedDeptId ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 700, color: d.id === selectedDeptId ? '#00f2fe' : '#9ca3af' }}>#{index + 1}</span>
                      <span style={{ fontWeight: 500 }}>{d.name}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f3f4f6' }}>{formatCurrency(d.expenses)}</span>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>Util: {d.utilization_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Budget vs spent visualization */}
            <div className="glass-panel" style={{ padding: '24px', height: '340px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>{activeDept.name} — Budget Allocations vs Outlays</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={[
                  {
                    name: activeDept.name,
                    Allocated: activeDept.budget_allocated * rate,
                    Spent: activeDept.budget_spent * rate,
                    Forecast: activeDept.forecast_spent_2025 * rate
                  }
                ]}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
                  <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
                  <Legend />
                  <Bar dataKey="Allocated" name="Budget Allocated" fill="#4b5563" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Spent" name="Actual Spent" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Forecast" name="2025 Forecast" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        </>
      )}

    </div>
  );
};

export default DepartmentAnalytics;
