import React, { useState } from 'react';
import api from '../utils/api';

const Register: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('User');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/register', {
        username,
        email,
        password,
        role,
      });

      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Registration failed. Try a different username/email.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glass-panel auth-card animate-fade-in">
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '28px', color: '#00f2fe', marginBottom: '8px' }}>Create Account</h2>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>Join AI Financial Intelligence Platform</p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid #f43f5e',
            color: '#f43f5e',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            color: '#10b981',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px'
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. employee1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. name@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              style={{ background: '#0e172a' }}
            >
              <option value="User">Normal User</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <button type="submit" className="btn-primary" style={{ justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#00f2fe', textDecoration: 'none' }}>
            Sign In here
          </a>
        </div>
      </div>
    </div>
  );
};

export default Register;
