import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

interface Invoice {
  id: string;
  ref: string;
  client: string;
  date: string;
  dueDate: string;
  totalHT: number;
  totalTTC: number;
  status: "Brouillon" | "Envoyée" | "Payée" | "En retard" | "Annulée";
  paymentMethod?: string;
  missions: number;
}

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSave: (invoice: Invoice) => void;
}

export function EditInvoiceModal({ isOpen, onClose, invoice, onSave }: EditInvoiceModalProps) {
  const { currentTheme } = useTheme();
  const [formData, setFormData] = useState<Invoice>({
    id: "",
    ref: "",
    client: "",
    date: "",
    dueDate: "",
    totalHT: 0,
    totalTTC: 0,
    status: "Brouillon",
    paymentMethod: "",
    missions: 0,
  });

  // Mettre à jour les données du formulaire quand la facture change
  useEffect(() => {
    if (invoice) {
      setFormData(invoice);
    }
  }, [invoice]);

  const handleChange = (field: keyof Invoice, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const calculateTTC = (ht: number) => {
    return ht * 1.2; // TVA 20%
  };

  const handleHTChange = (value: string) => {
    const ht = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      totalHT: ht,
      totalTTC: calculateTTC(ht),
    }));
  };

  if (!invoice) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier la facture" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Informations générales */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Informations générales
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Référence
                </label>
                <input
                  type="text"
                  value={formData.ref}
                  disabled
                  className="w-full px-4 py-2.5 border rounded-lg bg-opacity-50 cursor-not-allowed"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.textLight,
                    backgroundColor: currentTheme.colors.primaryLight,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Client *
                </label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) => handleChange("client", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Date de facture *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleChange("date", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Date d'échéance *
                </label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Nombre de missions
                </label>
                <input
                  type="number"
                  value={formData.missions}
                  onChange={(e) => handleChange("missions", parseInt(e.target.value) || 0)}
                  min="0"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Mode de règlement
                </label>
                <select
                  value={formData.paymentMethod || ""}
                  onChange={(e) => handleChange("paymentMethod", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">Sélectionner...</option>
                  <option value="Virement">Virement</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Carte bancaire">Carte bancaire</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Prélèvement">Prélèvement</option>
                </select>
              </div>
            </div>
          </div>

          {/* Montants */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Montants
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Total HT (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalHT}
                  onChange={(e) => handleHTChange(e.target.value)}
                  required
                  min="0"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Total TTC (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.totalTTC}
                  disabled
                  className="w-full px-4 py-2.5 border rounded-lg bg-opacity-50 cursor-not-allowed font-semibold"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.primary,
                    backgroundColor: currentTheme.colors.primaryLight,
                  }}
                />
              </div>
            </div>

            <p className="text-xs mt-2" style={{ color: currentTheme.colors.textLight }}>
              TVA (20%) : {(formData.totalTTC - formData.totalHT).toFixed(2)} €
            </p>
          </div>

          {/* Statut */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Statut de la facture
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(["Brouillon", "Envoyée", "Payée", "En retard", "Annulée"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleChange("status", status)}
                  className="px-4 py-3 rounded-lg border-2 font-medium transition-all"
                  style={{
                    borderColor:
                      formData.status === status ? currentTheme.colors.primary : currentTheme.colors.border,
                    backgroundColor:
                      formData.status === status ? currentTheme.colors.primaryLight : "transparent",
                    color: formData.status === status ? currentTheme.colors.primary : currentTheme.colors.text,
                  }}
                >
                  {status}
                </button>
              ))}
            </div>
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
            Enregistrer
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
