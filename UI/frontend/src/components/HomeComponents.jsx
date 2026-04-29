import { Link } from 'react-router-dom'
import { LogoIcon } from './Icons'

export function Hero({ ctaPath = '/login' }) {
  return (
    <section style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 40, padding: '60px 6% 80px',
      background: 'linear-gradient(135deg,#eef3ff 0%,#f5f8ff 60%,#dce7fb 100%)',
      position: 'relative', overflow: 'hidden', minHeight: 'calc(100vh - 70px)'
    }}>
      <div style={{ flex: 1, maxWidth: 520, zIndex: 1 }} className="fade-in">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--light-blue)', color: 'var(--accent)', padding: '5px 14px', borderRadius: 50, fontSize: '.8rem', fontWeight: 600, marginBottom: 20 }}>
          ✨ AI-Powered Vision Platform
        </div>
        <h1 style={{ fontSize: 'clamp(2.4rem,5vw,3.6rem)', fontWeight: 900, lineHeight: 1.15, color: 'var(--primary)', marginBottom: 20 }}>
          See with<br /><span style={{ color: 'var(--accent)' }}>Intelligence</span>
        </h1>
        <p style={{ fontSize: '1.05rem', color: 'var(--muted)', maxWidth: 420, marginBottom: 36 }}>
          Unlock the power of AI-driven vision to analyze and enhance images like never before.
        </p>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Link to={ctaPath} className="btn btn-primary btn-lg">Get Started</Link>
          <a href="#features" className="btn btn-outline btn-lg">Learn More</a>
        </div>
        <div style={{ display: 'flex', gap: 32, marginTop: 40 }}>
          {[['99.8%', 'Accuracy']].map(([n, l]) => (
            <div key={l}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{n}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: 520, zIndex: 1 }}>
        <div style={{
          width: 420, height: 380, borderRadius: 24,
          background: 'linear-gradient(145deg,#ffffff 0%,#dce8ff 100%)',
          border: '1px solid rgba(74,98,160,.18)',
          boxShadow: '0 28px 80px rgba(39,48,83,.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
          gap: 16,
          filter: 'drop-shadow(0 20px 60px rgba(47,110,245,.25))',
          animation: 'float 4s ease-in-out infinite'
        }}>
          <div style={{
            width: 230, height: 170, borderRadius: 22,
            background: 'linear-gradient(135deg,#eef3ff,#ffffff)',
            border: '1px solid rgba(39,48,83,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9), 0 18px 45px rgba(39,48,83,.12)'
          }}>
            <LogoIcon size={120} style={{ color: 'var(--primary)', maxWidth: '78%' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '1.35rem', letterSpacing: '-.02em' }}>ReLook-AI</div>
            <div style={{ color: 'var(--muted)', fontWeight: 600, fontSize: '.82rem', marginTop: 2 }}>Vision that restores detail</div>
          </div>
        </div>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}`}</style>
      </div>
    </section>
  )
}

export function FeatureCard({ icon, title, desc }) {
  return (
    <div className="card">
      <div className="card-icon">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: 28, height: 28, color: 'var(--accent)' }}>
          {icon === 'star' && <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />}
          {icon === 'clock' && <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 3" /></>}
          {icon === 'shield' && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />}
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <Link to="/app" className="learn-more">Learn More →</Link>
    </div>
  )
}

export function ToolCard({ emoji, title, desc }) {
  return (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)', transition: 'transform .25s,box-shadow .25s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ background: 'linear-gradient(135deg,var(--light-blue),var(--sky))', height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>{emoji}</div>
      <div style={{ padding: '22px 22px 28px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>{title}</h3>
        <p style={{ fontSize: '.88rem', color: 'var(--muted)', marginBottom: 14, lineHeight: 1.7 }}>{desc}</p>
        <Link to="/app" className="learn-more">Learn More →</Link>
      </div>
    </div>
  )
}

export function Testi({ text, name, role, initials }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 28 }}>
      <div style={{ color: '#f59e0b', fontSize: '1.1rem', marginBottom: 12 }}>★★★★★</div>
      <p style={{ fontSize: '.93rem', color: 'var(--text)', lineHeight: 1.8, marginBottom: 16, fontStyle: 'italic' }}>"{text}"</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,var(--accent),var(--primary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '.9rem' }}>{initials}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--primary)' }}>{name}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{role}</div>
        </div>
      </div>
    </div>
  )
}

export function Footer() {
  return (
    <footer id="contact">
      <div className="footer-links">
        {['Home', 'About', 'Features', 'Pricing', 'Privacy Policy', 'Contact'].map(l => <a href="/#contact" key={l}>{l}</a>)}
      </div>
      <p className="copy">© 2025 ReLook-AI. All rights reserved.</p>
    </footer>
  )
}
