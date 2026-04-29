import crypto from 'node:crypto'

const VND_PER_USD = Number(process.env.ZALOPAY_VND_PER_USD || 25000)

function createMac(data, key) {
  return crypto.createHmac('sha256', key).update(data).digest('hex')
}

function getVietnamDatePrefix() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}${values.month}${values.day}`
}

function toZaloPayAmount(order) {
  if (String(order.currency || '').toUpperCase() === 'VND') {
    return Math.round(Number(order.amount))
  }

  return Math.round(Number(order.amount) * VND_PER_USD)
}

function createDemoZaloPayPayment(order) {
  const providerTxnId = `zalopay_${order.order_id}`
  const orderUrl = `${order.return_url}?orderId=${order.order_id}&provider=zalopay&status=pending`

  return {
    provider: 'zalopay',
    providerTxnId,
    status: 'pending',
    orderUrl,
    qrCode: orderUrl,
    message: 'ZaloPay demo QR generated. Add ZALOPAY_APP_ID and ZALOPAY_KEY1 to call the real ZaloPay API.',
  }
}

function hasRealCredential(value) {
  return value && !String(value).trim().toLowerCase().startsWith('your_')
}

export async function createZaloPayPayment(order) {
  const appId = process.env.ZALOPAY_APP_ID
  const key1 = process.env.ZALOPAY_KEY1
  const endpoint = process.env.ZALOPAY_CREATE_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create'

  if (!hasRealCredential(appId) || !hasRealCredential(key1)) {
    return createDemoZaloPayPayment(order)
  }

  const amount = toZaloPayAmount(order)
  const appTransId = `${getVietnamDatePrefix()}_${order.order_id.replaceAll('-', '').slice(0, 20)}`
  const appTime = Date.now()
  const embedData = JSON.stringify({
    redirecturl: order.return_url,
    order_id: order.order_id,
    plan_id: order.plan_id,
  })
  const item = JSON.stringify([
    {
      itemid: order.plan_id,
      itemname: order.plan_name,
      itemprice: amount,
      itemquantity: 1,
    },
  ])

  const payload = {
    app_id: appId,
    app_trans_id: appTransId,
    app_user: order.order_id,
    app_time: appTime,
    amount,
    item,
    embed_data: embedData,
    description: `ReLook-AI - ${order.plan_name}`,
    bank_code: 'zalopayapp',
    callback_url: process.env.ZALOPAY_CALLBACK_URL || '',
  }

  const macInput = [
    payload.app_id,
    payload.app_trans_id,
    payload.app_user,
    payload.amount,
    payload.app_time,
    payload.embed_data,
    payload.item,
  ].join('|')

  payload.mac = createMac(macInput, key1)

  const body = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      body.append(key, String(value))
    }
  })

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    const data = await response.json()

    if (!response.ok || data.return_code !== 1) {
      throw new Error(data.return_message || data.sub_return_message || 'ZaloPay create order failed')
    }

    return {
      provider: 'zalopay',
      providerTxnId: data.zp_trans_token || data.order_token || appTransId,
      status: 'pending',
      orderUrl: data.order_url,
      qrCode: data.qr_code || data.order_url,
      message: data.return_message || 'ZaloPay order created.',
      raw: data,
    }
  } catch (error) {
    return {
      ...createDemoZaloPayPayment(order),
      message: `${error.message}. Showing demo ZaloPay QR instead.`,
    }
  }
}
