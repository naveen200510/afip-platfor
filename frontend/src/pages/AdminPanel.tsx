import React, { useState, useEffect } from 'react';
import CSVUpload from '../components/CSVUpload';
import { History, Database, Users } from 'lucide-react';
import api from '../utils/api';

const AdminPanel: React.FC = () => {
  const [uploads, setUploads] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'upload' | 'users' | 'logs'>('upload');

  const fetchUploadsAndLogs = async () => {
    try {
      const uploadRes = await api.get('/data/uploads');
      setUploads(uploadRes.data);
      
      const logsRes = await api.get('/admin/logs');
      setLogs(logsRes.data);

      const usersRes = await api.get('/admin/users');
      setUsersList(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch admin dashboard records:', err);
    }
  };

  useEffect(() => {
    fetchUploadsAndLogs();
  }, []);

  const changeUserRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'Admin' ? 'User' : 'Admin';
    try {
      await api.put(`/admin/users/${userId}/role?role=${newRole}`);
      fetchUploadsAndLogs();
    } catch (err) {
      alert('Error updating user role.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      
      {/* Sub tabs navigation */}
      <div style={{ display: 'flex', gap: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => setActiveSubTab('upload')}
          className="btn-primary"
          style={{
            background: activeSubTab === 'upload' ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: '#ffffff'
          }}
        >
          <Database size={16} /> Import Financial Sheets
        </button>

        <button
          onClick={() => setActiveSubTab('users')}
          className="btn-primary"
          style={{
            background: activeSubTab === 'users' ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: '#ffffff'
          }}
        >
          <Users size={16} /> Manage Users
        </button>

        <button
          onClick={() => setActiveSubTab('logs')}
          className="btn-primary"
          style={{
            background: activeSubTab === 'logs' ? 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))' : 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            color: '#ffffff'
          }}
        >
          <History size={16} /> Audit Logs & Activity
        </button>
      </div>

      {activeSubTab === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '30px' }}>
          {/* File uploader widget */}
          <CSVUpload onUploadSuccess={fetchUploadsAndLogs} />

          {/* Upload History list */}
          <div className="glass-panel" style={{ padding: '24px', overflowY: 'auto', maxHeight: '500px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>Upload History</h3>
            
            {uploads.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '40px 0' }}>No files uploaded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '13px'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>{u.filename}</span>
                      <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px' }}>
                        FY {u.year} • {u.row_count} rows • {new Date(u.uploaded_at).toLocaleString()}
                      </div>
                    </div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        fontSize: '11px',
                        background: u.status === 'Completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                        color: u.status === 'Completed' ? '#10b981' : '#f43f5e'
                      }}
                    >
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'users' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>Access Control List</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: '#9ca3af' }}>
                  <th style={{ padding: '12px' }}>Username</th>
                  <th style={{ padding: '12px' }}>Email</th>
                  <th style={{ padding: '12px' }}>Role</th>
                  <th style={{ padding: '12px' }}>Registered At</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map((user) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '14px', fontWeight: 600, color: '#ffffff' }}>{user.username}</td>
                    <td style={{ padding: '14px' }}>{user.email}</td>
                    <td style={{ padding: '14px' }}>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: user.role === 'Admin' ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: user.role === 'Admin' ? '#00f2fe' : '#9ca3af'
                      }}>
                        {user.role}
                      </span>
                    </td>
                    <td style={{ padding: '14px' }}>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button
                        onClick={() => changeUserRole(user.id, user.role)}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-color)',
                          color: '#00f2fe',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Change to {user.role === 'Admin' ? 'User' : 'Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'logs' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '15px' }}>Security Audit Trail</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '12px',
                  background: 'rgba(255,255,255,0.01)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '20px'
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#00f2fe' }}>{log.action}</span>
                  <p style={{ color: '#d1d5db', marginTop: '4px', lineHeight: 1.4 }}>{log.details}</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, fontSize: '11px', color: '#9ca3af' }}>
                  <span>User: {log.username}</span>
                  <span style={{ marginTop: '4px' }}>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminPanel;
