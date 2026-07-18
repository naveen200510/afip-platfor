import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { RotateCcw } from 'lucide-react';
import api from '../utils/api';

const ScenarioSimulator: React.FC = () => {
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

  const [salaryChange, setSalaryChange] = useState(0);
  const [fuelChange, setFuelChange] = useState(0);
  const [maintenanceChange, setMaintenanceChange] = useState(0);
  const [revenueChange, setRevenueChange] = useState(0);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const runSimulation = async () => {
    try {
      const response = await api.post('/dashboard/simulate?year=2024', {
        salary_change_pct: salaryChange,
        fuel_change_pct: fuelChange,
        maintenance_change_pct: maintenanceChange,
        revenue_change_pct: revenueChange
      });
      setSimulationResult(response.data);
    } catch (err) {
      console.error('Simulation failed:', err);
    }
  };

  useEffect(() => {
    runSimulation();
  }, [salaryChange, fuelChange, maintenanceChange, revenueChange]);

  const resetSliders = () => {
    setSalaryChange(0);
    setFuelChange(0);
    setMaintenanceChange(0);
    setRevenueChange(0);
  };

  const getChartData = () => {
    if (!simulationResult) return [];
    return [
      {
        name: 'Revenue',
        Original: simulationResult.original_revenue * rate,
        Simulated: simulationResult.simulated_revenue * rate
      },
      {
        name: 'Expenses',
        Original: simulationResult.original_expenses * rate,
        Simulated: simulationResult.simulated_expenses * rate
      },
      {
        name: 'Net Profit',
        Original: simulationResult.original_profit * rate,
        Simulated: simulationResult.simulated_profit * rate
      }
    ];
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
      {/* Sliders Control Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600 }}>What-If Scenario Simulation</h3>
          <button
            onClick={resetSliders}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="simulation-control">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Staff Salary Increase</span>
              <span style={{ color: '#00f2fe', fontWeight: 600 }}>{salaryChange > 0 ? `+${salaryChange}%` : `${salaryChange}%`}</span>
            </div>
            <input
              type="range"
              min="-20"
              max="50"
              step="5"
              className="simulation-slider"
              value={salaryChange}
              onChange={(e) => setSalaryChange(parseInt(e.target.value))}
            />
          </div>

          <div className="simulation-control">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Fuel Price Shift</span>
              <span style={{ color: '#f43f5e', fontWeight: 600 }}>{fuelChange > 0 ? `+${fuelChange}%` : `${fuelChange}%`}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="50"
              step="5"
              className="simulation-slider"
              value={fuelChange}
              onChange={(e) => setFuelChange(parseInt(e.target.value))}
            />
          </div>

          <div className="simulation-control">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Maintenance & Repairs Cost</span>
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>{maintenanceChange > 0 ? `+${maintenanceChange}%` : `${maintenanceChange}%`}</span>
            </div>
            <input
              type="range"
              min="-50"
              max="100"
              step="10"
              className="simulation-slider"
              value={maintenanceChange}
              onChange={(e) => setMaintenanceChange(parseInt(e.target.value))}
            />
          </div>

          <div className="simulation-control">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span>Sales & Consulting Revenue Target</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>{revenueChange > 0 ? `+${revenueChange}%` : `${revenueChange}%`}</span>
            </div>
            <input
              type="range"
              min="-30"
              max="50"
              step="5"
              className="simulation-slider"
              value={revenueChange}
              onChange={(e) => setRevenueChange(parseInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Simulated Results Visualizer */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Impact Analysis Projection</h3>

        {simulationResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%' }}>
            {/* Chart */}
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getChartData()}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatYAxisTick} />
                  <Tooltip formatter={(v: any) => formatChartValue(Number(v))} contentStyle={{ background: '#0c1221', borderColor: 'rgba(255,255,255,0.1)' }} />
                  <Legend verticalAlign="top" height={36} />
                  <Bar dataKey="Original" fill="#4b5563" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Simulated" fill="#00f2fe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Change details text */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: '140px',
              padding: '12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px'
            }}>
              <span style={{ fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Impact Notes</span>
              {simulationResult.details.length === 0 ? (
                <span style={{ color: '#9ca3af' }}>No simulated parameters adjusted. Showing baseline values.</span>
              ) : (
                simulationResult.details.map((d: string, i: number) => (
                  <p key={i} style={{ color: '#e5e7eb', lineHeight: 1.4 }}>• {d}</p>
                ))
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ca3af', padding: '50px 0' }}>
            Adjust sliders to compute simulation.
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioSimulator;
