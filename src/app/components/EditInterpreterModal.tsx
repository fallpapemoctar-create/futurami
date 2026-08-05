import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

interface Interpreter {
  name: string;
  languages: string;
  phone?: string;
  email?: string;
  status: "Disponible" | "Occupé" | "Indisponible";
  billing?: string;
}

interface EditInterpreterModalProps {
  isOpen: boolean;
  onClose: () => void;
  interpreter: Interpreter | null;
  onSave: (interpreter: Interpreter) => void;
}

const EMPTY_INTERPRETER: Interpreter = {
  name: "",
  languages: "",
  phone: "",
  email: "",
  status: "Disponible",
  billing: "",
};

export function EditInterpreterModal({ isOpen, onClose, interpreter, onSave }: EditInterpreterModalProps) {
  const { currentTheme } = useTheme();
  const isCreating = !interpreter;
  const [formData, setFormData] = useState<Interpreter>(EMPTY_INTERPRETER);

  useEffect(() => {
    if (isOpen) {
      setFormData(interpreter ?? EMPTY_INTERPRETER);
    }
  }, [isOpen, interpreter]);

  const handleChange = (field: keyof Interpreter, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCreating ? "Nouvel interprète" : "Modifier l'interprète"} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Informations personnelles */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Informations personnelles
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
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
                  Langues *
                </label>
                <textarea
                  value={formData.languages}
                  onChange={(e) => handleChange("languages", e.target.value)}
                  required
                  rows={3}
                  placeholder="Ex: Géorgien vers Français, Russe vers Français"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Coordonnées
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={formData.phone || ""}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="Ex: 06 12 34 56 78"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="exemple@email.com"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Facturation */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Informations de facturation
            </h3>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Tarification
              </label>
              <input
                type="text"
                value={formData.billing || ""}
                onChange={(e) => handleChange("billing", e.target.value)}
                placeholder="Ex: FACTURATION -30€ -15€"
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Statut de disponibilité
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(["Disponible", "Occupé", "Indisponible"] as const).map((status) => (
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
