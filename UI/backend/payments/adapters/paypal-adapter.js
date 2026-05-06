const DEFAULT_PAYPAL_PAYMENT_URL = 'https://paypal.me/relookai'

function createFourDigitUserCode(order) {
  const source = order.user_id || order.order_id
  const hash = Array.from(String(source)).reduce((total, char) => {
    return (total * 31 + char.charCodeAt(0)) % 10000
  }, 0)

  return String(hash).padStart(4, '0')
}

function createPayPalAmountUrl(baseUrl, amount, currency) {
  if (!baseUrl) return ''

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const normalizedCurrency = String(currency || 'USD').toUpperCase()
  const normalizedAmount = Number(amount).toFixed(2)
  const includeCurrency = String(process.env.PAYPAL_INCLUDE_CURRENCY || '').toLowerCase() === 'true'

  if (!normalizedBaseUrl.includes('paypal.me/')) {
    return normalizedBaseUrl
  }

  return `${normalizedBaseUrl}/${normalizedAmount}${includeCurrency ? normalizedCurrency : ''}`
}

export async function createPayPalPayment(order) {
  const providerTxnId = `paypal_${order.order_id}`
  const paypalUrl = createPayPalAmountUrl(
    process.env.PAYPAL_PAYMENT_URL || DEFAULT_PAYPAL_PAYMENT_URL,
    order.amount,
    order.currency || 'USD',
  )
  const transferContent = process.env.PAYPAL_TRANSFER_CONTENT || createFourDigitUserCode(order)

  return {
    provider: 'paypal',
    providerTxnId,
    status: 'pending',
    orderUrl: paypalUrl,
    transferContent,
    amount: order.amount,
    currency: order.currency || 'USD',
    message: paypalUrl
      ? 'Open PayPal and include the payment code in the note.'
      : 'PayPal manual payment selected. Add PAYPAL_PAYMENT_URL to show a payment link.',
  }
}
