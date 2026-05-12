import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Footer } from '../components/HomeComponents'
import { supabase } from '../services/supabaseClient'

const PLAN_OPTIONS = ['free', 'basic', 'pro', 'ent']
const STATUS_OPTIONS = ['active', 'expired', 'cancelled']
const ROLE_OPTIONS = ['user', 'admin']

function formatDate(value) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getDisplayName(profile) {
  const firstLast = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
  return profile?.display_name || firstLast || profile?.email?.split('@')[0] || 'Unnamed user'
}

function normalizeImage(row) {
  return {
    ...row,
    imageUrl: row.restored_image_url || row.image_url || row.output_image_url || '',
    originalUrl: row.original_image_url || row.input_image_url || '',
    status: row.status || 'completed',
  }
}

export default function Admin() {
  const [sessionUser, setSessionUser] = useState(null)
  const [adminProfile, setAdminProfile] = useState(null)
  const [users, setUsers] = useState([])
  const [images, setImages] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState('')
  const [deletingImageId, setDeletingImageId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isAdmin = adminProfile?.role === 'admin'

  const stats = useMemo(() => {
    const paidUsers = users.filter(user => user.current_plan && user.current_plan !== 'free').length
    const adminUsers = users.filter(user => user.role === 'admin').length
    const completedImages = images.filter(image => String(image.status).toLowerCase().includes('completed')).length

    return [
      { label: 'Users', value: users.length, icon: 'bi-people-fill' },
      { label: 'Paid users', value: paidUsers, icon: 'bi-credit-card-fill' },
      { label: 'Restored images', value: images.length, icon: 'bi-images' },
      { label: 'Completed', value: completedImages, icon: 'bi-check-circle-fill' },
      { label: 'Admins', value: adminUsers, icon: 'bi-shield-lock-fill' },
    ]
  }, [users, images])

  useEffect(() => {
    let mounted = true

    async function loadAdminData() {
      setLoading(true)
      setError('')

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      const currentUser = sessionData?.session?.user || null

      if (!mounted) return

      if (sessionError) {
        setError(sessionError.message)
        setLoading(false)
        return
      }

      setSessionUser(currentUser)

      if (!currentUser) {
        setLoading(false)
        return
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id,email,first_name,last_name,current_plan,plan_status,role,created_at')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (!mounted) return

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      setAdminProfile(profileData || null)

      if (profileData?.role !== 'admin') {
        setLoading(false)
        return
      }

      const [{ data: userRows, error: usersError }, { data: imageRows, error: imagesError }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,email,first_name,last_name,current_plan,plan_status,role,created_at,plan_started_at,plan_expires_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('restored_images')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(80),
      ])

      if (!mounted) return

      if (usersError) {
        setError(usersError.message)
      } else {
        setUsers(userRows || [])
      }

      if (imagesError) {
        setError(current => current || imagesError.message)
      } else {
        setImages((imageRows || []).map(normalizeImage).filter(image => image.imageUrl))
      }

      setLoading(false)
    }

    loadAdminData()

    return () => {
      mounted = false
    }
  }, [])

  async function updateUser(userId, patch) {
    setSavingUserId(userId)
    setError('')
    setNotice('')

    const previousUsers = users
    setUsers(current => current.map(user => user.id === userId ? { ...user, ...patch } : user))

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      setUsers(previousUsers)
      setError(updateError.message)
    } else {
      setNotice('User updated.')
    }

    setSavingUserId('')
  }

  async function deleteImage(imageId) {
    const confirmed = window.confirm('Delete this restored image record?')
    if (!confirmed) return

    setDeletingImageId(imageId)
    setError('')
    setNotice('')

    const previousImages = images
    setImages(current => current.filter(image => image.id !== imageId))

    const { error: deleteError } = await supabase
      .from('restored_images')
      .delete()
      .eq('id', imageId)

    if (deleteError) {
      setImages(previousImages)
      setError(deleteError.message)
    } else {
      setNotice('Image history item deleted.')
    }

    setDeletingImageId('')
  }

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <section className="admin-hero">
          <div>
            <span className="admin-kicker">Admin dashboard</span>
            <h1>ReLook-AI Control Center</h1>
            <p>Manage users, plans, restored images, and manual payment operations.</p>
          </div>
          <Link to="/" className="btn btn-outline">Back to site</Link>
        </section>

        {loading && (
          <section className="admin-state">
            <i className="bi bi-arrow-repeat"></i>
            <h2>Loading admin dashboard</h2>
          </section>
        )}

        {!loading && !sessionUser && (
          <section className="admin-state">
            <i className="bi bi-person-lock"></i>
            <h2>Sign in required</h2>
            <p>Please sign in with an admin account.</p>
            <Link to="/login" className="btn btn-primary">Sign in</Link>
          </section>
        )}

        {!loading && sessionUser && !isAdmin && (
          <section className="admin-state danger">
            <i className="bi bi-shield-exclamation"></i>
            <h2>Admin access required</h2>
            <p>Your account does not have admin permission yet.</p>
          </section>
        )}

        {!loading && isAdmin && (
          <>
            {(error || notice) && (
              <div className={`admin-alert ${error ? 'error' : 'success'}`}>
                {error || notice}
              </div>
            )}

            <nav className="admin-tabs" aria-label="Admin sections">
              {['overview', 'users', 'images', 'payments'].map(tab => (
                <button
                  type="button"
                  key={tab}
                  className={activeTab === tab ? 'active' : ''}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </nav>

            {activeTab === 'overview' && (
              <section className="admin-grid">
                {stats.map(stat => (
                  <article className="admin-stat-card" key={stat.label}>
                    <i className={`bi ${stat.icon}`}></i>
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </article>
                ))}
              </section>
            )}

            {activeTab === 'users' && (
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <h2>Users</h2>
                    <p>Manage roles, current plans, and account status.</p>
                  </div>
                </div>

                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Role</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id}>
                          <td>
                            <strong>{getDisplayName(user)}</strong>
                            <small>{user.email || user.id}</small>
                          </td>
                          <td>
                            <select
                              value={user.current_plan || 'free'}
                              disabled={savingUserId === user.id}
                              onChange={event => updateUser(user.id, { current_plan: event.target.value, plan_status: 'active', plan_started_at: new Date().toISOString() })}
                            >
                              {PLAN_OPTIONS.map(plan => <option key={plan} value={plan}>{plan}</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              value={user.plan_status || 'active'}
                              disabled={savingUserId === user.id}
                              onChange={event => updateUser(user.id, { plan_status: event.target.value })}
                            >
                              {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              value={user.role || 'user'}
                              disabled={savingUserId === user.id || user.id === sessionUser.id}
                              onChange={event => updateUser(user.id, { role: event.target.value })}
                            >
                              {ROLE_OPTIONS.map(role => <option key={role} value={role}>{role}</option>)}
                            </select>
                          </td>
                          <td>{formatDate(user.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === 'images' && (
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <h2>Restored images</h2>
                    <p>Review and remove restored image history records.</p>
                  </div>
                </div>

                {images.length ? (
                  <div className="admin-image-grid">
                    {images.map(image => (
                      <article className="admin-image-card" key={image.id}>
                        <img src={image.imageUrl} alt="Restored result" />
                        <div>
                          <span>{image.status}</span>
                          <strong>{formatDate(image.created_at)}</strong>
                          <small>{image.user_id}</small>
                          <button type="button" onClick={() => deleteImage(image.id)} disabled={deletingImageId === image.id}>
                            <i className="bi bi-trash3"></i>
                            {deletingImageId === image.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="admin-empty">No restored images found.</div>
                )}
              </section>
            )}

            {activeTab === 'payments' && (
              <section className="admin-panel">
                <div className="admin-panel-head">
                  <div>
                    <h2>Payments</h2>
                    <p>Manual payment review currently maps to user plan changes.</p>
                  </div>
                </div>
                <div className="admin-empty">
                  Payment orders are currently stored in backend memory, so they disappear when the backend restarts.
                  Use the Users tab to activate a plan after verifying VietQR or PayPal manually. A persistent payments table can be added next.
                </div>
              </section>
            )}
          </>
        )}
      </main>
      <Footer />
    </>
  )
}
