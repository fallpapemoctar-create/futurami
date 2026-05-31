import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

interface Mission {
  id: string;
  ref: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  interpreter: string;
  language: string;
  client: string;
  location: string;
  status: "Brouillon" | "Validée" | "Terminée" | "Annulée";
}

interface EditMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: Mission | null;
  onSave: (mission: Mission) => void;
}

export function EditMissionModal({ isOpen, onClose, mission, onSave }: EditMissionModalProps) {
  const { currentTheme } = useTheme();
  const [formData, setFormData] = useState<Mission>({
    id: "",
    ref: "",
    type: "",
    date: "",
    time: "",
    duration: "",
    interpreter: "",
    language: "",
    client: "",
    location: "",
    status: "Brouillon",
  });

  // Mettre à jour les données du formulaire quand la mission change
  useEffect(() => {
    if (mission) {
      setFormData(mission);
    }
  }, [mission]);

  const handleChange = (field: keyof Mission, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  if (!mission) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifier la mission" size="lg">
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
                  Type de mission *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">Sélectionner...</option>
                  <option value="Interprétariat téléphonique">Interprétariat téléphonique</option>
                  <option value="Traduction">Traduction</option>
                  <option value="Tribunal judiciaire">Tribunal judiciaire</option>
                  <option value="Visite médicale">Visite médicale</option>
                  <option value="Rendez-vous administratif">Rendez-vous administratif</option>
                </select>
              </div>
            </div>
          </div>

          {/* Planification */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Planification
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Date *
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
                  Heure *
                </label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => handleChange("time", e.target.value)}
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
                  Durée
                </label>
                <input
                  type="text"
                  value={formData.duration}
                  onChange={(e) => handleChange("duration", e.target.value)}
                  placeholder="Ex: 60 min"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Participants
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Interprète *
                </label>
                <input
                  type="text"
                  value={formData.interpreter}
                  onChange={(e) => handleChange("interpreter", e.target.value)}
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
                  Langue *
                </label>
                <input
                  type="text"
                  value={formData.language}
                  onChange={(e) => handleChange("language", e.target.value)}
                  required
                  placeholder="Ex: Géorgien vers Français"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
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
                  Lieu
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="Ex: Sur place, Téléphone"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Statut */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Statut
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {(["Brouillon", "Validée", "Terminée", "Annulée"] as const).map((status) => (
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
