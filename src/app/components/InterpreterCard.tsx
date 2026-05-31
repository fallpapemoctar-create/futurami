import { motion } from "motion/react";
import { Phone, Mail, MessageSquare, Edit, Trash2 } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";
import { StatusChip } from "./StatusChip";

interface InterpreterCardProps {
  name: string;
  languages: string;
  phone?: string;
  email?: string;
  status: "Disponible" | "Occupé" | "Indisponible";
  billing?: string;
  delay?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function InterpreterCard({
  name,
  languages,
  phone,
  email,
  status,
  billing,
  delay = 0,
  onEdit,
  onDelete,
}: InterpreterCardProps) {
  const { currentTheme } = useTheme();

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      whileHover={{ y: -4, boxShadow: "0 12px 24px -4px rgba(0, 0, 0, 0.1)" }}
      className="rounded-xl p-6 shadow-sm hover:shadow-md transition-all border"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold mb-1" style={{ color: currentTheme.colors.text }}>
            {name}
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: currentTheme.colors.textLight }}>
            {languages}
          </p>
        </div>
        <StatusChip status={status} />
      </div>

      {billing && (
        <div className="mb-4 pb-4 border-b" style={{ borderColor: currentTheme.colors.border }}>
          <p className="text-xs mb-1" style={{ color: currentTheme.colors.textLight }}>
            Facturation
          </p>
          <p className="text-sm font-medium" style={{ color: currentTheme.colors.text }}>
            {billing}
          </p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-2 text-sm transition-colors group"
            style={{ color: currentTheme.colors.text }}
          >
            <Phone className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
            <span className="font-medium">{phone}</span>
          </a>
        )}
        {email && (
          <a
            href={`mailto:${email}`}
            className="flex items-center gap-2 text-sm transition-colors group"
            style={{ color: currentTheme.colors.text }}
          >
            <Mail className="w-4 h-4" style={{ color: currentTheme.colors.textLight }} />
            <span className="truncate">{email}</span>
          </a>
        )}
      </div>

      <div className="flex gap-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-lg transition-colors text-sm font-medium"
          style={{ backgroundColor: currentTheme.colors.success }}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Contacter</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onEdit}
          className="p-2.5 text-white rounded-lg transition-colors"
          style={{ backgroundColor: currentTheme.colors.primary }}
          title="Modifier"
        >
          <Edit className="w-4 h-4" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onDelete}
          className="p-2.5 text-white rounded-lg transition-colors"
          style={{ backgroundColor: currentTheme.colors.error }}
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}
