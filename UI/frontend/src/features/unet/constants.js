import { API_BASE_URL } from '../../services/apiConfig'

export { API_BASE_URL }

export const MODEL_REGISTRY = {
  unet: {
    name: 'Zhang et al. (Pre-trained)',
    params: 'Selectable Color Fill',
    arch: 'Image Colorization (Static Images)',
  },
}

export const COLOR_STYLES = [
  {
    id: 'natural',
    name: 'Natural',
    tone: 'Realistic color balance',
    icon: 'bi-brightness-high',
  },
  {
    id: 'vivid',
    name: 'Vivid',
    tone: 'Rich saturated fill',
    icon: 'bi-palette',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    tone: 'Warm soft film look',
    icon: 'bi-camera',
  },
]

export const PIPELINE_STEPS = [
  { pct: 5, label: 'Pre-processing image...', sub: 'Resizing to 256x256 & LAB color space' },
  { pct: 25, label: 'Extracting Features...', sub: 'Running Zhang et al. Encoder' },
  { pct: 55, label: 'Predicting Color Channels...', sub: 'Inferring A and B chrominance' },
  { pct: 80, label: 'Upsampling...', sub: 'Reconstructing spatial details' },
  { pct: 95, label: 'Color Fusion...', sub: 'Merging L channel with AB channels' },
  { pct: 100, label: 'Done!', sub: 'Colorization complete' },
]
