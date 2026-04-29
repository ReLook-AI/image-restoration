const VND_PER_USD = Number(process.env.VIETQR_VND_PER_USD || 25000)

function toVietQrAmount(order) {
  if (String(order.currency || '').toUpperCase() === 'VND') {
    return Math.round(Number(order.amount))
  }

  return Math.round(Number(order.amount) * VND_PER_USD)
}

function sanitizeTransferContent(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 25)
}

function createFourDigitUserCode(order) {
  const source = order.user_id || order.order_id
  const hash = Array.from(String(source)).reduce((total, char) => {
    return (total * 31 + char.charCodeAt(0)) % 10000
  }, 0)

  return String(hash).padStart(4, '0')
}

function createTransferContent(order) {
  const fixedContent = process.env.VIETQR_TRANSFER_CONTENT
  if (fixedContent) return sanitizeTransferContent(fixedContent)

  const prefix = process.env.VIETQR_TRANSFER_PREFIX || ''
  const userCode = createFourDigitUserCode(order)

  return sanitizeTransferContent(`${prefix}${userCode}`)
}

function createDemoVietQrPayment(order) {
  const providerTxnId = `vietqr_${order.order_id}`

  return {
    provider: 'vietqr',
    providerTxnId,
    status: 'pending',
    qrCode: `VIETQR_DEMO:${order.order_id}:${order.amount}:${order.currency}`,
    message: 'VietQR demo QR generated. Add VIETQR_BANK_ID and VIETQR_ACCOUNT_NO to create a real VietQR image.',
  }
}

export async function createVietQrPayment(order) {
  const bankId = process.env.VIETQR_BANK_ID
  const accountNo = process.env.VIETQR_ACCOUNT_NO
  const accountName = process.env.VIETQR_ACCOUNT_NAME || ''
  const template = process.env.VIETQR_TEMPLATE || 'print'

  if (!bankId || !accountNo) {
    return createDemoVietQrPayment(order)
  }

  const providerTxnId = `vietqr_${order.order_id}`
  const amount = toVietQrAmount(order)
  const addInfo = createTransferContent(order)
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo,
  })

  if (accountName) {
    params.set('accountName', accountName)
  }

  const qrCodeUrl = `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNo)}-${encodeURIComponent(template)}.png?${params.toString()}`

  return {
    provider: 'vietqr',
    providerTxnId,
    status: 'pending',
    qrCodeUrl,
    qrCode: qrCodeUrl,
    amount,
    currency: 'VND',
    transferContent: addInfo,
    message: 'VietQR image generated.',
  }
}
