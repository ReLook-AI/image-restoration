import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GoogleIcon, MailIcon, LockIcon } from '../components/Icons'
import { supabase } from '../services/supabaseClient'

const GOOGLE_LOGIN_REDIRECT_URL = 'https://relook-ai.vercel.app/'

function getLoginErrorMessage(error) {
  if (error?.message?.toLowerCase().includes('invalid login credentials')) {
    return 'Invalid password, please try again'
  }

  return error?.message || 'Unable to sign in. Please try again.'
}

export function LoginForm({ onSwitch }) {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email')
    const password = formData.get('password')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      setError(getLoginErrorMessage(authError))
      return
    }

    navigate('/payment')
  }

  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: GOOGLE_LOGIN_REDIRECT_URL,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data?.url) {
      window.location.href = data.url
    }
  }

  return (
    <div>
      <h1 className="auth-title">Sign In</h1>
      <p className="auth-sub">Welcome! Please enter your account details.</p>

      <button type="button" className="social-btn" style={{ marginBottom: 16 }} onClick={handleGoogleLogin}>
        <GoogleIcon /> Continue with Google
      </button>
      <div className="divider">or</div>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <div className="input-icon-wrap">
            <MailIcon />
            <input name="email" type="email" placeholder="email@example.com" required />
          </div>
        </div>
        <div className="form-group">
          <label>Password</label>
          <div className="pw-wrap input-icon-wrap">
            <LockIcon />
            <input name="password" type={showPw ? 'text' : 'password'} placeholder="Password" required />
            <button type="button" className="eye-btn" onClick={() => setShowPw(p => !p)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, fontSize: '.85rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" style={{ width: 'auto' }} /> Remember me
          </label>
          <a href="#" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</a>
        </div>
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        {error && <p className="auth-error">{error}</p>}
      </form>
      <div className="auth-link" style={{ marginTop: 16 }}>
        Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSwitch() }}>Create one</a>
      </div>
    </div>
  )
}

export function RegisterForm({ onSwitch }) {
  const navigate = useNavigate()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email')
    const password = formData.get('password')
    const firstName = formData.get('firstName')
    const lastName = formData.get('lastName')

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        emailRedirectTo: `${window.location.origin}/payment`,
      },
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    if (data.session) {
      navigate('/payment')
      return
    }

    setMessage('Please check your email to confirm your account.')
  }

  return (
    <div>
      <h1 className="auth-title">Create Account</h1>
      <p className="auth-sub">Join ReLook-AI for free today!</p>
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group"><label>First Name</label><input name="firstName" type="text" placeholder="John" required /></div>
          <div className="form-group"><label>Last Name</label><input name="lastName" type="text" placeholder="Doe" required /></div>
        </div>
        <div className="form-group">
          <label>Email</label>
          <div className="input-icon-wrap"><MailIcon /><input name="email" type="email" placeholder="email@example.com" required /></div>
        </div>
        <div className="form-group">
          <label>Password</label>
          <div className="pw-wrap input-icon-wrap">
            <LockIcon />
            <input name="password" type={showPw ? 'text' : 'password'} placeholder="At least 8 characters" required minLength={8} />
            <button type="button" className="eye-btn" onClick={() => setShowPw(p => !p)}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="pass-hint">Must include uppercase, number and special character.</p>
        </div>
        <button type="submit" className="btn btn-accent btn-block btn-lg" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        <p className="terms">By signing up you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>.</p>
      </form>
      <div className="auth-link" style={{ marginTop: 12 }}>
        Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onSwitch() }}>Sign in</a>
      </div>
    </div>
  )
}
