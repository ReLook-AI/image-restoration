import crypto from 'node:crypto'

const orders = new Map()

export const PAYMENT_STATUSES = {
  CREATED: 'created',
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  EXPIRED: 'expired',
  REFUNDED: 'refunded',
}

export function createOrder({
  paymentMethod,
  userId,
  planId,
  planName,
  amount,
  currency,
  returnUrl,
  promoCode,
  idempotencyKey,
}) {
  const orderId = crypto.randomUUID()
  const now = new Date().toISOString()

  const order = {
    order_id: orderId,
    user_id: userId || null,
    payment_method: paymentMethod,
    plan_id: planId,
    plan_name: planName,
    amount,
    currency,
    status: PAYMENT_STATUSES.CREATED,
    provider_txn_id: null,
    provider_payload: null,
    idempotency_key: idempotencyKey || crypto.randomUUID(),
    return_url: returnUrl,
    promo_code: promoCode || '',
    paid_at: null,
    created_at: now,
    updated_at: now,
  }

  orders.set(orderId, order)
  return order
}

export function getOrder(orderId) {
  return orders.get(orderId) || null
}

export function updateOrder(orderId, patch) {
  const order = getOrder(orderId)
  if (!order) return null

  const nextOrder = {
    ...order,
    ...patch,
    updated_at: new Date().toISOString(),
  }

  orders.set(orderId, nextOrder)
  return nextOrder
}

export function markOrderPending(orderId, providerPayload) {
  return updateOrder(orderId, {
    status: PAYMENT_STATUSES.PENDING,
    provider_txn_id: providerPayload.providerTxnId || null,
    provider_payload: providerPayload,
  })
}

export function markOrderPaid(orderId, providerPayload = {}) {
  return updateOrder(orderId, {
    status: PAYMENT_STATUSES.PAID,
    provider_txn_id: providerPayload.providerTxnId || null,
    provider_payload: providerPayload,
    paid_at: new Date().toISOString(),
  })
}

export function markOrderFailed(orderId, providerPayload = {}) {
  return updateOrder(orderId, {
    status: PAYMENT_STATUSES.FAILED,
    provider_txn_id: providerPayload.providerTxnId || null,
    provider_payload: providerPayload,
  })
}
