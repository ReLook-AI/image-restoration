// =============================================================================
// UNetPage.jsx – U-Net Image Segmentation Studio
// =============================================================================
// This page lets users upload an image, select a U-Net model variant,
// tune inference parameters, and visualize the segmentation output.
//
// ── HOW TO ATTACH YOUR REAL U-NET MODEL ──────────────────────────────────────
// Search for the comment  👉 MODEL INTEGRATION POINT  below.
// Replace the mock `callModelAPI()` function with a real API/inference call.
// Example backends:
//   • FastAPI + TorchScript  → POST /api/segment  (returns mask PNG)
//   • ONNX Runtime (browser) → import { InferenceSession } from 'onnxruntime-web'
//   • TF.js                  → import * as tf from '@tensorflow/tfjs'
// =============================================================================

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { MODEL_REGISTRY, PIPELINE_STEPS, API_BASE_URL } from '../features/unet/constants'
import {
  StatCard, PanelHeader, DropZone, EmptyOutput, ProcessingOverlay, ImageSlider
} from '../components/UNetComponents'
import { Footer } from '../components/HomeComponents'
import { callImageEnhanceAPI, callModelAPI } from '../features/unet/modelApi'
import { supabase } from '../services/supabaseClient'

const FREE_DAILY_LIMIT = 5

function getLocalDateKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFreeUsageKey(userId) {
  return `relook-free-restoration:${userId}:${getLocalDateKey()}`
}


// ─────────────────────────────────────────────
// 6. MAIN PAGE COMPONENT
// ─────────────────────────────────────────────
export default function UNetPage() {

  // ── State: model selection & inference parameters ──
  const modelId = 'unet'

  // ── State: image and results ──
  const [imgSrc, setImgSrc] = useState(null)
  const [imgInfo, setImgInfo] = useState('')
  const [processing, setProcessing] = useState(false)
  const [procStep, setProcStep] = useState({ pct: 0, label: '', sub: '' })
  const [result, setResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [history, setHistory] = useState([])   // thumbnail strip
  const [isDone, setIsDone] = useState(false)
  const [checkingPlan, setCheckingPlan] = useState(true)
  const [currentPlanId, setCurrentPlanId] = useState('free')
  const [userId, setUserId] = useState('')
  const [freeUsageCount, setFreeUsageCount] = useState(0)
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [enhanceMode, setEnhanceMode] = useState('hd')
  const [enhancePrompt, setEnhancePrompt] = useState('')

  const fileInputRef = useRef()
  const currentModel = MODEL_REGISTRY[modelId]
  const isFreePlan = currentPlanId === 'free'
  const freeUsesRemaining = Math.max(0, FREE_DAILY_LIMIT - freeUsageCount)
  const hasReachedFreeLimit = isSignedIn && isFreePlan && freeUsesRemaining <= 0

  useEffect(() => {
    let mounted = true

    async function checkPlanAccess() {
      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!mounted) return

      if (!userId) {
        setIsSignedIn(false)
        setCurrentPlanId('free')
        setUserId('')
        setFreeUsageCount(0)
        setCheckingPlan(false)
        return
      }

      setIsSignedIn(true)
      setUserId(userId)

      const { data } = await supabase
        .from('profiles')
        .select('current_plan')
        .eq('id', userId)
        .single()

      if (!mounted) return

      const planId = data?.current_plan || 'free'
      setCurrentPlanId(planId)
      setFreeUsageCount(Number(localStorage.getItem(getFreeUsageKey(userId)) || 0))
      setCheckingPlan(false)
    }

    checkPlanAccess()

    return () => {
      mounted = false
    }
  }, [])

  // ── Load a user-selected image file ──
  const loadFile = (file) => {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setErrorMessage('Please upload a PNG or JPEG image.')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      setImgSrc(ev.target.result)
      setResult(null)
      setErrorMessage('')
      setIsDone(false)
      setImgInfo(`${file.name}  •  ${(file.size / 1024).toFixed(1)} KB`)
    }
    reader.readAsDataURL(file)
  }

  // ── Generate and load a synthetic sample image ──
  const loadSample = () => {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 512
    const ctx = c.getContext('2d')

    // Radial blue gradient background
    const g = ctx.createRadialGradient(256, 256, 30, 256, 256, 250)
    g.addColorStop(0, '#93c5fd'); g.addColorStop(.5, '#bfdbfe'); g.addColorStop(1, '#e0f2fe')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512)

    // Random grey blobs simulating B&W tissue regions
    for (let i = 0; i < 6; i++) {
      ctx.beginPath()
      ctx.arc(80 + i * 70 + Math.random() * 20, 120 + Math.random() * 260, 30 + Math.random() * 50, 0, Math.PI * 2)
      ctx.fillStyle = '#666666'
      ctx.globalAlpha = .4 + Math.random() * .4
      ctx.fill()
      ctx.globalAlpha = 1
    }

    setImgSrc(c.toDataURL())
    setResult(null); setErrorMessage(''); setIsDone(false)
    setImgInfo('sample_image.png  •  512×512')
  }

  // ── Orchestrate model inference ──
  const runImageJob = async (job) => {
    if (!imgSrc) return
    if (!isSignedIn) {
      setErrorMessage('Please sign in to use the restoration studio.')
      return
    }
    if (hasReachedFreeLimit) {
      setErrorMessage(`Free plan limit reached. You can restore ${FREE_DAILY_LIMIT} images per day. Upgrade for unlimited restoration.`)
      return
    }

    setProcessing(true); setResult(null); setIsDone(false)
    setErrorMessage('')

    // Animate progress steps while inference runs in parallel
    let stepIdx = 0
    const stepInterval = setInterval(() => {
      if (stepIdx < PIPELINE_STEPS.length) {
        setProcStep(PIPELINE_STEPS[stepIdx++])
      } else {
        clearInterval(stepInterval)
      }
    }, 380)

    const startTime = Date.now()
    try {
      // ───────────────────────────────────────────────
      // 👉 MODEL INTEGRATION POINT
      // Replace callModelAPI() with your actual model.
      // ───────────────────────────────────────────────
      const output = job === 'gemini'
        ? await callImageEnhanceAPI(imgSrc, { mode: enhanceMode, prompt: enhancePrompt })
        : await callModelAPI(imgSrc, modelId, {})

      clearInterval(stepInterval)
      setProcStep(PIPELINE_STEPS.at(-1))

      const elapsed = `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      const newResult = { ...output, elapsed }

      setResult(newResult)
      setHistory(prev => [output.maskDataURL, ...prev].slice(0, 8))
      setIsDone(true)

      if (isFreePlan && userId) {
        const nextUsageCount = freeUsageCount + 1
        localStorage.setItem(getFreeUsageKey(userId), String(nextUsageCount))
        setFreeUsageCount(nextUsageCount)
      }
    } catch (err) {
      // Handle inference errors here (show toast, log, etc.)
      console.error('Inference failed:', err)
      setErrorMessage(err.message || 'Model inference failed. Please check that both backend and model servers are running.')
      clearInterval(stepInterval)
    } finally {
      setProcessing(false)
    }
  }

  // ── Download the output mask as PNG ──
  const runInference = () => runImageJob('model')
  const runGeminiEnhance = () => runImageJob('gemini')

  const downloadResult = () => {
    if (!result) return
    const a = document.createElement('a')
    a.download = `unet_${modelId}_result.png`
    a.href = result.maskDataURL
    a.click()
  }

  // ── Reset everything back to blank ──
  const resetAll = () => {
    setImgSrc(null); setResult(null); setErrorMessage(''); setIsDone(false); setImgInfo('')
  }

  // ─────────────────────────────────────────────
  // 7. RENDER
  // ─────────────────────────────────────────────
  if (checkingPlan) {
    return (
      <>
        <Navbar />
        <div className="container-fluid bg-light d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 70px)' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <p className="fw-bold text-primary">Checking your plan...</p>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  if (!isSignedIn) {
    return (
      <>
        <Navbar />
        <div className="container-fluid bg-light d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 70px)', padding: '48px 6%' }}>
          <div className="bg-white border shadow-sm text-center" style={{ maxWidth: 520, borderRadius: 16, padding: '36px 32px' }}>
            <h1 className="fw-bold text-primary mb-3" style={{ fontSize: '1.6rem' }}>Sign in required</h1>
            <p className="text-muted mb-4">
              Sign in to use the AI restoration studio. Free accounts include limited daily restoration.
            </p>
            <Link to="/login" className="btn btn-primary btn-lg">
              Sign In
            </Link>
          </div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />

      <div className="container-fluid bg-light unet-page">
        <div className="row h-100 unet-shell">
          {/* ════════════════════════════════════════
              SIDEBAR – Model, Parameters, Options
              ════════════════════════════════════════ */}
          <aside className="col-lg-3 col-xl-2 bg-white border-end py-4 px-3 d-flex flex-column gap-4 unet-sidebar">
            
            <div>
              <h6 className="text-uppercase text-muted fw-bold mb-3" style={{ fontSize: '0.75rem', letterSpacing: '1px' }}>
                AI Engine
              </h6>

              {/* Premium Active Model Info Card */}
              <div className="card text-white border-0 shadow-lg rounded-4 overflow-hidden position-relative" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' }}>
                <div className="position-absolute" style={{ top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
                <div className="position-absolute" style={{ bottom: '-30px', left: '-10px', width: '80px', height: '80px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}></div>
                
                <div className="card-body p-4 position-relative z-1">
                  <div className="d-flex align-items-center mb-3">
                    <div className="bg-white bg-opacity-25 rounded p-2 me-3 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }}>
                      <i className="bi bi-cpu fs-4"></i>
                    </div>
                    <div>
                      <div className="text-white-50 fw-bold text-uppercase" style={{ fontSize: '0.65rem', letterSpacing: '1px' }}>Active Model</div>
                      <div className="fw-bold fs-6 lh-1 mt-1">{currentModel.name}</div>
                    </div>
                  </div>

                  <hr className="border-white opacity-25 my-3" />

                  <ul className="list-unstyled mb-0 small" style={{ opacity: 0.95, lineHeight: '1.8' }}>
                    <li className="d-flex justify-content-between mb-2">
                      <span className="text-white-50"><i className="bi bi-aspect-ratio me-2"></i>Input</span>
                      <span className="fw-medium">256×256px</span>
                    </li>
                    <li className="d-flex justify-content-between mb-2">
                      <span className="text-white-50"><i className="bi bi-layers me-2"></i>Network</span>
                      <span className="fw-medium text-end" style={{ maxWidth: '65%' }}>{currentModel.arch}</span>
                    </li>
                    <li className="d-flex justify-content-between">
                      <span className="text-white-50"><i className="bi bi-palette me-2"></i>Style</span>
                      <span className="fw-medium text-end" style={{ maxWidth: '65%' }}>{currentModel.params}</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Instructions box */}
            <div className="bg-light rounded-4 p-4 border border-1 shadow-sm mt-3">
               <h6 className="fw-bold text-dark mb-2 d-flex align-items-center" style={{ fontSize: '0.85rem' }}>
                 <i className="bi bi-info-circle me-2 fs-5 text-primary"></i>How it works
               </h6>
               <p className="small text-muted mb-0 lh-lg mt-2">
                 Upload any black & white or grayscale image. The AI will analyze the semantic context and intelligently infuse realistic, vibrant colors in high resolution.
               </p>
            </div>

          </aside>

          {/* ════════════════════════════════════════
              MAIN WORKSPACE
              ════════════════════════════════════════ */}
          <main className="col-lg-9 col-xl-10 p-4 d-flex flex-column gap-3 unet-main">

            {/* ── Toolbar ── */}
            <div className="bg-white border rounded-3 p-2 d-flex align-items-center gap-2 flex-wrap shadow-sm unet-toolbar">
              <button onClick={() => fileInputRef.current.click()} className="btn btn-light border fw-medium px-3 py-2 btn-sm">
                <i className="bi bi-folder2-open me-2"></i>Upload Image
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="d-none" onChange={e => { loadFile(e.target.files[0]); e.target.value = '' }} />

              <button onClick={loadSample} className="btn btn-light border fw-medium px-3 py-2 btn-sm">
                <i className="bi bi-image me-2"></i>Sample
              </button>

              <div className="vr mx-2"></div>

              <button onClick={runInference} disabled={!imgSrc || processing} className="btn btn-primary fw-medium px-4 py-2 btn-sm shadow-sm d-flex align-items-center">
                <i className="bi bi-cpu me-2"></i>Model
              </button>

              <button onClick={runGeminiEnhance} disabled={!imgSrc || processing} className="btn btn-success fw-medium px-4 py-2 btn-sm shadow-sm d-flex align-items-center">
                <i className="bi bi-play-fill me-1 fs-5"></i>Run AI
              </button>

              {isFreePlan && (
                <Link to="/payment" className="btn btn-outline-primary fw-medium px-3 py-2 btn-sm">
                  Free: {freeUsesRemaining}/{FREE_DAILY_LIMIT} left
                </Link>
              )}

              <button onClick={downloadResult} disabled={!isDone} className={`btn btn-light border fw-medium px-3 py-2 btn-sm ${!isDone ? 'opacity-50' : ''}`}>
                <i className="bi bi-download me-2"></i>Download
              </button>

              <button onClick={resetAll} className="btn btn-outline-danger fw-medium px-3 py-2 btn-sm ms-2">
                <i className="bi bi-trash3 me-2"></i>Clear
              </button>

              <span className="ms-auto text-muted small px-3 unet-image-info">{imgInfo}</span>
            </div>

            {isFreePlan && hasReachedFreeLimit && (
              <div className="alert alert-warning border-0 shadow-sm mb-0 d-flex align-items-center justify-content-between gap-3 flex-wrap">
                <span className="fw-medium">Free daily restoration limit reached.</span>
                <Link to="/payment" className="btn btn-primary btn-sm">Upgrade for unlimited</Link>
              </div>
            )}

            <section className="gemini-panel bg-white border rounded-3 shadow-sm p-3">
              <div className="gemini-panel-header">
                <div>
                  <h2 className="gemini-panel-title">
                    <i className="bi bi-stars text-primary"></i>
                    Gemini AI
                  </h2>
                  <p className="gemini-panel-subtitle">Choose HD enhancement or describe a new style, then press Run AI.</p>
                </div>
                <div className="btn-group gemini-mode-toggle" role="group" aria-label="Gemini mode">
                  <button
                    type="button"
                    onClick={() => setEnhanceMode('hd')}
                    className={`btn btn-sm ${enhanceMode === 'hd' ? 'btn-primary' : 'btn-outline-primary'}`}
                  >
                    HD
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnhanceMode('style')}
                    className={`btn btn-sm ${enhanceMode === 'style' ? 'btn-primary' : 'btn-outline-primary'}`}
                  >
                    Style
                  </button>
                </div>
              </div>
              <textarea
                className="form-control form-control-sm gemini-prompt"
                rows="2"
                placeholder={enhanceMode === 'style' ? 'Describe the new style...' : 'Optional enhancement note, e.g. sharpen face and restore detail'}
                value={enhancePrompt}
                onChange={e => setEnhancePrompt(e.target.value)}
              />
            </section>

            {/* ── Input / Output Canvas Panels ── */}
            <div className="row g-3">
              {/* INPUT PANEL */}
              <div className="col-12 col-xl-6">
                <div className="card border-0 shadow-sm h-100 rounded-3 overflow-hidden">
                  <PanelHeader title="Input Image" badge="INPUT" badgeColor="#e8f0fe" badgeText="#1a3c8f" />
                  <div className="card-body p-0 d-flex align-items-center justify-content-center bg-light"
                    style={{ minHeight: '350px', cursor: imgSrc ? 'default' : 'pointer', position: 'relative' }}
                    onClick={() => !imgSrc && fileInputRef.current.click()}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over') }}
                    onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over') }}
                    onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); loadFile(e.dataTransfer.files[0]) }}>
                    {imgSrc ? <img src={imgSrc} alt="input" className="img-fluid p-2 w-100 h-100 object-fit-contain position-absolute" /> : <DropZone />}
                  </div>
                </div>
              </div>

              {/* OUTPUT PANEL */}
              <div className="col-12 col-xl-6">
                <div className="card border-0 shadow-sm h-100 rounded-3 overflow-hidden position-relative">
                  <PanelHeader title="AI Output Result" badge={isDone ? '✓ DONE' : 'OUTPUT'} badgeColor={isDone ? '#dcfce7' : '#e8f0fe'} badgeText={isDone ? '#15803d' : '#1a3c8f'} />
                  <div className="card-body p-0 d-flex align-items-center justify-content-center bg-light position-relative" style={{ minHeight: '350px' }}>

                    {errorMessage ? (
                      <div className="text-center p-4">
                        <i className="bi bi-exclamation-triangle text-danger mb-3" style={{ fontSize: '3rem' }}></i>
                        <h6 className="fw-bold text-danger mb-2">Model failed</h6>
                        <p className="small text-muted mb-0">{errorMessage}</p>
                      </div>
                    ) : isDone && result && imgSrc ? (
                      <ImageSlider beforeSrc={imgSrc} afterSrc={result.maskDataURL} />
                    ) : result ? (
                      <img src={result.maskDataURL} alt="segmentation output" className="img-fluid p-2 w-100 h-100 object-fit-contain position-absolute" />
                    ) : (
                      <EmptyOutput />
                    )}

                    {processing && <ProcessingOverlay step={procStep} />}
                  </div>


                </div>
              </div>
            </div>

            {/* ── Summary Statistics Bar ── */}
            <div className="row g-3">
              <div className="col-6 col-md-4"><StatCard icon="⚡" value={result?.elapsed ?? '—'} label="Processing Time" /></div>
              <div className="col-6 col-md-4"><StatCard icon="🎨" value={result ? 'Vibrant' : '—'} label="Color Mode" /></div>
              <div className="col-12 col-md-4"><StatCard icon="📐" value={result?.resolution ?? '—'} label="Output Resolution" /></div>
            </div>

            {/* ── Result History Strip ── */}
            {history.length > 0 && (
              <div className="card border-0 shadow-sm rounded-3 mt-2 mb-4">
                <div className="card-body p-3">
                  <h6 className="fw-bold text-primary mb-3">🕓 Processing History</h6>
                  <div className="d-flex gap-2 overflow-x-auto pb-2">
                    {history.map((src, i) => (
                      <div key={i} title={`Result #${history.length - i}`}
                        onClick={() => setResult(r => ({ ...r, maskDataURL: src }))}
                        className="flex-shrink-0 border rounded-3 overflow-hidden card-hover-shadow"
                        style={{ width: 70, height: 70, cursor: 'pointer', transition: 'all 0.2s' }}>
                        <img src={src} alt={`history-${i}`} className="w-100 h-100 object-fit-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
      <Footer />
    </>
  )
}
