import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import Navbar from '../components/Navbar'
import { ShieldIcon } from '../components/Icons'
import { PLANS } from '../features/payment/constants'
import { OrderSummary } from '../features/payment/OrderSummary'
import { createPaymentRequest, getPaymentStatus } from '../services/paymentApi'
import { supabase } from '../services/supabaseClient'

const PLAN_RANK = {
  free: 0,
  basic: 1,
  pro: 2,
  ent: 3,
}

const VIETQR_BANK_ID = 'MB'
const VIETQR_ACCOUNT_NO = '0961856252'
const VIETQR_ACCOUNT_NAME = 'NGUYEN LAM ANH TUAN'
const VIETQR_TEMPLATE = 'print'
const VIETQR_VND_PER_USD = 25000
const PAYPAL_PAYMENT_URL = 'https://paypal.me/relookai'

function getPlanRank(planId) {
  return PLAN_RANK[planId] || 0
}

function getNextPlanId(currentPlanId) {
  const currentRank = getPlanRank(currentPlanId)
  return PLANS.find(plan => getPlanRank(plan.id) > currentRank)?.id || currentPlanId
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''))
}

function isQrImageUrl(value) {
  const url = String(value || '')
  return isHttpUrl(url) && (/\/image\//i.test(url) || /\.(png|jpe?g|webp)(\?|$)/i.test(url))
}

function createFourDigitCode(value) {
  const source = String(value || '')
  const hash = Array.from(source).reduce((total, char) => {
    return (total * 31 + char.charCodeAt(0)) % 10000
  }, 0)

  return String(hash).padStart(4, '0')
}

function parseDemoVietQr(value) {
  const parts = String(value || '').split(':')
  if (parts[0] !== 'VIETQR_DEMO' || parts.length < 4) return null

  return {
    orderId: parts[1],
    amount: Number(parts[2]),
    currency: parts[3],
  }
}

function toVndAmount(amount, currency) {
  if (String(currency || '').toUpperCase() === 'VND') {
    return Math.round(Number(amount))
  }

  return Math.round(Number(amount) * VIETQR_VND_PER_USD)
}

function createVietQrImageUrl({ amount, currency, orderId, userId }) {
  const transferContent = createFourDigitCode(userId || orderId)
  const params = new URLSearchParams({
    amount: String(toVndAmount(amount, currency)),
    addInfo: transferContent,
    accountName: VIETQR_ACCOUNT_NAME,
  })

  return {
    qrCodeUrl: `https://img.vietqr.io/image/${VIETQR_BANK_ID}-${VIETQR_ACCOUNT_NO}-${VIETQR_TEMPLATE}.png?${params.toString()}`,
    transferContent,
    amount: toVndAmount(amount, currency),
    currency: 'VND',
  }
}

function normalizePaymentResult(result, fallback = {}) {
  if (!result) return result

  const demoVietQr = parseDemoVietQr(result.qrCode)
  const fallbackVietQr = demoVietQr
    ? createVietQrImageUrl({
      amount: demoVietQr.amount || fallback.amount,
      currency: demoVietQr.currency || fallback.currency,
      orderId: demoVietQr.orderId || result.orderId,
      userId: fallback.userId,
    })
    : null
  const qrCodeUrl = result.qrCodeUrl || fallbackVietQr?.qrCodeUrl || (isQrImageUrl(result.qrCode) ? result.qrCode : '')
  const qrCode = qrCodeUrl && result.qrCode === qrCodeUrl ? '' : result.qrCode

  return {
    ...result,
    ...(fallbackVietQr || {}),
    qrCodeUrl,
    qrCode,
  }
}

function isDemoQrCode(value) {
  return String(value || '').startsWith('VIETQR_DEMO:')
}

function createPayPalAmountUrl(baseUrl, amount) {
  const normalizedBaseUrl = String(baseUrl || '').replace(/\/+$/, '')
  const normalizedAmount = Number(amount || 0).toFixed(2)

  if (!normalizedBaseUrl || Number.isNaN(Number(normalizedAmount))) return normalizedBaseUrl
  if (!normalizedBaseUrl.includes('paypal.me/')) return normalizedBaseUrl

  return `${normalizedBaseUrl}/${normalizedAmount}`
}

export default function PaymentPage() {
  const [selectedPlan, setSelectedPlan] = useState('pro')
  const [pm, setPm]       = useState('paypal')
  const [promo, setPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(true)
  const [promoMsg, setPromoMsg] = useState({ text: '✓ Valid code! 20% discount applied', ok: true })
  const [paying, setPaying]   = useState(false)
  const [done, setDone]       = useState(false)
  const [paymentResult, setPaymentResult] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const [currentPlanId, setCurrentPlanId] = useState('free')
  const [loadingPlan, setLoadingPlan] = useState(true)
  const [checkoutStep, setCheckoutStep] = useState('plan')

  const plan = PLANS.find(p => p.id === selectedPlan)
  const currentPlan = PLANS.find(p => p.id === currentPlanId)
  const selectedPlanRank = getPlanRank(selectedPlan)
  const currentPlanRank = getPlanRank(currentPlanId)
  const canUpgradeSelectedPlan = selectedPlanRank > currentPlanRank
  const hasHigherPlan = PLANS.some(p => getPlanRank(p.id) > currentPlanRank)
  const isQrPayment = pm === 'qr'
  const isManualPayment = isQrPayment || pm === 'paypal'
  const hasQrCode = Boolean(paymentResult?.qrCodeUrl || (paymentResult?.qrCode && !isDemoQrCode(paymentResult.qrCode)))

  const updateCurrentUserPlan = async (planId) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id

    if (!userId || !planId || planId === 'free') return

    const { error } = await supabase
      .from('profiles')
      .update({
        current_plan: planId,
        plan_status: 'active',
        plan_started_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (error) {
      throw new Error(error.message || 'Unable to update current plan.')
    }

    setCurrentPlanId(planId)
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('orderId')

    if (!orderId) return

    getPaymentStatus(orderId)
      .then(status => {
        setPaymentResult(normalizePaymentResult(status))
        setDone(status.status === 'paid')
        if (status.status === 'paid') {
          updateCurrentUserPlan(status.planId).catch(err => {
            setPaymentError(err.message || 'Unable to activate plan.')
          })
        }
      })
      .catch(err => {
        setPaymentError(err.message || 'Unable to check payment status.')
      })
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadCurrentPlan() {
      setLoadingPlan(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const userId = sessionData.session?.user?.id

      if (!userId) {
        if (mounted) {
          setCurrentPlanId('free')
          setSelectedPlan('basic')
          setLoadingPlan(false)
        }
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('current_plan')
        .eq('id', userId)
        .single()

      if (!mounted) return

      if (error) {
        setPaymentError(error.message || 'Unable to load current plan.')
        setLoadingPlan(false)
        return
      }

      const profilePlanId = data?.current_plan || 'free'
      setCurrentPlanId(profilePlanId)
      setSelectedPlan(getNextPlanId(profilePlanId))
      setLoadingPlan(false)
    }

    loadCurrentPlan()

    return () => {
      mounted = false
    }
  }, [])

  const applyPromo = () => {
    if (promo.trim().toUpperCase() === 'RELOOK20') {
      setPromoApplied(true); setPromoMsg({ text: '✓ Valid code! 20% discount applied', ok: true })
    } else {
      setPromoApplied(false); setPromoMsg({ text: '✗ Invalid promo code', ok: false })
    }
  }

  const getTotal = () => {
    const disc = promoApplied ? plan.price * 0.2 : 0
    const after = plan.price - disc
    const vat = +(after * 0.1).toFixed(2)
    return +(after + vat).toFixed(2)
  }
  const paypalPaymentUrl = paymentResult?.orderUrl || createPayPalAmountUrl(PAYPAL_PAYMENT_URL, paymentResult?.amount || getTotal())

  const continueToPaymentMethods = () => {
    if (!canUpgradeSelectedPlan) {
      setPaymentError('Please choose a higher plan than your current plan.')
      return
    }

    setPaymentError('')
    setCheckoutStep('method')
  }

  const continueToPaymentDetails = async () => {
    setPaymentResult(null)
    setPaymentError('')
    setCheckoutStep('details')

    if (isManualPayment) {
      await doPay()
    }
  }

  const doPay = async () => {
    if (!canUpgradeSelectedPlan) {
      setPaymentError('Please choose a higher plan than your current plan.')
      return
    }

    setPaying(true)
    setDone(false)
    setPaymentResult(null)
    setPaymentError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()

      const result = await createPaymentRequest({
        provider: pm,
        userId: sessionData.session?.user?.id,
        planId: plan.id,
        planName: plan.name,
        amount: getTotal(),
        currency: 'USD',
        promoCode: promoApplied ? 'RELOOK20' : promo.trim(),
        returnUrl: `${window.location.origin}/payment`,
      })

      const normalizedResult = normalizePaymentResult(result, {
        amount: getTotal(),
        currency: 'USD',
        userId: sessionData.session?.user?.id,
      })
      setPaymentResult(normalizedResult)

      if (!isManualPayment && !normalizedResult.qrCode && !normalizedResult.qrCodeUrl && (normalizedResult.redirectUrl || normalizedResult.orderUrl || normalizedResult.checkoutUrl)) {
        window.location.assign(normalizedResult.redirectUrl || normalizedResult.orderUrl || normalizedResult.checkoutUrl)
        return
      }

      if (normalizedResult.status === 'paid' || normalizedResult.paid === true) {
        await updateCurrentUserPlan(plan.id)
        setDone(true)
      }
    } catch (err) {
      setPaymentError(err.message || 'Payment failed. Please try again.')
    } finally {
      setPaying(false)
    }
  }

  const checkoutActionDisabled =
    checkoutStep === 'plan'
      ? loadingPlan || !canUpgradeSelectedPlan
      : checkoutStep === 'method'
        ? !pm
        : paying || done || loadingPlan || !canUpgradeSelectedPlan || (isQrPayment && hasQrCode) || (pm === 'paypal' && Boolean(paymentResult?.orderUrl))

  const handleCheckoutAction = async () => {
    if (checkoutStep === 'plan') {
      continueToPaymentMethods()
      return
    }

    if (checkoutStep === 'method') {
      await continueToPaymentDetails()
      return
    }

    await doPay()
  }

  const checkoutActionLabel = done
    ? 'Payment Successful!'
    : checkoutStep === 'plan'
      ? (!hasHigherPlan ? 'Current Highest Plan' : 'Continue')
      : checkoutStep === 'method'
        ? 'Continue'
        : isQrPayment && hasQrCode
          ? 'QR Ready'
          : pm === 'paypal' && paymentResult?.orderUrl
            ? 'PayPal Ready'
          : paying
            ? (isManualPayment ? 'Preparing...' : 'Processing...')
            : (isManualPayment ? 'Prepare Payment' : 'Pay Securely')

  return (
    <>
      <Navbar />
      <div className="payment-page">
        <div className="payment-layout">

          {/* Main form */}
          <div className="payment-card">
            <h1 style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.5rem', marginBottom: 6 }}>
              {checkoutStep === 'plan' ? 'Choose Your Plan' : checkoutStep === 'method' ? 'Choose Payment Method' : 'Complete Payment'}
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: '.92rem', marginBottom: 24 }}>
              {checkoutStep === 'plan' ? 'Upgrade to unlock all AI features.' : checkoutStep === 'method' ? 'Select how you want to pay for this upgrade.' : 'Review your details and continue securely.'}
            </p>
            <div style={{ marginBottom: 18, padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--light-blue)', color: 'var(--primary)', fontSize: '.88rem', fontWeight: 700 }}>
              Current plan: {loadingPlan ? 'Checking...' : currentPlan?.name || 'Free'}
            </div>

            {/* Plans */}
            {checkoutStep === 'plan' ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 24 }}>
                  {PLANS.map(p => {
                    const isCurrentPlan = p.id === currentPlanId
                    const isLowerPlan = getPlanRank(p.id) < currentPlanRank
                    const isUnavailable = isCurrentPlan || isLowerPlan

                    return (
                      <div key={p.id} className={`payment-plan-card ${selectedPlan === p.id ? 'active' : ''} ${isUnavailable ? 'unavailable' : ''}`} onClick={() => !isUnavailable && setSelectedPlan(p.id)} style={{
                        border: `2px solid ${selectedPlan === p.id ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 14, padding: '16px 12px', cursor: isUnavailable ? 'not-allowed' : 'pointer', textAlign: 'center',
                        background: selectedPlan === p.id ? 'var(--light-blue)' : 'var(--panel-surface)',
                        opacity: isLowerPlan ? 0.55 : 1,
                        position: 'relative', transition: 'all .2s'
                      }}>
                        {p.popular && !isCurrentPlan && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#fff', fontSize: '.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>Most Popular</div>}
                        {isCurrentPlan && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', fontSize: '.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>Current Plan</div>}
                        <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--primary)', marginBottom: 6 }}>{p.name}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent)' }}>${p.price}<span style={{ fontSize: '.72rem', fontWeight: 500, color: 'var(--muted)' }}>/mo</span></div>
                        <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{p.features}</div>
                        {isLowerPlan && <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginTop: 8, fontWeight: 700 }}>Included in your plan</div>}
                      </div>
                    )
                  })}
                </div>
                {!hasHigherPlan && (
                  <div style={{ marginBottom: 20, padding: 12, borderRadius: 'var(--radius-sm)', background: '#dcfce7', color: '#15803d', fontSize: '.88rem', fontWeight: 700, textAlign: 'center' }}>
                    You are already on the highest plan.
                  </div>
                )}
              </>
            ) : (
              <div className="payment-panel" style={{ marginBottom: 20, padding: 14, borderRadius: 'var(--radius-sm)', background: 'var(--panel-surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Selected plan</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{plan.name} - ${plan.price}/mo</div>
                </div>
                <button type="button" className="btn btn-outline" style={{ borderRadius: 'var(--radius-sm)', padding: '8px 14px' }} onClick={() => setCheckoutStep('plan')}>
                  Change
                </button>
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0 0 20px' }} />

            {/* Payment methods */}
            {checkoutStep === 'method' && (
              <>
                <h3 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 14 }}>Payment Method</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {[['paypal', 'PayPal'], ['qr', 'VietQR']].map(([id, lbl]) => (
                <button key={id} onClick={() => setPm(id)} style={{
                  padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer',
                  border: `${pm === id ? '2px' : '1.5px'} solid ${pm === id ? 'var(--accent)' : 'var(--border)'}`,
                  background: pm === id ? 'var(--light-blue)' : 'var(--panel-surface)', color: pm === id ? 'var(--primary)' : 'var(--muted)'
                }}>{lbl}</button>
              ))}
            </div>

              </>
            )}

            {checkoutStep === 'details' && (
              <div className="payment-panel" style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--radius-sm)', background: 'var(--panel-surface)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Payment method</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{pm === 'paypal' ? 'PayPal' : 'VietQR'}</div>
                </div>
                <button type="button" className="btn btn-outline" style={{ borderRadius: 'var(--radius-sm)', padding: '8px 14px' }} onClick={() => setCheckoutStep('method')}>
                  Change
                </button>
              </div>
            )}
            {checkoutStep === 'details' && pm === 'paypal' && (
              <div style={{ textAlign: 'center', padding: 32, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--primary)', marginBottom: 8, fontWeight: 800 }}>PayPal Manual Payment</h3>
                <p style={{ color: 'var(--muted)', fontSize: '.95rem', maxWidth: 360, margin: '0 auto 14px' }}>
                  Send the payment through PayPal and include your payment code in the note.
                </p>
                {paymentResult?.amount && paymentResult?.currency && (
                  <p style={{ color: 'var(--primary)', fontSize: '.95rem', margin: '4px 0', fontWeight: 700 }}>
                    Amount: {Number(paymentResult.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} {paymentResult.currency}
                  </p>
                )}
                {paymentResult?.transferContent && (
                  <div style={{ margin: '14px auto', padding: 14, background: '#fff', border: '2px solid var(--accent)', borderRadius: 8, maxWidth: 320 }}>
                    <div style={{ color: 'var(--muted)', fontSize: '.76rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Payment code</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--primary)', fontSize: '1.7rem', fontWeight: 900, letterSpacing: 1 }}>{paymentResult.transferContent}</span>
                      <button type="button" className="btn btn-outline" style={{ borderRadius: 'var(--radius-sm)', padding: '7px 12px', fontSize: '.8rem' }} onClick={() => navigator.clipboard?.writeText(paymentResult.transferContent)}>Copy</button>
                    </div>
                  </div>
                )}
                <a href={paypalPaymentUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Open PayPal</a>
              </div>
            )}
            {checkoutStep === 'details' && pm === 'qr' && (
              <div style={{ textAlign: 'center', padding: 32, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--primary)', marginBottom: 8, fontWeight: 800 }}>VietQR Bank Transfer</h3>
                <p style={{ color: 'var(--muted)', fontSize: '.95rem', maxWidth: 300, margin: '0 auto' }}>Scan QR with your banking app</p>
                {paymentResult?.qrCodeUrl && (
                  <div style={{ marginTop: 20, background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
                    <img src={paymentResult.qrCodeUrl} alt="VietQR code" style={{ width: 300, maxWidth: '100%', borderRadius: 8 }} />
                  </div>
                )}
                {paymentResult?.qrCode && !paymentResult?.qrCodeUrl && !isDemoQrCode(paymentResult.qrCode) && (
                  <div style={{ marginTop: 20, background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
                    <QRCodeCanvas value={paymentResult.qrCode} size={220} includeMargin />
                  </div>
                )}
                {paymentResult?.qrCode && !paymentResult?.qrCodeUrl && isDemoQrCode(paymentResult.qrCode) && (
                  <p style={{ color: '#ef4444', fontSize: '.86rem', fontWeight: 700, margin: '16px 0 0' }}>
                    VietQR is still in demo mode. A real bank QR image was not returned by the backend.
                  </p>
                )}
                {paymentResult?.amount && paymentResult?.currency && (
                  <p style={{ color: 'var(--primary)', fontSize: '.9rem', margin: '4px 0 0', fontWeight: 700 }}>
                    Amount: {Number(paymentResult.amount).toLocaleString('vi-VN')} {paymentResult.currency}
                  </p>
                )}
                {paymentResult?.transferContent && (
                  <p style={{ color: 'var(--muted)', fontSize: '.78rem', margin: '8px 0 0' }}>
                    Please enter this code exactly if your banking app does not fill it automatically.
                  </p>
                )}
              </div>
            )}

            {checkoutStep === 'details' && pm !== 'qr' && paymentResult?.qrCodeUrl && (
              <div style={{ textAlign: 'center', marginTop: 16, padding: 20, background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <img src={paymentResult.qrCodeUrl} alt="Payment QR code" style={{ width: 220, maxWidth: '100%', borderRadius: 8 }} />
                <p style={{ marginTop: 10, color: 'var(--muted)', fontSize: '.9rem' }}>Scan this QR code to complete the payment.</p>
              </div>
            )}

            {checkoutStep === 'details' && pm !== 'qr' && paymentResult?.qrCode && !paymentResult?.qrCodeUrl && !isDemoQrCode(paymentResult.qrCode) && (
              <div style={{ textAlign: 'center', marginTop: 16, padding: 20, background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <QRCodeCanvas value={paymentResult.qrCode} size={220} includeMargin />
                <p style={{ marginTop: 10, color: 'var(--muted)', fontSize: '.9rem' }}>
                  Scan this QR code with your banking app.
                </p>
              </div>
            )}

            {/* Promo */}
            {checkoutStep === 'details' && (
              <div className="form-group" style={{ marginTop: 16 }}>
              <label>Promo Code</label>
              <div className="promo-row" style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={promo} onChange={e => setPromo(e.target.value)} placeholder="Enter promo code" onKeyDown={e => e.key === 'Enter' && applyPromo()} style={{ flex: 1 }} />
                <button className="btn btn-outline" onClick={applyPromo} style={{ flexShrink: 0, borderRadius: 'var(--radius-sm)' }}>Apply</button>
              </div>
              {promoMsg && <div style={{ marginTop: 6, fontSize: '.83rem', color: promoMsg.ok ? '#16a34a' : '#ef4444', fontWeight: 600 }}>{promoMsg.text}</div>}
              </div>
            )}

            <button
              onClick={handleCheckoutAction} disabled={checkoutActionDisabled}
              className={`btn btn-block btn-lg ${done ? '' : 'btn-accent'}`}
              style={{ marginTop: 8, ...(done ? { background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff' } : {}) }}
            >
              {checkoutActionLabel}
            </button>
            <div className="badge-secure">
              <ShieldIcon /> 256-bit SSL encryption – 100% secure payment
            </div>
            {paymentError && (
              <div style={{ marginTop: 12, color: '#ef4444', fontSize: '.9rem', fontWeight: 600, textAlign: 'center' }}>
                {paymentError}
              </div>
            )}
            {paymentResult?.orderId && !done && !paymentError && (
              <div style={{ marginTop: 12, color: 'var(--muted)', fontSize: '.88rem', fontWeight: 600, textAlign: 'center' }}>
                Order {paymentResult.orderId} is {paymentResult.status || 'pending'}.
              </div>
            )}
            {done && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Link to="/app" className="btn btn-primary">🚀 Start Using U-Net Studio</Link>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="payment-sidebar">
            <OrderSummary plan={plan} promoApplied={promoApplied} />
            <div className="payment-testimonial">
              <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>⭐</div>
              <p style={{ fontSize: '.88rem', opacity: .9, lineHeight: 1.7 }}>"ReLook-AI completely transformed our image processing pipeline. Absolutely remarkable!"</p>
              <div style={{ marginTop: 10, fontSize: '.8rem', opacity: .7 }}>— Mai Nguyen, CTO at TechViet</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
