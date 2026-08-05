import { useState, useEffect, useMemo } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { Modal } from "./Modal";
import { AutocompleteSelect } from "./AutocompleteSelect";
import { EditCompanyModal } from "./EditCompanyModal";
import { EditContactModal, type ContactFormData } from "./EditContactModal";
import { useLanguages, useInterpreters, useClients, useContacts, crud } from "../../lib/hooks";

// Aucun schéma de champ local : les modales de création rapide réutilisent
// EditCompanyModal (bouton « Ajouter » page Tiers) et EditContactModal
// (bouton « Ajouter » depuis la page Tiers > détail) → UX cohérente partout.

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
  clientId?: number | null;
  contact: string;
  contactId?: number | null;
  location: string;
  status: "Brouillon" | "Validée" | "Terminée" | "Annulée";
}

interface EditMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mission: Mission | null;
  onSave: (mission: Mission) => void;
}

const EMPTY_MISSION: Mission = {
  id: "",
  ref: "",
  type: "",
  date: "",
  time: "",
  duration: "",
  interpreter: "",
  language: "",
  client: "",
  clientId: null,
  contact: "",
  contactId: null,
  location: "",
  status: "Brouillon",
};

export function EditMissionModal({ isOpen, onClose, mission, onSave }: EditMissionModalProps) {
  const { currentTheme } = useTheme();
  const isCreating = !mission;
  const [formData, setFormData] = useState<Mission>(EMPTY_MISSION);
  const { data: languages, loading: languagesLoading } = useLanguages();
  const { data: interpreters, loading: interpretersLoading } = useInterpreters();
  const {
    data: clients,
    loading: clientsLoading,
    refetch: refetchClients,
  } = useClients({ activeOnly: true });

  // Résout dynamiquement l'ID du client sélectionné depuis son libellé.
  // Sert à :
  //   1) charger la liste des contacts (personnes demandeuses) rattachés ;
  //   2) vider le contact si l'utilisateur change de client (llx_socpeople.fk_soc).
  const resolvedClientId = useMemo(() => {
    const match = clients.find((c) => c.name === formData.client);
    return match?.id ?? formData.clientId ?? null;
  }, [clients, formData.client, formData.clientId]);

  const {
    data: contacts,
    loading: contactsLoading,
    refetch: refetchContacts,
  } = useContacts(resolvedClientId);

  // Options des combobox.
  const languageOptions = useMemo(
    () =>
      languages.map((l) => {
        const label = l.display_name || l.label || l.ref;
        return { id: l.id ?? label, value: label, label };
      }),
    [languages]
  );

  const clientOptions = useMemo(
    () =>
      clients.map((c) => ({
        id: c.id ?? c.name,
        value: c.name,
        label: c.name,
      })),
    [clients]
  );

  const contactOptions = useMemo(
    () =>
      contacts.map((c) => {
        const name = [c.lastname, c.firstname].filter(Boolean).join(" ") || c.email || "—";
        return { id: c.id ?? name, value: name, label: name };
      }),
    [contacts]
  );

  // ─── Création rapide inline (tiers + contact) ────────────────────────
  // Contexte métier : quand la personne demandeuse (ou son entreprise)
  // n'existe pas encore en base, l'agent Planet Traduction doit pouvoir la
  // créer sans quitter le modal d'édition de mission.
  const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);
  const [createInlineError, setCreateInlineError] = useState<string | null>(null);

  const handleCreateClient = async (updated: any) => {
    try {
      await crud.saveClient({
        name: updated.name,
        alias: updated.code || undefined,
        address: updated.address || undefined,
        zip: updated.postalCode || undefined,
        town: updated.city || undefined,
        phone: updated.phone || undefined,
        fax: updated.fax || undefined,
        email: updated.email || undefined,
        website: updated.website || undefined,
        siren: updated.siren || undefined,
        siret: updated.siret || undefined,
        note_public: updated.publicNote || undefined,
        note_private: updated.privateNote || undefined,
      });
      await refetchClients();
      // On pré-sélectionne le nouveau client et on réinitialise le contact.
      setFormData((prev) => ({
        ...prev,
        client: updated.name,
        contact: "",
        contactId: null,
      }));
      setIsCreateClientOpen(false);
      setCreateInlineError(null);
    } catch (e: any) {
      console.error("Création société impossible", e);
      setCreateInlineError(
        e?.response?.data?.error || e?.message || "Création de la société impossible."
      );
    }
  };

  const handleCreateContact = async (data: ContactFormData) => {
    if (!resolvedClientId) {
      setCreateInlineError("Veuillez d'abord sélectionner une société demandeuse.");
      return;
    }
    try {
      // fk_soc = société sélectionnée → le contact appartient bien à ce tiers.
      await crud.saveContact({
        client_id: resolvedClientId,
        civility: data.civility || undefined,
        firstname: data.firstname || undefined,
        lastname: data.lastname,
        position: data.position || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        personal_phone: data.personalPhone || undefined,
        mobile: data.mobile || undefined,
        fax: data.fax || undefined,
        birthday: data.birthday || undefined,
        address: data.address || undefined,
        zip: data.postalCode || undefined,
        town: data.city || undefined,
        country_id: data.countryId ? Number(data.countryId) : undefined,
        department_id: data.departmentId ? Number(data.departmentId) : undefined,
        note_public: data.publicNote || undefined,
        note_private: data.privateNote || undefined,
        is_active: data.isActive ? 1 : 0,
      });
      await refetchContacts();
      const displayName = [data.lastname, data.firstname].filter(Boolean).join(" ");
      setFormData((prev) => ({ ...prev, contact: displayName }));
      setIsCreateContactOpen(false);
      setCreateInlineError(null);
    } catch (e: any) {
      console.error("Création contact impossible", e);
      setCreateInlineError(
        e?.response?.data?.error || e?.message || "Création du contact impossible."
      );
    }
  };

  // Réinitialiser les données du formulaire à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setFormData(mission ?? EMPTY_MISSION);
    }
  }, [isOpen, mission]);

  const handleChange = (field: keyof Mission, value: string) => {
    setFormData((prev) => {
      // Changement de client → on réinitialise la personne demandeuse
      // (les contacts sont rattachés au tiers via llx_socpeople.fk_soc).
      if (field === "client" && value !== prev.client) {
        return { ...prev, client: value, contact: "", contactId: null };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Résout l'ID du contact démandeur à partir du libellé sélectionné.
    const contactMatch = contacts.find((c) => {
      const name = [c.lastname, c.firstname].filter(Boolean).join(" ") || c.email || "";
      return name === formData.contact;
    });
    onSave({
      ...formData,
      contactId: contactMatch?.id ?? (formData.contact ? formData.contactId : null),
      clientId: resolvedClientId,
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCreating ? "Nouvelle mission" : "Modifier la mission"} size="lg">
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
                  list="edit-mission-interpreters"
                  value={formData.interpreter}
                  onChange={(e) => handleChange("interpreter", e.target.value)}
                  required
                  autoComplete="off"
                  placeholder={interpretersLoading ? "Chargement…" : "Rechercher un interprète"}
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <datalist id="edit-mission-interpreters">
                  {interpreters.map((i) => (
                    <option key={i.id} value={i.name} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Langue *
                </label>
                <AutocompleteSelect
                  value={formData.language}
                  onChange={(v) => handleChange("language", v)}
                  options={languageOptions}
                  loading={languagesLoading}
                  placeholder="Rechercher une langue"
                  required
                  helperText="Langue absente ? Ajoutez-la depuis Admin › Langues."
                  currentTheme={currentTheme}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Client (société demandeuse) *
                </label>
                <AutocompleteSelect
                  value={formData.client}
                  onChange={(v) => handleChange("client", v)}
                  options={clientOptions}
                  loading={clientsLoading}
                  placeholder="Rechercher une société"
                  required
                  helperText="Société absente ? Utilisez le bouton « + Nouveau » pour la créer."
                  currentTheme={currentTheme}
                  onCreateNew={() => setIsCreateClientOpen(true)}
                  createNewLabel="Créer une nouvelle société"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Personne demandeuse
                </label>
                <AutocompleteSelect
                  value={formData.contact}
                  onChange={(v) => handleChange("contact", v)}
                  options={contactOptions}
                  loading={contactsLoading}
                  disabled={!resolvedClientId}
                  placeholder={
                    !resolvedClientId
                      ? "Sélectionnez d'abord un client"
                      : contactOptions.length === 0
                        ? "Aucun contact pour ce client"
                        : "Rechercher un contact"
                  }
                  helperText={
                    resolvedClientId
                      ? "Contact absent ? Utilisez le bouton « + Nouveau » pour l'ajouter à ce tiers."
                      : "Renseignez d'abord le client pour lister ses contacts."
                  }
                  currentTheme={currentTheme}
                  onCreateNew={
                    resolvedClientId ? () => setIsCreateContactOpen(true) : undefined
                  }
                  createNewLabel="Créer une nouvelle personne demandeuse"
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

      {/* Bannière d'erreur des créations inline (client / contact) */}
      {createInlineError && (
        <div
          role="alert"
          className="mt-4 px-4 py-2.5 rounded-lg border text-sm"
          style={{
            backgroundColor: "#FEF2F2",
            borderColor: "#FECACA",
            color: "#991B1B",
          }}
        >
          {createInlineError}
        </div>
      )}

      {/* Création rapide inline d'un tiers (société demandeuse) — même
          modale que le bouton « Ajouter une société » de la page Tiers. */}
      <EditCompanyModal
        isOpen={isCreateClientOpen}
        onClose={() => {
          setIsCreateClientOpen(false);
          setCreateInlineError(null);
        }}
        company={null}
        onSave={handleCreateClient}
      />

      {/* Création rapide inline d'une personne demandeuse rattachée au tiers —
          même modale que le bouton « + » de la page Tiers > détail contacts. */}
      <EditContactModal
        isOpen={isCreateContactOpen}
        onClose={() => {
          setIsCreateContactOpen(false);
          setCreateInlineError(null);
        }}
        contact={null}
        companyName={formData.client || undefined}
        onSave={handleCreateContact}
      />
    </Modal>
  );
}
