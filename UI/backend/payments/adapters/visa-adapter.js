export async function createVisaPayment(order) {
  const providerTxnId = `visa_${order.order_id}`

  return {
    provider: 'visa',
    providerTxnId,
    status: 'pending',
    checkoutUrl: `${order.return_url}?orderId=${order.order_id}&provider=visa&status=pending`,
    message: 'Visa adapter is ready. Replace this demo checkout URL with your card gateway session URL.',
  }
}
