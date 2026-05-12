import './load-env.js'
import http from 'node:http'
import Busboy from 'busboy'
import { createPayment, getPaymentStatus } from './payments/payment-service.js'
import { handlePaymentWebhook } from './payments/webhook-handler.js'

const PORT = Number(process.env.PORT || 8000)
const MODEL_ENDPOINT = process.env.MODEL_ENDPOINT || ''
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

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

function validateImageSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8
      && buffer[0] === 0x89
      && buffer[1] === 0x50
      && buffer[2] === 0x4e
      && buffer[3] === 0x47
      && buffer[4] === 0x0d
      && buffer[5] === 0x0a
      && buffer[6] === 0x1a
      && buffer[7] === 0x0a
  }

  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3
      && buffer[0] === 0xff
      && buffer[1] === 0xd8
      && buffer[buffer.length - 2] === 0xff
      && buffer[buffer.length - 1] === 0xd9
  }

  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP'
  }

  return false
}

function parseImageUpload(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || ''

    if (!contentType.includes('multipart/form-data')) {
      reject(new HttpError(415, 'Content-Type must be multipart/form-data'))
      return
    }

    const fields = {}
    let uploadedFile = null
    let uploadError = null

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_IMAGE_UPLOAD_SIZE,
        files: 1,
        fields: 10,
      },
    })

    busboy.on('field', (name, value) => {
      fields[name] = value
    })

    busboy.on('file', (_name, file, info) => {
      const mimeType = info.mimeType
      const filename = info.filename || 'upload'
      const chunks = []

      if (uploadedFile) {
        uploadError = new HttpError(400, 'Only one image file can be uploaded')
        file.resume()
        return
      }

      if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
        uploadError = new HttpError(415, 'Only PNG, JPEG, and WebP image uploads are supported')
        file.resume()
        return
      }

      file.on('data', chunk => chunks.push(chunk))
      file.on('limit', () => {
        uploadError = new HttpError(413, 'Image upload is too large. Maximum size is 10MB.')
        file.resume()
      })
      file.on('error', error => {
        uploadError = new HttpError(400, 'Could not read uploaded image', error.message)
      })
      file.on('end', () => {
        if (uploadError) return

        const buffer = Buffer.concat(chunks)
        if (!validateImageSignature(buffer, mimeType)) {
          uploadError = new HttpError(400, 'Uploaded file content does not match its image type')
          return
        }

        uploadedFile = {
          buffer,
          filename,
          mimeType,
          size: buffer.length,
        }
      })
    })

    busboy.on('filesLimit', () => {
      uploadError = new HttpError(400, 'Only one image file can be uploaded')
    })

    busboy.on('error', error => {
      reject(new HttpError(400, 'Invalid multipart upload', error.message))
    })

    busboy.on('finish', () => {
      if (uploadError) {
        reject(uploadError)
        return
      }

      if (!uploadedFile) {
        reject(new HttpError(400, 'Image file is required in field "image"'))
        return
      }

      resolve({ fields, file: uploadedFile })
    })

    req.pipe(busboy)
  })
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

function buildGeminiPrompt(mode, userPrompt) {
  const trimmedPrompt = userPrompt?.trim()

  if (mode === 'style') {
    if (!trimmedPrompt) {
      throw new HttpError(400, 'Prompt is required when mode is "style"')
    }

    return [
      'Edit the uploaded image according to this style request.',
      `Style request: ${trimmedPrompt}`,
      'Preserve the main subject, composition, and identity unless the request explicitly says otherwise.',
      'Return the edited image.',
    ].join('\n')
  }

  return [
    'Enhance the uploaded image so it looks clearer, sharper, and higher definition.',
    'Reduce noise and blur, improve local contrast and detail, and keep the main content unchanged.',
    trimmedPrompt ? `Additional user preference: ${trimmedPrompt}` : '',
    'Return the enhanced image.',
  ].filter(Boolean).join('\n')
}

function extractGeminiImage(responseData) {
  const parts = responseData?.candidates?.[0]?.content?.parts || responseData?.parts || []
  const imagePart = parts.find(part => part.inlineData?.data || part.inline_data?.data)
  const inlineData = imagePart?.inlineData || imagePart?.inline_data

  if (!inlineData?.data) {
    const text = parts.map(part => part.text).filter(Boolean).join(' ').trim()
    throw new HttpError(502, 'Gemini did not return an edited image', text || undefined)
  }

  return {
    base64: inlineData.data,
    mimeType: inlineData.mimeType || inlineData.mime_type || 'image/png',
  }
}

function createGeminiError(response, data) {
  const details = data?.error?.message || `HTTP ${response.status}`
  const normalized = details.toLowerCase()

  if (normalized.includes('quota') || normalized.includes('rate-limit') || normalized.includes('rate limits')) {
    return new HttpError(
      429,
      'Gemini AI quota is exhausted for this API key. Please add billing/quota in Google AI Studio or use another Gemini key.',
    )
  }

  if (normalized.includes('api key') || normalized.includes('permission_denied') || normalized.includes('unauthorized')) {
    return new HttpError(
      401,
      'Gemini API key is missing or invalid. Please update GEMINI_API_KEY in backend secrets.',
    )
  }

  return new HttpError(502, 'Gemini API request failed', details)
}

async function enhanceImageWithGemini({ file, mode, prompt }) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new HttpError(500, 'GEMINI_API_KEY is not configured on the backend')
  }

  if (!['style', 'hd'].includes(mode)) {
    throw new HttpError(400, 'mode must be either "style" or "hd"')
  }

  const geminiPrompt = buildGeminiPrompt(mode, prompt)
  const response = await fetch(`${GEMINI_GENERATE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: geminiPrompt },
          {
            inlineData: {
              mimeType: file.mimeType,
              data: file.buffer.toString('base64'),
            },
          },
        ],
      }],
    }),
  })

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw createGeminiError(response, data)
  }

  const image = extractGeminiImage(data)
  return {
    status: 'ok',
    mode,
    model: GEMINI_IMAGE_MODEL,
    mimeType: image.mimeType,
    imageBase64: image.base64,
    imageDataURL: `data:${image.mimeType};base64,${image.base64}`,
  }
}

async function handleImageEnhance(req, res) {
  const { fields, file } = await parseImageUpload(req)
  const mode = fields.mode || 'hd'
  const result = await enhanceImageWithGemini({
    file,
    mode,
    prompt: fields.prompt || '',
  })

  sendJson(res, 200, result)
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

    if (req.method === 'POST' && url.pathname === '/api/image/enhance') {
      return await handleImageEnhance(req, res)
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
