import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import api from '../utils/api';

const YearComparison: React.FC = () => {
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComparisons = async () => {
    try {
      const response = await api.get('/dashboard/compare');
      setComparisons(response.data);
    } catch (err) {
      console.error('Error fetching yearly comparisons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparisons();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#9ca3af' }}>
        Compiling year-over-year aggregates...
      </div>
    );
  }

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
      return `${sym}${(converted / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
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
      return `${sym}${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
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

  const scaledComparisons = comparisons.map(item => ({
    ...item,
    revenue: item.revenue * rate,
    expenses: item.expenses * rate,
    profit: item.profit * rate
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Visual Chart Comparison */}
      <div className="glass-panel" style={{ padding: '24px', height: '350px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>YoY Core Performance Comparison</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={scaledComparisons}>
            <XAxis dataKey="year" stroke="#9ca3af" fontSize={11} />
            <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
            <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="profit" name="Net Profit" fill="#00f2fe" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Grid Comparison Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>Financial Ledger Summary</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                <th style={{ padding: '12px 16px' }}>Financial Year</th>
                <th style={{ padding: '12px 16px' }}>Total Revenue</th>
                <th style={{ padding: '12px 16px' }}>Operating Expenses</th>
                <th style={{ padding: '12px 16px' }}>Net Profit</th>
                <th style={{ padding: '12px 16px' }}>Profit Margin</th>
                <th style={{ padding: '12px 16px' }}>YoY Revenue Growth</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((item) => {
                const margin = (item.profit / item.revenue * 100).toFixed(1);
                return (
                  <tr key={item.year} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '16px', fontWeight: 600, color: '#ffffff' }}>FY {item.year}-{String(item.year + 1).substring(2)}</td>
                    <td style={{ padding: '16px', color: '#10b981', fontWeight: 500 }}>{formatCurrency(item.revenue)}</td>
                    <td style={{ padding: '16px', color: '#f43f5e' }}>{formatCurrency(item.expenses)}</td>
                    <td style={{ padding: '16px', color: '#00f2fe', fontWeight: 600 }}>{formatCurrency(item.profit)}</td>
                    <td style={{ padding: '16px' }}>{margin}%</td>
                    <td style={{ padding: '16px', color: item.yoy_growth_pct >= 0 ? '#10b981' : '#f43f5e' }}>
                      {item.yoy_growth_pct >= 0 ? `+${item.yoy_growth_pct}%` : `${item.yoy_growth_pct}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default YearComparison;
