import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Save, Plus, Trash2 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";
import { AutocompleteSelect } from "./AutocompleteSelect";
import { useClients, useLanguages, crud } from "../../lib/hooks";

/**
 * Ligne saisie manuellement dans un devis libre.
 * Correspond à `invoice_draft_lines` :
 *   description, quantity, unit_price, tva_rate, discount.
 * `productLabel` est un champ UI (nom de la prestation choisie dans le combo
 * Langue/Produit) qui préremplit `description`, `unit_price`, `tva_rate`.
 */
export interface ManualQuoteLine {
  productLabel: string;   // libellé prestation (langue) — préremplit description + prix
  description: string;
  quantity: number;
  unit_price: number;
  tva_rate: number;
  discount: number;
}

export interface ManualQuoteValues {
  client_id: number;
  client_name: string;
  date_valid_until: string; // YYYY-MM-DD
  month: string;            // YYYY-MM
  notes: string;
  lines: ManualQuoteLine[];
}

interface CreateQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (result: { quote_id: number; total_ht: number }) => void;
  onError?: (msg: string) => void;
}

const EMPTY_LINE: ManualQuoteLine = {
  productLabel: "",
  description: "",
  quantity: 1,
  unit_price: 0,
  tva_rate: 0,
  discount: 0,
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function plus30DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CreateQuoteModal({ isOpen, onClose, onCreated, onError }: CreateQuoteModalProps) {
  const { currentTheme } = useTheme();
  const { data: clients, loading: clientsLoading } = useClients({ activeOnly: true });
  const { data: languages, loading: languagesLoading } = useLanguages();

  // État du formulaire
  const [selectedClientLabel, setSelectedClientLabel] = useState("");
  const [dateValidUntil, setDateValidUntil] = useState(plus30DaysISO());
  const [month, setMonth] = useState(currentMonth());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<ManualQuoteLine[]>([{ ...EMPTY_LINE }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Réinitialiser à chaque ouverture — l'utilisateur repart d'un devis vide.
  useEffect(() => {
    if (isOpen) {
      setSelectedClientLabel("");
      setDateValidUntil(plus30DaysISO());
      setMonth(currentMonth());
      setNotes("");
      setLines([{ ...EMPTY_LINE }]);
      setError(null);
    }
  }, [isOpen]);

  // Options combobox
  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({ id: c.id ?? c.name, value: c.name, label: c.name })),
    [clients]
  );
  const languageOptions = useMemo(
    () =>
      languages.map((l) => {
        const label = l.display_name || l.label || l.ref;
        return { id: l.id ?? label, value: label, label };
      }),
    [languages]
  );

  const selectedClientId = useMemo(() => {
    const m = clients.find((c) => c.name === selectedClientLabel);
    return m?.id ?? null;
  }, [clients, selectedClientLabel]);

  // Totaux calculés
  const totals = useMemo(() => {
    let totalHt = 0;
    let totalTva = 0;
    for (const l of lines) {
      const lineHt = l.quantity * l.unit_price * (1 - l.discount / 100);
      totalHt += lineHt;
      totalTva += lineHt * (l.tva_rate / 100);
    }
    return {
      totalHt: Math.round(totalHt * 100) / 100,
      totalTva: Math.round(totalTva * 100) / 100,
      totalTtc: Math.round((totalHt + totalTva) * 100) / 100,
    };
  }, [lines]);

  // Manipulation des lignes
  const updateLine = (index: number, patch: Partial<ManualQuoteLine>) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleLanguageChange = (index: number, label: string) => {
    // Préremplissage à partir de la langue/produit sélectionnée (prix, TVA).
    const lang = languages.find((l) => (l.display_name || l.label || l.ref) === label);
    updateLine(index, {
      productLabel: label,
      description: label || lines[index].description,
      unit_price: lang?.price != null ? Number(lang.price) : lines[index].unit_price,
      tva_rate: lang?.tva_tx != null ? Number(lang.tva_tx) : lines[index].tva_rate,
    });
  };

  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  const removeLine = (index: number) =>
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedClientId) {
      setError("Veuillez sélectionner un client.");
      return;
    }
    // Au moins une ligne non totalement vide.
    const validLines = lines.filter(
      (l) => (l.description || "").trim() !== "" || l.unit_price > 0 || l.quantity > 0
    );
    if (validLines.length === 0) {
      setError("Ajoutez au moins une ligne au devis.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await crud.createQuoteManual({
        client_id: selectedClientId,
        date_valid_until: dateValidUntil || undefined,
        month: month || undefined,
        notes: notes || undefined,
        lines: validLines.map((l) => ({
          description: l.description || l.productLabel || "Prestation",
          quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0,
          tva_rate: Number(l.tva_rate) || 0,
          discount: Number(l.discount) || 0,
        })),
      });
      onCreated({
        quote_id: Number(res?.quote_id ?? 0),
        total_ht: Number(res?.total_ht ?? 0),
      });
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.error || e?.message || "Création du devis impossible.";
      setError(msg);
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau devis" size="xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ─── En-tête : client + validité ─────────────────────────────── */}
        <div>
          <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
            Informations générales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Client *
              </label>
              <AutocompleteSelect
                value={selectedClientLabel}
                onChange={setSelectedClientLabel}
                options={clientOptions}
                loading={clientsLoading}
                placeholder="Rechercher un client"
                required
                helperText="Sélectionnez la société à qui le devis sera adressé."
                currentTheme={currentTheme}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Date de validité
              </label>
              <input
                type="date"
                value={dateValidUntil}
                min={todayISO()}
                onChange={(e) => setDateValidUntil(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Mois de facturation
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
              />
            </div>
          </div>
        </div>

        {/* ─── Lignes du devis ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold" style={{ color: currentTheme.colors.text }}>
              Lignes de prestations
            </h3>
            <button
              type="button"
              onClick={addLine}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: currentTheme.colors.primary }}
            >
              <Plus className="w-4 h-4" />
              Ajouter une ligne
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => {
              const lineHt = line.quantity * line.unit_price * (1 - line.discount / 100);
              return (
                <div
                  key={index}
                  className="rounded-lg border p-4"
                  style={{
                    borderColor: currentTheme.colors.border,
                    backgroundColor: currentTheme.colors.surface,
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Prestation (langue/produit) — préremplit description + prix */}
                    <div className="md:col-span-4">
                      <label className="block text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
                        Prestation (référentiel Langue)
                      </label>
                      <AutocompleteSelect
                        value={line.productLabel}
                        onChange={(v) => handleLanguageChange(index, v)}
                        options={languageOptions}
                        loading={languagesLoading}
                        placeholder="Choisir une prestation"
                        currentTheme={currentTheme}
                      />
                    </div>

                    <div className="md:col-span-8">
                      <label className="block text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        placeholder="Description libre de la prestation"
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
                        Quantité
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
                        PU HT (€)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
                        TVA (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={line.tva_rate}
                        onChange={(e) => updateLine(index, { tva_rate: Number(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
                        Remise (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={line.discount}
                        onChange={(e) => updateLine(index, { discount: Number(e.target.value) })}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm"
                        style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
                      />
                    </div>

                    <div className="md:col-span-3 flex items-end">
                      <div
                        className="w-full px-3 py-2 rounded-lg text-sm font-semibold text-right"
                        style={{
                          backgroundColor: currentTheme.colors.primaryLight,
                          color: currentTheme.colors.primary,
                        }}
                      >
                        {(Math.round(lineHt * 100) / 100).toFixed(2)} € HT
                      </div>
                    </div>

                    <div className="md:col-span-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 1}
                        title="Supprimer cette ligne"
                        className="p-2 rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: currentTheme.colors.error }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Totaux ──────────────────────────────────────────────────── */}
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.background }}
        >
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div style={{ color: currentTheme.colors.textLight }}>Total HT</div>
              <div className="text-lg font-semibold" style={{ color: currentTheme.colors.text }}>
                {totals.totalHt.toFixed(2)} €
              </div>
            </div>
            <div>
              <div style={{ color: currentTheme.colors.textLight }}>Total TVA</div>
              <div className="text-lg font-semibold" style={{ color: currentTheme.colors.text }}>
                {totals.totalTva.toFixed(2)} €
              </div>
            </div>
            <div>
              <div style={{ color: currentTheme.colors.textLight }}>Total TTC</div>
              <div className="text-lg font-bold" style={{ color: currentTheme.colors.primary }}>
                {totals.totalTtc.toFixed(2)} €
              </div>
            </div>
          </div>
        </div>

        {/* ─── Notes ───────────────────────────────────────────────────── */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
            Notes / Conditions
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Conditions particulières, message au client…"
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          />
        </div>

        {/* ─── Erreur ──────────────────────────────────────────────────── */}
        {error && (
          <div
            role="alert"
            className="px-4 py-2.5 rounded-lg border text-sm"
            style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: "#991B1B" }}
          >
            {error}
          </div>
        )}

        {/* ─── Boutons ─────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: currentTheme.colors.border }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              backgroundColor: currentTheme.colors.surface,
              color: currentTheme.colors.text,
              border: `1px solid ${currentTheme.colors.border}`,
            }}
          >
            Annuler
          </button>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-60"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Save className="w-4 h-4" />
            {submitting ? "Création…" : "Créer le devis"}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
