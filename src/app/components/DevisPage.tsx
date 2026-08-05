import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Plus, Search, Filter, X, Calendar, User, Building, Euro, Download, Edit, Trash2, Eye, Send, CheckCircle, XCircle, Clock, Receipt } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { useQuotes, crud } from "../../lib/hooks";
import { EditQuoteModal, type QuoteEditValues } from "./EditQuoteModal";
import { CreateQuoteModal } from "./CreateQuoteModal";

interface Devis {
  id: string;
  reference: string;
  client: string;
  contact: string;
  dateCreation: string;
  dateExpiration: string;
  montantHT: number;
  montantTTC: number;
  status: "Brouillon" | "Envoyé" | "Accepté" | "Refusé" | "Expiré";
  missions: number;
}

export function DevisPage() {
  const { currentTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showFilters, setShowFilters] = useState(false);

  const quoteStatusMap: Record<string, Devis["status"]> = {
    draft: "Brouillon",
    sent: "Envoyé",
    accepted: "Accepté",
    accepted_converted: "Accepté",
    finalized: "Accepté",
    rejected: "Refusé",
    expired: "Expiré",
  };

  const quotesQuery = useQuotes({ pageSize: 100 });
  const rawQuotes = quotesQuery.data.quotes;

  const devis: Devis[] = rawQuotes.map((q) => ({
    id: String(q.id),
    reference: `DEV-${String(q.id).padStart(6, "0")}`,
    client: q.client_name || "",
    contact: "",
    dateCreation: (q.created_at || "").slice(0, 10),
    dateExpiration: (q.date_valid_until || "").slice(0, 10),
    montantHT: Number(q.total_ht) || 0,
    montantTTC: Math.round((Number(q.total_ht) || 0) * 1.2 * 100) / 100,
    status: quoteStatusMap[q.status] || "Brouillon",
    missions: q.mission_id ? 1 : 0,
  }));

  const [editingQuote, setEditingQuote] = useState<QuoteEditValues | null>(null);
  const [isEditQuoteOpen, setIsEditQuoteOpen] = useState(false);
  const [isCreateQuoteOpen, setIsCreateQuoteOpen] = useState(false);

  // Bandeau succès / erreur non-bloquant après création manuelle d'un devis.
  const [flash, setFlash] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleNewQuote = () => {
    // Ouvre la modale de création manuelle (client + lignes libres).
    setIsCreateQuoteOpen(true);
  };

  const handleViewQuote = (d: Devis) => {
    const q = rawQuotes.find((x) => String(x.id) === d.id);
    if (!q) return;
    const lines = [
      `Devis ${d.reference}`,
      `Client : ${d.client || "—"}`,
      `Créé le : ${d.dateCreation || "—"}`,
      `Valable jusqu'au : ${d.dateExpiration || "—"}`,
      `Statut : ${d.status}`,
      `Total HT : ${d.montantHT.toFixed(2)} €`,
      q.notes ? `\nNotes :\n${q.notes}` : "",
      q.converted_invoice_number ? `\nConverti en facture : ${q.converted_invoice_number}` : "",
    ].filter(Boolean).join("\n");
    alert(lines);
  };

  const handleEditQuote = (d: Devis) => {
    const q = rawQuotes.find((x) => String(x.id) === d.id);
    if (!q) return;
    setEditingQuote({
      quote_id: q.id,
      status: q.status || "draft",
      notes: q.notes || "",
      date_valid_until: (q.date_valid_until || "").slice(0, 10),
    });
    setIsEditQuoteOpen(true);
  };

  const handleSaveQuote = async (values: QuoteEditValues) => {
    try {
      await crud.updateQuote(values);
      quotesQuery.refetch();
    } catch (e: any) {
      console.error("Mise à jour devis impossible", e);
      alert(e?.response?.data?.error || "Mise à jour du devis impossible");
    }
  };

  const handleDeleteQuote = (_d: Devis) => {
    alert("La suppression définitive d'un devis n'est pas supportée. Passez son statut à « Refusé » ou « Expiré » via Modifier.");
  };

  const handleConvertToInvoice = async (d: Devis) => {
    const q = rawQuotes.find((x) => String(x.id) === d.id);
    if (!q) return;
    if (q.status !== "accepted") {
      alert("Seuls les devis au statut « Accepté » peuvent être convertis en facture.");
      return;
    }
    if (!confirm(`Convertir le devis ${d.reference} en facture client ?`)) return;
    try {
      const res = await crud.convertQuoteToInvoice(q.id);
      alert(`Facture créée : ${res?.invoice_number ?? "(numéro indisponible)"}`);
      quotesQuery.refetch();
    } catch (e: any) {
      console.error("Conversion devis impossible", e);
      alert(e?.response?.data?.error || "Conversion du devis en facture impossible");
    }
  };

  const filteredDevis = devis.filter((d) => {
    const matchesSearch =
      d.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.contact.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExport = (format: "csv" | "excel") => {
    console.log(`Exporting devis as ${format}`);
  };

  const stats = {
    total: devis.length,
    brouillon: devis.filter((d) => d.status === "Brouillon").length,
    envoye: devis.filter((d) => d.status === "Envoyé").length,
    accepte: devis.filter((d) => d.status === "Accepté").length,
    refuse: devis.filter((d) => d.status === "Refusé").length,
    expire: devis.filter((d) => d.status === "Expiré").length,
  };

  return (
    <div className="max-w-[1800px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
            Devis
          </h2>
          <p className="text-sm mt-1" style={{ color: currentTheme.colors.textLight }}>
            Gérez vos devis et propositions commerciales
          </p>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="Total"
          value={stats.total}
          color={currentTheme.colors.text}
          bgColor={currentTheme.colors.primaryLight}
        />
        <StatCard
          label="Brouillon"
          value={stats.brouillon}
          color={currentTheme.colors.textLight}
          bgColor={currentTheme.colors.surface}
        />
        <StatCard
          label="Envoyés"
          value={stats.envoye}
          color={currentTheme.colors.secondary}
          bgColor={currentTheme.colors.secondary + "20"}
        />
        <StatCard
          label="Acceptés"
          value={stats.accepte}
          color={currentTheme.colors.success}
          bgColor={currentTheme.colors.success + "20"}
        />
        <StatCard
          label="Refusés"
          value={stats.refuse}
          color={currentTheme.colors.error}
          bgColor={currentTheme.colors.error + "20"}
        />
        <StatCard
          label="Expirés"
          value={stats.expire}
          color={currentTheme.colors.warning}
          bgColor={currentTheme.colors.warning + "20"}
        />
      </div>

      {/* Barre d'outils */}
      <div
        className="rounded-xl border p-4 mb-6"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Recherche */}
          <div className="flex-1 min-w-[300px]">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: currentTheme.colors.textLight }}
              />
              <input
                type="text"
                placeholder="Rechercher par référence, client ou contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
            </div>
          </div>

          {/* Filtres */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors"
            style={{
              borderColor: showFilters ? currentTheme.colors.primary : currentTheme.colors.border,
              color: showFilters ? currentTheme.colors.primary : currentTheme.colors.text,
              backgroundColor: showFilters ? currentTheme.colors.primaryLight : "transparent",
            }}
          >
            <Filter className="w-4 h-4" />
            Filtres
          </button>

          <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />

          {/* Actions */}
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleExport("excel")}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: currentTheme.colors.success }}
            >
              <Download className="w-4 h-4" />
              Excel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNewQuote}
              className="flex items-center gap-2 px-4 py-2.5 text-white rounded-lg text-sm font-medium"
              style={{ backgroundColor: currentTheme.colors.primary }}
            >
              <Plus className="w-4 h-4" />
              Nouveau devis
            </motion.button>
          </div>
        </div>

        {/* Panneau de filtres */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 mt-4 border-t" style={{ borderColor: currentTheme.colors.border }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                      Statut
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                      style={{
                        borderColor: currentTheme.colors.border,
                        color: currentTheme.colors.text,
                      }}
                    >
                      <option value="all">Tous les statuts</option>
                      <option value="Brouillon">Brouillon</option>
                      <option value="Envoyé">Envoyé</option>
                      <option value="Accepté">Accepté</option>
                      <option value="Refusé">Refusé</option>
                      <option value="Expiré">Expiré</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Liste des devis */}
      {filteredDevis.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis trouvé"
          description={searchQuery || statusFilter !== "all" ? "Essayez de modifier vos critères de recherche" : "Créez votre premier devis pour commencer"}
          action={
            !searchQuery && statusFilter === "all"
              ? {
                  label: "Créer un devis",
                  onClick: handleNewQuote,
                }
              : undefined
          }
        />
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDevis.map((devis, index) => (
            <DevisCard key={devis.id} devis={devis} delay={index * 0.05} currentTheme={currentTheme} onView={handleViewQuote} onEdit={handleEditQuote} onDelete={handleDeleteQuote} onConvert={handleConvertToInvoice} />
          ))}
        </div>
      ) : (
        <DevisTable devis={filteredDevis} currentTheme={currentTheme} onView={handleViewQuote} onEdit={handleEditQuote} onDelete={handleDeleteQuote} onConvert={handleConvertToInvoice} />
      )}

      <EditQuoteModal
        isOpen={isEditQuoteOpen}
        onClose={() => {
          setIsEditQuoteOpen(false);
          setEditingQuote(null);
        }}
        quote={editingQuote}
        onSave={handleSaveQuote}
      />

      {/* Modale de création manuelle d'un devis (sans mission source) */}
      <CreateQuoteModal
        isOpen={isCreateQuoteOpen}
        onClose={() => setIsCreateQuoteOpen(false)}
        onCreated={(res) => {
          quotesQuery.refetch();
          setFlash({
            type: "success",
            msg: `Devis #${res.quote_id} créé (total ${res.total_ht.toFixed(2)} € HT).`,
          });
          window.setTimeout(() => setFlash(null), 6000);
        }}
        onError={(msg) => {
          setFlash({ type: "error", msg });
          window.setTimeout(() => setFlash(null), 8000);
        }}
      />

      {/* Toast flottant non bloquant — rendu en haut de la page */}
      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            role="status"
            className="fixed top-4 right-4 z-50 px-5 py-3 rounded-lg shadow-lg border text-sm font-medium max-w-md"
            style={{
              backgroundColor: flash.type === "success" ? "#ECFDF5" : "#FEF2F2",
              borderColor: flash.type === "success" ? "#A7F3D0" : "#FECACA",
              color: flash.type === "success" ? "#065F46" : "#991B1B",
            }}
          >
            {flash.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, color, bgColor }: { label: string; value: number; color: string; bgColor: string }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="rounded-lg p-4 text-center"
      style={{ backgroundColor: bgColor }}
    >
      <p className="text-2xl font-bold mb-1" style={{ color }}>
        {value}
      </p>
      <p className="text-xs" style={{ color }}>
        {label}
      </p>
    </motion.div>
  );
}

function DevisCard({ devis, delay, currentTheme, onView, onEdit, onDelete, onConvert }: { devis: Devis; delay: number; currentTheme: any; onView: (d: Devis) => void; onEdit: (d: Devis) => void; onDelete: (d: Devis) => void; onConvert: (d: Devis) => void }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="rounded-xl border overflow-hidden hover:shadow-lg transition-all cursor-pointer"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1" style={{ color: currentTheme.colors.text }}>
              {devis.reference}
            </h3>
            <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              {devis.missions} mission{devis.missions > 1 ? "s" : ""}
            </p>
          </div>
          <StatusChip status={devis.status} />
        </div>

        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Building className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
            <span style={{ color: currentTheme.colors.text }}>{devis.client}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
            <span style={{ color: currentTheme.colors.text }}>{devis.contact}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
            <span style={{ color: currentTheme.colors.text }}>
              Expire le {new Date(devis.dateExpiration).toLocaleDateString("fr-FR")}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t mb-4" style={{ borderColor: currentTheme.colors.border }}>
          <div className="flex items-baseline justify-between">
            <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              Total HT
            </span>
            <span className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
              {devis.montantHT.toFixed(2)} €
            </span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              Total TTC
            </span>
            <span className="text-base font-semibold" style={{ color: currentTheme.colors.primary }}>
              {devis.montantTTC.toFixed(2)} €
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onView(devis)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
            title="Voir le devis"
          >
            <Eye className="w-4 h-4" />
            Voir
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEdit(devis)}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
            title="Modifier"
          >
            <Edit className="w-4 h-4" />
          </motion.button>
          {devis.status === "accepted" && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onConvert(devis)}
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: currentTheme.colors.success }}
              title="Convertir en facture"
            >
              <Receipt className="w-4 h-4" />
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onDelete(devis)}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.error + "20",
              color: currentTheme.colors.error,
            }}
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

function DevisTable({ devis, currentTheme, onView, onEdit, onDelete, onConvert }: { devis: Devis[]; currentTheme: any; onView: (d: Devis) => void; onEdit: (d: Devis) => void; onDelete: (d: Devis) => void; onConvert: (d: Devis) => void }) {
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
                Client
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Contact
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Date création
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Expiration
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Missions
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Total TTC
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Statut
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {devis.map((d, index) => (
              <motion.tr
                key={d.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="border-t hover:bg-opacity-5 transition-colors"
                style={{ borderColor: currentTheme.colors.border }}
              >
                <td className="px-4 py-3">
                  <span className="font-medium text-sm" style={{ color: currentTheme.colors.text }}>
                    {d.reference}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {d.client}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                    {d.contact}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {new Date(d.dateCreation).toLocaleDateString("fr-FR")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {new Date(d.dateExpiration).toLocaleDateString("fr-FR")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {d.missions}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-sm" style={{ color: currentTheme.colors.primary }}>
                    {d.montantTTC.toFixed(2)} €
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={d.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onView(d)}
                      className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                      style={{ color: currentTheme.colors.primary }}
                      title="Voir"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(d)}
                      className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                      style={{ color: currentTheme.colors.primary }}
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {d.status === "accepted" && (
                      <button
                        onClick={() => onConvert(d)}
                        className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                        style={{ color: currentTheme.colors.success }}
                        title="Convertir en facture"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => onDelete(d)}
                      className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                      style={{ color: currentTheme.colors.error }}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
