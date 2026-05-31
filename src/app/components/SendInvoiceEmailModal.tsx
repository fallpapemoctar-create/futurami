import { useState } from "react";
import { motion } from "motion/react";
import { Send, X, Paperclip, UserPlus, Eye } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

interface Invoice {
  id: string;
  ref: string;
  client: string;
  totalTTC: number;
}

interface SendInvoiceEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onSend: (emailData: EmailData) => void;
}

export interface EmailData {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  message: string;
  attachInvoice: boolean;
}

export function SendInvoiceEmailModal({ isOpen, onClose, invoice, onSend }: SendInvoiceEmailModalProps) {
  const { currentTheme } = useTheme();
  const [formData, setFormData] = useState<EmailData>({
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    message: "",
    attachInvoice: true,
  });

  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");

  // Initialiser le formulaire quand la facture change
  useState(() => {
    if (invoice) {
      setFormData({
        to: [],
        cc: [],
        bcc: [],
        subject: `Facture ${invoice.ref} - ${invoice.client}`,
        message: `Bonjour,

Veuillez trouver ci-joint la facture ${invoice.ref} d'un montant de ${invoice.totalTTC.toFixed(2)} € TTC.

Nous restons à votre disposition pour tout renseignement complémentaire.

Cordialement,
L'équipe AMI`,
        attachInvoice: true,
      });
    }
  });

  const handleAddEmail = (type: "to" | "cc" | "bcc") => {
    const input = type === "to" ? toInput : type === "cc" ? ccInput : bccInput;
    if (input && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
      setFormData((prev) => ({
        ...prev,
        [type]: [...prev[type], input],
      }));
      if (type === "to") setToInput("");
      if (type === "cc") setCcInput("");
      if (type === "bcc") setBccInput("");
    }
  };

  const handleRemoveEmail = (type: "to" | "cc" | "bcc", email: string) => {
    setFormData((prev) => ({
      ...prev,
      [type]: prev[type].filter((e) => e !== email),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.to.length === 0) {
      alert("Veuillez ajouter au moins un destinataire");
      return;
    }
    onSend(formData);
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent, type: "to" | "cc" | "bcc") => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail(type);
    }
  };

  if (!invoice) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Envoyer la facture par email" size="lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Informations facture */}
          <div
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              borderColor: currentTheme.colors.primary,
            }}
          >
            <div className="flex items-center gap-3">
              <Paperclip className="w-5 h-5" style={{ color: currentTheme.colors.primary }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                  Pièce jointe : {invoice.ref}.pdf
                </p>
                <p className="text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                  Facture pour {invoice.client} - {invoice.totalTTC.toFixed(2)} € TTC
                </p>
              </div>
            </div>
          </div>

          {/* Destinataires */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Destinataires *
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, "to")}
                  placeholder="Saisir une adresse email et appuyer sur Entrée"
                  className="flex-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddEmail("to")}
                  className="px-4 py-2.5 rounded-lg font-medium flex items-center gap-2"
                  style={{
                    backgroundColor: currentTheme.colors.primaryLight,
                    color: currentTheme.colors.primary,
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                  Ajouter
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.to.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                    style={{
                      backgroundColor: currentTheme.colors.primary,
                      color: "#FFFFFF",
                    }}
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail("to", email)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CC */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Copie (CC)
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, "cc")}
                  placeholder="Copie carbone"
                  className="flex-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddEmail("cc")}
                  className="px-4 py-2.5 rounded-lg font-medium"
                  style={{
                    backgroundColor: currentTheme.colors.primaryLight,
                    color: currentTheme.colors.primary,
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.cc.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                    style={{
                      backgroundColor: currentTheme.colors.secondary + "30",
                      color: currentTheme.colors.secondary,
                    }}
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail("cc", email)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* BCC */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Copie cachée (BCC)
            </label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, "bcc")}
                  placeholder="Copie carbone invisible"
                  className="flex-1 px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddEmail("bcc")}
                  className="px-4 py-2.5 rounded-lg font-medium"
                  style={{
                    backgroundColor: currentTheme.colors.primaryLight,
                    color: currentTheme.colors.primary,
                  }}
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.bcc.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                    style={{
                      backgroundColor: currentTheme.colors.textLight + "30",
                      color: currentTheme.colors.textLight,
                    }}
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail("bcc", email)}
                      className="hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Sujet */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Objet *
            </label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
              required
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Message *
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
              required
              rows={8}
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t" style={{ borderColor: currentTheme.colors.border }}>
          <button
            type="button"
            className="flex items-center gap-2 px-4 py-2 text-sm"
            style={{ color: currentTheme.colors.primary }}
          >
            <Eye className="w-4 h-4" />
            Aperçu
          </button>
          <div className="flex gap-3">
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
              <Send className="w-4 h-4" />
              Envoyer
            </motion.button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
