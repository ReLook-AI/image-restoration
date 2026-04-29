import { getOrder, markOrderFailed, markOrderPaid } from './order-service.js'

export async function handlePaymentWebhook(payload) {
  const orderId = payload.orderId || payload.order_id
  const status = String(payload.status || '').toLowerCase()

  if (!orderId) {
    throw new Error('Webhook payload requires orderId')
  }

  if (!getOrder(orderId)) {
    throw new Error('Order not found')
  }

  if (status === 'paid' || status === 'success' || status === 'completed') {
    return markOrderPaid(orderId, {
      providerTxnId: payload.providerTxnId || payload.provider_txn_id || null,
      raw: payload,
    })
  }

  if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
    return markOrderFailed(orderId, {
      providerTxnId: payload.providerTxnId || payload.provider_txn_id || null,
      raw: payload,
    })
  }

  return getOrder(orderId)
}
