import { useState } from "react";
import { motion } from "motion/react";
import { Shield, Plus, Edit, Trash2, Search, UserCheck, UserX, Download, FileSpreadsheet } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { EditUserModal } from "./EditUserModal";
import { useUsers, crud, type RawUser } from "../../lib/hooks";

interface User {
  id: string;
  name: string;
  permissions: {
    interpretes: boolean;
    gestInterpretes: boolean;
    missions: boolean;
    admin: boolean;
  };
}

export function AdminPage() {
  const { currentTheme } = useTheme();
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
      name: user.name,
      email: `${user.name.toLowerCase().replace(/\s/g, ".")}@ami.fr`,
      role: "Gestionnaire",
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
        username: (updatedUser.email || updatedUser.name || "").split("@")[0],
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
    name: u.fullname || u.username,
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

  return (
    <div className="max-w-[1600px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            Administration
          </h2>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            Gestion des utilisateurs et des permissions · {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? "s" : ""}
          </p>
        </div>
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
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Plus className="w-5 h-5" />
            <span>Ajouter un utilisateur</span>
          </motion.button>
        </div>
      </div>

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
    </div>
  );
}
