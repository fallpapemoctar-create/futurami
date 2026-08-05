import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Download, Eye, Trash2, Plus, Calendar, Euro,
  CheckCircle, Clock, Search, Filter, X, ChevronLeft, ChevronRight,
  FileSpreadsheet, TrendingUp, RefreshCw, Mail, FileMinus, AlertCircle,
  Save, Lock
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { SendInvoiceEmailModal, EmailData } from "./SendInvoiceEmailModal";
import { CreateCreditNoteModal, CreditNoteData } from "./CreateCreditNoteModal";
import { CreateInvoiceDraftModal } from "./CreateInvoiceDraftModal";
import { api } from "../../lib/api";
import { crud, type RawClientInvoice, type RawInvoiceDraft, type RawMission, useClients, usePaymentTerms, useBankAccounts, useInvoiceDrafts } from "../../lib/hooks";

interface Invoice {
  id: string;
  ref: string;
  client: string;
  month: string;
  totalHT: number;
  totalTTC: number;
  status: "Brouillon" | "Envoyée" | "Payée";
  date: string;
  paymentDate?: string;
}

interface CreditNote {
  id: string;
  ref: string;
  originalInvoiceId: string;
  originalInvoiceRef: string;
  client: string;
  date: string;
  reason: string;
  type: "total" | "partial";
  amountHT: number;
  amountTTC: number;
  description: string;
  status: "Brouillon" | "Validé" | "Envoyé";
}

// Mappers API → modèles UI
function mapDraftToInvoice(d: RawInvoiceDraft): Invoice {
  const ht = Number(d.total_ht) || 0;
  return {
    id: `draft-${d.draft_id}`,
    ref: `DRAFT-${String(d.draft_id).padStart(6, "0")}`,
    client: d.client_name || "",
    month: d.month || "",
    totalHT: ht,
    totalTTC: Math.round(ht * 1.2 * 100) / 100,
    status: "Brouillon",
    date: (d.created_at || "").slice(0, 10),
  };
}

function mapClientInvoice(inv: RawClientInvoice): Invoice {
  const ht = Number(inv.invoice_total_ht ?? inv.amount_ht ?? 0);
  const ttc = Number(inv.invoice_total_ttc ?? ht * 1.2);
  const statusMap: Record<string, Invoice["status"]> = {
    draft: "Brouillon",
    sent: "Envoyée",
    paid: "Payée",
    validated: "Envoyée",
  };
  return {
    id: `inv-${inv.id}`,
    ref: inv.invoice_number,
    client: inv.client_name || "",
    month: inv.period_month || "",
    totalHT: ht,
    totalTTC: ttc,
    status: statusMap[(inv.status_code || "").toLowerCase()] || "Envoyée",
    date: (inv.billed_at || inv.created_at || "").slice(0, 10),
  };
}

export function FacturationPage() {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"preparation" | "initiated" | "invoices" | "creditNotes">("preparation");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showFilters, setShowFilters] = useState(false);

  // Brouillon en cours de reprise (transmis de l'onglet "Factures initiées"
  // vers l'onglet "Préparation"). PreparationTab hydrate ses filtres avec ces
  // valeurs au montage, puis notifie via onResumeConsumed().
  const [resumeDraft, setResumeDraft] = useState<RawInvoiceDraft | null>(null);
  const handleResumeDraft = (draft: RawInvoiceDraft) => {
    setResumeDraft(draft);
    setActiveTab("preparation");
  };

  // Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");

  // Modaux
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [isCreateDraftModalOpen, setIsCreateDraftModalOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Factures chargées depuis l'API (brouillons + émises fusionnés)
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const reloadInvoices = () => {
    Promise.all([
      api.get("get_invoice_drafts.php", { params: { status: "all" } }).then((r) => r.data?.drafts ?? []).catch(() => []),
      api.post("get_client_invoices.php", { page: 1, pageSize: 500 }).then((r) => r.data?.invoices ?? []).catch(() => []),
    ]).then(([drafts, invoices]) => {
      const mapped: Invoice[] = [
        ...(drafts as RawInvoiceDraft[]).map(mapDraftToInvoice),
        ...(invoices as RawClientInvoice[]).map(mapClientInvoice),
      ];
      setAllInvoices(mapped);
    });
  };
  useEffect(() => {
    reloadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateDraft = async (values: { client_id?: number; client_name?: string; month: string }) => {
    try {
      await crud.saveInvoiceDraft({
        client_id: values.client_id,
        client_name: values.client_name,
        month: values.month,
      });
      reloadInvoices();
    } catch (e: any) {
      console.error("Création brouillon impossible", e);
      alert(e?.response?.data?.error || "Création du brouillon impossible");
    }
  };

  // État des avoirs
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);

  // Listes uniques pour les filtres
  const uniqueClients = useMemo(() =>
    [...new Set(allInvoices.map(inv => inv.client))].sort(),
    [allInvoices]
  );

  const uniqueMonths = useMemo(() =>
    [...new Set(allInvoices.map(inv => inv.month))].sort(),
    [allInvoices]
  );

  // Filtrage des factures
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(invoice => {
      // Recherche globale
      const matchesSearch = searchQuery === "" ||
        invoice.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.client.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtre par client
      const matchesClient = filterClient === "" || invoice.client === filterClient;

      // Filtre par statut
      const matchesStatus = filterStatus === "all" || invoice.status === filterStatus;

      // Filtre par mois
      const matchesMonth = filterMonth === "" || invoice.month === filterMonth;

      // Filtre par montant
      let matchesAmount = true;
      if (filterAmountMin !== "" && invoice.totalTTC < parseFloat(filterAmountMin)) {
        matchesAmount = false;
      }
      if (filterAmountMax !== "" && invoice.totalTTC > parseFloat(filterAmountMax)) {
        matchesAmount = false;
      }

      // Filtre par date
      let matchesDate = true;
      if (filterDateStart || filterDateEnd) {
        const invoiceDate = parseFrenchDate(invoice.date);
        if (filterDateStart && invoiceDate < new Date(filterDateStart)) {
          matchesDate = false;
        }
        if (filterDateEnd && invoiceDate > new Date(filterDateEnd)) {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesClient && matchesStatus && matchesMonth && matchesAmount && matchesDate;
    });
  }, [allInvoices, searchQuery, filterClient, filterStatus, filterMonth, filterAmountMin, filterAmountMax, filterDateStart, filterDateEnd]);

  // Statistiques
  const stats = useMemo(() => {
    const total = filteredInvoices.length;
    const paid = filteredInvoices.filter(i => i.status === "Payée").length;
    const sent = filteredInvoices.filter(i => i.status === "Envoyée").length;
    const draft = filteredInvoices.filter(i => i.status === "Brouillon").length;
    const totalAmount = filteredInvoices.reduce((acc, inv) => acc + inv.totalTTC, 0);
    const paidAmount = filteredInvoices.filter(i => i.status === "Payée").reduce((acc, inv) => acc + inv.totalTTC, 0);
    const pendingAmount = filteredInvoices.filter(i => i.status !== "Payée").reduce((acc, inv) => acc + inv.totalTTC, 0);

    return { total, paid, sent, draft, totalAmount, paidAmount, pendingAmount };
  }, [filteredInvoices]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredInvoices.slice(start, start + itemsPerPage);
  }, [filteredInvoices, currentPage, itemsPerPage]);

  // Réinitialiser la page lors du changement de filtres
  const resetPage = () => setCurrentPage(1);

  // Réinitialiser tous les filtres
  const clearFilters = () => {
    setSearchQuery("");
    setFilterClient("");
    setFilterStatus("all");
    setFilterMonth("");
    setFilterDateStart("");
    setFilterDateEnd("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setCurrentPage(1);
  };

  // Fonction d'export
  const handleExport = (format: "excel" | "csv") => {
    const dataToExport = filteredInvoices;

    if (format === "csv") {
      exportToCSV(dataToExport);
    } else {
      exportToExcel(dataToExport);
    }
  };

  // Handlers pour les modaux
  const handleOpenEmailModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsEmailModalOpen(true);
  };

  const handleOpenCreditNoteModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsCreditNoteModalOpen(true);
  };

  const handleSendEmail = async (emailData: EmailData) => {
    if (!selectedInvoice) return;
    try {
      const res = await crud.sendInvoiceEmail({
        invoice_number: selectedInvoice.ref,
        to: emailData.to,
        cc: emailData.cc,
        subject: emailData.subject,
        body: emailData.message,
      });
      alert(res?.message ?? `Demande d'envoi enregistrée pour ${selectedInvoice.ref}`);
    } catch (e: any) {
      console.error("Envoi email impossible", e);
      alert(e?.response?.data?.error || "Envoi de l'email impossible");
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    if (!confirm(`Marquer la facture ${invoice.ref} comme payée ?`)) return;
    try {
      await crud.updateClientInvoiceStatus({
        invoice_number: invoice.ref,
        status: "paid",
        status_label: "Payée",
      });
      reloadInvoices();
    } catch (e: any) {
      console.error("Mise à jour du statut impossible", e);
      alert(e?.response?.data?.error || "Mise à jour du statut impossible");
    }
  };

  const handleMarkSent = async (invoice: Invoice) => {
    if (!confirm(`Marquer la facture ${invoice.ref} comme envoyée ?`)) return;
    try {
      await crud.updateClientInvoiceStatus({
        invoice_number: invoice.ref,
        status: "sent",
        status_label: "Envoyée",
      });
      reloadInvoices();
    } catch (e: any) {
      console.error("Mise à jour du statut impossible", e);
      alert(e?.response?.data?.error || "Mise à jour du statut impossible");
    }
  };

  const handleCreateCreditNote = async (creditNoteData: CreditNoteData) => {
    if (!selectedInvoice) return;
    try {
      const res = await crud.createCreditNote({
        source_invoice_number: creditNoteData.originalInvoiceRef,
        mode: creditNoteData.type,
        reason: creditNoteData.reason || creditNoteData.description || "Avoir",
      });
      const ref = res?.credit_note_number ?? res?.invoice_number ?? "(numéro indisponible)";

      // Maintenir l'affichage local d'avoirs en attendant un onglet câblé serveur
      const newCreditNote: CreditNote = {
        id: `credit-note-${Date.now()}`,
        ref,
        originalInvoiceId: creditNoteData.originalInvoiceId,
        originalInvoiceRef: creditNoteData.originalInvoiceRef,
        client: selectedInvoice.client,
        date: new Date().toLocaleDateString("fr-FR"),
        reason: creditNoteData.reason,
        type: creditNoteData.type,
        amountHT: creditNoteData.amountHT,
        amountTTC: creditNoteData.amountTTC,
        description: creditNoteData.description,
        status: "Brouillon",
      };
      setCreditNotes((prev) => [newCreditNote, ...prev]);

      alert(
        `Avoir ${ref} créé avec succès\nFacture originale : ${creditNoteData.originalInvoiceRef}`
      );
      setActiveTab("creditNotes");
      reloadInvoices();
    } catch (e: any) {
      console.error("Création avoir impossible", e);
      alert(e?.response?.data?.error || "Création de l'avoir impossible");
    }
  };

  const activeFiltersCount = [
    filterClient,
    filterStatus !== "all" ? filterStatus : "",
    filterMonth,
    filterDateStart,
    filterDateEnd,
    filterAmountMin,
    filterAmountMax,
    searchQuery,
  ].filter(Boolean).length;

  return (
    <div className="max-w-[1800px] mx-auto px-8 py-6">
      {/* En-tête avec onglets */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4" style={{ color: currentTheme.colors.text }}>
          {activeTab === "preparation"
            ? "Création des factures"
            : activeTab === "initiated"
            ? "Factures initiées"
            : activeTab === "creditNotes"
            ? "Avoirs"
            : "Factures"}
        </h2>

        {/* Onglets */}
        <div className="flex items-center gap-2 border-b" style={{ borderColor: currentTheme.colors.border }}>
          <button
            onClick={() => setActiveTab("preparation")}
            className="px-6 py-3 font-medium transition-colors relative"
            style={{
              color: activeTab === "preparation" ? currentTheme.colors.primary : currentTheme.colors.textLight,
            }}
          >
            Préparation
            {activeTab === "preparation" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: currentTheme.colors.primary }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("initiated")}
            className="px-6 py-3 font-medium transition-colors relative"
            style={{
              color: activeTab === "initiated" ? currentTheme.colors.primary : currentTheme.colors.textLight,
            }}
          >
            Factures initiées
            {activeTab === "initiated" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: currentTheme.colors.primary }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className="px-6 py-3 font-medium transition-colors relative"
            style={{
              color: activeTab === "invoices" ? currentTheme.colors.primary : currentTheme.colors.textLight,
            }}
          >
            Factures
            {activeTab === "invoices" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: currentTheme.colors.primary }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("creditNotes")}
            className="px-6 py-3 font-medium transition-colors relative flex items-center gap-2"
            style={{
              color: activeTab === "creditNotes" ? currentTheme.colors.primary : currentTheme.colors.textLight,
            }}
          >
            Avoirs
            {creditNotes.length > 0 && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: activeTab === "creditNotes" ? currentTheme.colors.primary : currentTheme.colors.textLight,
                  color: currentTheme.colors.surface,
                }}
              >
                {creditNotes.length}
              </span>
            )}
            {activeTab === "creditNotes" && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ backgroundColor: currentTheme.colors.primary }}
              />
            )}
          </button>
        </div>
      </div>

      {/* Contenu selon l'onglet actif */}
      <AnimatePresence mode="wait">
        {activeTab === "preparation" && (
          <PreparationTab
            key="preparation"
            currentTheme={currentTheme}
            resumeDraft={resumeDraft}
            onResumeConsumed={() => setResumeDraft(null)}
            onDraftCreated={() => setActiveTab("initiated")}
            onInvoiceEmitted={() => setActiveTab("invoices")}
          />
        )}
        {activeTab === "initiated" && (
          <InitiatedInvoicesTab
            key="initiated"
            currentTheme={currentTheme}
            onResume={handleResumeDraft}
          />
        )}
        {activeTab === "invoices" && (
          <motion.div key="invoices" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                  {filteredInvoices.length.toLocaleString()} facture{filteredInvoices.length > 1 ? "s" : ""}
                  {filteredInvoices.length !== allInvoices.length && (
                    <span> sur {allInvoices.length.toLocaleString()} au total</span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium border relative"
            style={{
              backgroundColor: showFilters ? currentTheme.colors.primaryLight : currentTheme.colors.surface,
              color: showFilters ? currentTheme.colors.primary : currentTheme.colors.text,
              borderColor: currentTheme.colors.border,
            }}
          >
            <Filter className="w-5 h-5" />
            <span>Filtres</span>
            {activeFiltersCount > 0 && (
              <span
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: currentTheme.colors.primary }}
              >
                {activeFiltersCount}
              </span>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsCreateDraftModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Plus className="w-5 h-5" />
            <span>Créer une facture</span>
          </motion.button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentTheme.colors.primaryLight }}
            >
              <FileText className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
            </div>
          </div>
          <p className="text-3xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            {stats.total.toLocaleString()}
          </p>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            Factures totales
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentTheme.colors.success + "20" }}
            >
              <CheckCircle className="w-6 h-6" style={{ color: currentTheme.colors.success }} />
            </div>
          </div>
          <p className="text-3xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            {stats.paid.toLocaleString()}
          </p>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            Factures payées
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentTheme.colors.success + "20" }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: currentTheme.colors.success }} />
            </div>
          </div>
          <p className="text-3xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            {stats.paidAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            Montant encaissé
          </p>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentTheme.colors.warning + "20" }}
            >
              <Euro className="w-6 h-6" style={{ color: currentTheme.colors.warning }} />
            </div>
          </div>
          <p className="text-3xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            {stats.pendingAmount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            En attente
          </p>
        </motion.div>
      </div>

      {/* Barre de recherche rapide */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border p-4 mb-4"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: currentTheme.colors.textLight }}
          />
          <input
            type="text"
            placeholder="Recherche rapide par référence, client..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{
              borderColor: currentTheme.colors.border,
              color: currentTheme.colors.text,
            }}
          />
        </div>
      </motion.div>

      {/* Panneau de filtres avancés */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-4"
          >
            <div
              className="rounded-xl border p-6"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                  Filtres avancés
                </h3>
                <div className="flex gap-2">
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: currentTheme.colors.error + "20",
                        color: currentTheme.colors.error,
                      }}
                    >
                      <X className="w-4 h-4" />
                      <span>Réinitialiser</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Client
                  </label>
                  <select
                    value={filterClient}
                    onChange={(e) => { setFilterClient(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="">Tous les clients</option>
                    {uniqueClients.map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Statut
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="Brouillon">Brouillon</option>
                    <option value="Envoyée">Envoyée</option>
                    <option value="Payée">Payée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Mois
                  </label>
                  <select
                    value={filterMonth}
                    onChange={(e) => { setFilterMonth(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="">Tous les mois</option>
                    {uniqueMonths.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={filterDateStart}
                    onChange={(e) => { setFilterDateStart(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={filterDateEnd}
                    onChange={(e) => { setFilterDateEnd(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Montant minimum (€)
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    step="0.01"
                    value={filterAmountMin}
                    onChange={(e) => { setFilterAmountMin(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Montant maximum (€)
                  </label>
                  <input
                    type="number"
                    placeholder="10000.00"
                    step="0.01"
                    value={filterAmountMax}
                    onChange={(e) => { setFilterAmountMax(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre d'actions et export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport("excel")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.success,
              color: "#ffffff",
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exporter Excel</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.secondary,
              color: "#ffffff",
            }}
          >
            <Download className="w-4 h-4" />
            <span>Exporter CSV</span>
          </motion.button>
        </div>

        <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
          Page {currentPage} sur {totalPages}
        </p>
      </div>

      {/* Liste des factures */}
      {viewMode === "cards" ? (
        <div className="space-y-4">
          {paginatedInvoices.map((invoice, index) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              index={index}
              onSendEmail={handleOpenEmailModal}
              onCreateCreditNote={handleOpenCreditNoteModal}
              onMarkPaid={handleMarkPaid}
              onMarkSent={handleMarkSent}
            />
          ))}
        </div>
      ) : (
        <InvoicesTable invoices={paginatedInvoices} />
      )}

      {filteredInvoices.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Aucune facture trouvée"
          description="Essayez de modifier vos critères de recherche ou créez une nouvelle facture"
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-6 flex items-center justify-center gap-2"
        >
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {getPageNumbers(currentPage, totalPages).map((pageNum, idx) =>
            pageNum === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-3 py-2" style={{ color: currentTheme.colors.textLight }}>
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(Number(pageNum))}
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: currentPage === pageNum ? currentTheme.colors.primary : currentTheme.colors.primaryLight,
                  color: currentPage === pageNum ? "#ffffff" : currentTheme.colors.primary,
                }}
              >
                {pageNum}
              </button>
            )
          )}

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}
          </motion.div>
        )}

        {/* Onglet Avoirs */}
        {activeTab === "creditNotes" && (
          <motion.div key="creditNotes" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                  {creditNotes.length.toLocaleString()} avoir{creditNotes.length > 1 ? "s" : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const data = creditNotes.map((cn) => ({
                      Référence: cn.ref,
                      "Facture originale": cn.originalInvoiceRef,
                      Client: cn.client,
                      Date: cn.date,
                      Type: cn.type === "total" ? "Total" : "Partiel",
                      Motif: cn.reason,
                      "Montant HT": cn.amountHT.toFixed(2),
                      "Montant TTC": cn.amountTTC.toFixed(2),
                      Statut: cn.status,
                    }));

                    const headers = Object.keys(data[0] || {});
                    const csvContent = [
                      headers.join(";"),
                      ...data.map((row) =>
                        headers.map((header) => `"${row[header] || ""}"`).join(";")
                      ),
                    ].join("\n");

                    const blob = new Blob(["﻿" + csvContent], {
                      type: "text/csv;charset=utf-8;",
                    });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `avoirs_${new Date().toISOString().split("T")[0]}.csv`;
                    link.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: currentTheme.colors.secondary,
                    color: "#ffffff",
                  }}
                >
                  <Download className="w-4 h-4" />
                  <span>Exporter CSV</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    import("xlsx").then((XLSX) => {
                      const data = creditNotes.map((cn) => ({
                        Référence: cn.ref,
                        "Facture originale": cn.originalInvoiceRef,
                        Client: cn.client,
                        Date: cn.date,
                        Type: cn.type === "total" ? "Total" : "Partiel",
                        Motif: cn.reason,
                        "Montant HT": cn.amountHT.toFixed(2),
                        "Montant TTC": cn.amountTTC.toFixed(2),
                        Statut: cn.status,
                      }));

                      const worksheet = XLSX.utils.json_to_sheet(data);
                      const workbook = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(workbook, worksheet, "Avoirs");

                      const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
                      worksheet["!cols"] = colWidths;

                      XLSX.writeFile(
                        workbook,
                        `avoirs_${new Date().toISOString().split("T")[0]}.xlsx`
                      );
                    });
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: currentTheme.colors.success,
                    color: "#ffffff",
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exporter Excel</span>
                </motion.button>
              </div>
            </div>

            {creditNotes.length === 0 ? (
              <EmptyState
                icon={FileMinus}
                title="Aucun avoir créé"
                description="Les avoirs que vous créez à partir des factures apparaîtront ici"
              />
            ) : viewMode === "cards" ? (
              <div className="space-y-4">
                {creditNotes.map((creditNote, index) => (
                  <CreditNoteCard key={creditNote.id} creditNote={creditNote} index={index} currentTheme={currentTheme} />
                ))}
              </div>
            ) : (
              <CreditNotesTable creditNotes={creditNotes} currentTheme={currentTheme} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modaux */}
      <SendInvoiceEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        invoice={selectedInvoice}
        onSend={handleSendEmail}
      />

      <CreateCreditNoteModal
        isOpen={isCreditNoteModalOpen}
        onClose={() => setIsCreditNoteModalOpen(false)}
        invoice={selectedInvoice}
        onCreate={handleCreateCreditNote}
      />

      <CreateInvoiceDraftModal
        isOpen={isCreateDraftModalOpen}
        onClose={() => setIsCreateDraftModalOpen(false)}
        onCreate={handleCreateDraft}
      />
    </div>
  );
}

// Onglet Préparation
function PreparationTab({
  currentTheme,
  resumeDraft,
  onResumeConsumed,
  onDraftCreated,
  onInvoiceEmitted,
}: {
  currentTheme: any;
  resumeDraft?: RawInvoiceDraft | null;
  onResumeConsumed?: () => void;
  onDraftCreated?: () => void;
  onInvoiceEmitted?: (invoiceNumber: string) => void;
}) {
  const [selectedClient, setSelectedClient] = useState("");
  const now = new Date();
  const monthInput = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(monthInput);
  const clientIdNum = selectedClient ? Number(selectedClient) : null;
  const { data: clients, loading: clientsLoading } = useClients({ activeOnly: true });
  const { data: paymentTermsData, loading: paymentTermsLoading } = usePaymentTerms(clientIdNum);
  const { data: bankAccounts, loading: bankAccountsLoading } = useBankAccounts();
  const [paymentTermId, setPaymentTermId] = useState<number>(0);
  const [bankAccountId, setBankAccountId] = useState<number>(0);
  // Bandeau informatif "brouillon repris" affiché tant que l'utilisateur n'a
  // pas modifié les filtres pré-remplis.
  const [resumedInfo, setResumedInfo] = useState<{ draftId: number; client: string; month: string } | null>(null);

  // ─── Chargement des missions à facturer ─────────────────────────────────
  const [loadedMissions, setLoadedMissions] = useState<RawMission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [unitPrices, setUnitPrices] = useState<Record<number, number>>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Hydrate les filtres à partir d'un brouillon transmis par InitiatedInvoicesTab.
  useEffect(() => {
    if (!resumeDraft) return;
    if (resumeDraft.client_id != null) setSelectedClient(String(resumeDraft.client_id));
    if (resumeDraft.month) setSelectedMonth(resumeDraft.month);
    if (resumeDraft.payment_condition_id != null) setPaymentTermId(Number(resumeDraft.payment_condition_id));
    if (resumeDraft.bank_account_id != null) setBankAccountId(Number(resumeDraft.bank_account_id));
    setResumedInfo({
      draftId: resumeDraft.draft_id,
      client: resumeDraft.client_name || "",
      month: resumeDraft.month || "",
    });
    onResumeConsumed?.();
  }, [resumeDraft, onResumeConsumed]);

  useEffect(() => {
    if (paymentTermsData.defaultId && paymentTermId === 0) {
      setPaymentTermId(paymentTermsData.defaultId);
    }
  }, [paymentTermsData.defaultId, paymentTermId]);

  useEffect(() => {
    const def = bankAccounts.find((b) => b.isDefault);
    if (def && bankAccountId === 0) setBankAccountId(def.id);
  }, [bankAccounts, bankAccountId]);

  // Reset des missions chargées si le client/mois changent → cohérence avec les filtres
  useEffect(() => {
    setLoadedMissions([]);
    setSelectedIds(new Set());
    setUnitPrices({});
    setLoadError(null);
    setSaveError(null);
    setSaveSuccess(null);
  }, [clientIdNum, selectedMonth]);

  // Charge les missions non facturées pour le client + mois sélectionnés.
  async function handleLoadMissions() {
    setSaveError(null);
    setSaveSuccess(null);
    if (!clientIdNum) {
      setLoadError("Sélectionnez un client.");
      return;
    }
    if (!selectedMonth || !/^\d{4}-\d{2}$/.test(selectedMonth)) {
      setLoadError("Sélectionnez un mois valide.");
      return;
    }
    setLoadError(null);
    setLoadingMissions(true);
    try {
      const [year, month] = selectedMonth.split("-").map(Number);
      const dateStart = `${selectedMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const dateEnd = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;
      const res = await api.get("get_missions_datatable.php", {
        params: {
          clientId: clientIdNum,
          dateStart,
          dateEnd,
          clientBilledStatus: "non facturée",
          pageSize: 500,
          page: 1,
        },
      });
      const missions: RawMission[] = res.data?.missions ?? [];
      setLoadedMissions(missions);
      // Toutes les missions cochées par défaut, prix unitaire à 0 (à saisir).
      setSelectedIds(new Set(missions.map((m) => m.rowid)));
      const prices: Record<number, number> = {};
      missions.forEach((m) => {
        prices[m.rowid] = 0;
      });
      setUnitPrices(prices);
      if (missions.length === 0) {
        setLoadError("Aucune mission non facturée trouvée pour ce client sur cette période.");
      }
    } catch (e: any) {
      setLoadError(e?.response?.data?.error || e?.message || "Erreur lors du chargement des missions.");
    } finally {
      setLoadingMissions(false);
    }
  }

  // Bascule / tout cocher / décocher.
  function toggleSelection(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (selectedIds.size === loadedMissions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(loadedMissions.map((m) => m.rowid)));
    }
  }

  // Total HT calculé à partir des missions cochées + prix unitaires saisis.
  const selectedTotals = useMemo(() => {
    let count = 0;
    let totalHt = 0;
    loadedMissions.forEach((m) => {
      if (!selectedIds.has(m.rowid)) return;
      const price = unitPrices[m.rowid] || 0;
      const qty = m.dureemission && m.dureemission > 0 ? m.dureemission : 1;
      totalHt += price * qty;
      count += 1;
    });
    return { count, totalHt };
  }, [loadedMissions, selectedIds, unitPrices]);

  // Enregistre le brouillon + les lignes détaillées (2 appels API).
  // Renvoie { draftId, linesCount, totalHt } sur succès, ou null sur erreur (le
  // setter d'erreur est déjà appelé par la fonction avant de renvoyer null).
  async function persistDraft(): Promise<{ draftId: number; linesCount: number; totalHt: number } | null> {
    if (!clientIdNum) {
      setSaveError("Sélectionnez un client.");
      return null;
    }
    const client = clients.find((c) => c.id === clientIdNum);
    const clientName = client?.name || "";
    if (!clientName) {
      setSaveError("Client introuvable.");
      return null;
    }
    if (selectedIds.size === 0) {
      setSaveError("Sélectionnez au moins une mission à facturer.");
      return null;
    }
    const missionsToBill = loadedMissions.filter((m) => selectedIds.has(m.rowid));
    const anyPriced = missionsToBill.some((m) => (unitPrices[m.rowid] || 0) > 0);
    if (!anyPriced) {
      setSaveError("Saisissez au moins un prix unitaire (> 0) avant d'enregistrer.");
      return null;
    }

    // 1) Créer ou mettre à jour l'en-tête du brouillon.
    const draftRes = await crud.saveInvoiceDraft({
      draft_id: resumedInfo?.draftId,
      client_id: clientIdNum,
      client_name: clientName,
      month: selectedMonth,
      total_ht: selectedTotals.totalHt,
      payment_condition_id: paymentTermId || undefined,
      bank_account_id: bankAccountId || undefined,
    });
    const draftId: number | undefined = draftRes?.draft_id ?? resumedInfo?.draftId;
    if (!draftId) {
      setSaveError("Le serveur n'a pas renvoyé d'ID de brouillon.");
      return null;
    }

    // 2) Sauvegarder les lignes détaillées (tble_client_invoice_lines).
    const lines = missionsToBill.map((m, idx) => {
      const price = unitPrices[m.rowid] || 0;
      const qty = m.dureemission && m.dureemission > 0 ? m.dureemission : 1;
      const dateLabel = m.datemission_iso || "";
      const designationParts = [
        m.produit_label || "Prestation",
        m.interpreter_name || null,
        dateLabel || null,
      ].filter(Boolean);
      return {
        mission_id: m.rowid,
        mission_ref: m.reference_devis || "",
        designation: designationParts.join(" — "),
        quantity: qty,
        unit_price_ht: price,
        total_ht: price * qty,
        tva_rate: 0,
        sort_order: idx,
      };
    });

    await crud.saveInvoiceDraftLines({
      draft_id: draftId,
      client_name: clientName,
      period_month: `${selectedMonth}-01`,
      lines,
    });

    return { draftId, linesCount: lines.length, totalHt: selectedTotals.totalHt };
  }

  async function handleSaveDraft() {
    setSaveError(null);
    setSaveSuccess(null);
    setSavingDraft(true);
    try {
      const res = await persistDraft();
      if (!res) return; // erreur déjà signalée
      setSaveSuccess(
        `Brouillon #${res.draftId} sauvegardé avec ${res.linesCount} ligne(s) — Total : ${res.totalHt.toFixed(2)} €. Retrouvez-le dans « Factures initiées » pour le reprendre ou le finaliser.`
      );
      setLoadedMissions([]);
      setSelectedIds(new Set());
      setUnitPrices({});
      setResumedInfo(null);
      onDraftCreated?.();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error || e?.message || "Erreur lors de la sauvegarde du brouillon.");
    } finally {
      setSavingDraft(false);
    }
  }

  // Flux atomique : sauvegarde le brouillon puis émet immédiatement la facture
  // définitive côté serveur (numéro FAC réservé atomiquement, PDF généré et
  // archivé, brouillon supprimé — le tout dans une transaction PDO).
  async function handleCreateInvoiceNow() {
    setSaveError(null);
    setSaveSuccess(null);
    setCreatingInvoice(true);
    try {
      const persisted = await persistDraft();
      if (!persisted) return;
      const emitRes = await crud.emitInvoice({
        draft_id: persisted.draftId,
        status: "validated",
      });
      if (!emitRes?.success) {
        setSaveError("Émission refusée par le serveur.");
        return;
      }
      setSaveSuccess(
        `Facture ${emitRes.invoice_number} émise avec succès (Total : ${emitRes.total_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT). Le PDF est archivé.`
      );
      setLoadedMissions([]);
      setSelectedIds(new Set());
      setUnitPrices({});
      setResumedInfo(null);
      onInvoiceEmitted?.(emitRes.invoice_number);
    } catch (e: any) {
      setSaveError(
        e?.response?.data?.error ||
          e?.message ||
          "Erreur lors de l'émission de la facture."
      );
    } finally {
      setCreatingInvoice(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <p className="text-sm mb-6" style={{ color: currentTheme.colors.textLight }}>
        Factures sauvegardées mais non encore finalisées
      </p>

      {resumedInfo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 mb-6 rounded-lg border"
          style={{
            backgroundColor: currentTheme.colors.primaryLight,
            borderColor: currentTheme.colors.primary,
            color: currentTheme.colors.primary,
          }}
        >
          <RefreshCw className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Brouillon #{resumedInfo.draftId} repris</p>
            <p className="mt-0.5" style={{ color: currentTheme.colors.text }}>
              Client, mois et paramètres de facturation ont été pré-remplis à partir du brouillon
              {resumedInfo.client ? ` de « ${resumedInfo.client} »` : ""}
              {resumedInfo.month ? ` (${resumedInfo.month})` : ""}. Vous pouvez ajuster puis charger les missions.
            </p>
          </div>
          <button
            onClick={() => setResumedInfo(null)}
            className="p-1 rounded hover:bg-white/20"
            style={{ color: currentTheme.colors.primary }}
            title="Masquer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Filtres de préparation */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border p-6 mb-6"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Client
            </label>
            <div className="relative">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all appearance-none"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option value="">{clientsLoading ? "Chargement…" : "Sélectionner un client"}</option>
                {clients.map((c) => (
                  <option key={c.id ?? c.name} value={String(c.id ?? "")}>{c.name}</option>
                ))}
              </select>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: currentTheme.colors.textLight }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Mois
            </label>
            <div className="relative">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: currentTheme.colors.textLight }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Condition de règlement
            </label>
            <div className="relative">
              <select
                value={paymentTermId}
                onChange={(e) => setPaymentTermId(Number(e.target.value))}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all appearance-none"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option value={0}>{paymentTermsLoading ? "Chargement…" : "—"}</option>
                {paymentTermsData.terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}{t.isDefault ? " (défaut)" : ""}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Compte bancaire
            </label>
            <div className="relative">
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(Number(e.target.value))}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all appearance-none"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option value={0}>{bankAccountsLoading ? "Chargement…" : "—"}</option>
                {bankAccounts.map((b) => (
                  <option key={b.id} value={b.id}>{b.bankLabel || b.bankName || `Compte #${b.id}`}{b.isDefault ? " (défaut)" : ""}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: loadingMissions ? 1 : 1.02 }}
            whileTap={{ scale: loadingMissions ? 1 : 0.98 }}
            disabled={loadingMissions || savingDraft}
            onClick={handleLoadMissions}
            className="px-6 py-3 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
          >
            <RefreshCw className={`w-4 h-4 ${loadingMissions ? "animate-spin" : ""}`} />
            {loadingMissions ? "Chargement…" : "Charger les missions"}
          </motion.button>
          <motion.button
            whileHover={{ scale: savingDraft || loadedMissions.length === 0 ? 1 : 1.02 }}
            whileTap={{ scale: savingDraft || loadedMissions.length === 0 ? 1 : 0.98 }}
            disabled={savingDraft || creatingInvoice || loadedMissions.length === 0 || selectedIds.size === 0}
            onClick={handleSaveDraft}
            title="Enregistre le travail en cours comme brouillon dans « Factures initiées ». Reprenable à volonté avant validation définitive."
            className="px-6 py-3 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Save className="w-4 h-4" />
            {savingDraft ? "Enregistrement…" : "Sauvegarder"}
          </motion.button>
          <motion.button
            whileHover={{ scale: creatingInvoice || loadedMissions.length === 0 || selectedIds.size === 0 ? 1 : 1.02 }}
            whileTap={{ scale: creatingInvoice || loadedMissions.length === 0 || selectedIds.size === 0 ? 1 : 0.98 }}
            disabled={savingDraft || creatingInvoice || loadedMissions.length === 0 || selectedIds.size === 0}
            onClick={handleCreateInvoiceNow}
            title="Émission définitive : réserve un numéro FAC-XXX, génère le PDF côté serveur et l'archive dans une transaction atomique. Aucun retour possible ensuite."
            className="px-6 py-3 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: currentTheme.colors.success || "#10b981" }}
          >
            <Lock className="w-4 h-4" />
            {creatingInvoice ? "Émission…" : "Créer la facture"}
          </motion.button>
        </div>
      </motion.div>

      {/* Messages d'état */}
      {loadError && (
        <div
          className="p-4 mb-4 rounded-lg border flex items-start gap-3"
          style={{
            backgroundColor: currentTheme.colors.warning + "20",
            borderColor: currentTheme.colors.warning,
            color: currentTheme.colors.warning,
          }}
        >
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{loadError}</p>
        </div>
      )}
      {saveError && (
        <div
          className="p-4 mb-4 rounded-lg border flex items-start gap-3"
          style={{
            backgroundColor: (currentTheme.colors.error || "#ef4444") + "20",
            borderColor: currentTheme.colors.error || "#ef4444",
            color: currentTheme.colors.error || "#ef4444",
          }}
        >
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{saveError}</p>
        </div>
      )}
      {saveSuccess && (
        <div
          className="p-4 mb-4 rounded-lg border flex items-start gap-3"
          style={{
            backgroundColor: (currentTheme.colors.success || "#10b981") + "20",
            borderColor: currentTheme.colors.success || "#10b981",
            color: currentTheme.colors.success || "#10b981",
          }}
        >
          <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <p className="text-sm">{saveSuccess}</p>
        </div>
      )}

      {/* Tableau des missions chargées, ou état vide */}
      {loadedMissions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune mission à afficher"
          description="Saisissez un client, choisissez un mois puis cliquez sur « Charger les missions ». Ensuite « Sauvegarder » range votre travail dans « Factures initiées » (reprenable) ; « Créer la facture » l'émettra définitivement avec un numéro FAC-XXX et un PDF archivé côté serveur."
        />
      ) : (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-xl border overflow-hidden shadow-sm mb-6"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme.colors.border}` }}>
            <div>
              <p className="font-semibold" style={{ color: currentTheme.colors.text }}>
                {loadedMissions.length} mission(s) non facturée(s)
              </p>
              <p className="text-xs mt-0.5" style={{ color: currentTheme.colors.textLight }}>
                {selectedTotals.count} sélectionnée(s) — Saisissez le PU HT pour chaque ligne à facturer.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>Total HT sélectionné</p>
              <p className="text-lg font-bold" style={{ color: currentTheme.colors.primary }}>
                {selectedTotals.totalHt.toFixed(2)} €
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
                  <th className="px-3 py-2 text-left" style={{ color: currentTheme.colors.primary }}>
                    <input
                      type="checkbox"
                      checked={loadedMissions.length > 0 && selectedIds.size === loadedMissions.length}
                      ref={(el) => {
                        if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < loadedMissions.length;
                      }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: currentTheme.colors.primary }}>Réf.</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: currentTheme.colors.primary }}>Date</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: currentTheme.colors.primary }}>Prestation</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: currentTheme.colors.primary }}>Interprète</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: currentTheme.colors.primary }}>Durée (h)</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: currentTheme.colors.primary }}>PU HT (€)</th>
                  <th className="px-3 py-2 text-right font-semibold" style={{ color: currentTheme.colors.primary }}>Total HT (€)</th>
                </tr>
              </thead>
              <tbody>
                {loadedMissions.map((m) => {
                  const checked = selectedIds.has(m.rowid);
                  const price = unitPrices[m.rowid] || 0;
                  const qty = m.dureemission && m.dureemission > 0 ? m.dureemission : 1;
                  const total = price * qty;
                  return (
                    <tr
                      key={m.rowid}
                      style={{
                        borderTop: `1px solid ${currentTheme.colors.border}`,
                        opacity: checked ? 1 : 0.5,
                      }}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelection(m.rowid)} />
                      </td>
                      <td className="px-3 py-2" style={{ color: currentTheme.colors.text }}>{m.reference_devis || "—"}</td>
                      <td className="px-3 py-2" style={{ color: currentTheme.colors.text }}>{m.datemission_iso || "—"}</td>
                      <td className="px-3 py-2" style={{ color: currentTheme.colors.text }}>{m.produit_label || "—"}</td>
                      <td className="px-3 py-2" style={{ color: currentTheme.colors.text }}>{m.interpreter_name || "—"}</td>
                      <td className="px-3 py-2 text-right" style={{ color: currentTheme.colors.text }}>{qty}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={price}
                          onChange={(e) =>
                            setUnitPrices((prev) => ({ ...prev, [m.rowid]: Number(e.target.value) || 0 }))
                          }
                          disabled={!checked}
                          className="w-24 px-2 py-1 border rounded text-right disabled:opacity-50"
                          style={{
                            borderColor: currentTheme.colors.border,
                            color: currentTheme.colors.text,
                            backgroundColor: currentTheme.colors.background,
                          }}
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: currentTheme.colors.text }}>
                        {total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Onglet Factures initiées
function InitiatedInvoicesTab({
  currentTheme,
  onResume,
}: {
  currentTheme: any;
  onResume: (draft: RawInvoiceDraft) => void;
}) {
  // Brouillons (status='draft') filtrés côté serveur par entity via
  // get_invoice_drafts.php ($currentEntity du token). Sur futurAMI (entity=2)
  // seuls les brouillons créés dans cette entité seront visibles ; l'historique
  // AMI (entity=1) reste isolé — c'est le comportement multi-tenant voulu.
  const { data: rawDrafts, loading, error, refetch } = useInvoiceDrafts({ status: "draft" });

  // Suppression : confirmation inline + appel API
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Émission : confirmation inline + appel API atomique (emit_invoice.php)
  const [pendingEmitId, setPendingEmitId] = useState<number | null>(null);
  const [emittingId, setEmittingId] = useState<number | null>(null);
  const [emitError, setEmitError] = useState<string | null>(null);
  const [emitSuccess, setEmitSuccess] = useState<string | null>(null);

  const handleConfirmDelete = async (draftId: number) => {
    setDeletingId(draftId);
    setDeleteError(null);
    try {
      const res = await crud.deleteInvoiceDraft(draftId);
      if (res?.success) {
        setPendingDeleteId(null);
        refetch();
      } else {
        setDeleteError(res?.error || "Suppression refusée par le serveur.");
      }
    } catch (e: any) {
      setDeleteError(
        e?.response?.data?.error ||
          e?.message ||
          "Erreur réseau pendant la suppression."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleConfirmEmit = async (draftId: number) => {
    setEmittingId(draftId);
    setEmitError(null);
    setEmitSuccess(null);
    try {
      const res = await crud.emitInvoice({ draft_id: draftId, status: "validated" });
      if (res?.success) {
        setPendingEmitId(null);
        setEmitSuccess(
          `Facture ${res.invoice_number} émise avec succès (Total : ${res.total_ht.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT). Retrouvez-la dans « Factures ».`
        );
        refetch();
      } else {
        setEmitError("Émission refusée par le serveur.");
      }
    } catch (e: any) {
      setEmitError(
        e?.response?.data?.error ||
          e?.message ||
          "Erreur réseau pendant l'émission."
      );
    } finally {
      setEmittingId(null);
    }
  };

  const handlePreviewPdf = async (draftId: number) => {
    try {
      await crud.previewInvoicePdf(draftId);
    } catch (e: any) {
      // Le back renvoie du JSON en cas d'erreur, mais responseType='blob' force
      // axios à mettre la réponse dans un Blob. On tente de le relire en texte
      // pour extraire le vrai message d'erreur.
      let msg = e?.message || "Impossible d'ouvrir l'aperçu PDF.";
      const blob: Blob | undefined = e?.response?.data;
      if (blob && typeof blob.text === "function") {
        try {
          const text = await blob.text();
          const json = JSON.parse(text);
          msg = json?.error || json?.message || msg;
        } catch {
          /* pas du JSON — on garde le message par défaut */
        }
      }
      alert(msg);
    }
  };

  // Format d'affichage "Mois YYYY" à partir d'une clé "YYYY-MM"
  const formatMonth = (raw: string | null | undefined): string => {
    if (!raw) return "";
    const m = /^(\d{4})-(\d{2})/.exec(raw);
    if (!m) return raw;
    const year = m[1];
    const monthIndex = Number(m[2]) - 1;
    const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    return `${MONTHS_FR[monthIndex] ?? m[2]} ${year}`;
  };
  const formatEuro = (amount: number): string =>
    `${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`;

  const initiatedInvoices = useMemo(
    () =>
      (rawDrafts ?? []).map((d) => ({
        id: d.draft_id,
        ref: `#${d.draft_id}`,
        client: d.client_name || "—",
        date: formatMonth(d.month),
        totalHT: formatEuro(Number(d.total_ht) || 0),
        raw: d,
      })),
    [rawDrafts]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
          Factures sauvegardées mais non encore finalisées
          {!loading && !error && ` (${initiatedInvoices.length})`}
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => refetch()}
          className="p-2 rounded-lg flex items-center gap-2 text-sm"
          style={{
            color: currentTheme.colors.textLight,
            border: `1px solid ${currentTheme.colors.border}`,
          }}
          title="Rafraîchir"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Rafraîchir
        </motion.button>
      </div>

      {loading && (
        <div className="text-sm text-center py-8" style={{ color: currentTheme.colors.textLight }}>
          Chargement des brouillons…
        </div>
      )}

      {error && !loading && (
        <div
          className="flex items-center gap-2 p-4 rounded-lg text-sm"
          style={{
            backgroundColor: currentTheme.colors.statusExpired.bg,
            color: currentTheme.colors.statusExpired.text,
          }}
        >
          <AlertCircle className="w-4 h-4" />
          Impossible de charger les brouillons : {String(error)}
        </div>
      )}

      {deleteError && (
        <div
          className="flex items-center justify-between gap-2 p-4 mb-4 rounded-lg text-sm"
          style={{
            backgroundColor: currentTheme.colors.statusExpired.bg,
            color: currentTheme.colors.statusExpired.text,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button
            onClick={() => setDeleteError(null)}
            className="p-1 rounded hover:bg-white/20"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {emitError && (
        <div
          className="flex items-center justify-between gap-2 p-4 mb-4 rounded-lg text-sm"
          style={{
            backgroundColor: currentTheme.colors.statusExpired.bg,
            color: currentTheme.colors.statusExpired.text,
          }}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{emitError}</span>
          </div>
          <button
            onClick={() => setEmitError(null)}
            className="p-1 rounded hover:bg-white/20"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {emitSuccess && (
        <div
          className="flex items-center justify-between gap-2 p-4 mb-4 rounded-lg text-sm"
          style={{
            backgroundColor: currentTheme.colors.statusValidated.bg,
            color: currentTheme.colors.statusValidated.text,
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{emitSuccess}</span>
          </div>
          <button
            onClick={() => setEmitSuccess(null)}
            className="p-1 rounded hover:bg-white/20"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!loading && !error && initiatedInvoices.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Aucune facture initiée"
          description="Les brouillons de facture apparaîtront ici. Utilisez l'onglet Préparation pour en créer un."
        />
      )}

      <div className="space-y-3">
        {initiatedInvoices.map((invoice, index) => {
          const isPendingDelete = pendingDeleteId === invoice.id;
          const isDeleting = deletingId === invoice.id;
          const isPendingEmit = pendingEmitId === invoice.id;
          const isEmitting = emittingId === invoice.id;
          const isBusy = isDeleting || isEmitting;
          return (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="rounded-lg border p-4 hover:shadow-md transition-all"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: isPendingDelete
                  ? currentTheme.colors.error
                  : isPendingEmit
                  ? currentTheme.colors.success
                  : currentTheme.colors.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <FileText className="w-5 h-5" style={{ color: currentTheme.colors.primary }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold" style={{ color: currentTheme.colors.text }}>
                        {invoice.ref}
                      </span>
                      <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                        •
                      </span>
                      <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                        {invoice.date}
                      </span>
                      <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                        •
                      </span>
                      <span className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
                        Total: {invoice.totalHT}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: currentTheme.colors.text }}>
                      {invoice.client}
                    </p>
                  </div>
                </div>
                {isPendingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: currentTheme.colors.error }}>
                      Supprimer ce brouillon ?
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleConfirmDelete(invoice.id)}
                      disabled={isDeleting}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: currentTheme.colors.error }}
                    >
                      {isDeleting ? "Suppression…" : "Oui, supprimer"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPendingDeleteId(null)}
                      disabled={isDeleting}
                      className="px-3 py-2 rounded-lg text-sm font-medium border"
                      style={{
                        color: currentTheme.colors.textLight,
                        borderColor: currentTheme.colors.border,
                      }}
                    >
                      Annuler
                    </motion.button>
                  </div>
                ) : isPendingEmit ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: currentTheme.colors.success }}>
                      Émettre définitivement ? (N° FAC attribué, PDF archivé)
                    </span>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleConfirmEmit(invoice.id)}
                      disabled={isEmitting}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: currentTheme.colors.success }}
                    >
                      {isEmitting ? "Émission…" : "Oui, émettre"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPendingEmitId(null)}
                      disabled={isEmitting}
                      className="px-3 py-2 rounded-lg text-sm font-medium border"
                      style={{
                        color: currentTheme.colors.textLight,
                        borderColor: currentTheme.colors.border,
                      }}
                    >
                      Annuler
                    </motion.button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePreviewPdf(invoice.id)}
                      disabled={isBusy}
                      className="px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 border disabled:opacity-50"
                      style={{
                        color: currentTheme.colors.textLight,
                        borderColor: currentTheme.colors.border,
                      }}
                      title="Ouvrir un aperçu PDF avec watermark (le numéro FAC affiché est indicatif, aucun N° n'est consommé)"
                    >
                      <Eye className="w-4 h-4" />
                      Aperçu PDF
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onResume(invoice.raw)}
                      disabled={isBusy}
                      className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                      style={{
                        backgroundColor: currentTheme.colors.primaryLight,
                        color: currentTheme.colors.primary,
                      }}
                      title="Reprendre ce brouillon dans l'onglet Préparation"
                    >
                      Reprendre
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setEmitError(null);
                        setEmitSuccess(null);
                        setPendingEmitId(invoice.id);
                      }}
                      disabled={isBusy}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-50"
                      style={{ backgroundColor: currentTheme.colors.success }}
                      title="Émission atomique : réserve le N° FAC définitif, génère le PDF côté serveur, archive et supprime le brouillon en 1 transaction"
                    >
                      <Lock className="w-4 h-4" />
                      Émettre
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setDeleteError(null);
                        setPendingDeleteId(invoice.id);
                      }}
                      disabled={isBusy}
                      className="p-2 rounded-lg disabled:opacity-50"
                      style={{
                        color: currentTheme.colors.error,
                      }}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function InvoicesTable({ invoices }: { invoices: Invoice[] }) {
  const { currentTheme } = useTheme();

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Référence
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Client
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Période
              </th>
              <th
                className="px-4 py-3 text-right text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Total HT
              </th>
              <th
                className="px-4 py-3 text-right text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Total TTC
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Statut
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice, index) => (
              <motion.tr
                key={invoice.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className="border-b hover:bg-opacity-50 transition-colors"
                style={{
                  borderColor: currentTheme.colors.border,
                  backgroundColor: index % 2 === 0 ? "transparent" : currentTheme.colors.primaryLight + "20",
                }}
              >
                <td className="px-4 py-3">
                  <span className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                    {invoice.ref}
                  </span>
                  <div className="flex items-center gap-1 text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                    <Calendar className="w-3 h-3" />
                    <span>{invoice.date}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {invoice.client}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {invoice.month}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                      {invoice.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <Euro className="w-3 h-3" style={{ color: currentTheme.colors.textLight }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="font-bold text-sm" style={{ color: currentTheme.colors.text }}>
                      {invoice.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <Euro className="w-3 h-3" style={{ color: currentTheme.colors.textLight }} />
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <StatusChip status={invoice.status} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.primary }}
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleOpenEmailModal(invoice)}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.secondary }}
                      title="Envoyer par email"
                    >
                      <Mail className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.success }}
                      title="Télécharger PDF"
                    >
                      <Download className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleOpenCreditNoteModal(invoice)}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.warning }}
                      title="Créer un avoir"
                    >
                      <FileMinus className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.error }}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function InvoiceCard({
  invoice,
  index,
  onSendEmail,
  onCreateCreditNote,
  onMarkPaid,
  onMarkSent,
}: {
  invoice: Invoice;
  index: number;
  onSendEmail: (invoice: Invoice) => void;
  onCreateCreditNote: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
}) {
  const { currentTheme } = useTheme();

  const statusIcons = {
    Brouillon: Clock,
    Envoyée: FileText,
    Payée: CheckCircle,
  };

  const StatusIcon = statusIcons[invoice.status];

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      whileHover={{ y: -2, boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.1)" }}
      className="rounded-xl p-6 border shadow-sm hover:shadow-md transition-all"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4 flex-1">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: currentTheme.colors.primaryLight }}
          >
            <StatusIcon className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                {invoice.ref}
              </h3>
              <StatusChip status={invoice.status} />
            </div>
            <p className="text-sm mb-1" style={{ color: currentTheme.colors.textLight }}>
              {invoice.client}
            </p>
            <div className="flex items-center gap-4 text-xs" style={{ color: currentTheme.colors.textLight }}>
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{invoice.month}</span>
              </div>
              <span>Créée le {invoice.date}</span>
              {invoice.paymentDate && (
                <span className="font-medium" style={{ color: currentTheme.colors.success }}>
                  Payée le {invoice.paymentDate}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-right mr-4">
          <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
            Total TTC
          </p>
          <p className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
            {invoice.totalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
          <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
            HT: {invoice.totalHT.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </p>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.primary }}
            title="Voir détails"
          >
            <Eye className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSendEmail(invoice)}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.secondary }}
            title="Envoyer par email"
          >
            <Mail className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.success }}
            title="Télécharger PDF"
          >
            <Download className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onCreateCreditNote(invoice)}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.warning }}
            title="Créer un avoir"
          >
            <FileMinus className="w-4 h-4" />
          </motion.button>
          {invoice.status !== "Payée" && invoice.status !== "Envoyée" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMarkSent(invoice)}
              className="p-2 rounded-lg text-white"
              style={{ backgroundColor: currentTheme.colors.secondary }}
              title="Marquer comme envoyée"
            >
              <FileText className="w-4 h-4" />
            </motion.button>
          )}
          {invoice.status !== "Payée" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMarkPaid(invoice)}
              className="p-2 rounded-lg text-white"
              style={{ backgroundColor: currentTheme.colors.success }}
              title="Marquer comme payée"
            >
              <CheckCircle className="w-4 h-4" />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.error }}
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function CreateInvoiceForm({ onBack }: { onBack: () => void }) {
  const { currentTheme } = useTheme();

  return (
    <div className="max-w-6xl mx-auto px-8 py-6">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity"
          style={{ color: currentTheme.colors.primary }}
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="font-medium">Retour à la liste</span>
        </button>
        <h2 className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
          Création des factures
        </h2>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl p-8 border shadow-sm mb-6"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Client
            </label>
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option>FORUM RÉFUGIÉS (SPADA MARSEILLE) - 0746</option>
              <option>CADA Marseille - Groupe SOS Solidarités - 0516</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Mois
            </label>
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option>Avril 2026</option>
              <option>Mai 2026</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Condition de règlement
            </label>
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option>60 jours fin de mois (600)</option>
              <option>30 jours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Compte bancaire
            </label>
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option>BP RIVES DE PARIS - BANQUE</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2.5 text-white rounded-lg font-medium"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            Charger les missions
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2.5 text-white rounded-lg font-medium"
            style={{ backgroundColor: currentTheme.colors.success }}
          >
            Créer la facture
          </motion.button>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border overflow-hidden shadow-sm"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  Ref. mission
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  Désignation
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  TVA
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  P.U HT
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  P.U TTC
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  Réduc. %
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  QM
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: currentTheme.colors.textLight }}>
                  Aucune mission chargée
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          className="px-6 py-4 border-t"
          style={{ borderColor: currentTheme.colors.border }}
        >
          <div className="flex justify-end gap-8">
            <div className="text-right">
              <p className="text-sm mb-1" style={{ color: currentTheme.colors.textLight }}>
                Total HT
              </p>
              <p className="text-xl font-bold" style={{ color: currentTheme.colors.text }}>
                0.00 €
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm mb-1" style={{ color: currentTheme.colors.textLight }}>
                Total TTC
              </p>
              <p className="text-2xl font-bold" style={{ color: currentTheme.colors.primary }}>
                0.00 €
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Utilitaires
function parseFrenchDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}

function exportToCSV(invoices: Invoice[]) {
  const headers = ["Référence", "Client", "Mois", "Date", "Statut", "Total HT", "Total TTC", "Date paiement"];
  const rows = invoices.map(inv => [
    inv.ref,
    inv.client,
    inv.month,
    inv.date,
    inv.status,
    inv.totalHT.toFixed(2),
    inv.totalTTC.toFixed(2),
    inv.paymentDate || "",
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(";")),
  ].join("\n");

  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `factures_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

function exportToExcel(invoices: Invoice[]) {
  import("xlsx").then((XLSX) => {
    const worksheet = XLSX.utils.json_to_sheet(
      invoices.map(inv => ({
        "Référence": inv.ref,
        "Client": inv.client,
        "Mois": inv.month,
        "Date": inv.date,
        "Statut": inv.status,
        "Total HT": inv.totalHT,
        "Total TTC": inv.totalTTC,
        "Date paiement": inv.paymentDate || "",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Factures");

    // Définir la largeur des colonnes
    const colWidths = [
      { wch: 20 }, // Référence
      { wch: 50 }, // Client
      { wch: 15 }, // Mois
      { wch: 12 }, // Date
      { wch: 12 }, // Statut
      { wch: 12 }, // Total HT
      { wch: 12 }, // Total TTC
      { wch: 15 }, // Date paiement
    ];
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `factures_${new Date().toISOString().split("T")[0]}.xlsx`);
  });
}

// Composant Carte d'Avoir
function CreditNoteCard({
  creditNote,
  index,
  currentTheme,
}: {
  creditNote: CreditNote;
  index: number;
  currentTheme: any;
}) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      whileHover={{ y: -2, boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.1)" }}
      className="rounded-xl p-6 border shadow-sm"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <FileMinus className="w-5 h-5" style={{ color: currentTheme.colors.warning }} />
            <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
              {creditNote.ref}
            </h3>
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor:
                  creditNote.type === "total"
                    ? currentTheme.colors.error + "20"
                    : currentTheme.colors.warning + "20",
                color: creditNote.type === "total" ? currentTheme.colors.error : currentTheme.colors.warning,
              }}
            >
              {creditNote.type === "total" ? "Avoir total" : "Avoir partiel"}
            </span>
          </div>
          <p className="text-sm mb-1" style={{ color: currentTheme.colors.textLight }}>
            Facture originale : <span className="font-semibold">{creditNote.originalInvoiceRef}</span>
          </p>
          <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
            {creditNote.client}
          </p>
        </div>

        <div className="text-right">
          <StatusChip
            status={
              creditNote.status === "Brouillon"
                ? "Brouillon"
                : creditNote.status === "Validé"
                ? "Validée"
                : "Envoyée"
            }
          />
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-4 py-4 mb-4 border-y"
        style={{ borderColor: currentTheme.colors.border }}
      >
        <div>
          <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
            Date
          </p>
          <p className="text-sm font-medium flex items-center gap-2" style={{ color: currentTheme.colors.text }}>
            <Calendar className="w-4 h-4" />
            {creditNote.date}
          </p>
        </div>
        <div>
          <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
            Motif
          </p>
          <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
            {creditNote.reason}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs mb-2" style={{ color: currentTheme.colors.textLight }}>
          Description
        </p>
        <p className="text-sm" style={{ color: currentTheme.colors.text }}>
          {creditNote.description}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
              Montant HT
            </p>
            <p className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
              {creditNote.amountHT.toFixed(2)} €
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
              Montant TTC
            </p>
            <p className="text-xl font-bold" style={{ color: currentTheme.colors.error }}>
              -{creditNote.amountTTC.toFixed(2)} €
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.primary }}
            title="Voir"
          >
            <Eye className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.secondary }}
            title="Télécharger PDF"
          >
            <Download className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.success }}
            title="Envoyer par email"
          >
            <Mail className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

// Composant Tableau des Avoirs
function CreditNotesTable({ creditNotes, currentTheme }: { creditNotes: CreditNote[]; currentTheme: any }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Référence
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Facture originale
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Client
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Type
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Motif
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Date
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Montant TTC
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Statut
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((creditNote, index) => (
              <motion.tr
                key={creditNote.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className="border-b hover:bg-opacity-50 transition-colors"
                style={{
                  borderColor: currentTheme.colors.border,
                  backgroundColor: index % 2 === 0 ? "transparent" : currentTheme.colors.primaryLight + "20",
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileMinus className="w-4 h-4" style={{ color: currentTheme.colors.warning }} />
                    <span className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                      {creditNote.ref}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {creditNote.originalInvoiceRef}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {creditNote.client}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor:
                        creditNote.type === "total"
                          ? currentTheme.colors.error + "20"
                          : currentTheme.colors.warning + "20",
                      color: creditNote.type === "total" ? currentTheme.colors.error : currentTheme.colors.warning,
                    }}
                  >
                    {creditNote.type === "total" ? "Total" : "Partiel"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {creditNote.reason}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {creditNote.date}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-bold" style={{ color: currentTheme.colors.error }}>
                    -{creditNote.amountTTC.toFixed(2)} €
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <StatusChip
                      status={
                        creditNote.status === "Brouillon"
                          ? "Brouillon"
                          : creditNote.status === "Validé"
                          ? "Validée"
                          : "Envoyée"
                      }
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.primary }}
                      title="Voir"
                    >
                      <Eye className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.secondary }}
                      title="Télécharger PDF"
                    >
                      <Download className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.success }}
                      title="Envoyer par email"
                    >
                      <Mail className="w-4 h-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
