import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDiscard: () => void;
  onSave?: () => void;
}

export function UnsavedChangesDialog({
  isOpen,
  onClose,
  onDiscard,
  onSave,
}: UnsavedChangesDialogProps) {
  const { currentTheme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          >
            {/* Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 rounded-xl p-6 shadow-xl"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: currentTheme.colors.statusExpired.bg }}
                  >
                    <AlertTriangle
                      className="w-6 h-6"
                      style={{ color: currentTheme.colors.statusExpired.text }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                      Modifications non sauvegardées
                    </h3>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: currentTheme.colors.textLight }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <p className="mb-6 text-sm" style={{ color: currentTheme.colors.textSecondary }}>
                Vous avez des modifications non enregistrées. Souhaitez-vous les sauvegarder avant
                de quitter ?
              </p>

              {/* Actions */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onDiscard}
                  className="flex-1 px-4 py-2.5 rounded-lg font-medium border"
                  style={{
                    borderColor: currentTheme.colors.border,
                    color: currentTheme.colors.textSecondary,
                  }}
                >
                  Quitter sans enregistrer
                </motion.button>

                {onSave && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onSave}
                    className="flex-1 px-4 py-2.5 text-white rounded-lg font-medium shadow-sm"
                    style={{ backgroundColor: currentTheme.colors.primary }}
                  >
                    Enregistrer
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
