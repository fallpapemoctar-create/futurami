import { useEffect, useState } from 'react'
import { api } from './api'

// ─── Generic helpers ─────────────────────────────────────────────────────────

interface FetchState<T> {
  data: T
  loading: boolean
  error: string | null
  refetch: () => void
}

function useFetch<T>(initial: T, fetcher: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetcher()
      .then((r) => {
        if (!cancelled) {
          setData(r)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.response?.data?.message ?? e?.message ?? 'Erreur réseau')
          setData(initial)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { data, loading, error, refetch: () => setTick((t) => t + 1) }
}

// ─── Interprètes ─────────────────────────────────────────────────────────────

export interface UIInterpreter {
  id: string
  name: string
  languages: string
  phone?: string
  email?: string
  status: 'Disponible' | 'Indisponible'
  billing?: string
  raw?: RawInterpreter
}

export interface RawInterpreter {
  id: number | null
  numero: string | null
  display_name: string
  firstname: string
  lastname: string
  email: string | null
  tel_mobile: string | null
  tel_domicile: string | null
  langues_parlees: string | null
  adresse: string | null
  code_postal: string | null
  ville: string | null
  pays: string | null
  commentaires: string | null
  status: string
}

function mapInterpreter(raw: RawInterpreter): UIInterpreter {
  const name =
    raw.display_name ||
    [raw.lastname, raw.firstname].filter(Boolean).join(' ') ||
    raw.numero ||
    '—'
  return {
    id: String(raw.id ?? raw.numero ?? name),
    name,
    languages: raw.langues_parlees || '',
    phone: raw.tel_mobile || raw.tel_domicile || undefined,
    email: raw.email || undefined,
    status: raw.status === 'Indisponible' ? 'Indisponible' : 'Disponible',
    billing: raw.commentaires || undefined,
    raw,
  }
}

export function useInterpreters(q?: string) {
  return useFetch<UIInterpreter[]>(
    [],
    async () => {
      const res = await api.get('get_interpretes.php', { params: { q, limit: 10000 } })
      const list: RawInterpreter[] = Array.isArray(res.data) ? res.data : []
      return list.map(mapInterpreter)
    },
    [q ?? '']
  )
}

// ─── Clients (Tiers > Sociétés) ──────────────────────────────────────────────

export interface RawClient {
  id: number | null
  name: string
  alias: string
  address: string
  zip: string
  town: string
  phone: string
  fax: string
  email: string
  website: string
  siren: string
  siret: string
  note_private: string
  note_public: string
  fk_pays: number
  country_label: string
  fk_departement: number
  department_label: string
  status: number
}

export function useClients(opts: { q?: string; activeOnly?: boolean } = {}) {
  const { q, activeOnly } = opts
  return useFetch<RawClient[]>(
    [],
    async () => {
      const res = await api.get('get_clients.php', {
        params: { q, active_only: activeOnly ? '1' : undefined, limit: 0 },
      })
      return res.data?.clients ?? []
    },
    [q ?? '', activeOnly ?? false]
  )
}

// ─── Contacts ────────────────────────────────────────────────────────────────

export interface RawContact {
  id: number | null
  client_id: number | null
  civility: string
  firstname: string
  lastname: string
  email: string
  phone: string
  phone_perso: string
  phone_mobile: string
  fax: string
  birthday: string
  position: string
  address: string
  zip: string
  town: string
  fk_pays: number
  country_label: string
  fk_departement: number
  department_label: string
  note_public: string
  note_private: string
  status: number
}

export function useContacts(clientId: number | null) {
  return useFetch<RawContact[]>(
    [],
    async () => {
      if (!clientId) return []
      const res = await api.get('get_contacts.php', { params: { client_id: clientId } })
      return res.data?.contacts ?? []
    },
    [clientId ?? 0]
  )
}

// Vue transverse "Contacts" (toutes sociétés confondues) — utilisée par l'onglet
// Contacts de TiersPage. Distincte de useContacts(clientId) qui reste dédiée à la
// fiche détail d'une société (get_contacts.php exige un client_id).
export interface RawAllContact extends RawContact {
  company_name: string
}

export function useAllContacts(q?: string) {
  return useFetch<RawAllContact[]>(
    [],
    async () => {
      const res = await api.get('get_all_contacts.php', { params: { q, limit: 5000 } })
      return res.data?.contacts ?? []
    },
    [q ?? '']
  )
}

// ─── Missions (datatable, paginé serveur) ────────────────────────────────────

export interface RawMission {
  rowid: number
  reference_devis: string
  label: string
  client_id: number
  contact_id: number
  commentaires: string
  datemission: string | null
  heuredebutmission: string
  dureemission: number
  mission_status: number
  mission_types: string[]
  firstname: string | null
  lastname: string | null
  interpreter_name: string
  produit_ref: string
  produit_label: string
  client_name: string
  client_code: string
  client_address: string
  client_zip: string
  client_town: string
  // Personne demandeuse (contact rattaché au tiers via llx_socpeople.fk_soc)
  prenom_demandeur: string | null
  nom_demandeur: string | null
  phone: string | null
  phone_mobile: string | null
  billed_status: string | null
  client_billed_status: string | null
  client_billed_status_label: string | null
  client_invoice_number: string | null
  datemission_iso: string | null
}

export interface MissionsQuery {
  page?: number
  pageSize?: number
  q?: string
  dateStart?: string
  dateEnd?: string
  missionStatus?: string
  missionType?: string
  clientId?: number
}

export function useMissions(query: MissionsQuery) {
  const params = {
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
    q: query.q || undefined,
    dateStart: query.dateStart || undefined,
    dateEnd: query.dateEnd || undefined,
    missionStatus: query.missionStatus || undefined,
    missionType: query.missionType || undefined,
    clientId: query.clientId || undefined,
  }
  return useFetch<{ missions: RawMission[]; total: number; page: number; pageSize: number }>(
    { missions: [], total: 0, page: 1, pageSize: params.pageSize },
    async () => {
      const res = await api.get('get_missions_datatable.php', { params })
      return {
        missions: res.data?.missions ?? [],
        total: res.data?.total ?? 0,
        page: res.data?.page ?? params.page,
        pageSize: res.data?.pageSize ?? params.pageSize,
      }
    },
    [JSON.stringify(params)]
  )
}

// ─── Devis ───────────────────────────────────────────────────────────────────

export interface RawQuote {
  id: number
  client_id: number | null
  client_name: string
  mission_id: number | null
  month: string
  total_ht: number
  status: string
  date_valid_until: string
  notes: string
  sent_at: string | null
  converted_invoice_number: string | null
  created_at: string
  updated_at: string
  mission_ref: string | null
}

export function useQuotes(opts: { status?: string; clientId?: number; page?: number; pageSize?: number } = {}) {
  const params = {
    status: opts.status || undefined,
    client_id: opts.clientId || undefined,
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 100,
  }
  return useFetch<{ quotes: RawQuote[]; total: number }>(
    { quotes: [], total: 0 },
    async () => {
      const res = await api.get('get_quotes.php', { params })
      return { quotes: res.data?.quotes ?? [], total: res.data?.total ?? 0 }
    },
    [JSON.stringify(params)]
  )
}

// ─── Factures (brouillons + émises) ──────────────────────────────────────────

export interface RawInvoiceDraft {
  draft_id: number
  client_id: number | null
  client_name: string
  month: string
  total_ht: number
  status: string
  payment_condition_id: number | null
  bank_account_id: number | null
  created_at: string
  updated_at: string
}

export function useInvoiceDrafts(opts: { status?: string; clientId?: number } = {}) {
  return useFetch<RawInvoiceDraft[]>(
    [],
    async () => {
      const res = await api.get('get_invoice_drafts.php', {
        params: { status: opts.status, client_id: opts.clientId },
      })
      return res.data?.drafts ?? []
    },
    [opts.status ?? '', opts.clientId ?? 0]
  )
}

export interface RawClientInvoice {
  invoice_number: string
  id: number
  category: string
  invoice_total_ht: number | null
  invoice_total_ttc: number | null
  amount_ht: number | null
  client_name: string
  mission_ref: string | null
  status_code: string
  status_label: string
  billed_at: string
  created_at: string
  updated_at: string
  period_month: string
}

export function useClientInvoices(opts: { page?: number; pageSize?: number; q?: string; status?: string } = {}) {
  const body = {
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 100,
    search: opts.q || undefined,
    status_code: opts.status || undefined,
  }
  return useFetch<{ invoices: RawClientInvoice[]; total: number }>(
    { invoices: [], total: 0 },
    async () => {
      const res = await api.post('get_client_invoices.php', body)
      return { invoices: res.data?.invoices ?? [], total: res.data?.total ?? 0 }
    },
    [JSON.stringify(body)]
  )
}

// ─── Société (Configuration) ─────────────────────────────────────────────────

export interface RawCompany {
  name: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  city: string
  siret: string
  phone: string
  email: string
  website: string
  logoUrl: string
  bankLabel: string
  bankName: string
  bankBic: string
  bankIban: string
  bankAccountHolder: string
}

export function useCompanyInfo() {
  return useFetch<RawCompany | null>(
    null,
    async () => {
      const res = await api.get('get_company_info.php')
      return res.data?.company ?? null
    }
  )
}

// ─── Utilisateurs (Admin) ────────────────────────────────────────────────────

export interface RawUser {
  id: number
  username: string
  fullname: string
  email: string
  can_manage_interpreters: boolean
  can_manage_missions: boolean
  is_interpreter: boolean
  is_admin: boolean
  is_active: boolean
}

export function useUsers() {
  return useFetch<RawUser[]>(
    [],
    async () => {
      const res = await api.get('admin/get_users.php')
      return res.data?.users ?? []
    }
  )
}

// ─── Référentiels (langues, pays, départements, conditions paiement, comptes bancaires) ─

export interface RefLanguage {
  id: number | null
  ref: string
  label: string
  display_name: string
  price?: number | null
  price_ttc?: number | null
  tva_tx?: number | null
}

export function useLanguages(q?: string) {
  return useFetch<RefLanguage[]>(
    [],
    async () => {
      const res = await api.get('get_languages.php', { params: { q, limit: 10000 } })
      return res.data?.languages ?? []
    },
    [q ?? '']
  )
}

export interface RefCountry {
  id: number
  label: string
  code: string
  code_iso: string
}

export function useCountries() {
  return useFetch<RefCountry[]>(
    [],
    async () => {
      const res = await api.get('get_countries.php')
      return Array.isArray(res.data) ? res.data : []
    }
  )
}

export interface RefDepartment {
  id: number
  label: string
  code: string
}

export function useDepartments() {
  return useFetch<RefDepartment[]>(
    [],
    async () => {
      const res = await api.get('get_departments.php')
      return Array.isArray(res.data) ? res.data : []
    }
  )
}

export interface RefPaymentTerm {
  id: number
  code: string
  label: string
  days: number
  shift: number
  isDefault: boolean
}

export function usePaymentTerms(clientId?: number | null) {
  return useFetch<{ terms: RefPaymentTerm[]; defaultId: number }>(
    { terms: [], defaultId: 0 },
    async () => {
      const res = await api.get('get_client_payment_terms.php', {
        params: { client_id: clientId ?? 0 },
      })
      return {
        terms: res.data?.paymentTerms ?? [],
        defaultId: res.data?.defaultTermId ?? 0,
      }
    },
    [clientId ?? 0]
  )
}

export interface RefBankAccount {
  id: number
  isDefault: boolean
  bankLabel: string
  bankName: string
  bankIban: string
  bankBic: string
  bankAccountHolder: string
  bankDomiciliation: string
}

export function useBankAccounts() {
  return useFetch<RefBankAccount[]>(
    [],
    async () => {
      const res = await api.get('get_company_bank_accounts.php')
      return res.data?.bankAccounts ?? []
    }
  )
}

// ─── Actions CRUD ────────────────────────────────────────────────────────────

export const crud = {
  // Interprètes
  saveInterpreter: (data: {
    id?: string | number
    lastname: string
    firstname: string
    email?: string
    tel_mobile?: string
    tel_domicile?: string
    langues_parlees?: string
    adresse?: string
    code_postal?: string
    ville?: string
    commentaires?: string
    status?: string
  }) => {
    const endpoint = data.id ? 'update_interprete.php' : 'add_interprete.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteInterpreter: (id: string | number) =>
    api.post('delete_interprete.php', { id }).then((r) => r.data),

  // Clients (Tiers > Sociétés)
  saveClient: (data: {
    id?: string | number
    name: string
    alias?: string
    address?: string
    zip?: string
    town?: string
    phone?: string
    fax?: string
    email?: string
    website?: string
    siren?: string
    siret?: string
    note_public?: string
    note_private?: string
    fk_pays?: number | string
  }) => {
    const endpoint = data.id ? 'update_client.php' : 'add_client.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteClient: (id: string | number) =>
    api.post('delete_client.php', { id }).then((r) => r.data),

  // Contacts
  saveContact: (data: {
    id?: string | number
    client_id: number
    civility?: string
    firstname?: string
    lastname: string
    email?: string
    phone?: string
    personal_phone?: string
    mobile?: string
    fax?: string
    position?: string
    birthday?: string
    address?: string
    zip?: string
    town?: string
    country_id?: number | string
    department_id?: number | string
    note_public?: string
    note_private?: string
    is_active?: 0 | 1
  }) => {
    const endpoint = data.id ? 'update_contact.php' : 'add_contact.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteContact: (id: string | number) =>
    api.post('delete_contact.php', { id }).then((r) => r.data),

  // Missions
  saveMission: (data: {
    id?: string | number
    interpreter_id?: number
    client_id?: number
    contact_id?: number
    reference_devis?: string
    label?: string
    datemission?: string
    heuredebutmission?: string
    dureemission?: string | number
    mission_status?: number
    mission_types?: string | string[]
    id_produit_service?: number
    commentaires?: string
  }) => {
    const endpoint = data.id ? 'update_mission_interpreter.php' : 'add_mission_interpreter.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteMission: (id: string | number) =>
    api.post('delete_mission_interpreter.php', { id }).then((r) => r.data),

  // Devis
  updateQuote: (data: {
    quote_id: number
    notes?: string
    date_valid_until?: string
    status?: string
    lines?: Array<{
      id?: number
      description: string
      quantity: number
      unit_price: number
      tva_rate: number
      discount?: number
      sort_order?: number
    }>
  }) => api.post('update_quote.php', data).then((r) => r.data),
  createQuoteFromMission: (mission_id: number, user_id?: number) =>
    api.post('create_quote_from_mission.php', { mission_id, user_id }).then((r) => r.data),
  // Création manuelle d'un devis (sans mission source) — appelée depuis la page
  // Devis, bouton « Nouveau devis ». mission_id = NULL côté BDD.
  createQuoteManual: (data: {
    client_id: number
    date_valid_until?: string
    month?: string
    notes?: string
    lines: Array<{
      description: string
      quantity: number
      unit_price: number
      tva_rate?: number
      discount?: number
    }>
  }) => api.post('add_quote.php', data).then((r) => r.data),
  convertQuoteToInvoice: (quote_id: number, opts: { user_id?: number; payment_condition_id?: number; bank_account_id?: number } = {}) =>
    api.post('convert_quote_to_invoice.php', { quote_id, ...opts }).then((r) => r.data),

  // Brouillons de factures
  saveInvoiceDraft: (data: {
    draft_id?: number
    client_id?: number
    client_name?: string
    month: string
    total_ht?: number
    payment_condition_id?: number
    bank_account_id?: number
  }) => api.post('save_invoice_draft.php', data).then((r) => r.data),
  saveInvoiceDraftLines: (data: {
    draft_id?: number
    draft_key?: string
    client_name: string
    period_month: string // "YYYY-MM-DD" (1er du mois) ou "YYYY-MM"
    user_id?: number
    user_name?: string
    lines: Array<{
      mission_id?: number
      mission_ref?: string
      designation: string
      quantity: number
      unit_price_ht: number
      total_ht?: number
      tva_rate?: number
      discount?: number
      notes?: string
      sort_order?: number
    }>
  }) => api.post('save_invoice_draft_lines.php', data).then((r) => r.data),
  deleteInvoiceDraft: (draft_id: number) =>
    api.post('delete_invoice_draft.php', { draft_id }).then((r) => r.data),

  // ─── Émission facture atomique (Phase 3) ────────────────────────────────
  /**
   * Ouvre l'aperçu PDF d'un brouillon de facture dans un nouvel onglet.
   *
   * NB : l'endpoint `preview_invoice_pdf.php` est protégé par JWT
   * (Authorization: Bearer …). Une simple `window.open(url)` ne peut PAS
   * envoyer d'en-tête personnalisé → réponse `missing_token`. On récupère
   * donc le PDF via axios (qui joint automatiquement le Bearer), puis on
   * l'affiche depuis un `blob:` URL local. Bonus : le token n'apparaît
   * jamais dans l'historique du navigateur ni les logs serveur.
   */
  previewInvoicePdf: async (draft_id: number): Promise<void> => {
    const res = await api.get('preview_invoice_pdf.php', {
      params: { draft_id },
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    // Le popup peut être bloqué : on tente un lien invisible en fallback.
    if (!win) {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
    }
    // Libération mémoire une fois le nouvel onglet chargé (60 s).
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },

  /**
   * Émet la facture définitive à partir d'un brouillon. Côté serveur :
   * réservation atomique du N°, génération PDF, INSERT en BDD et suppression
   * du brouillon dans une SEULE transaction PDO. Impossible d'obtenir deux
   * factures au même N° même en cas d'appels concurrents.
   */
  emitInvoice: (data: {
    draft_id: number
    user_id?: number
    user_name?: string
    notes?: string
    status?: 'draft' | 'validated' | 'sent'
  }) => api.post('emit_invoice.php', data).then((r) => r.data as {
    success: boolean
    invoice_number: string
    pdf_path: string
    pdf_filename: string
    pdf_size: number
    total_ht: number
    status_code: string
    status_label: string
  }),

  // Statuts de facturation client
  updateClientInvoiceStatus: (data: {
    invoice_number: string
    status: string
    status_label?: string
    user_id?: number
    user_name?: string
  }) => api.post('update_client_invoice_status.php', data).then((r) => r.data),

  updateInvoiceDate: (data: { invoice_number: string; invoice_date: string }) =>
    api.post('update_invoice_date.php', data).then((r) => r.data),

  updateInvoiceBankAccount: (data: { invoice_number: string; bank_account_id: number }) =>
    api.post('update_invoice_bank_account.php', data).then((r) => r.data),

  updateInvoicePaymentTerm: (data: { invoice_number: string; payment_condition_id: number }) =>
    api.post('update_invoice_payment_term.php', data).then((r) => r.data),

  // Avoirs (credit notes)
  createCreditNote: (data: {
    source_invoice_number: string
    mode: 'total' | 'partial'
    reason: string
    lines?: Array<{ source_line_id: number; quantity: number; unit_price_ht: number }>
    user_id?: number
    user_name?: string
    billed_at?: string
  }) => api.post('create_credit_note.php', data).then((r) => r.data),

  applyCreditNote: (data: {
    invoice_number: string
    credit_note_invoice_number: string
    amount?: number
    user_id?: number
    user_name?: string
  }) => api.post('apply_credit_note.php', data).then((r) => r.data),

  getAvailableCreditNotes: (clientId: number) =>
    api.get('get_available_credit_notes.php', { params: { client_id: clientId } }).then((r) => r.data),

  // Envoi email facture (stub serveur)
  sendInvoiceEmail: (data: {
    invoice_number: string
    to: string[]
    cc?: string[]
    subject?: string
    body?: string
    user_id?: number
    user_name?: string
  }) => api.post('send_invoice_email.php', data).then((r) => r.data),
  // Utilisateurs
  saveUser: (data: {
    id?: string | number
    username: string
    password?: string
    fullname?: string
    email?: string
    can_manage_interpreters?: boolean
    can_manage_missions?: boolean
    is_interpreter?: boolean
    is_admin?: boolean
  }) => {
    const endpoint = data.id ? 'admin/update_user.php' : 'admin/add_user.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteUser: (id: string | number) =>
    api.post('admin/delete_user.php', { id }).then((r) => r.data),

  // Référentiels — Langues / prestations (llx_product, scopées par entité)
  saveLanguage: (data: {
    id?: string | number
    ref?: string
    label: string
    price?: number
    price_ttc?: number
    tva_tx?: number
    fk_product_type?: number
  }) => {
    const endpoint = data.id ? 'update_language.php' : 'add_language.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteLanguage: (id: string | number) =>
    api.post('delete_language.php', { id }).then((r) => r.data),

  // Référentiels — Termes de paiement (llx_c_payment_term, scopés par entité)
  savePaymentTerm: (data: {
    id?: string | number
    code?: string
    label: string
    label_facture?: string
    days?: number
    shift?: number
    active?: boolean
  }) => {
    const endpoint = data.id ? 'update_payment_term.php' : 'add_payment_term.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deletePaymentTerm: (id: string | number) =>
    api.post('delete_payment_term.php', { id }).then((r) => r.data),

  // Référentiels — Comptes bancaires (llx_bank_account, scopés par entité, pas de duplication)
  saveBankAccount: (data: {
    id?: string | number
    bankLabel: string
    bankName?: string
    bankCode?: string
    bankBranchCode?: string
    bankAccountNumber?: string
    bankRibKey?: string
    bankBic?: string
    bankIban?: string
    bankDomiciliation?: string
    bankAccountHolder?: string
    bankOwnerAddress?: string
    bankOwnerPostalCode?: string
    bankOwnerCity?: string
    isDefault?: boolean
  }) => {
    const endpoint = data.id ? 'update_bank_account.php' : 'add_bank_account.php'
    return api.post(endpoint, data).then((r) => r.data)
  },
  deleteBankAccount: (id: string | number) =>
    api.post('delete_bank_account.php', { id }).then((r) => r.data),
}

