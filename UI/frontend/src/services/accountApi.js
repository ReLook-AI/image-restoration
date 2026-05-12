import { buildApiUrl } from './apiConfig'
import { supabase } from './supabaseClient'

export async function deleteCurrentAccount() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new Error('Please sign in again before deleting your account.')
  }

  const response = await fetch(buildApiUrl('/api/account'), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.message || 'Could not delete account.')
  }

  await supabase.auth.signOut()
  return body
}
