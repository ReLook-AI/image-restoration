export const PLANS = [
  { id: 'free', name: 'Free', price: 0, features: '1 GB - 5 images/day', popular: false },
  { id: 'basic', name: 'ðŸŒ± Starter', price: 9, features: '5 GB â€¢ 50 images/day', popular: false },
  { id: 'pro', name: 'âš¡ Professional', price: 19, features: '50 GB â€¢ Unlimited images', popular: true },
  { id: 'ent', name: 'ðŸ¢ Enterprise', price: 49, features: 'âˆž â€¢ API + 24/7 Support', popular: false },
]

export function fmt(n) {
  return `$${n.toFixed(2)}`
}
