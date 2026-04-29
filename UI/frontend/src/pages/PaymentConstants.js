export const PLANS = [
  { id: 'free',  name: 'Free',            price: 0,   features: '1 GB - 5 images/day',   popular: false },
  { id: 'basic', name: '🌱 Starter',      price: 9,   features: '5 GB • 50 images/day',  popular: false },
  { id: 'pro',   name: '⚡ Professional', price: 19,  features: '50 GB • Unlimited images', popular: true  },
  { id: 'ent',   name: '🏢 Enterprise',   price: 49,  features: '∞ • API + 24/7 Support', popular: false },
]

export function fmt(n) { 
  return `$${n.toFixed(2)}` 
}
