import { fmt } from '../pages/PaymentConstants'

export function OrderSummary({ plan, promoApplied }) {
  const disc  = promoApplied ? plan.price * 0.2 : 0
  const after = plan.price - disc
  const vat   = +(after * 0.1).toFixed(2)
  const total = +(after + vat).toFixed(2)

  return (
    <div style={{ background: '#fff', borderRadius: 24, padding: '30px 28px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
      <h3 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 16 }}>Order Summary</h3>
      {[
        [`${plan.name} Plan`, fmt(plan.price)],
        ['Discount 20%', promoApplied ? `-${fmt(disc)}` : '$0.00'],
        ['Tax (10%)', fmt(vat)],
      ].map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.9rem', padding: '6px 0' }}>
          <span>{l}</span>
          <span style={l.startsWith('Discount') ? { color: '#16a34a' } : {}}>{v}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--primary)', borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 12, fontSize: '1rem' }}>
        <span>Total</span><span>{fmt(total)}</span>
      </div>
      {promoApplied && (
        <div style={{ marginTop: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#16a34a', fontSize: '.8rem', fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>
            🏷 RELOOK20 applied
          </span>
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
      <h4 style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 12 }}>What's included</h4>
      {['Unlimited image processing', 'Access to 200+ AI models', 'Priority processing queue', '24/7 technical support', 'Unlimited API integration', '30-day money-back guarantee'].map(t => (
        <div key={t} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '.85rem', marginBottom: 9 }}>
          <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0 }}>✓</span>{t}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {['PayPal', 'ZaloPay', 'VietQR'].map(b => (
          <div key={b} style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)' }}>{b}</div>
        ))}
      </div>
    </div>
  )
}
