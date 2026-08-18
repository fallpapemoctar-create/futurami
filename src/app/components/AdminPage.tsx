import { useState } from "react";
import { motion } from "motion/react";
import { Shield, Plus, Edit, Trash2, Search, UserCheck, UserX, Download, FileSpreadsheet, Languages, CreditCard, Landmark, Users as UsersIcon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { EditUserModal } from "./EditUserModal";
import { ReferentielFormModal, type ReferentielField } from "./ReferentielFormModal";
import {
  useUsers,
  useLanguages,
  usePaymentTerms,
  useBankAccounts,
  crud,
  type RawUser,
  type RefLanguage,
  type RefPaymentTerm,
  type RefBankAccount,
} from "../../lib/hooks";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  permissions: {
    interpretes: boolean;
    gestInterpretes: boolean;
    missions: boolean;
    admin: boolean;
  };
}

export function AdminPage() {
  const { currentTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"users" | "languages" | "paymentTerms" | "bankAccounts">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
      XLSX.utils.book_append_sheet(workbook, worksheet, "Utilisateurs");

      const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(
        workbook,
        `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    });
  };

  // Fonction d'export des utilisateurs
  const handleExportUsers = (format: "csv" | "excel") => {
    const dataToExport = filteredUsers.map((user) => ({
      Nom: user.name,
      "Accès Interprètes": user.permissions.interpretes ? "Oui" : "Non",
      "Gestion Interprètes": user.permissions.gestInterpretes ? "Oui" : "Non",
      "Accès Missions": user.permissions.missions ? "Oui" : "Non",
      Administrateur: user.permissions.admin ? "Oui" : "Non",
    }));

    if (format === "csv") {
      exportToCSV(dataToExport, "utilisateurs");
    } else {
      exportToExcel(dataToExport, "utilisateurs");
    }
  };

  // Handlers pour l'édition
  const handleEditUser = (user: User) => {
    // Mapper le format User vers le format attendu par EditUserModal
    const modalUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: "Gestionnaire",
      password: "",
      permissions: {
        missions: user.permissions.missions,
        invoices: false,
        interpreters: user.permissions.interpretes,
        clients: false,
        reports: false,
        settings: user.permissions.admin,
      },
      status: "Actif" as const,
    };
    setEditingUser(modalUser);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = async (updatedUser: any) => {
    try {
      await crud.saveUser({
        id: updatedUser.id || undefined,
        username: updatedUser.username || (updatedUser.email || updatedUser.name || "").split("@")[0],
        password: updatedUser.password || undefined,
        fullname: updatedUser.name,
        email: updatedUser.email,
        can_manage_interpreters: !!updatedUser.permissions?.interpreters,
        can_manage_missions: !!updatedUser.permissions?.missions,
        is_admin: !!updatedUser.permissions?.settings,
      });
      usersQuery.refetch();
      setIsEditModalOpen(false);
      setEditingUser(null);
    } catch (e) {
      console.error("Sauvegarde utilisateur impossible", e);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Supprimer l'utilisateur « ${user.name} » ?`)) return;
    try {
      await crud.deleteUser(user.id);
      usersQuery.refetch();
    } catch (e) {
      console.error("Suppression utilisateur impossible", e);
    }
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setEditingUser(null);
  };

  const usersQuery = useUsers();
  const users: User[] = usersQuery.data.map((u: RawUser) => ({
    id: String(u.id),
    username: u.username,
    name: u.fullname || u.username,
    email: u.email,
    permissions: {
      interpretes: !!u.can_manage_interpreters || !!u.is_interpreter,
      gestInterpretes: !!u.can_manage_interpreters,
      missions: !!u.can_manage_missions,
      admin: !!u.is_admin,
    },
  }));

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const permissionLabels = [
    { key: "interpretes", label: "Interprètes", description: "Voir l'annuaire des interprètes" },
    { key: "gestInterpretes", label: "Gest. Interprètes", description: "Gérer les interprètes" },
    { key: "missions", label: "Missions", description: "Accès aux missions" },
    { key: "admin", label: "Admin", description: "Administration du système" },
  ];

  const tabs: { key: typeof activeTab; label: string; icon: typeof UsersIcon }[] = [
    { key: "users", label: "Utilisateurs", icon: UsersIcon },
    { key: "languages", label: "Langues", icon: Languages },
    { key: "paymentTerms", label: "Termes de paiement", icon: CreditCard },
    { key: "bankAccounts", label: "Comptes bancaires", icon: Landmark },
  ];

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            Administration
          </h2>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            {activeTab === "users"
              ? `Gestion des utilisateurs et des permissions · ${filteredUsers.length} utilisateur${filteredUsers.length > 1 ? "s" : ""}`
              : "Référentiels de l'entité · propres à votre structure"}
          </p>
        </div>
        {activeTab === "users" && (
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleExportUsers("excel")}
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
              onClick={() => handleExportUsers("csv")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ backgroundColor: currentTheme.colors.secondary }}
              title="Exporter en CSV"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setEditingUser(null);
                setIsEditModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
              style={{ backgroundColor: currentTheme.colors.primary }}
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter un utilisateur</span>
            </motion.button>
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-1 p-1 rounded-lg border mb-6 w-fit"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                backgroundColor: activeTab === tab.key ? currentTheme.colors.primary : "transparent",
                color: activeTab === tab.key ? "#FFFFFF" : currentTheme.colors.text,
              }}
            >
              <TabIcon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "languages" && <LanguagesSection currentTheme={currentTheme} />}
      {activeTab === "paymentTerms" && <PaymentTermsSection currentTheme={currentTheme} />}
      {activeTab === "bankAccounts" && <BankAccountsSection currentTheme={currentTheme} />}

      {activeTab === "users" && (
      <>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
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
            placeholder="Rechercher un utilisateur..."
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

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
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
                <th
                  className="px-6 py-4 text-left text-sm font-semibold sticky left-0"
                  style={{
                    color: currentTheme.colors.primary,
                    backgroundColor: currentTheme.colors.primaryLight,
                  }}
                >
                  Nom Prénom
                </th>
                {permissionLabels.map((perm) => (
                  <th
                    key={perm.key}
                    className="px-6 py-4 text-center text-sm font-semibold"
                    style={{ color: currentTheme.colors.primary }}
                    title={perm.description}
                  >
                    {perm.label}
                  </th>
                ))}
                <th
                  className="px-6 py-4 text-center text-sm font-semibold"
                  style={{ color: currentTheme.colors.primary }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b hover:bg-opacity-50 transition-colors"
                  style={{
                    borderColor: currentTheme.colors.border,
                  }}
                >
                  <td
                    className="px-6 py-4 font-medium sticky left-0"
                    style={{
                      color: currentTheme.colors.text,
                      backgroundColor: currentTheme.colors.surface,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: currentTheme.colors.primary }}
                      >
                        {user.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </div>
                  </td>
                  {permissionLabels.map((perm) => (
                    <td key={perm.key} className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={user.permissions[perm.key as keyof typeof user.permissions]}
                            className="sr-only peer"
                            onChange={() => {}}
                          />
                          <div
                            className="w-11 h-6 rounded-full peer transition-all"
                            style={{
                              backgroundColor: user.permissions[perm.key as keyof typeof user.permissions]
                                ? currentTheme.colors.primary
                                : currentTheme.colors.border,
                            }}
                          >
                            <div
                              className={`absolute top-0.5 left-0.5 bg-white rounded-full h-5 w-5 transition-transform ${
                                user.permissions[perm.key as keyof typeof user.permissions]
                                  ? "translate-x-5"
                                  : ""
                              }`}
                            />
                          </div>
                        </label>
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleEditUser(user)}
                        className="p-2 rounded-lg text-white"
                        style={{ backgroundColor: currentTheme.colors.secondary }}
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDeleteUser(user)}
                        className="p-2 rounded-lg text-white"
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

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8"
      >
        {permissionLabels.map((perm, index) => (
          <div
            key={perm.key}
            className="rounded-xl border p-6"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: currentTheme.colors.primaryLight }}
              >
                <Shield className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
              </div>
              <div>
                <h3 className="text-lg font-bold mb-1" style={{ color: currentTheme.colors.text }}>
                  {perm.label}
                </h3>
                <p className="text-sm mb-3" style={{ color: currentTheme.colors.textLight }}>
                  {perm.description}
                </p>
                <div className="flex items-center gap-2">
                  <UserCheck
                    className="w-4 h-4"
                    style={{ color: currentTheme.colors.success }}
                  />
                  <span className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
                    {filteredUsers.filter(u => u.permissions[perm.key as keyof typeof u.permissions]).length} utilisateur(s)
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Modal d'édition d'utilisateur */}
      <EditUserModal
        isOpen={isEditModalOpen}
        onClose={handleCloseModal}
        user={editingUser}
        onSave={handleSaveUser}
      />
      </>
      )}
    </div>
  );
}

// ─── Référentiels : Langues / prestations ────────────────────────────────────

const languageFields: ReferentielField[] = [
  { key: "label", label: "Libellé", type: "text", required: true },
  { key: "ref", label: "Référence", type: "text", placeholder: "Générée automatiquement si vide" },
  { key: "price", label: "Prix HT", type: "number", step: "0.01" },
  { key: "price_ttc", label: "Prix TTC", type: "number", step: "0.01" },
  { key: "tva_tx", label: "TVA (%)", type: "number", step: "0.01" },
];

function LanguagesSection({ currentTheme }: { currentTheme: any }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState<RefLanguage | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const languagesQuery = useLanguages(searchQuery);

  const handleSave = async (values: Record<string, any>) => {
    await crud.saveLanguage({
      id: editing?.id ?? undefined,
      label: values.label,
      ref: values.ref || undefined,
      price: values.price !== "" ? Number(values.price) : undefined,
      price_ttc: values.price_ttc !== "" ? Number(values.price_ttc) : undefined,
      tva_tx: values.tva_tx !== "" ? Number(values.tva_tx) : undefined,
    });
    languagesQuery.refetch();
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (language: RefLanguage) => {
    if (!language.id) return;
    if (!window.confirm(`Désactiver la langue « ${language.label} » ?`)) return;
    await crud.deleteLanguage(language.id);
    languagesQuery.refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: currentTheme.colors.textLight }}
          />
          <input
            type="text"
            placeholder="Rechercher une langue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setEditing(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
          style={{ backgroundColor: currentTheme.colors.primary }}
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter une langue</span>
        </motion.button>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border overflow-hidden shadow-sm"
        style={{ backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Référence</th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Libellé</th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Prix HT</th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Prix TTC</th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>TVA</th>
                <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {languagesQuery.data.map((lang) => (
                <tr key={lang.id ?? lang.ref} className="border-b" style={{ borderColor: currentTheme.colors.border }}>
                  <td className="px-4 py-3 text-sm" style={{ color: currentTheme.colors.text }}>{lang.ref}</td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: currentTheme.colors.text }}>{lang.label || lang.display_name}</td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: currentTheme.colors.text }}>{lang.price != null ? lang.price.toFixed(2) : "—"}</td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: currentTheme.colors.text }}>{lang.price_ttc != null ? lang.price_ttc.toFixed(2) : "—"}</td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: currentTheme.colors.text }}>{lang.tva_tx != null ? `${lang.tva_tx}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => { setEditing(lang); setIsModalOpen(true); }}
                        className="p-1.5 rounded-lg text-white"
                        style={{ backgroundColor: currentTheme.colors.secondary }}
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(lang)}
                        className="p-1.5 rounded-lg text-white"
                        style={{ backgroundColor: currentTheme.colors.error }}
                        title="Désactiver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {languagesQuery.data.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: currentTheme.colors.textLight }}>
              Aucune langue pour cette entité.
            </div>
          )}
        </div>
      </motion.div>

      <ReferentielFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        title={editing ? "Modifier la langue" : "Ajouter une langue"}
        fields={languageFields}
        initialValues={editing ? { label: editing.label, ref: editing.ref, price: editing.price ?? "", price_ttc: editing.price_ttc ?? "", tva_tx: editing.tva_tx ?? "" } : {}}
      />
    </div>
  );
}

// ─── Référentiels : Termes de paiement ───────────────────────────────────────

const paymentTermFields: ReferentielField[] = [
  { key: "label", label: "Libellé", type: "text", required: true },
  { key: "label_facture", label: "Libellé facture", type: "text" },
  { key: "code", label: "Code", type: "text", placeholder: "Généré automatiquement si vide" },
  { key: "days", label: "Nombre de jours", type: "number" },
  { key: "shift", label: "Décalage", type: "number" },
];

function PaymentTermsSection({ currentTheme }: { currentTheme: any }) {
  const [editing, setEditing] = useState<RefPaymentTerm | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const termsQuery = usePaymentTerms(null);

  const handleSave = async (values: Record<string, any>) => {
    await crud.savePaymentTerm({
      id: editing?.id ?? undefined,
      label: values.label,
      label_facture: values.label_facture || undefined,
      code: values.code || undefined,
      days: values.days !== "" ? Number(values.days) : undefined,
      shift: values.shift !== "" ? Number(values.shift) : undefined,
    });
    termsQuery.refetch();
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (term: RefPaymentTerm) => {
    if (!window.confirm(`Désactiver le terme de paiement « ${term.label} » ?`)) return;
    await crud.deletePaymentTerm(term.id);
    termsQuery.refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setEditing(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
          style={{ backgroundColor: currentTheme.colors.primary }}
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un terme de paiement</span>
        </motion.button>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border overflow-hidden shadow-sm"
        style={{ backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: currentTheme.colors.primaryLight }}>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Libellé</th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Jours</th>
                <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Décalage</th>
                <th className="px-4 py-3 text-center text-sm font-semibold" style={{ color: currentTheme.colors.primary }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {termsQuery.data.terms.map((term) => (
                <tr key={term.id} className="border-b" style={{ borderColor: currentTheme.colors.border }}>
                  <td className="px-4 py-3 text-sm" style={{ color: currentTheme.colors.text }}>{term.code}</td>
                  <td className="px-4 py-3 text-sm font-medium" style={{ color: currentTheme.colors.text }}>{term.label}</td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: currentTheme.colors.text }}>{term.days}</td>
                  <td className="px-4 py-3 text-sm text-right" style={{ color: currentTheme.colors.text }}>{term.shift}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => { setEditing(term); setIsModalOpen(true); }}
                        className="p-1.5 rounded-lg text-white"
                        style={{ backgroundColor: currentTheme.colors.secondary }}
                        title="Modifier"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(term)}
                        className="p-1.5 rounded-lg text-white"
                        style={{ backgroundColor: currentTheme.colors.error }}
                        title="Désactiver"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {termsQuery.data.terms.length === 0 && (
            <div className="p-8 text-center text-sm" style={{ color: currentTheme.colors.textLight }}>
              Aucun terme de paiement pour cette entité.
            </div>
          )}
        </div>
      </motion.div>

      <ReferentielFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        title={editing ? "Modifier le terme de paiement" : "Ajouter un terme de paiement"}
        fields={paymentTermFields}
        initialValues={editing ? { label: editing.label, code: editing.code, days: editing.days, shift: editing.shift } : {}}
      />
    </div>
  );
}

// ─── Référentiels : Comptes bancaires ────────────────────────────────────────
// Pas de duplication automatique depuis l'entité 1 (décision explicite) :
// chaque entité saisit ses propres comptes bancaires via ce CRUD.

const bankAccountFields: ReferentielField[] = [
  { key: "bankLabel", label: "Libellé", type: "text", required: true },
  { key: "bankName", label: "Banque", type: "text" },
  { key: "bankIban", label: "IBAN", type: "text" },
  { key: "bankBic", label: "BIC", type: "text" },
  { key: "bankCode", label: "Code banque", type: "text" },
  { key: "bankBranchCode", label: "Code guichet", type: "text" },
  { key: "bankAccountNumber", label: "N° de compte", type: "text" },
  { key: "bankRibKey", label: "Clé RIB", type: "text" },
  { key: "bankDomiciliation", label: "Domiciliation", type: "text" },
  { key: "bankAccountHolder", label: "Titulaire du compte", type: "text" },
  { key: "bankOwnerAddress", label: "Adresse du titulaire", type: "text" },
  { key: "bankOwnerPostalCode", label: "Code postal", type: "text" },
  { key: "bankOwnerCity", label: "Ville", type: "text" },
];

function BankAccountsSection({ currentTheme }: { currentTheme: any }) {
  const [editing, setEditing] = useState<RefBankAccount | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const accountsQuery = useBankAccounts();

  const handleSave = async (values: Record<string, any>) => {
    await crud.saveBankAccount({
      id: editing?.id ?? undefined,
      bankLabel: values.bankLabel,
      bankName: values.bankName || undefined,
      bankCode: values.bankCode || undefined,
      bankBranchCode: values.bankBranchCode || undefined,
      bankAccountNumber: values.bankAccountNumber || undefined,
      bankRibKey: values.bankRibKey || undefined,
      bankBic: values.bankBic || undefined,
      bankIban: values.bankIban || undefined,
      bankDomiciliation: values.bankDomiciliation || undefined,
      bankAccountHolder: values.bankAccountHolder || undefined,
      bankOwnerAddress: values.bankOwnerAddress || undefined,
      bankOwnerPostalCode: values.bankOwnerPostalCode || undefined,
      bankOwnerCity: values.bankOwnerCity || undefined,
    });
    accountsQuery.refetch();
    setIsModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (account: RefBankAccount) => {
    if (!window.confirm(`Désactiver le compte « ${account.bankLabel} » ?`)) return;
    await crud.deleteBankAccount(account.id);
    accountsQuery.refetch();
  };

  const handleSetDefault = async (account: RefBankAccount) => {
    await crud.saveBankAccount({ id: account.id, bankLabel: account.bankLabel, isDefault: true });
    accountsQuery.refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-end mb-4">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => { setEditing(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
          style={{ backgroundColor: currentTheme.colors.primary }}
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter un compte bancaire</span>
        </motion.button>
      </div>

      <div className="space-y-4">
        {accountsQuery.data.map((account) => (
          <motion.div
            key={account.id}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="rounded-xl p-6 border shadow-sm"
            style={{ backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>{account.bankLabel}</h3>
                  {account.isDefault && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: currentTheme.colors.primaryLight, color: currentTheme.colors.primary }}
                    >
                      Compte par défaut
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>{account.bankName}</p>
              </div>
              <div className="flex gap-2">
                {!account.isDefault && (
                  <button
                    onClick={() => handleSetDefault(account)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}
                  >
                    Définir par défaut
                  </button>
                )}
                <button
                  onClick={() => { setEditing(account); setIsModalOpen(true); }}
                  className="p-1.5 rounded-lg text-white"
                  style={{ backgroundColor: currentTheme.colors.secondary }}
                  title="Modifier"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(account)}
                  className="p-1.5 rounded-lg text-white"
                  style={{ backgroundColor: currentTheme.colors.error }}
                  title="Désactiver"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t text-sm" style={{ borderColor: currentTheme.colors.border, color: currentTheme.colors.text }}>
              <div><span style={{ color: currentTheme.colors.textLight }}>IBAN : </span>{account.bankIban || "—"}</div>
              <div><span style={{ color: currentTheme.colors.textLight }}>BIC : </span>{account.bankBic || "—"}</div>
              <div><span style={{ color: currentTheme.colors.textLight }}>Titulaire : </span>{account.bankAccountHolder || "—"}</div>
            </div>
          </motion.div>
        ))}
        {accountsQuery.data.length === 0 && (
          <div
            className="p-8 text-center text-sm rounded-xl border"
            style={{ color: currentTheme.colors.textLight, borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }}
          >
            Aucun compte bancaire pour cette entité.
          </div>
        )}
      </div>

      <ReferentielFormModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        title={editing ? "Modifier le compte bancaire" : "Ajouter un compte bancaire"}
        fields={bankAccountFields}
        initialValues={editing ?? {}}
      />
    </div>
  );
}
