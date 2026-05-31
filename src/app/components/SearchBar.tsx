import { Search, Filter, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "../contexts/ThemeContext";

interface SearchBarProps {
  onSearch: (value: string) => void;
  onAddNew: () => void;
}

export function SearchBar({ onSearch, onAddNew }: SearchBarProps) {
  const { currentTheme } = useTheme();

  return (
    <div
      className="rounded-xl p-6 shadow-sm border mb-6"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
            style={{ color: currentTheme.colors.textLight }}
          />
          <input
            type="text"
            placeholder="Rechercher un interprète par nom, langue, téléphone..."
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all"
            style={{
              borderColor: currentTheme.colors.border,
              color: currentTheme.colors.text,
            }}
          />
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors"
          style={{
            backgroundColor: currentTheme.colors.primaryLight,
            color: currentTheme.colors.primary,
          }}
        >
          <Filter className="w-5 h-5" />
          <span className="font-medium">Filtres</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAddNew}
          className="flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors font-medium shadow-sm"
          style={{ backgroundColor: currentTheme.colors.primary }}
        >
          <Plus className="w-5 h-5" />
          <span>Ajouter</span>
        </motion.button>
      </div>
    </div>
  );
}
