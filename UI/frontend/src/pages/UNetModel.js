import { API_BASE_URL } from './UNetConstants'

const MODEL_API_URL = import.meta.env.VITE_MODEL_API_URL || `${API_BASE_URL}/api/segment`

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
