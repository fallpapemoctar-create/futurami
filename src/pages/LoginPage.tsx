import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('login.php', { login: username, password })
      if (data.success && data.user) {
        const u = data.user
        const rights: string[] = Array.isArray(data.rights) ? data.rights : []
        const isAdmin = rights.includes('admin') || Boolean(u.admin || u.is_admin)
        setAuth(
          {
            id: String(u.id ?? u.rowid ?? ''),
            username: u.username ?? u.login ?? username,
            prenom: u.prenom ?? u.firstname ?? '',
            nom: u.nom ?? u.lastname ?? '',
            fullName: u.fullName ?? (`${u.prenom ?? ''} ${u.nom ?? ''}`.trim() || username),
            isAdmin,
            canManageInterpreters: isAdmin || rights.includes('manage_interpreters'),
            canManageMissions: isAdmin || rights.includes('manage_missions'),
          },
          data.token ?? 'session'
        )
        navigate('/', { replace: true })
      } else {
        setError(data.error ?? data.message ?? 'Identifiants incorrects.')
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string; message?: string } } })
        .response?.data?.error
      setError(msg ?? 'Erreur de connexion au serveur.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #000091 0%, #003189 50%, #0a76f6 100%)' }}
    >
      <div className="w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
            <img
              src="/assets/logo.png"
              alt="AMI"
              className="w-10 h-10 object-contain"
              onError={(e) => {
                const t = e.currentTarget
                t.style.display = 'none'
                t.nextElementSibling?.classList.remove('hidden')
              }}
            />
            <span className="text-white font-bold text-xl hidden">AMI</span>
          </div>
          <h1 className="text-white text-2xl font-bold">AMI</h1>
          <p className="text-blue-200 text-sm mt-1">Assistance Missions Interprètes</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-gray-800 text-lg font-semibold mb-6">Connexion</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Identifiant
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="Votre identifiant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #000091, #0a76f6)' }}
            >
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>
        </div>

        <p className="text-center text-blue-200 text-xs mt-6">Planet Traduction</p>
      </div>
    </div>
  )
}
