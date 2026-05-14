import './load-env.js'
import http from 'node:http'
import { createPayment, getPaymentStatus } from './payments/payment-service.js'
import { handlePaymentWebhook } from './payments/webhook-handler.js'

const PORT = Number(process.env.PORT || 8000)
const MODEL_ENDPOINT = process.env.MODEL_ENDPOINT || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(data))
}

async function readCurrentSupabaseUser(req) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''

  if (!token) {
    throw new HttpError(401, 'Missing authorization token')
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(500, 'Supabase admin environment is not configured')
  }

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok || !data?.id) {
    throw new HttpError(401, data?.msg || data?.message || 'Invalid authorization token')
  }

  return data
}

async function deleteSupabaseRows(tableName, query) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${tableName}?${query}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=minimal',
    },
  })

  if (!response.ok && response.status !== 404) {
    const message = await response.text().catch(() => '')
    const normalized = message.toLowerCase()
    if (!normalized.includes('could not find the table') && !normalized.includes('schema cache')) {
      throw new HttpError(response.status, `Could not delete ${tableName}`, message)
    }
  }
}

async function handleDeleteAccount(req, res) {
  const user = await readCurrentSupabaseUser(req)
  const encodedUserId = encodeURIComponent(user.id)

  await deleteSupabaseRows('images', `user_id=eq.${encodedUserId}`)
  await deleteSupabaseRows('image_history', `user_id=eq.${encodedUserId}`)
  await deleteSupabaseRows('restored_images', `user_id=eq.${encodedUserId}`)
  await deleteSupabaseRows('profiles', `id=eq.${encodedUserId}`)

  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/admin/users/${encodedUserId}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new HttpError(response.status, data?.msg || data?.message || 'Could not delete auth user')
  }

  return sendJson(res, 200, { ok: true })
}

async function readJson(req) {
  const chunks = []

  for await (const chunk of req) {
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function imageDataURLToUpload(imageDataURL) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(imageDataURL || '')

  if (!match) {
    throw new Error('imageDataURL must be a base64 data image')
  }

  const [, mimeType, encoded] = match
  const extension = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
  const buffer = Buffer.from(encoded, 'base64')

  return {
    blob: new Blob([buffer], { type: mimeType }),
    filename: `upload.${extension}`,
  }
}

async function imageUrlToDataURL(imageUrl) {
  const response = await fetch(imageUrl)

  if (!response.ok) {
    throw new Error(`Could not read model output image (${response.status})`)
  }

  const mimeType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

async function forwardToFlaskColorizer(payload) {
  const upload = imageDataURLToUpload(payload.imageDataURL)
  const form = new FormData()
  form.append('image', upload.blob, upload.filename)

  const response = await fetch(MODEL_ENDPOINT, {
    method: 'POST',
    body: form,
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Model endpoint failed with ${response.status}`)
  }

  const outputPath = data.colorized || data.output || data.download
  if (!outputPath) {
    throw new Error('Model response did not include a colorized image path')
  }

  const outputUrl = new URL(outputPath, MODEL_ENDPOINT).href
  const outputDataURL = await imageUrlToDataURL(outputUrl)

  return {
    maskDataURL: outputDataURL,
    outputImageDataURL: outputDataURL,
    resolution: data.resolution || 'original',
    modelId: payload.modelId || 'unet',
    mode: data.mode,
    status: 'ok',
  }
}

async function forwardToModel(payload) {
  if (!MODEL_ENDPOINT) return null

  if (MODEL_ENDPOINT.endsWith('/colorize')) {
    return forwardToFlaskColorizer(payload)
  }

  const response = await fetch(MODEL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.message || `Model endpoint failed with ${response.status}`)
  }

  return data
}

function createDemoInference(payload) {
  if (!payload.imageDataURL?.startsWith('data:image/')) {
    throw new Error('imageDataURL must be a base64 data image')
  }

  return {
    maskDataURL: payload.imageDataURL,
    resolution: 'backend demo',
    modelId: payload.modelId || 'unet',
    status: 'demo',
    message: 'Set MODEL_ENDPOINT to forward inference to your real model service.',
  }
}

async function handleSegment(req, res) {
  const payload = await readJson(req)
  const modelOutput = await forwardToModel(payload)
  sendJson(res, 200, modelOutput || createDemoInference(payload))
}

async function handlePaymentCreate(req, res) {
  const payload = await readJson(req)
  const payment = await createPayment(payload)

  sendJson(res, 200, payment)
}

async function handlePaymentStatus(req, res, url) {
  const orderId = url.searchParams.get('orderId')
  if (!orderId) {
    return sendJson(res, 400, { message: 'orderId is required' })
  }

  sendJson(res, 200, getPaymentStatus(orderId))
}

async function handlePaymentWebhookRequest(req, res) {
  const payload = await readJson(req)
  const order = await handlePaymentWebhook(payload)

  sendJson(res, 200, {
    received: true,
    orderId: order.order_id,
    status: order.status,
  })
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)

    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, {})
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, modelEndpoint: Boolean(MODEL_ENDPOINT) })
    }

    if (req.method === 'POST' && url.pathname === '/api/segment') {
      return await handleSegment(req, res)
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/create') {
      return await handlePaymentCreate(req, res)
    }

    if (req.method === 'GET' && url.pathname === '/api/payments/status') {
      return await handlePaymentStatus(req, res, url)
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/webhook') {
      return await handlePaymentWebhookRequest(req, res)
    }

    if (req.method === 'DELETE' && url.pathname === '/api/account') {
      return await handleDeleteAccount(req, res)
    }

    return sendJson(res, 404, { message: 'Not found' })
  } catch (error) {
    const status = error.status || 500
    return sendJson(res, status, {
      message: error.message || 'Internal server error',
      ...(error.details ? { details: error.details } : {}),
    })
  }
})

server.listen(PORT, () => {
  console.log(`Model backend listening on http://localhost:${PORT}`)
  if (MODEL_ENDPOINT) {
    console.log(`Forwarding inference to ${MODEL_ENDPOINT}`)
  }
})
