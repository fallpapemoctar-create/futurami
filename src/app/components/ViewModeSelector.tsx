import { motion } from "motion/react";
import { LayoutGrid, Table } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export type ViewMode = "cards" | "table";

interface ViewModeSelectorProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function ViewModeSelector({ viewMode, onViewModeChange }: ViewModeSelectorProps) {
  const { currentTheme } = useTheme();

  return (
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
        onClick={() => onViewModeChange("cards")}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all"
        style={{
          backgroundColor: viewMode === "cards" ? currentTheme.colors.primary : "transparent",
          color: viewMode === "cards" ? "#FFFFFF" : currentTheme.colors.text,
        }}
        title="Affichage en cartes"
      >
        <LayoutGrid className="w-4 h-4" />
        <span>Cartes</span>
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onViewModeChange("table")}
        className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all"
        style={{
          backgroundColor: viewMode === "table" ? currentTheme.colors.primary : "transparent",
          color: viewMode === "table" ? "#FFFFFF" : currentTheme.colors.text,
        }}
        title="Affichage en tableau"
      >
        <Table className="w-4 h-4" />
        <span>Tableau</span>
      </motion.button>
    </div>
  );
}
