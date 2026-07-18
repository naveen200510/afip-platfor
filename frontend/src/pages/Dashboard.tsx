import React, { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar,
  Treemap,
  AreaChart, Area
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Award
} from 'lucide-react';
import api from '../utils/api';

const COLORS = ['#00f2fe', '#10b981', '#6366f1', '#f43f5e', '#f59e0b', '#a855f7', '#ec4899'];

const Dashboard: React.FC = () => {
  const [kpis, setKpis] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [berths, setBerths] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const kpiRes = await api.get('/dashboard/kpis?year=2024');
      const chartRes = await api.get('/dashboard/charts?year=2024');
      const berthRes = await api.get('/dashboard/berths');
      setKpis(kpiRes.data);
      setCharts(chartRes.data);
      setBerths(berthRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading || !kpis || !charts || !berths) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#9ca3af' }}>
        Analyzing financial statements...
      </div>
    );
  }

  // Format currencies nicely in active currency
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

  // Pre-scaled charts data for correct Recharts height rendering
  const scaledCharts = {
    line: charts.line.map((d: any) => ({
      ...d,
      Revenue: d.Revenue * rate,
      Expenses: d.Expenses * rate,
      Profit: d.Profit * rate
    })),
    pie: charts.pie.map((d: any) => ({
      ...d,
      value: d.value * rate
    })),
    bar: charts.bar.map((d: any) => ({
      ...d,
      Allocated: d.Allocated * rate,
      Spent: d.Spent * rate
    })),
    area: charts.area.map((d: any) => ({
      ...d,
      Cumulative: d.Cumulative * rate
    })),
    heatmap: charts.heatmap.map((d: any) => ({
      ...d,
      amount: d.amount * rate
    })),
    treemap: charts.treemap
  };

  const scaledBerthRevenues = berths?.berth_revenues?.map((d: any) => ({
    ...d,
    revenue: d.revenue * rate
  })) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* 11 KPI Metric Cards (Module 3) */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card revenue animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <span className="metric-title">Gross Revenue</span>
          <div className="metric-value">{formatCurrency(kpis.revenue)}</div>
          <span className="metric-growth growth-up"><ArrowUpRight size={14} /> +{kpis.growth}% YoY</span>
        </div>

        <div className="glass-panel metric-card expenses animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <span className="metric-title">Operating Expenses</span>
          <div className="metric-value">{formatCurrency(kpis.expenses)}</div>
          <span className="metric-growth growth-down" style={{ color: '#f43f5e' }}><ArrowDownRight size={14} /> Spiking</span>
        </div>

        <div className="glass-panel metric-card profit animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <span className="metric-title">Net Profit</span>
          <div className="metric-value">{formatCurrency(kpis.profit)}</div>
          <span className="metric-growth growth-up">Margin: {kpis.ratios.profit_margin_pct}%</span>
        </div>

        <div className="glass-panel metric-card profit animate-fade-in" style={{ animationDelay: '0.18s' }}>
          <span className="metric-title">Berth Hire Revenue</span>
          <div className="metric-value" style={{ color: '#fbbf24' }}>{formatCurrency(berths.total_berth_charges)}</div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Vessel docking fees</span>
        </div>

        <div className="glass-panel metric-card health animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <span className="metric-title">Financial Health Score</span>
          <div className="metric-value" style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={22} /> {kpis.health_score} <span style={{ fontSize: '12px', color: '#9ca3af' }}>/100</span>
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>CIBIL-like financial rating</span>
        </div>

        <div className="glass-panel metric-card animate-fade-in" style={{ animationDelay: '0.25s' }}>
          <span className="metric-title">Net Cash Flow</span>
          <div className="metric-value" style={{ color: kpis.cash_flow >= 0 ? '#10b981' : '#f43f5e' }}>
            {formatCurrency(kpis.cash_flow)}
          </div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Operating Surplus</span>
        </div>

        <div className="glass-panel metric-card animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <span className="metric-title">Assets (Avg)</span>
          <div className="metric-value">{formatCurrency(kpis.assets)}</div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Equipment & Cash reserve</span>
        </div>

        <div className="glass-panel metric-card animate-fade-in" style={{ animationDelay: '0.35s' }}>
          <span className="metric-title">Liabilities (Avg)</span>
          <div className="metric-value">{formatCurrency(kpis.liabilities)}</div>
          <span style={{ fontSize: '11px', color: '#f43f5e' }}>Current Ratio: {kpis.ratios.current_ratio}</span>
        </div>

        <div className="glass-panel metric-card animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <span className="metric-title">Operating Cost</span>
          <div className="metric-value">{formatCurrency(kpis.operating_cost)}</div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Non-salary spends</span>
        </div>

        <div className="glass-panel metric-card animate-fade-in" style={{ animationDelay: '0.45s' }}>
          <span className="metric-title">Budget Utilization</span>
          <div className="metric-value">{kpis.budget_utilization.toFixed(1)}%</div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Spent vs Allocated</span>
        </div>

        <div className="glass-panel metric-card animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <span className="metric-title">OER Ratio</span>
          <div className="metric-value">{kpis.ratios.expense_ratio_pct}%</div>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>Expense-to-Revenue Ratio</span>
        </div>
      </div>

      {/* 9 Dashboard Charts Section */}
      <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', marginTop: '10px' }}>Visual Analytics Engine</h3>
      
      <div className="charts-grid">
        
        {/* Chart 1: Line Chart (Monthly Revenue vs Expenses vs Profit) */}
        <div className="glass-panel chart-card">
          <div className="chart-title">Line Chart — Monthly Cash Flow Trend</div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={scaledCharts.line}>
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
              <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Legend />
              <Line type="monotone" dataKey="Revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Profit" stroke="#00f2fe" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 2: Pie Chart (Expenses by Category) */}
        <div className="glass-panel chart-card">
          <div className="chart-title">Pie Chart — Expenditure Share by Category</div>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie
                data={scaledCharts.pie}
                cx="50%"
                cy="50%"
                outerRadius={95}
                innerRadius={50}
                dataKey="value"
                label={({ name, percent }) => `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`}
              >
                {scaledCharts.pie.map((_: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => formatChartValue(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 3: Bar Chart (Department budgets allocated vs spent) */}
        <div className="glass-panel chart-card">
          <div className="chart-title">Bar Chart — Department Budgets vs Outlays</div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={scaledCharts.bar}>
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={10} />
              <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
              <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Legend />
              <Bar dataKey="Allocated" fill="#4b5563" minPointSize={5} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Spent" fill="var(--accent-cyan)" minPointSize={5} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 4: Heatmap (Expenses by Category across Months) */}
        <div className="glass-panel chart-card" style={{ height: 'auto', minHeight: '380px' }}>
          <div className="chart-title">Heatmap — Category Spending Intensities</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: '6px', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: '100px', flexShrink: 0 }}></div>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => (
                <div key={m} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: '#9ca3af', minWidth: '30px' }}>{m}</div>
              ))}
            </div>
            
            {/* Draw Matrix Row for each distinct category */}
            {Array.from(new Set(scaledCharts.heatmap.map((h: any) => h.category))).map((cat: any) => (
              <div key={cat} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <div style={{ width: '100px', fontSize: '11px', color: '#d1d5db', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flexShrink: 0 }}>{cat}</div>
                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(m => {
                  const match = scaledCharts.heatmap.find((h: any) => h.category === cat && h.month === m);
                  const amount = match ? match.amount : 0;
                  
                  // Heatmap intensity calculation based on dynamic max scaling
                  const maxAmount = Math.max(...scaledCharts.heatmap.map((h: any) => h.amount), 1);
                  const opacity = amount > 0 ? 0.1 + (amount / maxAmount) * 0.85 : 0.05;

                  return (
                    <div
                      key={m}
                      style={{
                        flex: 1,
                        height: '24px',
                        background: `rgba(0, 242, 254, ${opacity})`,
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.02)',
                        minWidth: '30px',
                        cursor: 'pointer'
                      }}
                      title={`${cat} in ${m}: ${formatChartValue(amount)}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Chart 5: Treemap (Department Budgets) */}
        <div className="glass-panel chart-card">
          <div className="chart-title">Treemap — Departmental Budget Weightages</div>
          <ResponsiveContainer width="100%" height="90%">
            <Treemap
              data={charts.treemap.children}
              dataKey="value"
              stroke="#070b13"
              fill="#6366f1"
            />
          </ResponsiveContainer>
        </div>

        {/* Chart 6: Area Chart (Cumulative Cash Flow) */}
        <div className="glass-panel chart-card">
          <div className="chart-title">Area Chart — Cumulative Surplus Projection</div>
          <ResponsiveContainer width="100%" height="90%">
            <AreaChart data={scaledCharts.area}>
              <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
              <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Area type="monotone" dataKey="Cumulative" stroke="#00f2fe" fill="rgba(0, 242, 254, 0.15)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Chart 8: Waterfall Chart (Revenue to Profit Progression) */}
        <div className="glass-panel chart-card">
          <div className="chart-title">Waterfall Chart — Profit Stream Progression</div>
          <div style={{ display: 'flex', flexDirection: 'column', height: '90%', justifyContent: 'space-between', padding: '15px 0' }}>
            {charts.waterfall.map((w: any, idx: number) => {
              const maxVal = charts.waterfall[0].value; // Revenue is max
              const val = Math.abs(w.value);
              const pct = (val / maxVal * 100);
              
              // Colors based on positive/negative flow
              let barColor = '#00f2fe'; // profit
              if (w.value < 0) barColor = '#f43f5e'; // expenses/outlays
              if (w.name === 'Total Revenue') barColor = '#10b981';

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ fontWeight: 500 }}>{w.name}</span>
                    <span style={{ color: w.value >= 0 ? '#10b981' : '#f43f5e', fontWeight: 600 }}>
                      {w.value >= 0 ? `+${formatCurrency(w.value)}` : `-${formatCurrency(val)}`}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '14px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: barColor,
                      marginLeft: w.summary ? '0' : '30%', // indent expenses to show waterfall flow
                      borderRadius: '4px',
                      boxShadow: `0 0 8px ${barColor}50`
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Berth Operations Analytics Section */}
      <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff', marginTop: '20px' }}>Berth Operations & Revenues</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '25px', marginBottom: '25px' }}>
        {/* Left: Berth Revenues Chart */}
        <div className="glass-panel chart-card" style={{ height: '350px' }}>
          <div className="chart-title">Revenue Generated by Berth ({symbol})</div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={scaledBerthRevenues.slice(0, 6)}>
              <XAxis dataKey="berth" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
              <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
              <Bar dataKey="revenue" fill="#fbbf24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Right: Berth Rankings Table */}
        <div className="glass-panel" style={{ padding: '24px', height: '350px', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '15px' }}>Berth Outlays & Contributions</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                  <th style={{ padding: '8px' }}>Rank</th>
                  <th style={{ padding: '8px' }}>Berth</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Revenue Collected</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Contribution %</th>
                </tr>
              </thead>
              <tbody>
                {berths?.berth_revenues?.map((b: any, idx: number) => {
                  const pct = ((b.revenue / kpis.revenue) * 100).toFixed(1);
                  return (
                    <tr key={b.berth} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px', fontWeight: 700, color: idx === 0 ? '#fbbf24' : '#9ca3af' }}>#{idx + 1}</td>
                      <td style={{ padding: '8px', fontWeight: 600, color: '#ffffff' }}>{b.berth}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(b.revenue)}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#fbbf24' }}>{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
