import { buildApiUrl } from './apiConfig'

const PAYMENT_ENDPOINT = import.meta.env.VITE_PAYMENT_API_URL || buildApiUrl('/api/payments/create')
const PAYMENT_STATUS_ENDPOINT = PAYMENT_ENDPOINT.replace(/\/create$/, '/status')

export async function createPaymentRequest(payload) {
  const res = await fetch(PAYMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Unable to create payment request')
  }

  return data || {}
}

export async function getPaymentStatus(orderId) {
  const res = await fetch(`${PAYMENT_STATUS_ENDPOINT}?orderId=${encodeURIComponent(orderId)}`)

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new Error(data?.message || 'Unable to get payment status')
  }

  return data || {}
}
