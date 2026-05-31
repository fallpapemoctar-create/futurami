import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText, Download, Eye, Trash2, Plus, Calendar, Euro,
  CheckCircle, Clock, Search, Filter, X, ChevronLeft, ChevronRight,
  FileSpreadsheet, TrendingUp, RefreshCw, Mail, FileMinus, AlertCircle
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { SendInvoiceEmailModal, EmailData } from "./SendInvoiceEmailModal";
import { CreateCreditNoteModal, CreditNoteData } from "./CreateCreditNoteModal";
import { api } from "../../lib/api";
import type { RawClientInvoice, RawInvoiceDraft } from "../../lib/hooks";

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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  // Factures chargées depuis l'API (brouillons + émises fusionnés)
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("get_invoice_drafts.php", { params: { status: "all" } }).then((r) => r.data?.drafts ?? []).catch(() => []),
      api.post("get_client_invoices.php", { page: 1, pageSize: 500 }).then((r) => r.data?.invoices ?? []).catch(() => []),
    ]).then(([drafts, invoices]) => {
      if (cancelled) return;
      const mapped: Invoice[] = [
        ...(drafts as RawInvoiceDraft[]).map(mapDraftToInvoice),
        ...(invoices as RawClientInvoice[]).map(mapClientInvoice),
      ];
      setAllInvoices(mapped);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleSendEmail = (emailData: EmailData) => {
    console.log("Envoi d'email:", emailData);
    // Ici vous ajouteriez la logique d'envoi d'email
    alert(`Email envoyé à ${emailData.to.join(", ")} avec la facture ${selectedInvoice?.ref} en PJ`);
  };

  const handleCreateCreditNote = (creditNoteData: CreditNoteData) => {
    if (!selectedInvoice) return;

    // Générer une référence unique pour l'avoir
    const year = new Date().getFullYear();
    const creditNoteNumber = creditNotes.length + 1;
    const ref = `AV-${year}-${String(creditNoteNumber).padStart(5, "0")}`;

    // Créer l'avoir
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

    // Ajouter l'avoir à la liste
    setCreditNotes((prev) => [newCreditNote, ...prev]);

    // Afficher une confirmation
    alert(
      `Avoir ${ref} créé avec succès\nFacture originale: ${creditNoteData.originalInvoiceRef}\nMontant: ${creditNoteData.amountTTC.toFixed(
        2
      )} € TTC\n\nL'avoir est disponible dans l'onglet "Avoirs".`
    );

    // Basculer vers l'onglet des avoirs
    setActiveTab("creditNotes");
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
          <PreparationTab key="preparation" currentTheme={currentTheme} />
        )}
        {activeTab === "initiated" && (
          <InitiatedInvoicesTab key="initiated" currentTheme={currentTheme} />
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
            onClick={() => alert("Créer une nouvelle facture")}
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
    </div>
  );
}

// Onglet Préparation
function PreparationTab({ currentTheme }: { currentTheme: any }) {
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("Mai 2026");
  const [paymentCondition, setPaymentCondition] = useState("Condition par défaut");
  const [bankAccount, setBankAccount] = useState("BP RIVES DE PARI...");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <p className="text-sm mb-6" style={{ color: currentTheme.colors.textLight }}>
        Factures sauvegardées mais non encore finalisées
      </p>

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
                <option value="">Sélectionner un client</option>
                <option>CADA Marseille - Groupe SOS Solidarités</option>
                <option>HOPITAL EMILE ROUX</option>
                <option>Tribunal de Paris</option>
                <option>ATPA Grenoble Port de Claix</option>
              </select>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: currentTheme.colors.textLight }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Mois
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all appearance-none"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option>Mai 2026</option>
                <option>Avril 2026</option>
                <option>Mars 2026</option>
                <option>Février 2026</option>
                <option>Janvier 2026</option>
              </select>
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: currentTheme.colors.textLight }} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Condition de règlement
            </label>
            <div className="relative">
              <select
                value={paymentCondition}
                onChange={(e) => setPaymentCondition(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all appearance-none"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option>Condition par défaut</option>
                <option>30 jours</option>
                <option>45 jours</option>
                <option>60 jours</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Compte bancaire
            </label>
            <div className="relative">
              <select
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all appearance-none"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option>BP RIVES DE PARI...</option>
                <option>Compte principal</option>
                <option>Compte secondaire</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-lg font-medium flex items-center gap-2"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
          >
            <RefreshCw className="w-4 h-4" />
            Charger les missions
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 text-white rounded-lg font-medium flex items-center gap-2"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Plus className="w-4 h-4" />
            Créer la facture
          </motion.button>
        </div>
      </motion.div>

      {/* État vide */}
      <EmptyState
        icon={FileText}
        title="Aucune mission à afficher"
        description="Saisissez un client, choisissez un mois puis cliquez sur 'Charger les missions' pour préparer la facture."
      />
    </motion.div>
  );
}

// Onglet Factures initiées
function InitiatedInvoicesTab({ currentTheme }: { currentTheme: any }) {
  const initiatedInvoices = [
    { id: "1", ref: "#60", client: "test", date: "Mai 2026-05", totalHT: "0.00 €" },
    { id: "2", ref: "#59", client: "test", date: "Mai 2026-05", totalHT: "0.00 €" },
    { id: "3", ref: "#58", client: "CADA Marseille - Groupe SOS Solidarités - 0516", date: "Mars 2025-03", totalHT: "455.75 € HT" },
    { id: "4", ref: "#57", client: "CADA Marseille - Groupe SOS Solidarités - 0516", date: "Mars 2025-03", totalHT: "455.75 € HT" },
    { id: "5", ref: "#56", client: "AAJT (Association d'Aide aux Jeunes Travailleurs) - CADA - 0740", date: "Mars 2025-03", totalHT: "455.75 € HT" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <p className="text-sm mb-6" style={{ color: currentTheme.colors.textLight }}>
        Factures sauvegardées mais non encore finalisées
      </p>

      <div className="space-y-3">
        {initiatedInvoices.map((invoice, index) => (
          <motion.div
            key={invoice.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-lg border p-4 hover:shadow-md transition-all"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
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
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: currentTheme.colors.primaryLight,
                    color: currentTheme.colors.primary,
                  }}
                >
                  Reprendre
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg"
                  style={{
                    color: currentTheme.colors.error,
                  }}
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
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
}: {
  invoice: Invoice;
  index: number;
  onSendEmail: (invoice: Invoice) => void;
  onCreateCreditNote: (invoice: Invoice) => void;
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
