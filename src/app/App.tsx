import { useState } from "react";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { InterpreterCard } from "./components/InterpreterCard";
import { ThemeSelector } from "./components/ThemeSelector";
import { DashboardPage } from "./components/DashboardPage";
import { MissionsPage } from "./components/MissionsPage";
import { DevisPage } from "./components/DevisPage";
import { FacturationPage } from "./components/FacturationPage";
import { TiersPage } from "./components/TiersPage";
import { ConfigurationPage } from "./components/ConfigurationPage";
import { TiersDetailPage } from "./components/TiersDetailPage";
import { AdminPage } from "./components/AdminPage";
import { EmptyState } from "./components/EmptyState";
import { ViewModeSelector, ViewMode } from "./components/ViewModeSelector";
import { EditInterpreterModal } from "./components/EditInterpreterModal";
import { useInterpreters, crud } from "../lib/hooks";
import { useAuthStore } from "../store/auth";
import { motion } from "motion/react";
import { FileText, Download, FileSpreadsheet, UserPlus, Users, Phone, Mail, MessageSquare, Edit, Trash2 } from "lucide-react";

function AppContent() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [editingInterpreter, setEditingInterpreter] = useState<any | null>(null);
  const [isEditInterpreterModalOpen, setIsEditInterpreterModalOpen] = useState(false);
  const { currentTheme } = useTheme();
  const authUser = useAuthStore((s) => s.user);

  // Interprètes chargés depuis l'API (get_interpretes.php) — filtrage côté client
  const { data: interpreters, refetch: refetchInterpreters } = useInterpreters();

  const filteredInterpreters = interpreters.filter(
    (interpreter) =>
      interpreter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      interpreter.languages.toLowerCase().includes(searchQuery.toLowerCase()) ||
      interpreter.phone?.includes(searchQuery) ||
      interpreter.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fonction d'export des interprètes
  const handleExportInterpreters = (format: "csv" | "excel") => {
    const dataToExport = filteredInterpreters.map((interpreter) => ({
      Nom: interpreter.name,
      Langues: interpreter.languages,
      Téléphone: interpreter.phone || "",
      Email: interpreter.email || "",
      Statut: interpreter.status,
      Facturation: interpreter.billing || "",
    }));

    if (format === "csv") {
      exportToCSV(dataToExport, "interpretes");
    } else {
      exportToExcel(dataToExport, "interpretes");
    }
  };

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

      // Largeur des colonnes
      const colWidths = Object.keys(data[0] || {}).map(() => ({ wch: 20 }));
      worksheet["!cols"] = colWidths;

      XLSX.writeFile(
        workbook,
        `${filename}_${new Date().toISOString().split("T")[0]}.xlsx`
      );
    });
  };

  // Handlers pour l'édition des interprètes
  const handleEditInterpreter = (interpreter: any) => {
    setEditingInterpreter(interpreter);
    setIsEditInterpreterModalOpen(true);
  };

  const handleSaveInterpreter = async (updatedInterpreter: any) => {
    try {
      const [firstname = "", ...rest] = (updatedInterpreter.name || "").split(" ");
      const lastname = rest.join(" ") || firstname;
      await crud.saveInterpreter({
        id: updatedInterpreter.id || editingInterpreter?.id,
        firstname,
        lastname,
        email: updatedInterpreter.email,
        tel_mobile: updatedInterpreter.phone,
        langues_parlees: updatedInterpreter.languages,
        commentaires: updatedInterpreter.billing,
        status: updatedInterpreter.status,
      });
      refetchInterpreters();
    } catch (e) {
      console.error("Sauvegarde interprète impossible", e);
    }
  };

  const handleDeleteInterpreter = async (interpreter: any) => {
    if (!interpreter?.id) return;
    if (!window.confirm(`Supprimer l'interprète « ${interpreter.name} » ?`)) return;
    try {
      await crud.deleteInterpreter(interpreter.id);
      refetchInterpreters();
    } catch (e) {
      console.error("Suppression impossible", e);
    }
  };

  const handleCloseInterpreterModal = () => {
    setIsEditInterpreterModalOpen(false);
    setEditingInterpreter(null);
  };

  return (
    <div
      className="size-full flex flex-col"
      style={{ backgroundColor: currentTheme.colors.background }}
    >
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        userName={authUser?.fullName || authUser?.username || ""}
      />

      <main className="flex-1 overflow-auto">
        {activeTab === "dashboard" ? (
          <DashboardPage />
        ) : activeTab === "themes" ? (
          <ThemeSelector />
        ) : activeTab === "missions" ? (
          <MissionsPage />
        ) : activeTab === "devis" ? (
          <DevisPage />
        ) : activeTab === "facturation" ? (
          <FacturationPage />
        ) : activeTab === "tiers" ? (
          <TiersPage />
        ) : activeTab === "configuration" ? (
          <ConfigurationPage />
        ) : activeTab === "admin" ? (
          <AdminPage />
        ) : (
          <div className="max-w-[1600px] mx-auto px-8 py-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-2xl font-bold mb-1"
                  style={{ color: currentTheme.colors.text }}
                >
                  Annuaire des interprètes
                </h2>
                <div
                  className="flex items-center gap-2 text-sm cursor-pointer group"
                  style={{ color: currentTheme.colors.primary }}
                >
                  <FileText className="w-4 h-4" />
                  <span className="font-medium group-hover:underline">
                    FMI - Facturation des interprètes
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                  <span
                    className="font-semibold"
                    style={{ color: currentTheme.colors.text }}
                  >
                    {filteredInterpreters.length}
                  </span>{" "}
                  interprète{filteredInterpreters.length > 1 ? "s" : ""}
                </div>
                <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleExportInterpreters("excel")}
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
                    onClick={() => handleExportInterpreters("csv")}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
                    style={{ backgroundColor: currentTheme.colors.secondary }}
                    title="Exporter en CSV"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </motion.button>
                </div>
              </div>
            </div>

            <SearchBar
              onSearch={setSearchQuery}
              onAddNew={() => {
                setEditingInterpreter(null);
                setIsEditInterpreterModalOpen(true);
              }}
            />

            {filteredInterpreters.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun interprète trouvé"
                description={searchQuery ? "Essayez de modifier vos critères de recherche" : "Ajoutez votre premier interprète pour commencer"}
                action={!searchQuery ? {
                  label: "Ajouter un interprète",
                  onClick: () => {
                    setEditingInterpreter(null);
                    setIsEditInterpreterModalOpen(true);
                  }
                } : undefined}
              />
            ) : viewMode === "cards" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredInterpreters.map((interpreter, index) => (
                  <InterpreterCard
                    key={interpreter.name}
                    {...interpreter}
                    delay={index * 0.05}
                    onEdit={() => handleEditInterpreter(interpreter)}
                    onDelete={() => handleDeleteInterpreter(interpreter)}
                  />
                ))}
              </div>
            ) : (
              <InterpretersTable interpreters={filteredInterpreters} currentTheme={currentTheme} onEdit={handleEditInterpreter} />
            )}
          </div>
        )}
      </main>

      {/* Modal d'édition d'interprète */}
      <EditInterpreterModal
        isOpen={isEditInterpreterModalOpen}
        onClose={handleCloseInterpreterModal}
        interpreter={editingInterpreter}
        onSave={handleSaveInterpreter}
      />
    </div>
  );
}

function InterpretersTable({ interpreters, currentTheme, onEdit }: { interpreters: any[]; currentTheme: any; onEdit: (interpreter: any) => void }) {
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
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Nom
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Langues
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Téléphone
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Email
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Facturation
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Statut
              </th>
              <th
                className="px-4 py-3 text-center text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {interpreters.map((interpreter, index) => (
              <motion.tr
                key={interpreter.name}
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
                    {interpreter.name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {interpreter.languages}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {interpreter.phone ? (
                    <a
                      href={`tel:${interpreter.phone}`}
                      className="flex items-center gap-2 text-sm hover:underline"
                      style={{ color: currentTheme.colors.text }}
                    >
                      <Phone className="w-3 h-3" style={{ color: currentTheme.colors.textLight }} />
                      <span>{interpreter.phone}</span>
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {interpreter.email ? (
                    <a
                      href={`mailto:${interpreter.email}`}
                      className="flex items-center gap-2 text-sm hover:underline truncate max-w-xs"
                      style={{ color: currentTheme.colors.text }}
                    >
                      <Mail className="w-3 h-3 flex-shrink-0" style={{ color: currentTheme.colors.textLight }} />
                      <span className="truncate">{interpreter.email}</span>
                    </a>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {interpreter.billing ? (
                    <span className="text-xs" style={{ color: currentTheme.colors.text }}>
                      {interpreter.billing}
                    </span>
                  ) : (
                    <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: currentTheme.colors.success + "20",
                        color: currentTheme.colors.success,
                      }}
                    >
                      {interpreter.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.success }}
                      title="Contacter"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => onEdit(interpreter)}
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.primary }}
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

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}