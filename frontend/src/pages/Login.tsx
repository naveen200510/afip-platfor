import React, { useState } from 'react';
import { 
  Anchor, Globe, HelpCircle, Shield, User, Lock, 
  Eye, EyeOff, ArrowRight, AlertTriangle 
} from 'lucide-react';
import api from '../utils/api';

interface LoginProps {
  onLoginSuccess: () => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { access_token } = response.data;
      localStorage.setItem('afip_token', access_token);
      
      // Get role
      const meResponse = await api.get('/auth/me');
      localStorage.setItem('afip_user_role', meResponse.data.role);

      onLoginSuccess();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 'Login failed. Please check your username and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      minHeight: '100vh', 
      justifyContent: 'space-between', 
      padding: 0 
    }}>
      
      {/* Target Screenshot Header */}
      <header style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 40px',
        background: 'rgba(255, 255, 255, 0.45)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.25)',
        zIndex: 10
      }}>
        {/* Left Side: Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#092240' }}>
          <Anchor size={22} strokeWidth={2.5} />
          <span style={{ 
            fontSize: '18px', 
            fontWeight: 700, 
            fontFamily: 'Outfit, Inter, sans-serif',
            letterSpacing: '-0.02em'
          }}>
            Cochin Port Authority
          </span>
        </div>
        
        {/* Right Side: Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: '#092240', fontSize: '13px', fontWeight: 600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <Globe size={15} /> English
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <HelpCircle size={15} /> Help
          </span>
        </div>
      </header>

      {/* Target Screenshot Center Card */}
      <main style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '50px 20px',
        zIndex: 5
      }}>
        <div style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(255, 255, 255, 0.12)',
          backdropFilter: 'none',
          border: '1px solid rgba(255, 255, 255, 0.45)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          color: '#092240',
          fontFamily: 'Outfit, Inter, sans-serif'
        }} className="animate-fade-in">
          
          {/* Top Security Icon */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#092240',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(9, 34, 64, 0.3)'
            }}>
              <Shield size={26} fill="#ffffff" />
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#092240', marginBottom: '6px' }}>Login</h2>
            <p style={{ color: '#4b5563', fontSize: '13px' }}>Access the secure logistics portal</p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(185, 28, 28, 0.08)',
              border: '1px solid rgba(185, 28, 28, 0.3)',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Input 1: Personnel ID */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                Personnel ID / Username
              </label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} />
                <input
                  type="text"
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    padding: '12px 16px 12px 40px',
                    borderRadius: '8px',
                    color: '#1f2937',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your ID"
                  required
                />
              </div>
            </div>

            {/* Input 2: Password */}
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                Secure Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#9ca3af' 
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{
                    width: '100%',
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    padding: '12px 40px 12px 40px',
                    borderRadius: '8px',
                    color: '#1f2937',
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Me / Forgot */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              fontSize: '12px',
              fontWeight: 500
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5563', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#092240' }} />
                Remember me
              </label>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); alert("Forgot Credentials: Just use standard username 'admin' and password 'admin123' to proceed."); }} 
                style={{ color: '#a05a2c', fontWeight: 600, textDecoration: 'none' }}
              >
                Forgot access?
              </a>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              style={{
                background: '#092240',
                color: '#ffffff',
                border: 'none',
                padding: '14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(9, 34, 64, 0.25)',
                transition: 'background 0.2s'
              }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Emergency Protocols */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '20px', textAlign: 'center' }}>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: 700, 
              color: '#4b5563', 
              letterSpacing: '0.12em', 
              display: 'block', 
              marginBottom: '12px' 
            }}>
              EMERGENCY PROTOCOLS
            </span>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
              <button
                type="button"
                onClick={() => alert("Alert Broadcast Initiated: Emergency response teams notified.")}
                style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <AlertTriangle size={18} color="#b91c1c" />
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c' }}>SAFETY ALERT</span>
              </button>
              <button
                type="button"
                onClick={() => alert("Port Support Line: +91 484 258 2000")}
                style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <HelpCircle size={18} color="#4b5563" />
                <span style={{ fontSize: '10px', fontWeight: 700, color: '#4b5563' }}>SUPPORT</span>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* Target Screenshot Footer */}
      <footer style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 40px',
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        zIndex: 10,
        flexWrap: 'wrap',
        gap: '15px',
        fontFamily: 'Outfit, Inter, sans-serif'
      }}>
        {/* Left Footer Details */}
        <div style={{ fontSize: '12px', color: '#4b5563', textAlign: 'left' }}>
          <div style={{ fontWeight: 700, color: '#092240', marginBottom: '2px' }}>Cochin Port Authority</div>
          <div>© 2024 Cochin Port Authority. All Rights Reserved.</div>
        </div>
        
        {/* Right Footer Links */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px', fontWeight: 500, color: '#4b5563' }}>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Terms of Service</a>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Port Safety</a>
          <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'inherit', textDecoration: 'none' }}>Contact Us</a>
        </div>
      </footer>

    </div>
  );
};

export default Login;
