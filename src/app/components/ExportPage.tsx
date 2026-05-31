import { motion } from "motion/react";
import { Download, FileSpreadsheet, FileText, Calendar, Filter, Database } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export function ExportPage() {
  const { currentTheme } = useTheme();

  const exportOptions = [
    {
      id: "missions",
      title: "Export des missions",
      description: "Exporter toutes les missions avec leurs détails",
      icon: FileText,
      formats: ["Excel", "CSV", "PDF"],
    },
    {
      id: "invoices",
      title: "Export des factures",
      description: "Exporter les factures et les données de facturation",
      icon: FileSpreadsheet,
      formats: ["Excel", "CSV", "PDF"],
    },
    {
      id: "interpreters",
      title: "Export des interprètes",
      description: "Exporter l'annuaire complet des interprètes",
      icon: Database,
      formats: ["Excel", "CSV"],
    },
    {
      id: "clients",
      title: "Export des tiers",
      description: "Exporter les sociétés et contacts",
      icon: Database,
      formats: ["Excel", "CSV"],
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-8 py-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
          Exports de données
        </h2>
        <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
          Téléchargez vos données dans différents formats
        </p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="rounded-xl border p-8 mb-8"
        style={{
          backgroundColor: currentTheme.colors.surface,
          borderColor: currentTheme.colors.border,
        }}
      >
        <div className="flex items-center gap-4 mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: currentTheme.colors.primaryLight }}
          >
            <Calendar className="w-8 h-8" style={{ color: currentTheme.colors.primary }} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-1" style={{ color: currentTheme.colors.text }}>
              Filtres de période
            </h3>
            <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              Sélectionnez la période pour vos exports
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Date de début
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
              Date de fin
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
              Période prédéfinie
            </label>
            <select
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            >
              <option>Mois en cours</option>
              <option>Mois dernier</option>
              <option>Trimestre en cours</option>
              <option>Année en cours</option>
              <option>Personnalisé</option>
            </select>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportOptions.map((option, index) => {
          const Icon = option.icon;

          return (
            <motion.div
              key={option.id}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -4, boxShadow: "0 12px 24px -4px rgba(0, 0, 0, 0.1)" }}
              className="rounded-xl border p-6 shadow-sm hover:shadow-md transition-all"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            >
              <div className="flex items-start gap-4 mb-6">
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: currentTheme.colors.primaryLight }}
                >
                  <Icon className="w-7 h-7" style={{ color: currentTheme.colors.primary }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1" style={{ color: currentTheme.colors.text }}>
                    {option.title}
                  </h3>
                  <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
                    {option.description}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium mb-2" style={{ color: currentTheme.colors.textLight }}>
                  Formats disponibles:
                </p>
                <div className="flex gap-2">
                  {option.formats.map((format) => (
                    <motion.button
                      key={format}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg font-medium text-sm"
                      style={{ backgroundColor: currentTheme.colors.primary }}
                    >
                      <Download className="w-4 h-4" />
                      <span>{format}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 rounded-xl border p-6"
        style={{
          backgroundColor: currentTheme.colors.primaryLight,
          borderColor: currentTheme.colors.primary,
        }}
      >
        <div className="flex items-start gap-4">
          <Filter className="w-6 h-6 flex-shrink-0" style={{ color: currentTheme.colors.primary }} />
          <div>
            <h3 className="text-lg font-bold mb-2" style={{ color: currentTheme.colors.primary }}>
              Options d'export avancées
            </h3>
            <ul className="space-y-2 text-sm" style={{ color: currentTheme.colors.text }}>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.colors.primary }} />
                Les exports incluent toutes les données de la période sélectionnée
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.colors.primary }} />
                Les fichiers CSV utilisent l'encodage UTF-8
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.colors.primary }} />
                Les exports PDF incluent les en-têtes et logos personnalisés
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
