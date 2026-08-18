import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  permissions: {
    missions: boolean;
    invoices: boolean;
    interpreters: boolean;
    clients: boolean;
    reports: boolean;
    settings: boolean;
  };
  status: "Actif" | "Inactif";
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSave: (user: User) => void;
}

const EMPTY_USER: User = {
  id: "",
  username: "",
  name: "",
  email: "",
  role: "",
  password: "",
  permissions: {
    missions: false,
    invoices: false,
    interpreters: false,
    clients: false,
    reports: false,
    settings: false,
  },
  status: "Actif",
};

export function EditUserModal({ isOpen, onClose, user, onSave }: EditUserModalProps) {
  const { currentTheme } = useTheme();
  const isCreating = !user;
  const [formData, setFormData] = useState<User>(EMPTY_USER);

  useEffect(() => {
    if (isOpen) {
      setFormData(user ?? EMPTY_USER);
    }
  }, [isOpen, user]);

  const handleChange = (field: keyof User, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePermissionChange = (permission: keyof User["permissions"]) => {
    setFormData((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission],
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCreating ? "Nouvel utilisateur" : "Modifier l'utilisateur"} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Informations générales */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Informations générales
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Nom d'utilisateur *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange("username", e.target.value)}
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
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
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
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={formData.password ?? ""}
                  onChange={(e) => handleChange("password", e.target.value)}
                  placeholder="Laisser vide pour conserver le mot de passe"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Rôle *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleChange("role", e.target.value)}
                  required
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">Sélectionner...</option>
                  <option value="Administrateur">Administrateur</option>
                  <option value="Gestionnaire">Gestionnaire</option>
                  <option value="Comptable">Comptable</option>
                  <option value="Visualiseur">Visualiseur</option>
                </select>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Permissions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries({
                missions: "Gestion des missions",
                invoices: "Gestion de la facturation",
                interpreters: "Gestion des interprètes",
                clients: "Gestion des tiers",
                reports: "Rapports et statistiques",
                settings: "Paramètres système",
              }).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all hover:bg-opacity-5"
                  style={{
                    borderColor: formData.permissions[key as keyof User["permissions"]]
                      ? currentTheme.colors.primary
                      : currentTheme.colors.border,
                    backgroundColor: formData.permissions[key as keyof User["permissions"]]
                      ? currentTheme.colors.primaryLight
                      : "transparent",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={formData.permissions[key as keyof User["permissions"]]}
                    onChange={() => handlePermissionChange(key as keyof User["permissions"])}
                    className="w-5 h-5 rounded cursor-pointer"
                    style={{ accentColor: currentTheme.colors.primary }}
                  />
                  <span className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Statut */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Statut du compte
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(["Actif", "Inactif"] as const).map((status) => (
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
