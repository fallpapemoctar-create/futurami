import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, X, FileText, AlertCircle } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

interface Invoice {
  id: string;
  ref: string;
  client: string;
  date: string;
  totalHT: number;
  totalTTC: number;
}

interface CreateCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onCreate: (creditNote: CreditNoteData) => void;
}

export interface CreditNoteData {
  originalInvoiceId: string;
  originalInvoiceRef: string;
  reason: string;
  type: "total" | "partial";
  amountHT: number;
  amountTTC: number;
  description: string;
}

export function CreateCreditNoteModal({ isOpen, onClose, invoice, onCreate }: CreateCreditNoteModalProps) {
  const { currentTheme } = useTheme();
  const [formData, setFormData] = useState<Omit<CreditNoteData, "originalInvoiceId" | "originalInvoiceRef">>({
    reason: "",
    type: "total",
    amountHT: 0,
    amountTTC: 0,
    description: "",
  });

  // Initialiser avec les montants de la facture quand elle change
  useEffect(() => {
    if (invoice && isOpen) {
      setFormData({
        reason: "",
        type: "total",
        amountHT: invoice.totalHT,
        amountTTC: invoice.totalTTC,
        description: "",
      });
    }
  }, [invoice, isOpen]);

  const handleTypeChange = (type: "total" | "partial") => {
    setFormData((prev) => ({
      ...prev,
      type,
      amountHT: type === "total" && invoice ? invoice.totalHT : prev.amountHT,
      amountTTC: type === "total" && invoice ? invoice.totalTTC : prev.amountTTC,
    }));
  };

  const handleAmountHTChange = (value: string) => {
    const ht = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      amountHT: ht,
      amountTTC: ht * 1.2, // TVA 20%
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    if (formData.amountHT > invoice.totalHT) {
      alert("Le montant de l'avoir ne peut pas dépasser le montant de la facture originale");
      return;
    }

    onCreate({
      originalInvoiceId: invoice.id,
      originalInvoiceRef: invoice.ref,
      ...formData,
    });
    onClose();
  };

  if (!invoice) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un avoir" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Informations facture originale */}
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              borderColor: currentTheme.colors.primary,
            }}
          >
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: currentTheme.colors.primary }} />
              <div>
                <p className="font-semibold text-sm mb-1" style={{ color: currentTheme.colors.text }}>
                  Facture originale : {invoice.ref}
                </p>
                <div className="text-xs space-y-1" style={{ color: currentTheme.colors.textLight }}>
                  <p>Client : {invoice.client}</p>
                  <p>Date : {new Date(invoice.date).toLocaleDateString("fr-FR")}</p>
                  <p>
                    Montant : {invoice.totalHT.toFixed(2)} € HT / {invoice.totalTTC.toFixed(2)} € TTC
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Alerte */}
          <div
            className="p-4 rounded-lg border flex items-start gap-3"
            style={{
              backgroundColor: currentTheme.colors.warning + "10",
              borderColor: currentTheme.colors.warning,
            }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: currentTheme.colors.warning }} />
            <div>
              <p className="font-semibold text-sm mb-1" style={{ color: currentTheme.colors.text }}>
                Attention
              </p>
              <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
                Un avoir est un document qui annule ou réduit le montant d'une facture. Cette action est irréversible.
              </p>
            </div>
          </div>

          {/* Type d'avoir */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: currentTheme.colors.text }}>
              Type d'avoir *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange("total")}
                className="px-4 py-4 rounded-lg border-2 font-medium transition-all text-left"
                style={{
                  borderColor:
                    formData.type === "total" ? currentTheme.colors.primary : currentTheme.colors.border,
                  backgroundColor:
                    formData.type === "total" ? currentTheme.colors.primaryLight : "transparent",
                  color: formData.type === "total" ? currentTheme.colors.primary : currentTheme.colors.text,
                }}
              >
                <p className="font-semibold mb-1">Avoir total</p>
                <p className="text-xs opacity-75">Annulation complète de la facture</p>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange("partial")}
                className="px-4 py-4 rounded-lg border-2 font-medium transition-all text-left"
                style={{
                  borderColor:
                    formData.type === "partial" ? currentTheme.colors.primary : currentTheme.colors.border,
                  backgroundColor:
                    formData.type === "partial" ? currentTheme.colors.primaryLight : "transparent",
                  color: formData.type === "partial" ? currentTheme.colors.primary : currentTheme.colors.text,
                }}
              >
                <p className="font-semibold mb-1">Avoir partiel</p>
                <p className="text-xs opacity-75">Remboursement partiel ou réduction</p>
              </button>
            </div>
          </div>

          {/* Motif */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Motif de l'avoir *
            </label>
            <select
              value={formData.reason}
              onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option value="">Sélectionner un motif...</option>
              <option value="Erreur de facturation">Erreur de facturation</option>
              <option value="Retour de marchandise">Retour de marchandise</option>
              <option value="Remise commerciale">Remise commerciale</option>
              <option value="Geste commercial">Geste commercial</option>
              <option value="Annulation de prestation">Annulation de prestation</option>
              <option value="Erreur de prix">Erreur de prix</option>
              <option value="Autre">Autre</option>
            </select>
          </div>

          {/* Montants */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: currentTheme.colors.text }}>
              Montant de l'avoir
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: currentTheme.colors.textLight }}>
                  Montant HT (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amountHT}
                  onChange={(e) => handleAmountHTChange(e.target.value)}
                  required
                  min="0"
                  max={invoice.totalHT}
                  disabled={formData.type === "total"}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <p className="text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                  Maximum : {invoice.totalHT.toFixed(2)} €
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: currentTheme.colors.textLight }}>
                  Montant TTC (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amountTTC}
                  disabled
                  className="w-full px-4 py-2.5 border rounded-lg font-semibold cursor-not-allowed"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.primary,
                    backgroundColor: currentTheme.colors.primaryLight,
                  }}
                />
                <p className="text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                  TVA (20%) : {(formData.amountTTC - formData.amountHT).toFixed(2)} €
                </p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Description / Commentaire *
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              required
              rows={4}
              placeholder="Détaillez les raisons de l'avoir..."
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: currentTheme.colors.border }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border rounded-lg font-medium flex items-center gap-2"
            style={{
              borderColor: currentTheme.colors.border,
              color: currentTheme.colors.text,
            }}
          >
            <X className="w-4 h-4" />
            Annuler
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="px-6 py-2.5 text-white rounded-lg font-medium flex items-center gap-2"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Save className="w-4 h-4" />
            Créer l'avoir
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
