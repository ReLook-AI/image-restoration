import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Hero, FeatureCard, ToolCard, Testi, TeamSection, Footer } from '../components/HomeComponents'
import { supabase } from '../services/supabaseClient'

export default function HomePage() {
  const [user, setUser] = useState(null)
  const ctaPath = user ? '/app' : '/login'

  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') })
    }, { threshold: .12 })
    document.querySelectorAll('.fade-in').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

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

  return (
    <>
      <Navbar />
      <Hero ctaPath={ctaPath} />

      {/* Features */}
      <section id="features" style={{ background: 'var(--white)' }}>
        <div className="text-center" style={{ marginBottom: 48 }}>
          <span className="section-tag">Smart Features</span>
          <h2 className="section-title">Smart Image Enhancement with <strong>ReLook-AI</strong></h2>
          <p className="section-sub">Experience advanced AI-powered tools for image beautification, analysis, and optimization.</p>
        </div>
        <div className="grid-3 fade-in">
          <FeatureCard icon="star" title="Enhance Images" desc="Automatically improve quality, sharpness, colors and details with our cutting-edge deep learning models." />
          <FeatureCard icon="clock" title="Analyze Content" desc="Deep image recognition identifies objects, scenes, and faces with exceptional precision and speed." />
          <FeatureCard icon="shield" title="Secure Process" desc="End-to-end encryption and strict privacy policies ensure your images are always safe." />
        </div>
      </section>

      {/* Tools */}
      <section id="tools" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <span className="section-tag">AI Toolkit</span>
          <h2 className="section-title">Colorization Engine</h2>
          <p className="section-sub">Transform historical or grayscale images with cutting-edge AI colorization.</p>
        </div>
        <div className="grid-3 fade-in">
          <ToolCard emoji="🖌️" title="Vibrant Colorization" desc="Instantly breathe life into black & white photos with rich, highly realistic and vibrant colors." />
          <ToolCard emoji="🧠" title="Semantic Context" desc="The Zhang et al. model intelligently analyzes image context to apply the perfect hues to matching objects." />
          <ToolCard emoji="✨" title="Detail Preservation" desc="Adds color seamlessly without destroying the original sharpness, lighting depth, or fine textures." />
        </div>
      </section>

      <TeamSection />

      {/* CTA */}
      <div style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', borderRadius: 24, padding: '64px 48px', textAlign: 'center', color: '#fff', margin: '0 6% 80px', boxShadow: 'var(--shadow-lg)' }} className="fade-in">
        <h2 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 800, marginBottom: 12 }}>Ready to get a new perspective?</h2>
        <p style={{ opacity: .85, marginBottom: 32, fontSize: '1rem' }}>Join 50,000+ users already transforming their images with AI.</p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={ctaPath} className="btn btn-white btn-lg">🚀 Try Now</Link>
          {!user && <Link to="/login" className="btn btn-outline btn-lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.6)' }}>Sign In</Link>}
        </div>
      </div>

      <Footer />
    </>
  )
}
