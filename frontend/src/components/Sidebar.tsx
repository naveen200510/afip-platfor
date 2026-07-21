import React from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Building2, 
  Settings, 
  UserSquare2, 
  LogOut,
  TrendingUp,
  Brain,
  Briefcase
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const role = localStorage.getItem('afip_user_role') || 'User';

  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'comparison', name: 'Year Comparison', icon: BarChart3 },
    { id: 'departments', name: 'Department Analytics', icon: Building2 },
    { id: 'clients', name: 'Client Analytics', icon: Briefcase },
    { id: 'forecasting', name: 'Forecasting & Sim', icon: TrendingUp },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  // Admin-only panel link
  if (role.toLowerCase() === 'admin') {
    menuItems.splice(4, 0, { id: 'admin', name: 'Admin Panel', icon: UserSquare2 });
  }

  return (
    <aside className="sidebar">
      {/* Platform Title */}
      <div style={{
        padding: '30px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #00f2fe, #6366f1)',
          padding: '8px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)'
        }}>
          <Brain size={22} color="#ffffff" />
        </div>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>AFIP AI</h1>
          <span style={{ fontSize: '10px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CFO Intelligence</span>
        </div>
      </div>

      {/* Nav Links */}
      <nav style={{ flex: 1, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                width: '100%',
                padding: '12px 16px',
                background: isActive ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(0, 242, 254, 0.05))' : 'transparent',
                border: 'none',
                borderLeft: isActive ? '3px solid #00f2fe' : '3px solid transparent',
                borderRadius: '8px',
                color: isActive ? '#00f2fe' : '#9ca3af',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px',
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={18} />
              {item.name}
            </button>
          );
        })}
      </nav>

      {/* Logout button */}
      <div style={{ padding: '24px 16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={onLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            width: '100%',
            padding: '12px 16px',
            background: 'rgba(244, 63, 94, 0.05)',
            border: '1px solid rgba(244, 63, 94, 0.1)',
            borderRadius: '8px',
            color: '#f43f5e',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '14px',
            fontWeight: 600,
            transition: 'all 0.2s ease'
          }}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
