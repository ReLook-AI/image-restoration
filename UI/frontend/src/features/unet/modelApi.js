import { buildApiUrl } from '../../services/apiConfig'

const MODEL_API_URL = import.meta.env.VITE_MODEL_API_URL || buildApiUrl('/api/segment')

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

  const maskDataURL = data.maskDataURL || data.outputImageDataURL || data.imageDataURL

  return {
    maskDataURL,
    resolution: data.resolution || '256x256',
    colorStyle: data.colorStyle || params?.colorStyle || 'natural',
  }
}
