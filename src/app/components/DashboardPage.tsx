import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  TrendingUp,
  Users,
  FileText,
  Euro,
  Calendar,
  Activity,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export function DashboardPage() {
  const { currentTheme } = useTheme();
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "year">("month");

  // Données de démonstration
  const stats = useMemo(() => {
    return {
      totalMissions: 20000,
      totalInterpreters: 150,
      totalRevenue: 450000,
      averagePerDay: 67,
      growth: {
        missions: 12.5,
        revenue: 8.3,
        interpreters: 5.2,
      },
      // Missions par type
      missionsByType: [
        { name: "Tribunal judiciaire", value: 8500, color: currentTheme.colors.primary },
        { name: "Traduction", value: 6200, color: currentTheme.colors.secondary },
        { name: "Interprétariat", value: 5300, color: currentTheme.colors.accent },
      ],
      // Évolution mensuelle
      monthlyTrend: [
        { month: "Jan", missions: 1650, revenue: 35000 },
        { month: "Fév", missions: 1720, revenue: 36500 },
        { month: "Mar", missions: 1800, revenue: 38200 },
        { month: "Avr", missions: 1680, revenue: 37100 },
        { month: "Mai", missions: 1850, revenue: 39800 },
        { month: "Juin", missions: 1920, revenue: 41200 },
      ],
      // Top interprètes
      topInterpreters: [
        { name: "ABBAS AZHAR", missions: 145, revenue: 12400 },
        { name: "ABAD ANNA", missions: 132, revenue: 11800 },
        { name: "ABBASSOV NATELLA", missions: 128, revenue: 11200 },
        { name: "ABDALJABAR TAREK", missions: 119, revenue: 10500 },
        { name: "NELLY", missions: 115, revenue: 10100 },
      ],
      // Statuts missions
      missionsByStatus: [
        { name: "Validées", count: 12500, color: currentTheme.colors.statusAccepted.text },
        { name: "Terminées", count: 6200, color: currentTheme.colors.success },
        { name: "En attente", count: 980, color: currentTheme.colors.statusExpired.text },
        { name: "Annulées", count: 320, color: currentTheme.colors.statusCancelled.text },
      ],
    };
  }, [currentTheme]);

  const kpiCards = [
    {
      title: "Total Missions",
      value: stats.totalMissions.toLocaleString(),
      icon: FileText,
      growth: stats.growth.missions,
      color: currentTheme.colors.primary,
      bgColor: currentTheme.colors.primaryLight,
    },
    {
      title: "Interprètes Actifs",
      value: stats.totalInterpreters.toLocaleString(),
      icon: Users,
      growth: stats.growth.interpreters,
      color: currentTheme.colors.success,
      bgColor: currentTheme.colors.statusAccepted.bg,
    },
    {
      title: "Chiffre d'Affaires",
      value: `${(stats.totalRevenue / 1000).toFixed(0)}K €`,
      icon: Euro,
      growth: stats.growth.revenue,
      color: currentTheme.colors.secondary,
      bgColor: currentTheme.colors.statusSent.bg,
    },
    {
      title: "Moyenne / Jour",
      value: stats.averagePerDay.toLocaleString(),
      icon: Activity,
      growth: 3.2,
      color: currentTheme.colors.accent,
      bgColor: currentTheme.colors.statusSpecial.bg,
    },
  ];

  return (
    <div className="max-w-[1800px] mx-auto px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
          Tableau de bord
        </h2>
        <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
          Vue d'ensemble de l'activité et des performances
        </p>
      </div>

      {/* Period Selector */}
      <div className="mb-6 flex gap-2">
        {(["week", "month", "year"] as const).map((period) => (
          <motion.button
            key={period}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedPeriod(period)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor:
                selectedPeriod === period
                  ? currentTheme.colors.primary
                  : currentTheme.colors.surface,
              color:
                selectedPeriod === period ? "#ffffff" : currentTheme.colors.textSecondary,
              border: `1px solid ${currentTheme.colors.border}`,
            }}
          >
            {period === "week" ? "Semaine" : period === "month" ? "Mois" : "Année"}
          </motion.button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {kpiCards.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-xl p-6 border shadow-sm"
            style={{
              backgroundColor: currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: kpi.bgColor }}
              >
                <kpi.icon className="w-6 h-6" style={{ color: kpi.color }} />
              </div>
              <div className="flex items-center gap-1">
                {kpi.growth >= 0 ? (
                  <ArrowUp className="w-4 h-4" style={{ color: currentTheme.colors.success }} />
                ) : (
                  <ArrowDown className="w-4 h-4" style={{ color: currentTheme.colors.error }} />
                )}
                <span
                  className="text-sm font-semibold"
                  style={{
                    color:
                      kpi.growth >= 0 ? currentTheme.colors.success : currentTheme.colors.error,
                  }}
                >
                  {Math.abs(kpi.growth)}%
                </span>
              </div>
            </div>
            <p className="text-sm mb-1" style={{ color: currentTheme.colors.textLight }}>
              {kpi.title}
            </p>
            <p className="text-3xl font-bold" style={{ color: currentTheme.colors.text }}>
              {kpi.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Trend */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
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
              <TrendingUp className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                Évolution mensuelle
              </h3>
              <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
                Missions et chiffre d'affaires sur 6 mois
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.monthlyTrend}>
              <CartesianGrid key="monthly-grid" strokeDasharray="3 3" stroke={currentTheme.colors.border} />
              <XAxis key="monthly-xaxis" dataKey="month" stroke={currentTheme.colors.textLight} tick={{ fontSize: 12 }} />
              <YAxis key="monthly-yaxis" yAxisId="left" stroke={currentTheme.colors.primary} tick={{ fontSize: 12 }} />
              <YAxis key="monthly-yaxis2" yAxisId="right" orientation="right" stroke={currentTheme.colors.secondary} tick={{ fontSize: 12 }} />
              <Tooltip
                key="monthly-tooltip"
                contentStyle={{
                  backgroundColor: currentTheme.colors.surface,
                  border: `1px solid ${currentTheme.colors.border}`,
                  borderRadius: "8px",
                }}
              />
              <Legend key="monthly-legend" />
              <Line
                key="missions-line"
                yAxisId="left"
                type="monotone"
                dataKey="missions"
                stroke={currentTheme.colors.primary}
                strokeWidth={2}
                dot={{ fill: currentTheme.colors.primary, r: 4 }}
                name="Missions"
                isAnimationActive={false}
              />
              <Line
                key="revenue-line"
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                stroke={currentTheme.colors.secondary}
                strokeWidth={2}
                dot={{ fill: currentTheme.colors.secondary, r: 4 }}
                name="CA (€)"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Missions by Type */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
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
              <Calendar className="w-6 h-6" style={{ color: currentTheme.colors.primary }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                Répartition par type
              </h3>
              <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
                Missions par catégorie
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats.missionsByType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name.split(" ")[0]} (${entry.value})`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive={false}
              >
                {stats.missionsByType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: currentTheme.colors.surface,
                  border: `1px solid ${currentTheme.colors.border}`,
                  borderRadius: "8px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Interpreters & Mission Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Interpreters */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
            Top 5 Interprètes
          </h3>
          <div className="space-y-4">
            {stats.topInterpreters.map((interpreter, index) => (
              <div
                key={interpreter.name}
                className="flex items-center justify-between pb-3 border-b"
                style={{ borderColor: currentTheme.colors.border }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: currentTheme.colors.primary }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-sm" style={{ color: currentTheme.colors.text }}>
                      {interpreter.name}
                    </p>
                    <p className="text-xs" style={{ color: currentTheme.colors.textLight }}>
                      {interpreter.missions} missions
                    </p>
                  </div>
                </div>
                <p className="font-bold" style={{ color: currentTheme.colors.success }}>
                  {interpreter.revenue.toLocaleString()} €
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Missions by Status */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl p-6 border shadow-sm"
          style={{
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          }}
        >
          <h3 className="text-lg font-bold mb-4" style={{ color: currentTheme.colors.text }}>
            Statuts des missions
          </h3>
          <div className="space-y-3">
            {stats.missionsByStatus.map((status) => (
              <div key={status.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
                    {status.name}
                  </span>
                  <span className="text-sm font-bold" style={{ color: status.color }}>
                    {status.count.toLocaleString()}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full"
                  style={{ backgroundColor: currentTheme.colors.border }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      backgroundColor: status.color,
                      width: `${(status.count / stats.totalMissions) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
