import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth'

// Palette DSFR (Design System de l'État français) — Planet Traduction France
const BLEU_MARIANNE = '#000091'
const BLEU_DEEP = '#00006B'
const BLEU_LIGHT = '#0A76F6'
const ROUGE_MARIANNE = '#E1000F'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const year = new Date().getFullYear()

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      {/* ---------- Colonne gauche : hero identité PTF ---------- */}
      <aside
        className="relative flex flex-col justify-between text-white overflow-hidden
                   px-8 py-10 lg:px-14 lg:py-14
                   lg:w-[38%] lg:min-h-screen"
        style={{
          background: `linear-gradient(135deg, ${BLEU_DEEP} 0%, ${BLEU_MARIANNE} 55%, ${BLEU_LIGHT} 100%)`,
        }}
      >
        {/* Bandeau tricolore (filigrane haut) */}
        <div className="absolute top-0 left-0 right-0 h-1 flex">
          <div className="flex-1" style={{ background: BLEU_MARIANNE }} />
          <div className="flex-1 bg-white" />
          <div className="flex-1" style={{ background: ROUGE_MARIANNE }} />
        </div>

        {/* Motifs décoratifs discrets */}
        <div
          className="absolute -right-24 -top-24 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}
        />
        <div
          className="absolute -left-16 -bottom-16 w-72 h-72 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }}
        />

        {/* Bloc identité */}
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-white/15 backdrop-blur border border-white/25">
              <span className="text-white font-extrabold text-sm tracking-tight">PTF</span>
            </div>
            <div className="leading-tight">
              <div className="text-xs uppercase tracking-[0.18em] text-white/80">
                Planet Traduction
              </div>
              <div className="text-sm font-semibold tracking-wide">France</div>
            </div>
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-none">
            AMI<span className="text-white/70 font-light">–</span>PTF
          </h1>
          <p className="mt-3 text-white/85 text-base lg:text-lg font-medium">
            Assistance Missions Interprètes
          </p>
          <div className="mt-6 h-[2px] w-16 bg-white/40 rounded-full" />
          <p className="mt-6 max-w-md text-white/80 text-sm leading-relaxed">
            La plateforme métier de{' '}
            <strong className="text-white">Planet Traduction France</strong> pour piloter vos
            missions d'interprétariat : clients, interprètes, devis, factures et statistiques —
            dans une interface unique.
          </p>
        </div>

        {/* Pied colonne gauche */}
        <div className="relative mt-10 text-xs text-white/70 flex flex-col gap-1">
          <span>© {year} Planet Traduction France — Tous droits réservés</span>
          <span className="text-white/50">Version AMI-PTF · Interface professionnelle</span>
        </div>
      </aside>

      {/* ---------- Colonne droite : formulaire ---------- */}
      <main className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16 bg-[#F6F7FB]">
        <div className="w-full max-w-md">
          {/* Marque compacte (mobile only) */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                style={{ background: BLEU_MARIANNE }}
              >
                PTF
              </div>
              <span className="text-gray-900 font-bold text-lg">AMI-PTF</span>
            </div>
          </div>

          {/* Carte formulaire */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 lg:p-10">
            <div className="mb-7">
              <h2 className="text-xl font-bold text-gray-900">Connexion à votre espace</h2>
              <p className="text-sm text-gray-500 mt-1">
                Identifiez-vous pour accéder à AMI-PTF.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2 p-3 rounded-lg border text-sm"
                style={{ background: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}
              >
                <span
                  aria-hidden
                  className="inline-block w-1 rounded-full self-stretch"
                  style={{ background: ROUGE_MARIANNE }}
                />
                <span className="pt-0.5">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="login-username"
                  className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide"
                >
                  Identifiant
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  spellCheck={false}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-[#F9FAFB] border border-gray-200
                             text-gray-900 placeholder:text-gray-400
                             focus:outline-none focus:bg-white
                             focus:ring-2 transition"
                  style={{
                    ['--tw-ring-color' as string]: `${BLEU_MARIANNE}40`,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = BLEU_MARIANNE)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                  placeholder="prenom.nom"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full px-3.5 py-2.5 pr-20 rounded-lg text-sm bg-[#F9FAFB] border border-gray-200
                               text-gray-900 placeholder:text-gray-400
                               focus:outline-none focus:bg-white
                               focus:ring-2 transition"
                    style={{
                      ['--tw-ring-color' as string]: `${BLEU_MARIANNE}40`,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = BLEU_MARIANNE)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '')}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-gray-500 hover:text-gray-800"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                    }
                  >
                    {showPassword ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white font-semibold text-sm
                           transition-all disabled:opacity-60 disabled:cursor-not-allowed
                           hover:brightness-110 active:brightness-95
                           focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{
                  background: `linear-gradient(135deg, ${BLEU_MARIANNE}, ${BLEU_LIGHT})`,
                  boxShadow: '0 1px 2px rgba(0,0,145,0.15)',
                }}
              >
                {loading ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                        opacity="0.25"
                      />
                      <path
                        d="M4 12a8 8 0 018-8"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    Connexion en cours…
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                Un problème d'accès ? Contactez l'administrateur de Planet Traduction France.
              </p>
            </div>
          </div>

          <p className="lg:hidden text-center text-gray-400 text-xs mt-6">
            © {year} Planet Traduction France · AMI-PTF
          </p>
        </div>
      </main>
    </div>
  )
}
