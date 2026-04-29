import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import Navbar from '../components/Navbar'
import { ShieldIcon } from '../components/Icons'
import { OrderSummary } from '../components/PaymentComponents'
import { PLANS } from './PaymentConstants'
import { createPaymentRequest, getPaymentStatus } from '../services/paymentApi'
import { supabase } from '../services/supabaseClient'

const PLAN_RANK = {
  free: 0,
  basic: 1,
  pro: 2,
  ent: 3,
}

function getPlanRank(planId) {
  return PLAN_RANK[planId] || 0
}

function getNextPlanId(currentPlanId) {
  const currentRank = getPlanRank(currentPlanId)
  return PLANS.find(plan => getPlanRank(plan.id) > currentRank)?.id || currentPlanId
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
  const isQrPayment = pm === 'zalopay' || pm === 'qr'
  const isManualPayment = isQrPayment || pm === 'paypal'
  const hasQrCode = Boolean(paymentResult?.qrCode)

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
        setPaymentResult(status)
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

      setPaymentResult(result)

      if (!isManualPayment && !result.qrCode && (result.redirectUrl || result.orderUrl || result.checkoutUrl)) {
        window.location.assign(result.redirectUrl || result.orderUrl || result.checkoutUrl)
        return
      }

      if (result.status === 'paid' || result.paid === true) {
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
      <div style={{ background: 'linear-gradient(135deg,#e8f0fe,#f5f8ff,#dce7fb)', minHeight: 'calc(100vh - 70px)', padding: '48px 6%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 28, maxWidth: 980, margin: '0 auto', alignItems: 'flex-start' }}>

          {/* Main form */}
          <div style={{ background: '#fff', borderRadius: 24, padding: 36, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
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
                      <div key={p.id} onClick={() => !isUnavailable && setSelectedPlan(p.id)} style={{
                        border: `2px solid ${selectedPlan === p.id ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 14, padding: '16px 12px', cursor: isUnavailable ? 'not-allowed' : 'pointer', textAlign: 'center',
                        background: selectedPlan === p.id ? 'var(--light-blue)' : '#fff',
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
              <div style={{ marginBottom: 20, padding: 14, borderRadius: 'var(--radius-sm)', background: '#fff', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
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
              {[['paypal', 'PayPal'], ['zalopay', 'ZaloPay'], ['qr', 'VietQR']].map(([id, lbl]) => (
                <button key={id} onClick={() => setPm(id)} style={{
                  padding: '8px 16px', borderRadius: 10, fontFamily: 'inherit', fontWeight: 600, fontSize: '.85rem', cursor: 'pointer',
                  border: `${pm === id ? '2px' : '1.5px'} solid ${pm === id ? 'var(--accent)' : 'var(--border)'}`,
                  background: pm === id ? 'var(--light-blue)' : '#fff', color: pm === id ? 'var(--primary)' : 'var(--muted)'
                }}>{lbl}</button>
              ))}
            </div>

              </>
            )}

            {checkoutStep === 'details' && (
              <div style={{ marginBottom: 16, padding: 14, borderRadius: 'var(--radius-sm)', background: '#fff', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Payment method</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800 }}>{pm === 'paypal' ? 'PayPal' : pm === 'zalopay' ? 'ZaloPay' : 'VietQR'}</div>
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
                {paymentResult?.orderUrl ? (
                  <a href={paymentResult.orderUrl} target="_blank" rel="noreferrer" className="btn btn-primary">Open PayPal</a>
                ) : (
                  <p style={{ color: 'var(--muted)', fontSize: '.86rem', margin: 0 }}>Add PAYPAL_PAYMENT_URL in backend/.env to show your PayPal link.</p>
                )}
              </div>
            )}
            {checkoutStep === 'details' && pm === 'zalopay' && (
              <div style={{ textAlign: 'center', padding: 32, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <p style={{ color: 'var(--muted)', fontSize: '.95rem', maxWidth: 300, margin: 0 }}>Scan QR on your phone</p>
                {paymentResult?.qrCodeUrl && (
                  <div style={{ marginTop: 8, background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
                    <img src={paymentResult.qrCodeUrl} alt="ZaloPay QR code" style={{ width: 220, maxWidth: '100%', borderRadius: 8, background: '#fff', padding: 10 }} />
                  </div>
                )}
                {paymentResult?.qrCode && !paymentResult?.qrCodeUrl && (
                  <div style={{ marginTop: 8, background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
                    <QRCodeCanvas value={paymentResult.qrCode} size={220} includeMargin />
                  </div>
                )}
              </div>
            )}
            {checkoutStep === 'details' && pm === 'qr' && (
              <div style={{ textAlign: 'center', padding: 32, background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--primary)', marginBottom: 8, fontWeight: 800 }}>VietQR Bank Transfer</h3>
                <p style={{ color: 'var(--muted)', fontSize: '.95rem', maxWidth: 300, margin: '0 auto' }}>Scan QR with your banking app</p>
                {paymentResult?.transferContent && (
                  <div style={{ margin: '16px auto 0', padding: 14, background: '#fff', border: '2px solid var(--accent)', borderRadius: 8, maxWidth: 320 }}>
                    <div style={{ color: 'var(--muted)', fontSize: '.76rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
                      Noi dung thanh toan
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ color: 'var(--primary)', fontSize: '1.7rem', fontWeight: 900, letterSpacing: 1 }}>
                        {paymentResult.transferContent}
                      </span>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ borderRadius: 'var(--radius-sm)', padding: '7px 12px', fontSize: '.8rem' }}
                        onClick={() => navigator.clipboard?.writeText(paymentResult.transferContent)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                {paymentResult?.qrCodeUrl && (
                  <div style={{ marginTop: 20, background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
                    <img src={paymentResult.qrCodeUrl} alt="VietQR code" style={{ width: 300, maxWidth: '100%', borderRadius: 8 }} />
                  </div>
                )}
                {paymentResult?.qrCode && !paymentResult?.qrCodeUrl && (
                  <div style={{ marginTop: 20, background: '#fff', padding: 12, borderRadius: 8, lineHeight: 0 }}>
                    <QRCodeCanvas value={paymentResult.qrCode} size={220} includeMargin />
                  </div>
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

            {checkoutStep === 'details' && pm !== 'zalopay' && pm !== 'qr' && paymentResult?.qrCodeUrl && (
              <div style={{ textAlign: 'center', marginTop: 16, padding: 20, background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <img src={paymentResult.qrCodeUrl} alt="Payment QR code" style={{ width: 220, maxWidth: '100%', borderRadius: 8 }} />
                <p style={{ marginTop: 10, color: 'var(--muted)', fontSize: '.9rem' }}>Scan this QR code to complete the payment.</p>
              </div>
            )}

            {checkoutStep === 'details' && pm !== 'zalopay' && pm !== 'qr' && paymentResult?.qrCode && !paymentResult?.qrCodeUrl && (
              <div style={{ textAlign: 'center', marginTop: 16, padding: 20, background: '#fff', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <QRCodeCanvas value={paymentResult.qrCode} size={220} includeMargin />
                <p style={{ marginTop: 10, color: 'var(--muted)', fontSize: '.9rem' }}>
                  Scan this QR code with {pm === 'zalopay' ? 'ZaloPay' : 'your banking app'}.
                </p>
              </div>
            )}

            {/* Promo */}
            {checkoutStep === 'details' && (
              <div className="form-group" style={{ marginTop: 16 }}>
              <label>Promo Code</label>
              <div style={{ display: 'flex', gap: 8 }}>
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
          <div>
            <OrderSummary plan={plan} promoApplied={promoApplied} />
            <div style={{ background: 'linear-gradient(135deg,var(--primary),var(--accent))', borderRadius: 16, padding: 20, color: '#fff', marginTop: 16, textAlign: 'center' }}>
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
