import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import { Building, Users, Plus, Search, Edit, Trash2, RefreshCw, UserPlus, ChevronRight, Download, Mail, Phone, Smartphone, Briefcase } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useClients, useContacts, crud } from "../../lib/hooks";
import { EditCompanyModal } from "./EditCompanyModal";
import { EditContactModal, type ContactFormData } from "./EditContactModal";

interface Company {
  id: string;
  name: string;
  code: string;
  country: string;
  phone?: string;
  email?: string;
  address?: string;
  addressLine2?: string;
  postalCode?: string;
  city?: string;
  department?: string;
  fax?: string;
  siret?: string;
  siren?: string;
  website?: string;
  publicNote?: string;
  privateNote?: string;
}

interface Contact {
  id: string;
  name: string;
  country: string;
  phone?: string;
  mobile?: string;
  email?: string;
  position?: string;
  civility?: string;
  firstname?: string;
  lastname?: string;
  company?: string;
}

export function TiersDetailPage({ initialCompanyId }: { initialCompanyId?: string | null } = {}) {
  const { currentTheme } = useTheme();
  const [searchCompanyQuery, setSearchCompanyQuery] = useState("");
  const [searchContactQuery, setSearchContactQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    initialCompanyId ?? null
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Modal contact (personne demandeuse) — édition et création rapide
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactFormData | null>(null);

  const { data: rawClients, loading: clientsLoading, refetch: refetchClients } = useClients({ q: searchCompanyQuery });
  const clientIdNum = selectedCompanyId ? Number(selectedCompanyId) : null;
  const { data: rawContacts, loading: contactsLoading, refetch: refetchContacts } = useContacts(clientIdNum);

  const companies: Company[] = useMemo(
    () =>
      rawClients.map((c) => ({
        id: String(c.id ?? ""),
        name: c.name || "—",
        code: c.alias || "—",
        country: c.country_label || "—",
        phone: c.phone || undefined,
        email: c.email || undefined,
        address: c.address || undefined,
        postalCode: c.zip || undefined,
        city: c.town || undefined,
        department: c.department_label || undefined,
        fax: c.fax || undefined,
        siren: c.siren || undefined,
        siret: c.siret || undefined,
        website: c.website || undefined,
        publicNote: c.note_public || undefined,
        privateNote: c.note_private || undefined,
      })),
    [rawClients]
  );

  const contacts: Contact[] = useMemo(
    () =>
      rawContacts.map((c) => {
        const fullName = [c.civility, c.firstname, c.lastname].filter(Boolean).join(" ").trim();
        return {
          id: String(c.id ?? ""),
          name: fullName || c.email || "—",
          country: c.country_label || "—",
          phone: c.phone || undefined,
          mobile: c.phone_mobile || undefined,
          email: c.email || undefined,
          position: c.position || undefined,
          civility: c.civility || undefined,
          firstname: c.firstname || undefined,
          lastname: c.lastname || undefined,
        };
      }),
    [rawContacts]
  );

  useEffect(() => {
    if (!selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const filteredCompanies = companies;

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchContactQuery.toLowerCase())
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const handleEditCompany = () => {
    if (selectedCompany) {
      setEditingCompany(selectedCompany);
      setIsEditModalOpen(true);
    }
  };

  const handleAddCompany = () => {
    setEditingCompany(null);
    setIsEditModalOpen(true);
  };

  const handleSaveCompany = async (data: Company) => {
    try {
      await crud.saveClient({
        id: data.id ? Number(data.id) : undefined,
        name: data.name,
        alias: data.code,
        address: data.address,
        zip: data.postalCode,
        town: data.city,
        phone: data.phone,
        fax: data.fax,
        email: data.email,
        website: data.website,
        siren: data.siren,
        siret: data.siret,
        note_public: data.publicNote,
        note_private: data.privateNote,
      } as any);
      refetchClients();
    } catch (e: any) {
      alert(`Erreur enregistrement société : ${e?.message ?? e}`);
    }
  };

  const handleDeactivateCompany = async () => {
    if (!selectedCompany?.id) return;
    if (!confirm(`Désactiver la société « ${selectedCompany.name} » ?`)) return;
    try {
      await crud.deleteClient(Number(selectedCompany.id));
      refetchClients();
      setSelectedCompanyId(null);
    } catch (e: any) {
      alert(`Erreur : ${e?.message ?? e}`);
    }
  };

  // ─── Contact (personne demandeuse) — ouverture du modal de création ─────
  const openAddContactModal = () => {
    if (!selectedCompany) return;
    setEditingContact({
      id: "",
      clientId: selectedCompany.id,
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
    });
    setIsContactModalOpen(true);
  };

  // ─── Contact — ouverture du modal d'édition depuis un contact existant ──
  const openEditContactModal = (rawContactId: string) => {
    const raw = rawContacts.find((c) => String(c.id ?? "") === rawContactId);
    if (!raw || !selectedCompany) return;
    setEditingContact({
      id: String(raw.id ?? ""),
      clientId: selectedCompany.id,
      civility: raw.civility || "",
      firstname: raw.firstname || "",
      lastname: raw.lastname || "",
      position: raw.position || "",
      email: raw.email || "",
      phone: raw.phone || "",
      personalPhone: raw.phone_perso || "",
      mobile: raw.phone_mobile || "",
      fax: raw.fax || "",
      birthday: raw.birthday || "",
      address: raw.address || "",
      postalCode: raw.zip || "",
      city: raw.town || "",
      countryId: raw.fk_pays ? String(raw.fk_pays) : "",
      departmentId: raw.fk_departement ? String(raw.fk_departement) : "",
      publicNote: raw.note_public || "",
      privateNote: raw.note_private || "",
      isActive: (raw.status ?? 1) !== 0,
    });
    setIsContactModalOpen(true);
  };

  // ─── Contact — sauvegarde (create/update) ───────────────────────────────
  const handleSaveContact = async (data: ContactFormData) => {
    if (!selectedCompany) return;
    try {
      await crud.saveContact({
        id: data.id || undefined,
        client_id: Number(selectedCompany.id), // fk_soc — toujours cascade sur le tiers sélectionné
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
      refetchContacts();
      setIsContactModalOpen(false);
      setEditingContact(null);
    } catch (e: any) {
      alert(`Erreur : ${e?.response?.data?.error || e?.message || e}`);
    }
  };

  return (
    <div className="max-w-[1800px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            Sociétés et contacts
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panneau gauche - Liste des sociétés */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="rounded-xl border sticky top-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: currentTheme.colors.border }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                  Sociétés demandeuses
                </h3>
                <div className="flex gap-2">
                  <button
                    className="p-2 hover:bg-opacity-10 rounded-lg transition-colors"
                    style={{ color: currentTheme.colors.primary }}
                    title="Rafraîchir"
                    onClick={() => refetchClients()}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-opacity-10 rounded-lg transition-colors"
                    style={{ color: currentTheme.colors.primary }}
                    title="Exporter"
                    onClick={() => alert("L'export des sociétés sera disponible prochainement.")}
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddCompany}
                    className="px-3 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    style={{ backgroundColor: currentTheme.colors.primary }}
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </motion.button>
                </div>
              </div>

              {/* Barre de recherche */}
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: currentTheme.colors.textLight }}
                />
                <input
                  type="text"
                  placeholder="Rechercher une société"
                  value={searchCompanyQuery}
                  onChange={(e) => setSearchCompanyQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: currentTheme.colors.primary }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Liste des sociétés */}
            <div className="max-h-[600px] overflow-y-auto">
              {clientsLoading && (
                <p className="px-4 py-3 text-sm" style={{ color: currentTheme.colors.textLight }}>
                  Chargement…
                </p>
              )}
              {!clientsLoading && filteredCompanies.length === 0 && (
                <p className="px-4 py-3 text-sm" style={{ color: currentTheme.colors.textLight }}>
                  Aucune société.
                </p>
              )}
              {filteredCompanies.map((company) => (
                <motion.button
                  key={company.id}
                  whileHover={{ x: 4 }}
                  onClick={() => setSelectedCompanyId(company.id)}
                  className="w-full px-4 py-3 text-left border-b hover:bg-opacity-5 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    backgroundColor:
                      selectedCompanyId === company.id
                        ? currentTheme.colors.primaryLight
                        : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p
                        className="text-sm font-medium"
                        style={{
                          color:
                            selectedCompanyId === company.id
                              ? currentTheme.colors.primary
                              : currentTheme.colors.text,
                        }}
                      >
                        {company.name}
                      </p>
                      <p className="text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                        {company.country} • {company.code}
                      </p>
                    </div>
                    <ChevronRight
                      className="w-4 h-4 flex-shrink-0"
                      style={{
                        color:
                          selectedCompanyId === company.id
                            ? currentTheme.colors.primary
                            : currentTheme.colors.textLight,
                      }}
                    />
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Panneau droit - Détail de la société */}
        <div className="lg:col-span-2">
          {selectedCompany ? (
            <motion.div
              key={selectedCompanyId}
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="space-y-6"
            >
              {/* Informations de la société */}
              <div
                className="rounded-xl border p-6"
                style={{
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <h2 className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
                    {selectedCompany.name}
                  </h2>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleEditCompany}
                      className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                      style={{
                        backgroundColor: currentTheme.colors.primaryLight,
                        color: currentTheme.colors.primary,
                      }}
                    >
                      <Edit className="w-4 h-4" />
                      Modifier
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleDeactivateCompany}
                      className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                      style={{
                        backgroundColor: currentTheme.colors.error + "20",
                        color: currentTheme.colors.error,
                      }}
                    >
                      Désactiver
                    </motion.button>
                  </div>
                </div>

                {/* Grille d'informations */}
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <InfoField label="Alias" value={selectedCompany.name} currentTheme={currentTheme} />
                  <InfoField label="Code postal" value={selectedCompany.postalCode || "—"} currentTheme={currentTheme} />
                  <InfoField label="Ville" value={selectedCompany.city || "—"} currentTheme={currentTheme} />
                  <InfoField label="Pays" value={selectedCompany.country} currentTheme={currentTheme} />
                  <InfoField label="Département" value={selectedCompany.department || "—"} currentTheme={currentTheme} />
                  <InfoField label="Téléphone" value={selectedCompany.phone || "—"} currentTheme={currentTheme} />
                  <InfoField label="Fax" value={selectedCompany.fax || "—"} currentTheme={currentTheme} />
                  <InfoField label="Email" value={selectedCompany.email || "—"} currentTheme={currentTheme} />
                  <InfoField label="Site web" value={selectedCompany.website || "—"} currentTheme={currentTheme} />
                  <InfoField label="SIREN" value={selectedCompany.siren || "—"} currentTheme={currentTheme} />
                  <InfoField label="SIRET" value={selectedCompany.siret || "—"} currentTheme={currentTheme} />
                  <InfoField label="Adresse" value={selectedCompany.address || "—"} currentTheme={currentTheme} fullWidth />
                  <InfoField label="Note publique" value={selectedCompany.publicNote || "—"} currentTheme={currentTheme} fullWidth />
                  <InfoField label="Note privée" value={selectedCompany.privateNote || "—"} currentTheme={currentTheme} fullWidth />
                </div>
              </div>

              {/* Personnes demandeuses */}
              <div
                className="rounded-xl border p-6"
                style={{
                  backgroundColor: currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold" style={{ color: currentTheme.colors.text }}>
                    Personnes demandeuses
                  </h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={openAddContactModal}
                    className="px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                    style={{ backgroundColor: currentTheme.colors.primary }}
                  >
                    <UserPlus className="w-4 h-4" />
                    Ajouter
                  </motion.button>
                </div>

                {/* Barre de recherche des contacts */}
                <div className="relative mb-4">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                    style={{ color: currentTheme.colors.textLight }}
                  />
                  <input
                    type="text"
                    placeholder="Rechercher une personne"
                    value={searchContactQuery}
                    onChange={(e) => setSearchContactQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 text-sm transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: currentTheme.colors.primary }}
                  >
                    <ChevronRight className="w-4 h-4 rotate-90" />
                  </button>
                </div>

                {/* Liste des contacts */}
                <div className="space-y-2">
                  {contactsLoading && (
                    <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                      Chargement des contacts…
                    </p>
                  )}
                  {!contactsLoading && filteredContacts.length === 0 && (
                    <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                      Aucun contact pour cette société.
                    </p>
                  )}
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{
                        borderColor: currentTheme.colors.border,
                        backgroundColor: currentTheme.colors.primaryLight + "10",
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm" style={{ color: currentTheme.colors.text }}>
                          {contact.name}
                        </p>
                        {contact.position && (
                          <p className="text-xs flex items-center gap-1 mt-1" style={{ color: currentTheme.colors.textLight }}>
                            <Briefcase className="w-3 h-3 flex-shrink-0" />
                            {contact.position}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                          {contact.mobile && (
                            <span className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              {contact.mobile}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {contact.phone}
                            </span>
                          )}
                          {contact.email && (
                            <span className="flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 flex-shrink-0" />
                              {contact.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-3">
                        <button
                          className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                          style={{ color: currentTheme.colors.primary }}
                          title="Modifier"
                          onClick={() => openEditContactModal(contact.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                          style={{ color: currentTheme.colors.error }}
                          title="Supprimer"
                          onClick={async () => {
                            if (!confirm(`Supprimer le contact « ${contact.name} » ?`)) return;
                            try {
                              await crud.deleteContact(Number(contact.id));
                              refetchContacts();
                            } catch (e: any) {
                              alert(`Erreur : ${e?.message ?? e}`);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div
              className="rounded-xl border p-12 text-center"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            >
              <Building
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: currentTheme.colors.textLight, opacity: 0.3 }}
              />
              <p className="text-lg font-medium" style={{ color: currentTheme.colors.text }}>
                Sélectionnez une société
              </p>
              <p className="text-sm mt-2" style={{ color: currentTheme.colors.textLight }}>
                Cliquez sur une société dans la liste pour voir ses détails
              </p>
            </div>
          )}
        </div>
      </div>

      <EditCompanyModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        company={editingCompany as any}
        onSave={(data) => {
          handleSaveCompany(data as Company);
          setIsEditModalOpen(false);
        }}
      />

      <EditContactModal
        isOpen={isContactModalOpen}
        onClose={() => {
          setIsContactModalOpen(false);
          setEditingContact(null);
        }}
        contact={editingContact}
        companyName={selectedCompany?.name}
        onSave={handleSaveContact}
      />
    </div>
  );
}

function InfoField({
  label,
  value,
  currentTheme,
  fullWidth = false,
}: {
  label: string;
  value: string;
  currentTheme: any;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-xs font-medium mb-1" style={{ color: currentTheme.colors.textLight }}>
        {label}
      </p>
      <p className="text-sm" style={{ color: currentTheme.colors.text }}>
        {value}
      </p>
    </div>
  );
}
