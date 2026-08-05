import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";
import { useCountries, useDepartments } from "../../lib/hooks";

/**
 * Modèle UI d'un contact (personne demandeuse).
 *
 * Reflète les colonnes utiles de `llx_socpeople` :
 * - `rowid` → `id`
 * - `fk_soc` → `clientId` (rattachement au tiers)
 * - `civility`, `firstname`, `lastname`, `poste`
 * - `email`, `phone`, `phone_perso`, `phone_mobile`, `fax`
 * - `address`, `zip`, `town`, `fk_pays`, `fk_departement`
 * - `note_public`, `note_private`
 * - `birthday` (yyyy-mm-dd)
 * - `statut` (0 = archivé, 1 = actif)
 */
export interface ContactFormData {
  id: string;
  clientId: string;
  civility: string;
  firstname: string;
  lastname: string;
  position: string;
  email: string;
  phone: string;
  personalPhone: string;
  mobile: string;
  fax: string;
  birthday: string;
  address: string;
  postalCode: string;
  city: string;
  countryId: string;
  departmentId: string;
  publicNote: string;
  privateNote: string;
  isActive: boolean;
}

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: ContactFormData | null;
  companyName?: string;
  onSave: (contact: ContactFormData) => void;
}

const EMPTY_CONTACT: ContactFormData = {
  id: "",
  clientId: "",
  civility: "",
  firstname: "",
  lastname: "",
  position: "",
  email: "",
  phone: "",
  personalPhone: "",
  mobile: "",
  fax: "",
  birthday: "",
  address: "",
  postalCode: "",
  city: "",
  countryId: "",
  departmentId: "",
  publicNote: "",
  privateNote: "",
  isActive: true,
};

// Civilités habituelles Dolibarr — on garde une liste courte pour éviter la
// pollution des combos. Le champ reste éditable (input libre) pour absorber
// les valeurs héritées (« M. », « Dr », etc.) sans perte de données.
const CIVILITY_OPTIONS = ["", "MR", "MME", "MLLE"] as const;

export function EditContactModal({
  isOpen,
  onClose,
  contact,
  companyName,
  onSave,
}: EditContactModalProps) {
  const { currentTheme } = useTheme();
  const isCreating = !contact?.id;
  const [formData, setFormData] = useState<ContactFormData>(EMPTY_CONTACT);
  const { data: countries, loading: countriesLoading } = useCountries();
  const { data: departments, loading: departmentsLoading } = useDepartments();

  useEffect(() => {
    if (isOpen) {
      setFormData(contact ?? EMPTY_CONTACT);
    }
  }, [isOpen, contact]);

  const handleChange = (field: keyof ContactFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value } as ContactFormData));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const title = isCreating
    ? `Nouvelle personne demandeuse${companyName ? ` — ${companyName}` : ""}`
    : `Modifier « ${[formData.firstname, formData.lastname].filter(Boolean).join(" ")} »`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Identité */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Identité
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Civilité
                </label>
                <input
                  type="text"
                  list="edit-contact-civility"
                  value={formData.civility}
                  onChange={(e) => handleChange("civility", e.target.value)}
                  placeholder="MR, MME, MLLE…"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <datalist id="edit-contact-civility">
                  {CIVILITY_OPTIONS.filter(Boolean).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Prénom
                </label>
                <input
                  type="text"
                  value={formData.firstname}
                  onChange={(e) => handleChange("firstname", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.lastname}
                  onChange={(e) => handleChange("lastname", e.target.value)}
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
                  Fonction / poste
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleChange("position", e.target.value)}
                  placeholder="Ex : Intervenante sociale"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Coordonnées */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Coordonnées
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Téléphone pro
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Mobile
                </label>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleChange("mobile", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Téléphone perso
                </label>
                <input
                  type="tel"
                  value={formData.personalPhone}
                  onChange={(e) => handleChange("personalPhone", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Fax
                </label>
                <input
                  type="tel"
                  value={formData.fax}
                  onChange={(e) => handleChange("fax", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Date de naissance
                </label>
                <input
                  type="date"
                  value={formData.birthday}
                  onChange={(e) => handleChange("birthday", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Adresse (indépendante du tiers — un contact peut avoir une adresse propre) */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Adresse
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Adresse
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Code postal
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => handleChange("postalCode", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Ville
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Pays
                </label>
                <select
                  value={formData.countryId}
                  onChange={(e) => handleChange("countryId", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">{countriesLoading ? "Chargement…" : "— Pays —"}</option>
                  {countries.map((c) => (
                    <option key={c.id ?? c.label} value={c.id ?? ""}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Département
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => handleChange("departmentId", e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">{departmentsLoading ? "Chargement…" : "— Département —"}</option>
                  {departments.map((d) => (
                    <option key={d.id ?? d.label} value={d.id ?? ""}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Notes + statut */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Notes & statut
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Note publique
                </label>
                <textarea
                  value={formData.publicNote}
                  onChange={(e) => handleChange("publicNote", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Note privée
                </label>
                <textarea
                  value={formData.privateNote}
                  onChange={(e) => handleChange("privateNote", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 resize-none"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => handleChange("isActive", e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    Contact actif (décocher pour archiver — statut = 0 dans llx_socpeople)
                  </span>
                </label>
              </div>
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
