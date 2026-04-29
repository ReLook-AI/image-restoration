import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogoIcon } from './Icons'
import { supabase } from '../services/supabaseClient'

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
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

  const displayName =
    user?.user_metadata?.first_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split('@')[0]
  const isSignedIn = Boolean(user)

  const handleNav = (e, targetPath, hashId) => {
    e.preventDefault()
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
    navigate('/')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="logo" style={{ fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.3px' }}>
        <LogoIcon size={34} />
        ReLook-AI
      </Link>

      <ul className="nav-links">
        <li><Link to="/" className={active('/')}>Home</Link></li>
        <li><Link to="/app" className={active('/app')}>Restoration</Link></li>
        <li><a href="/#features" onClick={(e) => handleNav(e, '/', 'features')}>Features</a></li>
        <li><a href="#contact" onClick={(e) => handleNav(e, pathname, 'contact')}>Contact</a></li>
      </ul>

      <div className="nav-cta">
        {isSignedIn ? (
          <>
            <span className="nav-welcome">Welcome, {displayName}</span>
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
