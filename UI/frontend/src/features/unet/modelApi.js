import { buildApiUrl } from '../../services/apiConfig'

const MODEL_API_URL = import.meta.env.VITE_MODEL_API_URL || buildApiUrl('/api/segment')
const IMAGE_ENHANCE_API_URL = import.meta.env.VITE_IMAGE_ENHANCE_API_URL || buildApiUrl('/api/image/enhance')

function dataURLToBlob(imageDataURL) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(imageDataURL || '')

  if (!match) {
    throw new Error('Please upload a supported image before running Gemini AI.')
  }

  const [, mimeType, encoded] = match
  const byteString = atob(encoded)
  const bytes = new Uint8Array(byteString.length)

  for (let i = 0; i < byteString.length; i += 1) {
    bytes[i] = byteString.charCodeAt(i)
  }

  return new Blob([bytes], { type: mimeType })
}

function normalizeGeminiError(data, fallbackStatus) {
  const rawMessage = [data?.message, data?.details].filter(Boolean).join(' ')
  const lowerMessage = rawMessage.toLowerCase()

  if (lowerMessage.includes('quota') || lowerMessage.includes('rate-limit') || lowerMessage.includes('rate limits')) {
    return 'Gemini AI quota is exhausted for this API key. Please add billing/quota in Google AI Studio or use another Gemini key, then try Run AI again.'
  }

  if (lowerMessage.includes('api key') || lowerMessage.includes('permission_denied') || lowerMessage.includes('unauthorized')) {
    return 'Gemini API key is missing or invalid. Please update GEMINI_API_KEY in Hugging Face Space secrets.'
  }

  return data?.message || `Gemini request failed with HTTP ${fallbackStatus}`
}

export async function callModelAPI(imageDataURL, modelId, params) {
  const response = await fetch(MODEL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataURL, modelId, params }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.message || 'Model inference failed')
  }

  return {
    maskDataURL: data.maskDataURL || data.outputImageDataURL || data.imageDataURL,
    resolution: data.resolution || '256x256',
  }
}

export async function callImageEnhanceAPI(imageDataURL, { mode = 'hd', prompt = '' } = {}) {
  const formData = new FormData()
  const imageBlob = dataURLToBlob(imageDataURL)
  const extension = imageBlob.type === 'image/jpeg' ? 'jpg' : imageBlob.type.split('/')[1] || 'png'

  formData.append('image', imageBlob, `upload.${extension}`)
  formData.append('mode', mode)
  if (prompt.trim()) {
    formData.append('prompt', prompt.trim())
  }

  const response = await fetch(IMAGE_ENHANCE_API_URL, {
    method: 'POST',
    body: formData,
  })

  const responseText = await response.text()
  let data = {}

  try {
    data = responseText ? JSON.parse(responseText) : {}
  } catch {
    data = { message: responseText }
  }

  if (!response.ok) {
    throw new Error(normalizeGeminiError(data, response.status))
  }

  return {
    maskDataURL: data.imageDataURL || `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`,
    resolution: mode === 'hd' ? 'Gemini HD' : 'Gemini Style',
    modelId: data.model,
    mode: data.mode,
  }
}
