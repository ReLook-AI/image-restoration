import './load-env.js'
import http from 'node:http'
import { createPayment, getPaymentStatus } from './payments/payment-service.js'
import { handlePaymentWebhook } from './payments/webhook-handler.js'

const PORT = Number(process.env.PORT || 8000)
const MODEL_ENDPOINT = process.env.MODEL_ENDPOINT || ''

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(data))
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
      return handleSegment(req, res)
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/create') {
      return handlePaymentCreate(req, res)
    }

    if (req.method === 'GET' && url.pathname === '/api/payments/status') {
      return handlePaymentStatus(req, res, url)
    }

    if (req.method === 'POST' && url.pathname === '/api/payments/webhook') {
      return handlePaymentWebhookRequest(req, res)
    }

    return sendJson(res, 404, { message: 'Not found' })
  } catch (error) {
    return sendJson(res, 500, { message: error.message || 'Internal server error' })
  }
})

server.listen(PORT, () => {
  console.log(`Model backend listening on http://localhost:${PORT}`)
  if (MODEL_ENDPOINT) {
    console.log(`Forwarding inference to ${MODEL_ENDPOINT}`)
  }
})
