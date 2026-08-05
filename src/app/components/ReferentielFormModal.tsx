import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

export interface ReferentielField {
  key: string;
  label: string;
  type: "text" | "number";
  required?: boolean;
  placeholder?: string;
  step?: string;
}

interface ReferentielFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: Record<string, any>) => void | Promise<void>;
  title: string;
  fields: ReferentielField[];
  initialValues: Record<string, any>;
}

/**
 * Modal générique de création/édition pour les référentiels d'entité
 * (langues, termes de paiement, ...). Évite de dupliquer une modale par
 * référentiel : la liste de champs pilote entièrement le formulaire.
 */
export function ReferentielFormModal({ isOpen, onClose, onSave, title, fields, initialValues }: ReferentielFormModalProps) {
  const { currentTheme } = useTheme();
  const [values, setValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, any> = {};
      fields.forEach((f) => {
        initial[f.key] = initialValues[f.key] ?? "";
      });
      setValues(initial);
    }
  }, [isOpen]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                {field.label}{field.required ? " *" : ""}
              </label>
              <input
                type={field.type}
                step={field.step}
                required={field.required}
                placeholder={field.placeholder}
                value={values[field.key] ?? ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-6 border-t" style={{ borderColor: currentTheme.colors.border }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border rounded-lg font-medium flex items-center gap-2"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          >
            <X className="w-4 h-4" />
            Annuler
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-white rounded-lg font-medium flex items-center gap-2"
            style={{ backgroundColor: currentTheme.colors.primary, opacity: saving ? 0.7 : 1 }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Enregistrement..." : "Enregistrer"}
          </motion.button>
        </div>
      </form>
    </Modal>
  );
}
