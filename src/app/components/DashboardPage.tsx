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
import { useInterpreters, useMissions, useClientInvoices } from "../../lib/hooks";
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

  // Données réelles via API
  const { data: interpretersData } = useInterpreters();
  // pageSize élevé pour permettre les agrégations client-side (graphes).
  // Le total réel provient de missionsData.total (renvoyé par le backend).
  const { data: missionsData } = useMissions({ page: 1, pageSize: 2000 });
  const { data: invoicesData } = useClientInvoices({ page: 1, pageSize: 500 });

  const totalRevenue = useMemo(
    () => invoicesData.invoices.reduce((sum, inv) => sum + (Number(inv.invoice_total_ttc) || 0), 0),
    [invoicesData]
  );

  // Agrégations réelles (client-side) à partir des missions + factures chargées.
  const stats = useMemo(() => {
    const missions = missionsData.missions ?? [];
    const invoices = invoicesData.invoices ?? [];
    const totalMissions = missionsData.total ?? 0;
    const totalInterpreters = interpretersData.length ?? 0;
    const averagePerDay = Math.max(1, Math.round(totalMissions / 30));

    // ─── Helpers ─────────────────────────────────────────────────────────
    const monthKey = (iso: string | null | undefined): string | null => {
      if (!iso) return null;
      // Formats attendus: 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM:SS', ISO
      const m = /^(\d{4})-(\d{2})/.exec(iso);
      return m ? `${m[1]}-${m[2]}` : null;
    };
    const MONTH_LABELS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

    // ─── 1) Évolution mensuelle sur les 6 derniers mois glissants ───────
    const now = new Date();
    const windowMonths: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      windowMonths.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: MONTH_LABELS_FR[d.getMonth()],
      });
    }
    const missionsPerMonth: Record<string, number> = {};
    for (const mo of windowMonths) missionsPerMonth[mo.key] = 0;
    for (const m of missions) {
      const k = monthKey(m.datemission_iso || m.datemission);
      if (k && k in missionsPerMonth) missionsPerMonth[k]++;
    }
    const revenuePerMonth: Record<string, number> = {};
    for (const mo of windowMonths) revenuePerMonth[mo.key] = 0;
    for (const inv of invoices) {
      const k = monthKey(inv.billed_at || inv.created_at);
      if (k && k in revenuePerMonth) {
        revenuePerMonth[k] += Number(inv.invoice_total_ttc) || 0;
      }
    }
    const monthlyTrend = windowMonths.map((mo) => ({
      month: mo.label,
      missions: missionsPerMonth[mo.key],
      revenue: Math.round(revenuePerMonth[mo.key]),
    }));

    // ─── 2) Répartition par type (top 5) ────────────────────────────────
    const typeCounts: Record<string, number> = {};
    for (const m of missions) {
      const t = (m.produit_label || m.produit_ref || "Autres").trim() || "Autres";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }
    const typePalette = [
      currentTheme.colors.primary,
      currentTheme.colors.secondary,
      currentTheme.colors.accent,
      currentTheme.colors.success,
      currentTheme.colors.statusExpired.text,
    ];
    const missionsByType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], i) => ({ name, value, color: typePalette[i % typePalette.length] }));

    // ─── 3) Top 5 interprètes (par nb missions) ─────────────────────────
    const interpreterCounts: Record<string, number> = {};
    for (const m of missions) {
      const name =
        (m.interpreter_name && m.interpreter_name.trim()) ||
        [m.lastname, m.firstname].filter(Boolean).join(" ").trim() ||
        "";
      if (!name || name === "—") continue;
      interpreterCounts[name] = (interpreterCounts[name] || 0) + 1;
    }
    const topInterpreters = Object.entries(interpreterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, missions: count }));

    // ─── 4) Statuts missions (0=Brouillon, 1=Validée, 2=Terminée, 3=Annulée) ─
    const statusBuckets = [
      { code: 1, name: "Validées", color: currentTheme.colors.statusAccepted.text },
      { code: 2, name: "Terminées", color: currentTheme.colors.success },
      { code: 0, name: "En attente", color: currentTheme.colors.statusExpired.text },
      { code: 3, name: "Annulées", color: currentTheme.colors.statusCancelled.text },
    ];
    const statusCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const m of missions) {
      const c = Number(m.mission_status);
      if (c in statusCounts) statusCounts[c]++;
    }
    const missionsByStatus = statusBuckets.map((b) => ({
      name: b.name,
      count: statusCounts[b.code] || 0,
      color: b.color,
    }));

    // ─── 5) Growth : mois courant vs mois précédent ─────────────────────
    const lastKey = windowMonths[windowMonths.length - 1].key;
    const prevKey = windowMonths[windowMonths.length - 2].key;
    const pct = (curr: number, prev: number): number => {
      if (!prev) return 0;
      return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
    };
    const growth = {
      missions: pct(missionsPerMonth[lastKey], missionsPerMonth[prevKey]),
      revenue: pct(revenuePerMonth[lastKey], revenuePerMonth[prevKey]),
      interpreters: 0, // pas d'historique fiable côté API
    };

    return {
      totalMissions,
      totalInterpreters,
      totalRevenue,
      averagePerDay,
      growth,
      missionsByType,
      monthlyTrend,
      topInterpreters,
      missionsByStatus,
    };
  }, [currentTheme, missionsData, interpretersData, invoicesData, totalRevenue]);

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
            {stats.topInterpreters.length === 0 && (
              <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                Aucune mission avec interprète assigné dans la période chargée.
              </p>
            )}
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
                      {interpreter.missions} mission{interpreter.missions > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <p className="font-bold" style={{ color: currentTheme.colors.success }}>
                  {interpreter.missions}
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
            {stats.missionsByStatus.map((status) => {
              const totalForBar = stats.missionsByStatus.reduce((s, x) => s + x.count, 0);
              const pct = totalForBar > 0 ? (status.count / totalForBar) * 100 : 0;
              return (
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
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
