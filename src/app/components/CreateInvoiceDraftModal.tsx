import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";
import { Save } from "lucide-react";
import { useClients } from "../../lib/hooks";

export interface InvoiceDraftValues {
  client_id?: number;
  client_name?: string;
  month: string; // YYYY-MM
}

interface CreateInvoiceDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (values: InvoiceDraftValues) => void;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CreateInvoiceDraftModal({ isOpen, onClose, onCreate }: CreateInvoiceDraftModalProps) {
  const { currentTheme } = useTheme();
  const { data: clients } = useClients({ activeOnly: true });
  const [clientId, setClientId] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonth());

  useEffect(() => {
    if (isOpen) {
      setClientId("");
      setMonth(currentMonth());
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !month) return;
    const client = clients.find((c) => String(c.id) === clientId);
    onCreate({
      client_id: Number(clientId),
      client_name: client?.name,
      month,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un brouillon de facture" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
            Client *
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          >
            <option value="">— Sélectionner un client —</option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
            Mois facturé *
          </label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: currentTheme.colors.border }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-medium"
            style={{
              backgroundColor: currentTheme.colors.surface,
              color: currentTheme.colors.text,
              border: `1px solid ${currentTheme.colors.border}`,
            }}
          >
            Annuler
          </button>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Save className="w-4 h-4" />
            Créer
          </button>
        </div>
      </form>
    </Modal>
  );
}
