import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Download, FileSpreadsheet, FileText, Calendar, Filter, Database } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { useInterpreters, useClients, useMissions, useClientInvoices } from "../../lib/hooks";

type ExportFormat = "Excel" | "CSV" | "PDF";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",;\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const lines = [headers.map(escapeCsv).join(";")];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(";"));
  }
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportPage() {
  const { currentTheme } = useTheme();
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const { data: interpreters } = useInterpreters();
  const { data: clients } = useClients();
  const { data: missionsData } = useMissions({
    page: 1,
    pageSize: 10000,
    dateStart: dateStart || undefined,
    dateEnd: dateEnd || undefined,
  });
  const { data: invoicesData } = useClientInvoices({ page: 1, pageSize: 10000 });

  const exporters = useMemo(
    () => ({
      missions: () =>
        downloadCsv(
          `missions_${new Date().toISOString().slice(0, 10)}.csv`,
          ["Référence", "Date", "Client", "Interprète", "Langue", "Type", "Statut", "Facturée"],
          missionsData.missions.map((m) => [
            m.reference_devis,
            m.datemission_iso ?? m.datemission ?? "",
            m.client_name,
            m.interpreter_name,
            m.produit_label || m.produit_ref,
            (m.mission_types ?? []).join(" + "),
            m.mission_status,
            m.client_billed_status_label ?? "",
          ])
        ),
      invoices: () =>
        downloadCsv(
          `factures_${new Date().toISOString().slice(0, 10)}.csv`,
          ["Numéro", "Client", "Période", "Date émission", "Total HT", "Total TTC", "Statut"],
          invoicesData.invoices.map((i) => [
            i.invoice_number,
            i.client_name,
            i.period_month,
            i.billed_at,
            i.invoice_total_ht ?? "",
            i.invoice_total_ttc ?? "",
            i.status_label,
          ])
        ),
      interpreters: () =>
        downloadCsv(
          `interpretes_${new Date().toISOString().slice(0, 10)}.csv`,
          ["Nom", "Langues", "Téléphone", "Email", "Statut"],
          interpreters.map((it) => [it.name, it.languages, it.phone ?? "", it.email ?? "", it.status])
        ),
      clients: () =>
        downloadCsv(
          `clients_${new Date().toISOString().slice(0, 10)}.csv`,
          ["Nom", "Alias", "Adresse", "CP", "Ville", "Pays", "Téléphone", "Email", "SIRET"],
          clients.map((c) => [
            c.name,
            c.alias,
            c.address,
            c.zip,
            c.town,
            c.country_label,
            c.phone,
            c.email,
            c.siret,
          ])
        ),
    }),
    [missionsData.missions, invoicesData.invoices, interpreters, clients]
  );

  const handleExport = (id: keyof typeof exporters, format: ExportFormat) => {
    if (format !== "CSV") {
      alert(`L'export ${format} sera disponible prochainement. Veuillez utiliser CSV en attendant.`);
      return;
    }
    exporters[id]();
  };

  const exportOptions = [
    {
      id: "missions" as const,
      title: "Export des missions",
      description: "Exporter toutes les missions avec leurs détails",
      icon: FileText,
      formats: ["Excel", "CSV", "PDF"] as ExportFormat[],
      count: missionsData.total,
    },
    {
      id: "invoices" as const,
      title: "Export des factures",
      description: "Exporter les factures et les données de facturation",
      icon: FileSpreadsheet,
      formats: ["Excel", "CSV", "PDF"] as ExportFormat[],
      count: invoicesData.total,
    },
    {
      id: "interpreters" as const,
      title: "Export des interprètes",
      description: "Exporter l'annuaire complet des interprètes",
      icon: Database,
      formats: ["Excel", "CSV"] as ExportFormat[],
      count: interpreters.length,
    },
    {
      id: "clients" as const,
      title: "Export des tiers",
      description: "Exporter les sociétés et contacts",
      icon: Database,
      formats: ["Excel", "CSV"] as ExportFormat[],
      count: clients.length,
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
              Filtres de période (missions)
            </h3>
            <p className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              S'applique uniquement à l'export des missions
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: currentTheme.colors.text }}>
              Date de début
            </label>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
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
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-all"
              style={{
                borderColor: currentTheme.colors.border,
                color: currentTheme.colors.text,
              }}
            />
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
                  <p className="text-xs mt-1" style={{ color: currentTheme.colors.primary }}>
                    {option.count} enregistrement{option.count > 1 ? "s" : ""}
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
                      onClick={() => handleExport(option.id, format)}
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
                Les fichiers CSV utilisent l'encodage UTF-8 avec BOM (compatible Excel).
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.colors.primary }} />
                Le séparateur de colonnes est le point-virgule pour conserver la compatibilité avec Excel français.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentTheme.colors.primary }} />
                Les exports Excel (.xlsx) et PDF nécessitent l'ajout de librairies serveur — en cours d'implémentation.
              </li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
