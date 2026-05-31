import { useState } from "react";
import { motion } from "motion/react";
import { Building, Users, Plus, Search, Edit, Trash2, Eye, Mail, Phone, MapPin, Download, FileSpreadsheet, LayoutGrid, Columns } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { EmptyState } from "./EmptyState";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { TiersDetailPage } from "./TiersDetailPage";
import { EditCompanyModal } from "./EditCompanyModal";
import { useClients, useContacts, crud } from "../../lib/hooks";

interface Company {
  id: string;
  name: string;
  code: string;
  country: string;
  phone?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
}

interface Contact {
  id: string;
  name: string;
  country: string;
  company?: string;
}

export function TiersPage() {
  const { currentTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<"companies" | "contacts">("companies");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [layoutMode, setLayoutMode] = useState<"grid" | "masterdetail">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);

  // Fonction d'export CSV
  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(";"),
      ...data.map((row) =>
        headers.map((header) => `"${row[header] || ""}"`).join(";")
      ),
    ].join("\n");

    const blob = new Blob(["﻿" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Fonction d'export Excel
  const exportToExcel = (data: any[], filename: string) => {
    import("xlsx").then((XLSX) => {
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Données");

      const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(
        workbook,
        `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    });
  };

  // Fonction d'export pour la section active
  const handleExport = (format: "csv" | "excel") => {
    if (activeSection === "companies") {
      const dataToExport = filteredCompanies.map((company) => ({
        Nom: company.name,
        Code: company.code,
        Pays: company.country,
        Téléphone: company.phone || "",
        Email: company.email || "",
        Adresse: company.address || "",
        "Code postal": company.postalCode || "",
        Ville: company.city || "",
      }));

      if (format === "csv") {
        exportToCSV(dataToExport, "societes");
      } else {
        exportToExcel(dataToExport, "societes");
      }
    } else {
      const dataToExport = filteredContacts.map((contact) => ({
        Nom: contact.name,
        Pays: contact.country,
        Société: contact.company || "",
      }));

      if (format === "csv") {
        exportToCSV(dataToExport, "contacts");
      } else {
        exportToExcel(dataToExport, "contacts");
      }
    }
  };

  const companiesQuery = useClients({ q: searchQuery });
  const companies: Company[] = companiesQuery.data.map((c) => ({
    id: String(c.id ?? ''),
    name: c.name,
    code: c.alias || c.siret || c.siren || '—',
    country: c.country_label || '',
    phone: c.phone || undefined,
    email: c.email || undefined,
    address: c.address || undefined,
    postalCode: c.zip || undefined,
    city: c.town || undefined,
  }));

  // Contacts globaux: l'API exige client_id — on n'affiche rien sans sélection.
  // TODO: si un client est sélectionné ailleurs, brancher useContacts(clientId).
  const contacts: Contact[] = useContacts(null).data.map((c) => ({
    id: String(c.id ?? ''),
    name: [c.firstname, c.lastname].filter(Boolean).join(' ') || c.email || '—',
    country: c.country_label || '',
    company: undefined,
  }));

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers pour l'édition
  const handleEditCompany = (company: Company) => {
    setEditingCompany(company);
    setIsEditCompanyModalOpen(true);
  };

  const handleSaveCompany = async (updatedCompany: Company) => {
    try {
      await crud.saveClient({
        id: updatedCompany.id || undefined,
        name: updatedCompany.name,
        address: updatedCompany.address,
        zip: updatedCompany.postalCode,
        town: updatedCompany.city,
        phone: updatedCompany.phone,
        email: updatedCompany.email,
      });
      companiesQuery.refetch();
    } catch (e) {
      console.error("Sauvegarde société impossible", e);
    }
  };

  const handleDeleteCompany = async (company: Company) => {
    if (!company.id) return;
    if (!window.confirm(`Supprimer la société « ${company.name} » ?`)) return;
    try {
      await crud.deleteClient(company.id);
      companiesQuery.refetch();
    } catch (e) {
      console.error("Suppression impossible", e);
    }
  };

  const handleCloseCompanyModal = () => {
    setIsEditCompanyModalOpen(false);
    setEditingCompany(null);
  };

  // Si mode master-detail, afficher la page dédiée
  if (layoutMode === "masterdetail") {
    return <TiersDetailPage />;
  }

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            Sociétés et contacts
          </h2>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            Gestion des tiers · {activeSection === "companies" ? filteredCompanies.length : filteredContacts.length} résultat{(activeSection === "companies" ? filteredCompanies.length : filteredContacts.length) > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Sélecteur de layout */}
          <div
            className="flex items-center gap-1 p-1 rounded-lg border"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLayoutMode("grid")}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: layoutMode === "grid" ? currentTheme.colors.primary : "transparent",
                color: layoutMode === "grid" ? "#FFFFFF" : currentTheme.colors.text,
              }}
              title="Vue grille"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Grille</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setLayoutMode("masterdetail")}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: layoutMode === "masterdetail" ? currentTheme.colors.primary : "transparent",
                color: layoutMode === "masterdetail" ? "#FFFFFF" : currentTheme.colors.text,
              }}
              title="Vue détail"
            >
              <Columns className="w-4 h-4" />
              <span>Détail</span>
            </motion.button>
          </div>
          <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport("excel")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: currentTheme.colors.success }}
            title="Exporter en Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: currentTheme.colors.secondary }}
            title="Exporter en CSV"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </motion.button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="rounded-xl border p-4 sticky top-24"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
              Sections
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => setActiveSection("companies")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
                style={{
                  backgroundColor: activeSection === "companies" ? currentTheme.colors.primaryLight : "transparent",
                  color: activeSection === "companies" ? currentTheme.colors.primary : currentTheme.colors.text,
                }}
              >
                <Building className="w-5 h-5" />
                <div className="flex-1">
                  <p className="font-medium">Sociétés demandeuses</p>
                  <p className="text-xs opacity-70">{companies.length} sociétés</p>
                </div>
              </button>

              <button
                onClick={() => setActiveSection("contacts")}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors"
                style={{
                  backgroundColor: activeSection === "contacts" ? currentTheme.colors.primaryLight : "transparent",
                  color: activeSection === "contacts" ? currentTheme.colors.primary : currentTheme.colors.text,
                }}
              >
                <Users className="w-5 h-5" />
                <div className="flex-1">
                  <p className="font-medium">Personnes demandeuses</p>
                  <p className="text-xs opacity-70">{contacts.length} contacts</p>
                </div>
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-medium mt-4"
              style={{ backgroundColor: currentTheme.colors.primary }}
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter</span>
            </motion.button>
          </motion.div>
        </div>

        <div className="lg:col-span-3">
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="rounded-xl border p-6 mb-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                style={{ color: currentTheme.colors.textLight }}
              />
              <input
                type="text"
                placeholder={`Rechercher ${activeSection === "companies" ? "une société" : "un contact"}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
            </div>
          </motion.div>

          {activeSection === "companies" ? (
            <CompanyList companies={filteredCompanies} viewMode={viewMode} currentTheme={currentTheme} onEdit={handleEditCompany} />
          ) : (
            <ContactList contacts={filteredContacts} viewMode={viewMode} currentTheme={currentTheme} />
          )}
        </div>
      </div>

      {/* Modal d'édition de société */}
      <EditCompanyModal
        isOpen={isEditCompanyModalOpen}
        onClose={handleCloseCompanyModal}
        company={editingCompany}
        onSave={handleSaveCompany}
      />
    </div>
  );
}

function CompanyList({ companies, viewMode, currentTheme, onEdit }: { companies: Company[]; viewMode: ViewMode; currentTheme: any; onEdit: (company: Company) => void }) {
  if (viewMode === "table") {
    return <CompaniesTable companies={companies} currentTheme={currentTheme} onEdit={onEdit} />;
  }

  return (
    <div className="space-y-4">
      {companies.map((company, index) => (
        <motion.div
          key={company.id}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ y: -2, boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.1)" }}
          className="rounded-xl p-6 border shadow-sm hover:shadow-md transition-all"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4 flex-1">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: currentTheme.colors.primaryLight }}
              >
                <Building className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: currentTheme.colors.text }}>
                  {company.name}
                </h3>
                <div className="flex items-center gap-4 flex-wrap">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: currentTheme.colors.primaryLight,
                      color: currentTheme.colors.primary,
                    }}
                  >
                    Code: {company.code}
                  </span>
                  <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                    {company.country}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: currentTheme.colors.primary }}
                title="Voir détails"
              >
                <Eye className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onEdit(company)}
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: currentTheme.colors.secondary }}
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: currentTheme.colors.error }}
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {(company.phone || company.email || company.city) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t" style={{ borderColor: currentTheme.colors.border }}>
              {company.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {company.phone}
                  </span>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
                  <span className="text-sm truncate" style={{ color: currentTheme.colors.text }}>
                    {company.email}
                  </span>
                </div>
              )}
              {company.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {company.city}
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      ))}

      {companies.length === 0 && (
        <EmptyState
          icon={Building}
          title="Aucune société trouvée"
          description="Essayez de modifier vos critères de recherche ou ajoutez une nouvelle société"
        />
      )}
    </div>
  );
}

function ContactList({ contacts, viewMode, currentTheme }: { contacts: Contact[]; viewMode: ViewMode; currentTheme: any }) {
  if (viewMode === "table") {
    return <ContactsTable contacts={contacts} currentTheme={currentTheme} />;
  }

  return (
    <div className="space-y-4">
      {contacts.map((contact, index) => (
        <motion.div
          key={contact.id}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: index * 0.05 }}
          whileHover={{ y: -2, boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.1)" }}
          className="rounded-xl p-6 border shadow-sm hover:shadow-md transition-all"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: currentTheme.colors.primary }}
              >
                {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-1" style={{ color: currentTheme.colors.text }}>
                  {contact.name}
                </h3>
                <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                  {contact.country}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: currentTheme.colors.secondary }}
                title="Modifier"
              >
                <Edit className="w-4 h-4" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg text-white"
                style={{ backgroundColor: currentTheme.colors.error }}
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      ))}

      {contacts.length === 0 && (
        <EmptyState
          icon={Users}
          title="Aucun contact trouvé"
          description="Essayez de modifier vos critères de recherche ou ajoutez un nouveau contact"
        />
      )}
    </div>
  );
}

function CompaniesTable({ companies, currentTheme, onEdit }: { companies: Company[]; currentTheme: any; onEdit: (company: Company) => void }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Nom
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Code
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Pays
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Téléphone
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Email
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Ville
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company, index) => (
              <motion.tr
                key={company.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className="border-b hover:bg-opacity-50 transition-colors"
                style={{
                  borderColor: currentTheme.colors.border,
                  backgroundColor: index % 2 === 0 ? "transparent" : currentTheme.colors.primaryLight + "20",
                }}
              >
                <td className="px-4 py-3">
                  <span className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                    {company.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: currentTheme.colors.primaryLight,
                      color: currentTheme.colors.primary,
                    }}
                  >
                    {company.code}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {company.country}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {company.phone ? (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3 h-3" style={{ color: currentTheme.colors.textLight }} />
                      <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                        {company.phone}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {company.email ? (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3 h-3" style={{ color: currentTheme.colors.textLight }} />
                      <span className="text-sm truncate max-w-xs" style={{ color: currentTheme.colors.text }}>
                        {company.email}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {company.city ? (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3" style={{ color: currentTheme.colors.textLight }} />
                      <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                        {company.city}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.primary }}
                      title="Voir détails"
                    >
                      <Eye className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onEdit(company)}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.secondary }}
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.error }}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function ContactsTable({ contacts, currentTheme }: { contacts: Contact[]; currentTheme: any }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="rounded-xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Nom
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Pays
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Société
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact, index) => (
              <motion.tr
                key={contact.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.01 }}
                className="border-b hover:bg-opacity-50 transition-colors"
                style={{
                  borderColor: currentTheme.colors.border,
                  backgroundColor: index % 2 === 0 ? "transparent" : currentTheme.colors.primaryLight + "20",
                }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: currentTheme.colors.primary }}
                    >
                      {contact.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                      {contact.name}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {contact.country}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {contact.company ? (
                    <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                      {contact.company}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.secondary }}
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.error }}
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
