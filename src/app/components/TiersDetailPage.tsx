import { useState } from "react";
import { motion } from "motion/react";
import { Building, Users, Plus, Search, Edit, Trash2, RefreshCw, UserPlus, ChevronRight, Download } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

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
  company?: string;
}

export function TiersDetailPage() {
  const { currentTheme } = useTheme();
  const [searchCompanyQuery, setSearchCompanyQuery] = useState("");
  const [searchContactQuery, setSearchContactQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>("1");

  const companies: Company[] = [
    {
      id: "1",
      name: "1270 NOTAIRES - 0732",
      code: "0732",
      country: "France",
      phone: "0296878950",
      email: "c.maurice@1270notaires.fr",
      city: "—",
      department: "—",
      fax: "—",
      website: "—",
      siren: "—",
      siret: "—",
      address: "—",
      publicNote: "—",
      privateNote: "—",
    },
    {
      id: "2",
      name: "3919 Solidarité femmes - 0840",
      code: "0840",
      country: "France",
    },
    {
      id: "3",
      name: "À l'attention de Mme nzazoka Ely Gra'a De Sousa",
      code: "—",
      country: "France",
      city: "BONNELLES",
    },
    {
      id: "4",
      name: "AAJT (Association d'Aide aux Jeunes Travailleurs) - CADA - 0740",
      code: "0740",
      country: "France",
      phone: "0491078000",
      city: "Marseille",
    },
  ];

  const contacts: Contact[] = [
    { id: "1", name: "Inconnu / à renseigner", country: "France" },
    { id: "2", name: "lil lil", country: "France" },
    { id: "3", name: "MAURICE Coraline", country: "France", phone: "07 69 94 47 52" },
    { id: "4", name: "Dagim TEFERA", country: "France", phone: "07 69 94 47 52" },
    { id: "5", name: "test A-m-a", country: "France" },
  ];

  const filteredCompanies = companies.filter((c) =>
    c.name.toLowerCase().includes(searchCompanyQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchContactQuery.toLowerCase())
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

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
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    className="p-2 hover:bg-opacity-10 rounded-lg transition-colors"
                    style={{ color: currentTheme.colors.primary }}
                    title="Exporter"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
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
                  {filteredContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                      style={{
                        borderColor: currentTheme.colors.border,
                        backgroundColor: currentTheme.colors.primaryLight + "10",
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm" style={{ color: currentTheme.colors.text }}>
                          {contact.name}
                        </p>
                        <p className="text-xs mt-1" style={{ color: currentTheme.colors.textLight }}>
                          {contact.country}
                          {contact.phone && ` • ${contact.phone}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                          style={{ color: currentTheme.colors.primary }}
                          title="Modifier"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-opacity-20 rounded transition-colors"
                          style={{ color: currentTheme.colors.error }}
                          title="Supprimer"
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
