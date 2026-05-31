import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus, FileText, Calendar, Clock, User, Building, Languages, Edit, Trash2, Eye, ChevronRight, Search, Filter, Download, X, ChevronLeft, FileSpreadsheet, TrendingUp, BarChart3 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import { ViewModeSelector, ViewMode } from "./ViewModeSelector";
import { EditMissionModal } from "./EditMissionModal";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { api } from "../../lib/api";
import { crud, type RawMission } from "../../lib/hooks";

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

// Mappe une mission backend (get_missions_datatable.php) vers le modèle UI.
function mapApiMission(raw: RawMission): Mission {
  const iso = raw.datemission_iso || raw.datemission || "";
  const d = iso ? new Date(iso.replace(" ", "T")) : null;
  const dateStr = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("fr-FR") : (iso || "");
  const time = (raw.heuredebutmission || "").slice(0, 5);
  const statusMap: Record<number, Mission["status"]> = { 0: "Brouillon", 1: "Validée", 2: "Terminée", 3: "Annulée" };
  return {
    id: `mission-${raw.rowid}`,
    ref: raw.reference_devis || raw.label || `PRO${String(raw.rowid).padStart(6, "0")}`,
    type: raw.produit_label || raw.produit_ref || "Interprétariat",
    date: dateStr,
    time,
    duration: raw.dureemission ? `${raw.dureemission} min` : "",
    interpreter: raw.interpreter_name || [raw.firstname, raw.lastname].filter(Boolean).join(" ") || "—",
    language: raw.produit_ref || "",
    client: raw.client_name || "",
    location: raw.client_town || "",
    status: statusMap[raw.mission_status] || "Brouillon",
  };
}

export function MissionsPage() {
  const { currentTheme } = useTheme();
  const [view, setView] = useState<"list" | "create">("list");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [showFilters, setShowFilters] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filtres
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterInterpreter, setFilterInterpreter] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Missions chargées depuis l'API (get_missions_datatable.php avec exportAll)
  const [allMissions, setAllMissions] = useState<Mission[]>([]);
  const reloadMissions = () => {
    api
      .get("get_missions_datatable.php", { params: { exportAll: 1 } })
      .then((res) => {
        const list: RawMission[] = res.data?.missions ?? [];
        setAllMissions(list.map(mapApiMission));
      })
      .catch(() => setAllMissions([]));
  };
  useEffect(() => {
    reloadMissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers pour l'édition
  const handleEditMission = (mission: Mission) => {
    setEditingMission(mission);
    setIsEditModalOpen(true);
  };

  const handleSaveMission = async (updatedMission: Mission) => {
    try {
      const numericId = Number(String(updatedMission.id).replace(/^mission-/, ""));
      const statusMap: Record<Mission["status"], number> = { Brouillon: 0, "Validée": 1, "Terminée": 2, "Annulée": 3 };
      const [day, month, year] = (updatedMission.date || "").split("/");
      const isoDate = year && month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : undefined;
      await crud.saveMission({
        id: numericId || undefined,
        reference_devis: updatedMission.ref,
        label: updatedMission.type,
        datemission: isoDate,
        heuredebutmission: updatedMission.time,
        dureemission: updatedMission.duration?.replace(/[^0-9]/g, "") || undefined,
        mission_status: statusMap[updatedMission.status],
        commentaires: updatedMission.location,
      });
      reloadMissions();
    } catch (e) {
      console.error("Sauvegarde mission impossible", e);
    }
  };

  const handleDeleteMission = async (mission: Mission) => {
    const numericId = Number(String(mission.id).replace(/^mission-/, ""));
    if (!numericId) return;
    if (!window.confirm(`Supprimer la mission « ${mission.ref} » ?`)) return;
    try {
      await crud.deleteMission(numericId);
      reloadMissions();
    } catch (e) {
      console.error("Suppression mission impossible", e);
    }
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingMission(null);
  };

  // Listes uniques pour les filtres
  const uniqueClients = useMemo(() =>
    [...new Set(allMissions.map(m => m.client))].sort(),
    [allMissions]
  );

  const uniqueInterpreters = useMemo(() =>
    [...new Set(allMissions.map(m => m.interpreter))].sort(),
    [allMissions]
  );

  const uniqueLanguages = useMemo(() =>
    [...new Set(allMissions.map(m => m.language))].sort(),
    [allMissions]
  );

  // Statistiques
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Missions par jour du mois en cours
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const missionsByDay: { [key: string]: number } = {};

    for (let day = 1; day <= daysInMonth; day++) {
      missionsByDay[`${day}`] = 0;
    }

    // Missions des 3 derniers mois
    const last3Months: { [key: string]: number } = {};
    for (let i = 2; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const monthName = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      last3Months[monthName] = 0;
    }

    // Compter les missions
    allMissions.forEach(mission => {
      const missionDate = parseFrenchDate(mission.date);
      const missionMonth = missionDate.getMonth();
      const missionYear = missionDate.getFullYear();

      // Compter pour le mois en cours
      if (missionMonth === currentMonth && missionYear === currentYear) {
        const day = missionDate.getDate();
        missionsByDay[`${day}`]++;
      }

      // Compter pour les 3 derniers mois
      for (let i = 2; i >= 0; i--) {
        const targetDate = new Date(currentYear, currentMonth - i, 1);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();

        if (missionMonth === targetMonth && missionYear === targetYear) {
          const monthName = targetDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
          last3Months[monthName]++;
        }
      }
    });

    // Convertir en tableaux pour les graphiques
    const dailyData = Object.entries(missionsByDay).map(([day, count]) => ({
      day: `${day}`,
      missions: count,
    }));

    const monthlyData = Object.entries(last3Months).map(([month, count]) => ({
      month,
      missions: count,
    }));

    // Statistiques générales
    const totalMissions = allMissions.length;
    const thisMonthMissions = Object.values(missionsByDay).reduce((a, b) => a + b, 0);
    const avgPerDay = thisMonthMissions / daysInMonth;

    return {
      dailyData,
      monthlyData,
      totalMissions,
      thisMonthMissions,
      avgPerDay: Math.round(avgPerDay),
    };
  }, [allMissions]);

  // Filtrage des missions
  const filteredMissions = useMemo(() => {
    return allMissions.filter(mission => {
      // Recherche globale
      const matchesSearch = searchQuery === "" ||
        mission.ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mission.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mission.interpreter.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mission.language.toLowerCase().includes(searchQuery.toLowerCase());

      // Filtre par client
      const matchesClient = filterClient === "" || mission.client === filterClient;

      // Filtre par interprète
      const matchesInterpreter = filterInterpreter === "" || mission.interpreter === filterInterpreter;

      // Filtre par langue
      const matchesLanguage = filterLanguage === "" || mission.language === filterLanguage;

      // Filtre par statut
      const matchesStatus = filterStatus === "all" || mission.status === filterStatus;

      // Filtre par date
      let matchesDate = true;
      if (filterDateStart || filterDateEnd) {
        const missionDate = parseFrenchDate(mission.date);
        if (filterDateStart && missionDate < new Date(filterDateStart)) {
          matchesDate = false;
        }
        if (filterDateEnd && missionDate > new Date(filterDateEnd)) {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesClient && matchesInterpreter && matchesLanguage && matchesStatus && matchesDate;
    });
  }, [allMissions, searchQuery, filterClient, filterInterpreter, filterLanguage, filterStatus, filterDateStart, filterDateEnd]);

  // Pagination
  const totalPages = Math.ceil(filteredMissions.length / itemsPerPage);
  const paginatedMissions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMissions.slice(start, start + itemsPerPage);
  }, [filteredMissions, currentPage, itemsPerPage]);

  // Réinitialiser la page lors du changement de filtres
  const resetPage = () => setCurrentPage(1);

  // Réinitialiser tous les filtres
  const clearFilters = () => {
    setSearchQuery("");
    setFilterClient("");
    setFilterInterpreter("");
    setFilterLanguage("");
    setFilterDateStart("");
    setFilterDateEnd("");
    setFilterStatus("all");
    setCurrentPage(1);
  };

  // Fonction d'export
  const handleExport = (format: "excel" | "csv") => {
    const dataToExport = filteredMissions;

    if (format === "csv") {
      exportToCSV(dataToExport);
    } else {
      exportToExcel(dataToExport);
    }
  };

  const activeFiltersCount = [
    filterClient,
    filterInterpreter,
    filterLanguage,
    filterDateStart,
    filterDateEnd,
    filterStatus !== "all" ? filterStatus : "",
    searchQuery,
  ].filter(Boolean).length;

  if (view === "create") {
    return <CreateMissionForm onBack={() => setView("list")} />;
  }

  return (
    <div className="max-w-[1800px] mx-auto px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            Gestion des missions
          </h2>
          <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
            {filteredMissions.length.toLocaleString()} mission{filteredMissions.length > 1 ? "s" : ""}
            {filteredMissions.length !== allMissions.length && (
              <span> sur {allMissions.length.toLocaleString()} au total</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <ViewModeSelector viewMode={viewMode} onViewModeChange={setViewMode} />

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium border"
            style={{
              backgroundColor: showStats ? currentTheme.colors.primaryLight : currentTheme.colors.surface,
              color: showStats ? currentTheme.colors.primary : currentTheme.colors.text,
              borderColor: currentTheme.colors.border,
            }}
          >
            <TrendingUp className="w-5 h-5" />
            <span>{showStats ? "Masquer" : "Afficher"} statistiques</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-3 rounded-lg font-medium border relative"
            style={{
              backgroundColor: showFilters ? currentTheme.colors.primaryLight : currentTheme.colors.surface,
              color: showFilters ? currentTheme.colors.primary : currentTheme.colors.text,
              borderColor: currentTheme.colors.border,
            }}
          >
            <Filter className="w-5 h-5" />
            <span>Filtres</span>
            {activeFiltersCount > 0 && (
              <span
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: currentTheme.colors.primary }}
              >
                {activeFiltersCount}
              </span>
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView("create")}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
            style={{ backgroundColor: currentTheme.colors.primary }}
          >
            <Plus className="w-5 h-5" />
            <span>Nouvelle mission</span>
          </motion.button>
        </div>
      </div>

      {/* Statistiques */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-6"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Carte statistiques générales */}
              <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentTheme.colors.primaryLight }}
            >
              <TrendingUp className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
            </div>
            <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
              Vue d'ensemble
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
                Total missions
              </p>
              <p className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
                {stats.totalMissions.toLocaleString()}
              </p>
            </div>

            <div
              className="pt-4 border-t"
              style={{ borderColor: currentTheme.colors.border }}
            >
              <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
                Ce mois-ci
              </p>
              <p className="text-2xl font-bold" style={{ color: currentTheme.colors.primary }}>
                {stats.thisMonthMissions.toLocaleString()}
              </p>
            </div>

            <div
              className="pt-4 border-t"
              style={{ borderColor: currentTheme.colors.border }}
            >
              <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
                Moyenne par jour
              </p>
              <p className="text-2xl font-bold" style={{ color: currentTheme.colors.success }}>
                {stats.avgPerDay}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Graphique par jour */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: currentTheme.colors.primaryLight }}
            >
              <BarChart3 className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                Missions par jour - {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </h3>
              <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
                Nombre de missions créées chaque jour du mois en cours
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.dailyData}>
              <CartesianGrid key="daily-grid" strokeDasharray="3 3" stroke={currentTheme.colors.border} />
              <XAxis
                key="daily-xaxis"
                dataKey="day"
                stroke={currentTheme.colors.textLight}
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis key="daily-yaxis" stroke={currentTheme.colors.textLight} tick={{ fontSize: 12 }} />
              <Tooltip
                key="daily-tooltip"
                contentStyle={{
                  backgroundColor: currentTheme.colors.surface,
                  border: `1px solid ${currentTheme.colors.border}`,
                  borderRadius: "8px",
                  color: currentTheme.colors.text,
                }}
                labelFormatter={(value) => `Jour ${value}`}
                formatter={(value: number) => [`${value} mission${value > 1 ? "s" : ""}`, ""]}
              />
              <Bar key="missions-bar" dataKey="missions" fill={currentTheme.colors.primary} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

            {/* Graphique 3 derniers mois */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl p-6 border shadow-sm"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: currentTheme.colors.secondaryLight || currentTheme.colors.primaryLight }}
                >
                  <Calendar className="w-6 h-6" style={{ color: currentTheme.colors.secondary }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                    Évolution sur les 3 derniers mois
                  </h3>
                  <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
                    Comparaison du nombre total de missions par mois
                  </p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={stats.monthlyData}>
                  <CartesianGrid key="monthly-grid" strokeDasharray="3 3" stroke={currentTheme.colors.border} />
                  <XAxis
                    key="monthly-xaxis"
                    dataKey="month"
                    stroke={currentTheme.colors.textLight}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis key="monthly-yaxis" stroke={currentTheme.colors.textLight} tick={{ fontSize: 12 }} />
                  <Tooltip
                    key="monthly-tooltip"
                    contentStyle={{
                      backgroundColor: currentTheme.colors.surface,
                      border: `1px solid ${currentTheme.colors.border}`,
                      borderRadius: "8px",
                      color: currentTheme.colors.text,
                    }}
                    formatter={(value: number) => [`${value} mission${value > 1 ? "s" : ""}`, ""]}
                  />
                  <Legend key="monthly-legend" />
                  <Line
                    key="missions-line"
                    type="monotone"
                    dataKey="missions"
                    stroke={currentTheme.colors.secondary}
                    strokeWidth={3}
                    dot={{ fill: currentTheme.colors.secondary, r: 5 }}
                    activeDot={{ r: 7 }}
                    name="Missions"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre de recherche rapide */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border p-4 mb-4"
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
            placeholder="Recherche rapide par référence, client, interprète, langue..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); resetPage(); }}
            className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{
              borderColor: currentTheme.colors.border,
              color: currentTheme.colors.text,
            }}
          />
        </div>
      </motion.div>

      {/* Panneau de filtres avancés */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden mb-4"
          >
            <div
              className="rounded-xl border p-6"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                  Filtres avancés
                </h3>
                <div className="flex gap-2">
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: currentTheme.colors.error + "20",
                        color: currentTheme.colors.error,
                      }}
                    >
                      <X className="w-4 h-4" />
                      <span>Réinitialiser</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Client
                  </label>
                  <select
                    value={filterClient}
                    onChange={(e) => { setFilterClient(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="">Tous les clients</option>
                    {uniqueClients.map(client => (
                      <option key={client} value={client}>{client}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Interprète
                  </label>
                  <select
                    value={filterInterpreter}
                    onChange={(e) => { setFilterInterpreter(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="">Tous les interprètes</option>
                    {uniqueInterpreters.map(interpreter => (
                      <option key={interpreter} value={interpreter}>{interpreter}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Langue
                  </label>
                  <select
                    value={filterLanguage}
                    onChange={(e) => { setFilterLanguage(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="">Toutes les langues</option>
                    {uniqueLanguages.map(language => (
                      <option key={language} value={language}>{language}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Date de début
                  </label>
                  <input
                    type="date"
                    value={filterDateStart}
                    onChange={(e) => { setFilterDateStart(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={filterDateEnd}
                    onChange={(e) => { setFilterDateEnd(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                    Statut
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); resetPage(); }}
                    className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                    style={{
                      borderColor: currentTheme.colors.border,
                      color: currentTheme.colors.text,
                    }}
                  >
                    <option value="all">Tous les statuts</option>
                    <option value="Brouillon">Brouillon</option>
                    <option value="Validée">Validée</option>
                    <option value="Terminée">Terminée</option>
                    <option value="Annulée">Annulée</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre d'actions et export */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport("excel")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.success,
              color: "#ffffff",
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Exporter Excel</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleExport("csv")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: currentTheme.colors.secondary,
              color: "#ffffff",
            }}
          >
            <Download className="w-4 h-4" />
            <span>Exporter CSV</span>
          </motion.button>
        </div>

        <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
          Page {currentPage} sur {totalPages}
        </p>
      </div>

      {/* Liste des missions */}
      {viewMode === "cards" ? (
        <div className="space-y-4">
          {paginatedMissions.map((mission, index) => (
            <MissionCard key={mission.id} mission={mission} index={index} onEdit={handleEditMission} />
          ))}
        </div>
      ) : (
        <MissionsTable missions={paginatedMissions} />
      )}

      {filteredMissions.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Aucune mission trouvée"
          description="Essayez de modifier vos critères de recherche ou créez une nouvelle mission"
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mt-6 flex items-center justify-center gap-2"
        >
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {getPageNumbers(currentPage, totalPages).map((pageNum, idx) =>
            pageNum === "..." ? (
              <span key={`ellipsis-${idx}`} className="px-3 py-2" style={{ color: currentTheme.colors.textLight }}>
                ...
              </span>
            ) : (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(Number(pageNum))}
                className="px-4 py-2 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: currentPage === pageNum ? currentTheme.colors.primary : currentTheme.colors.primaryLight,
                  color: currentPage === pageNum ? "#ffffff" : currentTheme.colors.primary,
                }}
              >
                {pageNum}
              </button>
            )
          )}

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              color: currentTheme.colors.primary,
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      )}

      {/* Modal d'édition */}
      <EditMissionModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        mission={editingMission}
        onSave={handleSaveMission}
      />
    </div>
  );
}

function MissionsTable({ missions }: { missions: Mission[] }) {
  const { currentTheme } = useTheme();

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
                Référence
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Type
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Date & Heure
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Interprète
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Langue
              </th>
              <th
                className="px-4 py-3 text-left text-sm font-semibold"
                style={{ color: currentTheme.colors.primary }}
              >
                Client
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
            {missions.map((mission, index) => (
              <motion.tr
                key={mission.id}
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
                    {mission.ref}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {mission.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-xs" style={{ color: currentTheme.colors.textLight }}>
                      <Calendar className="w-3 h-3" />
                      <span>{mission.date}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs" style={{ color: currentTheme.colors.textLight }}>
                      <Clock className="w-3 h-3" />
                      <span>{mission.time} ({mission.duration})</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
                    <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                      {mission.interpreter}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Languages className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
                    <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                      {mission.language}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm" style={{ color: currentTheme.colors.text }}>
                    {mission.client}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex justify-center">
                    <StatusChip status={mission.status} />
                  </div>
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
                      className="p-1.5 rounded-lg text-white"
                      style={{ backgroundColor: currentTheme.colors.success }}
                      title="Générer un devis"
                      onClick={() => alert("Générer un devis pour cette mission")}
                    >
                      <FileText className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEditMission(mission)}
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

function MissionCard({ mission, index, onEdit }: { mission: Mission; index: number; onEdit: (mission: Mission) => void }) {
  const { currentTheme } = useTheme();

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      whileHover={{ y: -2, boxShadow: "0 8px 16px -4px rgba(0, 0, 0, 0.1)" }}
      className="rounded-xl p-6 border shadow-sm hover:shadow-md transition-all"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: currentTheme.colors.primaryLight }}
          >
            <FileText className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                {mission.ref}
              </h3>
              <StatusChip status={mission.status} />
            </div>
            <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              {mission.type}
            </p>
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
            className="p-2 rounded-lg text-white"
            style={{ backgroundColor: currentTheme.colors.success }}
            title="Générer un devis"
            onClick={() => alert("Générer un devis pour cette mission")}
          >
            <FileText className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onEdit(mission)}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>Date</p>
            <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
              {mission.date}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>Heure</p>
            <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
              {mission.time} ({mission.duration})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <User className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>Interprète</p>
            <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
              {mission.interpreter}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>Langue</p>
            <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
              {mission.language}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:col-span-2">
          <Building className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
          <div>
            <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>Client</p>
            <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
              {mission.client}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CreateMissionForm({ onBack }: { onBack: () => void }) {
  const { currentTheme } = useTheme();
  const [missionType, setMissionType] = useState("Interprétariat");

  return (
    <div className="max-w-4xl mx-auto px-8 py-6">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 mb-4 hover:opacity-70 transition-opacity"
          style={{ color: currentTheme.colors.primary }}
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          <span className="font-medium">Retour à la liste</span>
        </button>
        <h2 className="text-2xl font-bold" style={{ color: currentTheme.colors.text }}>
          Nouvelle mission
        </h2>
        <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
          Les champs avec astérisque (*) sont obligatoires
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl p-8 border shadow-sm"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="space-y-8">
          {/* Type de mission */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Type de mission
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Type *
                </label>
                <div className="flex gap-3">
                  {["Tribunal judiciaire", "Traduction", "Interprétariat"].map((type) => (
                    <button
                      key={type}
                      onClick={() => setMissionType(type)}
                      className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: missionType === type ? currentTheme.colors.primary : currentTheme.colors.primaryLight,
                        color: missionType === type ? "#ffffff" : currentTheme.colors.primary,
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Libellé
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                  placeholder="Description optionnelle"
                />
              </div>
            </div>
          </div>

          {/* Planification */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Planification
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Date de la mission * (JJ/MM/AAAA)
              </label>
              <input
                type="date"
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Heure de début (HH:MM)
              </label>
              <input
                type="time"
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Durée (minutes)
              </label>
              <input
                type="number"
                placeholder="60"
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              />
            </div>
          </div>
          </div>

          {/* Informations demandeur */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: currentTheme.colors.text }}>
                Informations demandeur
              </h3>
              <button
                className="text-sm font-medium hover:underline"
                style={{ color: currentTheme.colors.primary }}
              >
                Gérer les demandeurs
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Société demandeuse *
                </label>
                <select
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">Sélectionner une société</option>
                  <option>CADA Marseille - Groupe SOS Solidarités</option>
                  <option>HOPITAL EMILE ROUX</option>
                  <option>ATPA Grenoble Port de Claix</option>
                  <option>Tribunal de Paris</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                  Personne demandeuse *
                </label>
                <select
                  className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.text,
                  }}
                >
                  <option value="">Sélectionner une personne</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mission */}
          <div>
            <h3 className="text-lg font-semibold mb-4" style={{ color: currentTheme.colors.text }}>
              Mission
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Interprète *
              </label>
              <select
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option value="">Sélectionner un interprète</option>
                <option>NELLY</option>
                <option>ABBAS AZHAR</option>
                <option>ABAD ANNA</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
                Langue * (ref produit)
              </label>
              <select
                className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
                style={{
                  borderColor: currentTheme.colors.border,
                  color: currentTheme.colors.text,
                }}
              >
                <option value="">Sélectionner une langue</option>
                <option>Géorgien vers Français</option>
                <option>Kurde vers Français</option>
                <option>Bengali vers Français</option>
              </select>
            </div>
          </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Commentaires
            </label>
            <textarea
              rows={4}
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all resize-none"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
              placeholder="Informations complémentaires..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Statut mission
            </label>
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option>Brouillon</option>
              <option>Validée</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex-1 px-6 py-3 text-white rounded-lg font-medium shadow-sm"
              style={{ backgroundColor: currentTheme.colors.primary }}
            >
              Créer la mission
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBack}
              className="px-6 py-3 rounded-lg font-medium"
              style={{
                backgroundColor: currentTheme.colors.primaryLight,
                color: currentTheme.colors.primary,
              }}
            >
              Annuler
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Utilitaires
function parseFrenchDate(dateStr: string): Date {
  const [day, month, year] = dateStr.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 3) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}

function exportToCSV(missions: Mission[]) {
  const headers = ["Référence", "Type", "Date", "Heure", "Durée", "Interprète", "Langue", "Client", "Lieu", "Statut"];
  const rows = missions.map(m => [
    m.ref,
    m.type,
    m.date,
    m.time,
    m.duration,
    m.interpreter,
    m.language,
    m.client,
    m.location,
    m.status,
  ]);

  const csvContent = [
    headers.join(";"),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(";")),
  ].join("\n");

  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `missions_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
}

function exportToExcel(missions: Mission[]) {
  import("xlsx").then((XLSX) => {
    const worksheet = XLSX.utils.json_to_sheet(
      missions.map(m => ({
        "Référence": m.ref,
        "Type": m.type,
        "Date": m.date,
        "Heure": m.time,
        "Durée": m.duration,
        "Interprète": m.interpreter,
        "Langue": m.language,
        "Client": m.client,
        "Lieu": m.location,
        "Statut": m.status,
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Missions");

    // Définir la largeur des colonnes
    const colWidths = [
      { wch: 15 }, // Référence
      { wch: 30 }, // Type
      { wch: 12 }, // Date
      { wch: 10 }, // Heure
      { wch: 10 }, // Durée
      { wch: 20 }, // Interprète
      { wch: 25 }, // Langue
      { wch: 40 }, // Client
      { wch: 15 }, // Lieu
      { wch: 12 }, // Statut
    ];
    worksheet["!cols"] = colWidths;

    XLSX.writeFile(workbook, `missions_${new Date().toISOString().split("T")[0]}.xlsx`);
  });
}
