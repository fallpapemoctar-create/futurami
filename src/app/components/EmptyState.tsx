import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const { currentTheme } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: currentTheme.colors.primaryLight }}
      >
        <Icon className="w-10 h-10" style={{ color: currentTheme.colors.primary }} />
      </div>

      <h3 className="text-lg font-bold mb-2" style={{ color: currentTheme.colors.text }}>
        {title}
      </h3>

      {description && (
        <p className="text-sm max-w-md mb-6" style={{ color: currentTheme.colors.textLight }}>
          {description}
        </p>
      )}

      {action && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={action.onClick}
          className="px-6 py-3 text-white rounded-lg font-medium shadow-sm"
          style={{ backgroundColor: currentTheme.colors.primary }}
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  );
}
