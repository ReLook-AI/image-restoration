export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'https://JamesAT-ReLook-AI-Backend.hf.space'
).replace(/\/$/, '')

export const buildApiUrl = (path) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
