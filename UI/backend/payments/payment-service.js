import { createOrder, getOrder, markOrderPending } from './order-service.js'
import { createPayPalPayment } from './adapters/paypal-adapter.js'
import { createVietQrPayment } from './adapters/vietqr-adapter.js'

const SUPPORTED_PAYMENT_METHODS = {
  paypal: createPayPalPayment,
  qr: createVietQrPayment,
  vietqr: createVietQrPayment,
}

const SERVER_PLANS = {
  free: { id: 'free', name: 'Free', price: 0 },
  basic: { id: 'basic', name: 'Starter', price: 9 },
  pro: { id: 'pro', name: 'Professional', price: 19 },
  ent: { id: 'ent', name: 'Enterprise', price: 49 },
}

function normalizePaymentMethod(provider) {
  return String(provider || '').trim().toLowerCase()
}

function getPlan(planId) {
  return SERVER_PLANS[planId] || null
}

function calculateTotal(plan, promoCode) {
  const discount = String(promoCode || '').trim().toUpperCase() === 'RELOOK20' ? plan.price * 0.2 : 0
  const subtotal = plan.price - discount
  const vat = Number((subtotal * 0.1).toFixed(2))
  return Number((subtotal + vat).toFixed(2))
}

export async function createPayment(payload) {
  const paymentMethod = normalizePaymentMethod(payload.provider || payload.payment_method)
  const adapter = SUPPORTED_PAYMENT_METHODS[paymentMethod]

  if (!adapter) {
    throw new Error('Unsupported payment provider')
  }

  const plan = getPlan(payload.planId)
  if (!plan) {
    throw new Error('Invalid plan')
  }

  if (plan.id === 'free') {
    throw new Error('Free plan does not require payment')
  }

  const order = createOrder({
    paymentMethod,
    userId: payload.userId,
    planId: plan.id,
    planName: plan.name,
    amount: calculateTotal(plan, payload.promoCode),
    currency: payload.currency || 'USD',
    returnUrl: payload.returnUrl,
    promoCode: payload.promoCode,
    idempotencyKey: payload.idempotencyKey,
  })

  const providerPayload = await adapter(order)
  const pendingOrder = markOrderPending(order.order_id, providerPayload)

  return {
    orderId: pendingOrder.order_id,
    status: pendingOrder.status,
    provider: providerPayload.provider,
    providerTxnId: providerPayload.providerTxnId,
    checkoutUrl: providerPayload.checkoutUrl,
    orderUrl: providerPayload.orderUrl,
    qrCode: providerPayload.qrCode,
    qrCodeUrl: providerPayload.qrCodeUrl,
    amount: providerPayload.amount,
    currency: providerPayload.currency,
    transferContent: providerPayload.transferContent,
    message: providerPayload.message,
  }
}

export function getPaymentStatus(orderId) {
  const order = getOrder(orderId)

  if (!order) {
    throw new Error('Order not found')
  }

  return {
    orderId: order.order_id,
    status: order.status,
    provider: order.payment_method,
    providerTxnId: order.provider_txn_id,
    paidAt: order.paid_at,
    amount: order.amount,
    currency: order.currency,
    planId: order.plan_id,
    planName: order.plan_name,
  }
}
