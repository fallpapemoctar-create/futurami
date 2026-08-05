import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";
import { Save } from "lucide-react";

export interface QuoteEditValues {
  quote_id: number;
  status: string;
  notes: string;
  date_valid_until: string;
}

interface EditQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: QuoteEditValues | null;
  onSave: (values: QuoteEditValues) => void;
}

const STATUSES: { value: string; label: string }[] = [
  { value: "draft", label: "Brouillon" },
  { value: "sent", label: "Envoyé" },
  { value: "accepted", label: "Accepté" },
  { value: "rejected", label: "Refusé" },
  { value: "expired", label: "Expiré" },
];

export function EditQuoteModal({ isOpen, onClose, quote, onSave }: EditQuoteModalProps) {
  const { currentTheme } = useTheme();
  const [form, setForm] = useState<QuoteEditValues>({
    quote_id: 0,
    status: "draft",
    notes: "",
    date_valid_until: "",
  });

  useEffect(() => {
    if (isOpen && quote) setForm(quote);
  }, [isOpen, quote]);

  if (!quote) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Modifier le devis #${quote.quote_id}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
            Statut
          </label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
            Date de validité
          </label>
          <input
            type="date"
            value={form.date_valid_until}
            onChange={(e) => setForm((f) => ({ ...f, date_valid_until: e.target.value }))}
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
            Notes
          </label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={4}
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: currentTheme.colors.border }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium"
            style={{ backgroundColor: currentTheme.colors.surface, color: currentTheme.colors.text, border: `1px solid ${currentTheme.colors.border}` }}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Save className="w-4 h-4" />
            Enregistrer
          </button>
        </div>
      </form>
    </Modal>
  );
}
