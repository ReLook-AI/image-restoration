import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogoIcon, ShieldIcon } from '../components/Icons'
import { LoginForm, RegisterForm } from '../components/AuthComponents'
import { Footer } from '../components/HomeComponents'

export default function LoginPage() {
  const [tab, setTab] = useState('login')

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex' }}>
      {/* LEFT panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(160deg,var(--primary),var(--accent))',
        padding: '60px 48px', color: '#fff', position: 'relative', overflow: 'hidden', minWidth: 300
      }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,.06)', bottom: -180, left: -120 }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: '1.4rem', color: '#fff', marginBottom: 48, textDecoration: 'none', justifyContent: 'center' }}>
            <LogoIcon size={38} /> ReLook-AI
          </Link>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 14 }}>Welcome!</h2>
          <p style={{ opacity: .8, fontSize: '.95rem', lineHeight: 1.8, maxWidth: 300, margin: '0 auto 36px' }}>
            Access the most powerful AI vision platform to transform your images.
          </p>
          <ul style={{ listStyle: 'none', textAlign: 'left', display: 'inline-block' }}>
            {['50K+ active global users', '99.8% recognition accuracy', 'End-to-end encrypted data', '200+ cutting-edge AI models'].map(t => (
              <li key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', fontSize: '.9rem', opacity: .9 }}>
                <span style={{ width: 22, height: 22, background: 'rgba(255,255,255,.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', flexShrink: 0 }}>✓</span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* RIGHT panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 32px', background: 'linear-gradient(135deg,#e8f0fe,#f5f8ff)' }}>
        <div className="auth-card">
          <Link to="/" className="auth-logo"><LogoIcon size={28} />Re<span>Look</span>-AI</Link>

          <div className="tabs">
            <button className={`tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>Sign In</button>
            <button className={`tab${tab === 'reg' ? ' active' : ''}`} onClick={() => setTab('reg')}>Register</button>
          </div>

          {tab === 'login'
            ? <LoginForm onSwitch={() => setTab('reg')} />
            : <RegisterForm onSwitch={() => setTab('login')} />
          }

          <div className="badge-secure">
            <ShieldIcon /> Secured with 256-bit SSL encryption
          </div>
        </div>
      </div>
      </div>
      <Footer />
    </div>
  )
}
