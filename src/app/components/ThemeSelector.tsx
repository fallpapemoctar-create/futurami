import { motion } from "motion/react";
import { Check, Palette, Sparkles, Sun, Shield } from "lucide-react";
import { useTheme, themes, ThemeType } from "../contexts/ThemeContext";

export function ThemeSelector() {
  const { themeType, setThemeType } = useTheme();

  const themeIcons = {
    dsfr: Shield,
    professional: Palette,
    modern: Sparkles,
    warm: Sun,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choisissez votre thème
          </h1>
          <p className="text-lg text-gray-600">
            Personnalisez l'apparence de votre application selon vos préférences
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {Object.values(themes).map((theme, index) => {
            const Icon = themeIcons[theme.id];
            const isSelected = themeType === theme.id;

            return (
              <motion.button
                key={theme.id}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setThemeType(theme.id as ThemeType)}
                className={`relative bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all ${
                  isSelected ? "ring-4 ring-offset-4" : ""
                }`}
                style={{
                  ringColor: isSelected ? theme.colors.primary : "transparent",
                }}
              >
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-3 -right-3 rounded-full p-2 shadow-lg"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    <Check className="w-6 h-6 text-white" />
                  </motion.div>
                )}

                <div className="flex flex-col items-center text-center space-y-6">
                  <div
                    className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center shadow-lg`}
                  >
                    <Icon className="w-10 h-10 text-white" />
                  </div>

                  <div>
                    <h3 className="text-2xl font-bold mb-2" style={{ color: theme.colors.text }}>
                      {theme.name}
                    </h3>
                    <p className="text-sm" style={{ color: theme.colors.textLight }}>
                      {theme.description}
                    </p>
                  </div>

                  <div className="w-full space-y-3">
                    <div className="flex gap-2">
                      <div
                        className="flex-1 h-12 rounded-lg shadow-sm"
                        style={{ backgroundColor: theme.colors.primary }}
                      />
                      <div
                        className="flex-1 h-12 rounded-lg shadow-sm"
                        style={{ backgroundColor: theme.colors.secondary }}
                      />
                      <div
                        className="flex-1 h-12 rounded-lg shadow-sm"
                        style={{ backgroundColor: theme.colors.accent }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <div
                        className="flex-1 h-8 rounded-lg"
                        style={{ backgroundColor: theme.colors.success }}
                      />
                      <div
                        className="flex-1 h-8 rounded-lg"
                        style={{ backgroundColor: theme.colors.warning }}
                      />
                      <div
                        className="flex-1 h-8 rounded-lg"
                        style={{ backgroundColor: theme.colors.error }}
                      />
                    </div>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="w-full px-6 py-3 rounded-lg text-white font-semibold"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    {isSelected ? "Thème actif" : "Sélectionner"}
                  </motion.div>
                </div>
              </motion.button>
            );
          })}
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-8 shadow-lg"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Aperçu en direct</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PreviewCard />
            <PreviewButton />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function PreviewCard() {
  const { currentTheme } = useTheme();

  return (
    <div
      className="rounded-xl p-6 shadow-md"
      style={{ backgroundColor: currentTheme.colors.surface }}
    >
      <h3 className="text-lg font-bold mb-2" style={{ color: currentTheme.colors.text }}>
        Carte exemple
      </h3>
      <p className="text-sm mb-4" style={{ color: currentTheme.colors.textLight }}>
        Ceci est un aperçu de la carte avec le thème sélectionné
      </p>
      <div className="flex gap-2">
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: currentTheme.colors.success }}
        >
          Disponible
        </span>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: currentTheme.colors.warning }}
        >
          En attente
        </span>
      </div>
    </div>
  );
}

function PreviewButton() {
  const { currentTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="px-6 py-3 rounded-lg text-white font-semibold shadow-md"
        style={{ backgroundColor: currentTheme.colors.primary }}
      >
        Bouton principal
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="px-6 py-3 rounded-lg text-white font-semibold shadow-md"
        style={{ backgroundColor: currentTheme.colors.secondary }}
      >
        Bouton secondaire
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="px-6 py-3 rounded-lg font-semibold shadow-md"
        style={{
          backgroundColor: currentTheme.colors.primaryLight,
          color: currentTheme.colors.primary,
        }}
      >
        Bouton tertiaire
      </motion.button>
    </div>
  );
}
