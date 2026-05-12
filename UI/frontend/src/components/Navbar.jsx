import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogoIcon } from './Icons'
import { supabase } from '../services/supabaseClient'

const THEME_STORAGE_KEY = 'relook-theme'

function getInitialTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState(getInitialTheme)
  const active = (path) => pathname === path ? 'active' : ''

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data.session?.user ?? null)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const displayName =
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0]
  const isSignedIn = Boolean(user)

  const handleNav = (e, targetPath, hashId) => {
    e.preventDefault()
    setMenuOpen(false)
    if (pathname === targetPath) {
      document.getElementById(hashId)?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(targetPath)
      setTimeout(() => {
        document.getElementById(hashId)?.scrollIntoView({ behavior: 'smooth' })
      }, 150)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setMenuOpen(false)
    navigate('/')
  }

  const toggleTheme = () => {
    setTheme(current => current === 'dark' ? 'light' : 'dark')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo" style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.3px' }}>
        <LogoIcon size={34} />
        ReLook-AI
      </Link>

      <button
        type="button"
        className="mobile-menu-btn"
        aria-label="Toggle navigation menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(open => !open)}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <ul className="nav-links">
        <li><Link to="/" className={active('/')}>Home</Link></li>
        <li><Link to="/app" className={active('/app')}>Restoration</Link></li>
        <li><a href="/#features" onClick={(e) => handleNav(e, '/', 'features')}>Features</a></li>
        <li><a href="#contact" onClick={(e) => handleNav(e, pathname, 'contact')}>Contact</a></li>
      </ul>

      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <Link to="/" className={active('/')} onClick={() => setMenuOpen(false)}>Home</Link>
        <Link to="/app" className={active('/app')} onClick={() => setMenuOpen(false)}>Restoration</Link>
        <a href="/#features" onClick={(e) => handleNav(e, '/', 'features')}>Features</a>
        <a href="#contact" onClick={(e) => handleNav(e, pathname, 'contact')}>Contact</a>
      </div>

      <div className="nav-cta">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        {isSignedIn ? (
          <>
            <Link to="/profile" className="nav-welcome" title="View profile">Welcome, {displayName}</Link>
            <Link to="/payment" className="btn btn-primary">Upgrade to Pro</Link>
            <button type="button" className="btn btn-outline" onClick={handleSignOut}>Sign Out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-outline">Sign In</Link>
            <Link to="/login" className="btn btn-primary">Get Started</Link>
          </>
        )}
      </div>
    </nav>
  )
}
