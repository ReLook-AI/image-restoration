import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
    <div className="profile-redesign-grid">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="profile-redesign-history-card skeleton-card" key={index}>
          <div className="profile-skeleton skeleton-image" />
          <div className="profile-skeleton skeleton-line" />
          <div className="profile-skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [history, setHistory] = useState([])
  const [historyTable, setHistoryTable] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [itemToDelete, setItemToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const displayName = useMemo(() => getDisplayName(user, profile), [user, profile])
  const avatarUrl = useMemo(() => getAvatarUrl(user, profile), [user, profile])
  const accountDate = formatDate(profile?.created_at || user?.created_at)
  const latestHistory = history.slice(0, 3)

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

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (!loading && !user) {
    return (
      <>
        <Navbar />
        <main className="profile-page profile-redesign-page">
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
      <main className="profile-page profile-redesign-page">
        <div className="profile-redesign-shell">
          <aside className="profile-redesign-sidebar">
            <div className="profile-redesign-user">
              <div className="profile-redesign-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={`${displayName} avatar`} />
                ) : (
                  <span>{displayName.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="profile-redesign-name">
                <h1>{displayName}</h1>
                <span>PHÁM NHÂN SƠ KỲ</span>
                <div className="profile-redesign-points">
                  <strong><i className="bi bi-fire"></i> {history.length * 20}</strong>
                  <strong><i className="bi bi-gem"></i> {Math.max(1050, history.length * 350)}</strong>
                </div>
              </div>
            </div>

            <nav className="profile-redesign-menu" aria-label="Profile sections">
              <button type="button" className="featured" onClick={() => setActiveTab('overview')}>
                <i className="bi bi-crown-fill"></i>
                <span>Đặc Quyền VIP</span>
                <i className="bi bi-chevron-right"></i>
              </button>
              <button type="button" onClick={() => setActiveTab('overview')}>
                <i className="bi bi-info-circle-fill"></i>
                <span>Thông Tin</span>
                <i className="bi bi-chevron-right"></i>
              </button>
              <button type="button" onClick={() => setActiveTab('history')}>
                <i className="bi bi-controller"></i>
                <span>Hoạt Động</span>
                <i className="bi bi-chevron-right"></i>
              </button>
              <button type="button" onClick={() => setActiveTab('achievements')}>
                <i className="bi bi-trophy-fill"></i>
                <span>Bảng Xếp Hạng</span>
                <i className="bi bi-chevron-right"></i>
              </button>
              <button type="button" onClick={() => setActiveTab('history')}>
                <i className="bi bi-clock-history"></i>
                <span>Lịch Sử Xem</span>
                <i className="bi bi-chevron-right"></i>
              </button>
            </nav>

            <button type="button" className="profile-redesign-logout" onClick={handleSignOut}>
              <i className="bi bi-box-arrow-right"></i>
              Đăng Xuất
            </button>
          </aside>

          <section className="profile-redesign-content">
            <div className="profile-redesign-tabs" role="tablist" aria-label="Profile tabs">
              <button type="button" className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
                Tổng Quan
              </button>
              <button type="button" className={activeTab === 'history' ? 'active' : ''} onClick={() => setActiveTab('history')}>
                Ảnh Đã Phục Hồi
              </button>
              <button type="button" className={activeTab === 'achievements' ? 'active' : ''} onClick={() => setActiveTab('achievements')}>
                Thành Tựu
              </button>
            </div>

            {notice && <div className="profile-alert success">{notice}</div>}
            {error && <div className="profile-alert error">{error}</div>}

            {activeTab === 'overview' && (
              <div className="profile-redesign-panel">
                <div className="profile-redesign-stats">
                  <article>
                    <span>Email</span>
                    <strong>{user?.email || profile?.email || 'No email available'}</strong>
                  </article>
                  <article>
                    <span>Account created</span>
                    <strong>{accountDate}</strong>
                  </article>
                  <article>
                    <span>Restored images</span>
                    <strong>{loading ? '...' : history.length}</strong>
                  </article>
                </div>

                <div className="profile-redesign-section-title">
                  <h2>Hoạt động gần đây</h2>
                  <button type="button" onClick={() => setActiveTab('history')}>Xem tất cả</button>
                </div>

                {loading ? (
                  <ProfileSkeleton />
                ) : latestHistory.length ? (
                  <HistoryGrid items={latestHistory} onDelete={setItemToDelete} />
                ) : (
                  <EmptyHistory />
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="profile-redesign-panel">
                <div className="profile-redesign-section-title">
                  <div>
                    <h2>Restored Image History</h2>
                    <p>Ảnh đã phục hồi của tài khoản hiện tại.</p>
                  </div>
                  {historyTable && <span className="profile-table-badge">{historyTable}</span>}
                </div>

                {loading ? (
                  <ProfileSkeleton />
                ) : history.length ? (
                  <HistoryGrid items={history} onDelete={setItemToDelete} />
                ) : (
                  <EmptyHistory />
                )}
              </div>
            )}

            {activeTab === 'achievements' && (
              <div className="profile-redesign-panel">
                <div className="profile-redesign-achievements">
                  <article>
                    <i className="bi bi-stars"></i>
                    <h3>Tân binh phục hồi ảnh</h3>
                    <p>Hoàn thành lần phục hồi ảnh đầu tiên.</p>
                  </article>
                  <article>
                    <i className="bi bi-lightning-charge-fill"></i>
                    <h3>Tốc độ ánh sáng</h3>
                    <p>Lưu lại các phiên xử lý gần nhất trong lịch sử.</p>
                  </article>
                  <article>
                    <i className="bi bi-gem"></i>
                    <h3>Nhà sưu tầm</h3>
                    <p>Càng nhiều ảnh phục hồi, điểm hồ sơ càng tăng.</p>
                  </article>
                </div>
              </div>
            )}
          </section>
        </div>
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

function EmptyHistory() {
  return (
    <div className="profile-empty profile-redesign-empty">
      <i className="bi bi-images"></i>
      <h3>No restored images yet</h3>
      <p>Your restored image history will appear here after you process images.</p>
      <Link to="/app" className="btn btn-primary">Open Restoration Studio</Link>
    </div>
  )
}

function HistoryGrid({ items, onDelete }) {
  return (
    <div className="profile-redesign-grid">
      {items.map(item => (
        <article className="profile-redesign-history-card" key={item.id}>
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
              onClick={() => onDelete(item)}
              aria-label="Delete history item"
            >
              <i className="bi bi-trash3"></i>
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
