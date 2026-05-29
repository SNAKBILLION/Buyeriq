import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.js';

const GOLD = '#d4a05a';
const BG = '#0a0a0a';

export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setSubmitting(false);
  }

  // ── Loading Screen ──
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: BG, fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          {/* Animated logo */}
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
            background: `linear-gradient(135deg, ${GOLD}, #b8862d)`,
            display: 'grid', placeItems: 'center',
            boxShadow: `0 8px 32px ${GOLD}30`,
            animation: 'pulse 2s ease-in-out infinite',
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: BG, letterSpacing: -1 }}>BIQ</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#666', letterSpacing: 2 }}>LOADING</div>
          {/* Animated bar */}
          <div style={{ width: 120, height: 3, background: '#1a1a1a', borderRadius: 2, margin: '16px auto 0', overflow: 'hidden' }}>
            <div style={{
              width: '40%', height: '100%', background: `linear-gradient(90deg, ${GOLD}, #b8862d)`,
              borderRadius: 2, animation: 'loadbar 1.2s ease-in-out infinite',
            }} />
          </div>
          <style>{`
            @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
            @keyframes loadbar { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }
          `}</style>
        </div>
      </div>
    );
  }

  // ── Login Screen ──
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: BG, fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif",
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle grid pattern background */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.03,
          backgroundImage: `
            linear-gradient(${GOLD} 1px, transparent 1px),
            linear-gradient(90deg, ${GOLD} 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }} />

        {/* Glow orbs */}
        <div style={{ position: 'absolute', top: '15%', left: '20%', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${GOLD}08, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: 250, height: 250, borderRadius: '50%', background: 'radial-gradient(circle, #60a5fa06, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '0 20px' }}>
          {/* Card */}
          <div style={{
            padding: '40px 36px 36px', borderRadius: 20,
            background: 'rgba(17, 17, 17, 0.85)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset',
          }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
                background: `linear-gradient(135deg, ${GOLD}, #b8862d)`,
                display: 'grid', placeItems: 'center',
                boxShadow: `0 4px 20px ${GOLD}25`,
              }}>
                <span style={{ fontSize: 19, fontWeight: 900, color: BG, letterSpacing: -1 }}>BIQ</span>
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: '#f0ebe0', margin: 0, letterSpacing: -0.5 }}>BuyerIQ</h1>
              <p style={{ fontSize: 13, color: '#6b6560', marginTop: 6, fontWeight: 500 }}>Buyer Intelligence Platform</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} style={{ display: 'grid', gap: 14 }}>
              {/* Email */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Email</label>
                <input
                  type="email" required autoFocus autoComplete="email"
                  placeholder="you@company.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '13px 14px', borderRadius: 10,
                    border: '1px solid #222', background: '#0d0d0d', color: '#f0ebe0',
                    fontSize: 14, fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} required autoComplete="current-password"
                    placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '13px 44px 13px 14px', borderRadius: 10,
                      border: '1px solid #222', background: '#0d0d0d', color: '#f0ebe0',
                      fontSize: 14, fontFamily: 'inherit',
                    }}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: '#555', cursor: 'pointer',
                      fontSize: 16, padding: '2px 4px',
                    }}
                    tabIndex={-1}
                  >
                    {showPwd ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                  fontSize: 12, color: '#ef4444', fontWeight: 500,
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={submitting}
                style={{
                  padding: '14px', borderRadius: 10, border: 'none',
                  background: submitting ? '#8a7040' : `linear-gradient(135deg, ${GOLD}, #b8862d)`,
                  color: '#0a0a0a', fontSize: 14, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer',
                  fontFamily: 'inherit', letterSpacing: 0.3, marginTop: 4,
                  boxShadow: submitting ? 'none' : `0 4px 16px ${GOLD}20`,
                }}
              >
                {submitting ? 'Signing in...' : 'Sign in →'}
              </button>
            </form>

            {/* Footer */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <div style={{ fontSize: 11, color: '#444', lineHeight: 1.6 }}>
                Invite-only access · Contact your admin for credentials
              </div>
            </div>
          </div>

          {/* Company branding */}
          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#333', letterSpacing: 3, textTransform: 'uppercase' }}>
              Senses Lifestyle 
            </div>
            <div style={{ fontSize: 9, color: '#222', marginTop: 4 }}>Moradabad, India</div>
          </div>
        </div>
      </div>
    );
  }

  return children;
}
