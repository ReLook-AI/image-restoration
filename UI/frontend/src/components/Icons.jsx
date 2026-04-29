// Shared SVG Logo (R + Glasses from Figma reference)
export function LogoIcon({ size = 32, className = '', style = {} }) {
  return (
    <svg 
      viewBox="0 0 120 60" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="5.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className} 
      style={{ width: 'auto', height: size, color: 'var(--primary)', ...style }}
    >
      {/* Sweeping Arc */}
      <path d="M 22 50 C 40 10 75 12 108 32" />
      {/* R Top Bar */}
      <path d="M 8 18 L 28 18" />
      {/* R Loop */}
      <path d="M 25 35 C 33 35 38 30 38 24 C 38 18 33 18 28 18" />
      {/* R Right Leg */}
      <path d="M 30 35 L 40 50" />
      {/* Glasses Lenses */}
      <circle cx="66" cy="38" r="9" />
      <circle cx="94" cy="38" r="9" />
      {/* Bridge */}
      <path d="M 75 36 Q 80 32 85 36" />
      {/* Left Arm connects loop to glasses */}
      <path d="M 45 35 C 50 32 55 35 57 38" />
    </svg>
  )
}

// Google OAuth Icon
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57C21.36 18.5 22.56 15.68 22.56 12.25z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

// Lock icon
export function LockIcon() {
  return (
    <svg className="fi" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  )
}

// Email icon
export function MailIcon() {
  return (
    <svg className="fi" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,12 2,6"/>
    </svg>
  )
}

// Shield icon
export function ShieldIcon({ color = '#22c55e' }) {
  return (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
