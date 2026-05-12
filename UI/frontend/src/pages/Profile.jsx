import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Footer } from '../components/HomeComponents'
import { supabase } from '../services/supabaseClient'

const HISTORY_TABLE_CANDIDATES = ['restored_images', 'image_history', 'images']

function isMissingTableError(error) {
  const message = String(error?.message || '').toLowerCase()
  return (
    error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('does not exist') ||
    message.includes('schema cache')
  )
}

function formatDate(value) {
  if (!value) return 'Unknown date'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getDisplayName(user, profile) {
  const firstLast = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  return (
    profile?.display_name ||
    firstLast ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'ReLook user'
  )
}

function getAvatarUrl(user, profile) {
  return (
    profile?.avatar_url ||
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    ''
  )
}

function normalizeHistoryItem(row) {
  return {
    ...row,
    restoredUrl: row.restored_image_url || row.image_url || row.output_image_url || row.result_url || '',
    originalUrl: row.original_image_url || row.input_image_url || '',
    status: row.status || 'completed',
  }
}

function ProfileSkeleton() {
  return (
    <div className="profile-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="profile-history-card skeleton-card" key={index}>
          <div className="profile-skeleton skeleton-image" />
          <div className="profile-skeleton skeleton-line" />
          <div className="profile-skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  )
}

export default function Profile() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [historyTable, setHistoryTable] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [itemToDelete, setItemToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const displayName = useMemo(() => getDisplayName(user, profile), [user, profile])
  const avatarUrl = useMemo(() => getAvatarUrl(user, profile), [user, profile])

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      setLoading(true)
      setError('')

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const currentUser = sessionData?.session?.user

      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }

      if (!currentUser) {
        setUser(null)
        setLoading(false)
        return
      }

      setUser(currentUser)

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (!mounted) return
      setProfile(profileData || null)

      let lastError = null
      for (const tableName of HISTORY_TABLE_CANDIDATES) {
        const { data, error: historyError } = await supabase
          .from(tableName)
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false })

        if (!mounted) return

        if (!historyError) {
          setHistoryTable(tableName)
          setHistory((data || []).map(normalizeHistoryItem).filter(item => item.restoredUrl))
          setLoading(false)
          return
        }

        lastError = historyError
      }

      if (isMissingTableError(lastError)) {
        setHistoryTable('')
        setHistory([])
      } else {
        setError(lastError?.message || 'Could not load restored image history.')
      }
      setLoading(false)
    }

    loadProfile()

    return () => {
      mounted = false
    }
  }, [])

  async function confirmDelete() {
    if (!itemToDelete || !historyTable) return

    const previousHistory = history
    setDeleting(true)
    setHistory(current => current.filter(item => item.id !== itemToDelete.id))

    const { error: deleteError } = await supabase
      .from(historyTable)
      .delete()
      .eq('id', itemToDelete.id)
      .eq('user_id', user.id)

    if (deleteError) {
      setHistory(previousHistory)
      setNotice('')
      setError(deleteError.message)
    } else {
      setError('')
      setNotice('History item deleted.')
    }

    setDeleting(false)
    setItemToDelete(null)
  }

  if (!loading && !user) {
    return (
      <>
        <Navbar />
        <main className="profile-page">
          <section className="profile-empty auth-required">
            <i className="bi bi-person-lock"></i>
            <h1>Sign in required</h1>
            <p>Please sign in to view your profile and restored image history.</p>
            <Link to="/login" className="btn btn-primary">Sign In</Link>
          </section>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="profile-page">
        <section className="profile-hero">
          <div className="profile-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt={`${displayName} avatar`} />
            ) : (
              <span>{displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </div>

          <div className="profile-identity">
            <span className="profile-kicker">User profile</span>
            <h1>{displayName}</h1>
            <p>{user?.email || profile?.email || 'No email available'}</p>
          </div>

          <div className="profile-meta-card">
            <span>Account created</span>
            <strong>{formatDate(profile?.created_at || user?.created_at)}</strong>
          </div>
        </section>

        <section className="profile-section">
          <div className="profile-section-header">
            <div>
              <span className="profile-kicker">Gallery</span>
              <h2>Restored Image History</h2>
            </div>
            {historyTable && <span className="profile-table-badge">{historyTable}</span>}
          </div>

          {notice && <div className="profile-alert success">{notice}</div>}
          {error && <div className="profile-alert error">{error}</div>}

          {loading ? (
            <ProfileSkeleton />
          ) : history.length === 0 && !error ? (
            <div className="profile-empty">
              <i className="bi bi-images"></i>
              <h3>No restored images yet</h3>
              <p>Your restored image history will appear here after you process images.</p>
              <Link to="/app" className="btn btn-primary">Open Restoration Studio</Link>
            </div>
          ) : (
            <div className="profile-grid">
              {history.map(item => (
                <article className="profile-history-card" key={item.id}>
                  <div className="profile-image-pair">
                    {item.originalUrl && (
                      <figure>
                        <img src={item.originalUrl} alt="Original upload" />
                        <figcaption>Original</figcaption>
                      </figure>
                    )}
                    <figure className="restored">
                      <img src={item.restoredUrl} alt="Restored result" />
                      <figcaption>Restored</figcaption>
                    </figure>
                  </div>

                  <div className="profile-card-body">
                    <div>
                      <span className={`profile-status ${String(item.status).toLowerCase()}`}>
                        {item.status}
                      </span>
                      <p>{formatDate(item.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      className="profile-delete-btn"
                      onClick={() => setItemToDelete(item)}
                      aria-label="Delete history item"
                    >
                      <i className="bi bi-trash3"></i>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {itemToDelete && (
        <div className="profile-modal-backdrop" role="presentation">
          <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="delete-history-title">
            <h3 id="delete-history-title">Delete history item?</h3>
            <p>This removes the restored image record from your history.</p>
            <div className="profile-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setItemToDelete(null)} disabled={deleting}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  )
}
