import { motion } from "motion/react";
import { LogOut, Palette, BarChart3, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useAuthStore } from "../../store/auth";
import { useCompanyInfo } from "../../lib/hooks";
import { resolveLogoSrc } from "../../lib/api";

interface HeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userName: string;
}

export function Header({ activeTab, onTabChange, userName }: HeaderProps) {
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const companyQuery = useCompanyInfo();
  const logoSrc = resolveLogoSrc(companyQuery.data?.logoUrl);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const tabs = [
    { id: "dashboard", label: "Tableau de bord", icon: BarChart3 },
    { id: "interpretes", label: "Interprètes" },
    { id: "missions", label: "Missions" },
    { id: "devis", label: "Devis" },
    { id: "facturation", label: "Facturation" },
    { id: "tiers", label: "Tiers" },
    { id: "configuration", label: "Configuration", icon: Settings },
    { id: "admin", label: "Admin" },
    { id: "themes", label: "Thèmes", icon: Palette },
  ];

  return (
    <header
      className="border-b sticky top-0 z-50 shadow-sm"
      style={{
        backgroundColor: currentTheme.colors.surface,
        borderColor: currentTheme.colors.border
      }}
    >
      <div className="px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              // Hauteur fixe, largeur libre : un logo large (rectangulaire) reste
              // lisible au lieu d'être écrasé dans un badge carré 40x40.
              <img src={logoSrc} alt="Logo" className="h-10 max-w-[180px] object-contain" />
            ) : (
              <div
                className={`w-10 h-10 bg-gradient-to-br ${currentTheme.gradient} rounded-lg flex items-center justify-center`}
              >
                <span className="text-white font-bold text-sm">AMI</span>
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold" style={{ color: currentTheme.colors.text }}>
                AMI - Assistance missions interprètes
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm" style={{ color: currentTheme.colors.textLight }}>
              Bienvenue {userName}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              title="Déconnexion"
              aria-label="Déconnexion"
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors hover:opacity-80"
              style={{ color: currentTheme.colors.text }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="flex gap-2">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative px-6 py-2.5 text-sm font-medium transition-colors rounded-t-lg"
                style={{
                  color: isActive ? currentTheme.colors.primary : currentTheme.colors.textLight,
                  backgroundColor: isActive ? currentTheme.colors.primaryLight : "transparent",
                }}
              >
                {Icon && <Icon className="w-4 h-4 inline mr-2" />}
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: currentTheme.colors.primary }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
