import { createContext, useContext, useState, ReactNode } from "react";

export type ThemeType = "dsfr" | "professional" | "modern" | "warm";

export interface Theme {
  id: ThemeType;
  name: string;
  description: string;
  colors: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    border: string;
    text: string;
    textLight: string;
    textSecondary: string;
    success: string;
    warning: string;
    error: string;
    // Couleurs sémantiques pour statuts
    statusDraft: { text: string; bg: string };
    statusSent: { text: string; bg: string };
    statusAccepted: { text: string; bg: string };
    statusRejected: { text: string; bg: string };
    statusExpired: { text: string; bg: string };
    statusSpecial: { text: string; bg: string };
    statusValidated: { text: string; bg: string };
    statusLocked: { text: string; bg: string };
    statusCancelled: { text: string; bg: string };
  };
  gradient: string;
  cardHover: string;
}

export const themes: Record<ThemeType, Theme> = {
  dsfr: {
    id: "dsfr",
    name: "DSFR - Bleu Marianne",
    description: "Design System de l'État français - sobre et administratif",
    colors: {
      primary: "#000091",
      primaryHover: "#1212FF",
      primaryLight: "#E8EEFF",
      secondary: "#E1000F",
      accent: "#0010C8",
      background: "#F6F7FB",
      surface: "#FFFFFF",
      border: "#E5E7EB",
      text: "#161616",
      textLight: "#6B7280",
      textSecondary: "#374151",
      success: "#15803D",
      warning: "#D97706",
      error: "#E1000F",
      statusDraft: { text: "#6B7280", bg: "#F1F5F9" },
      statusSent: { text: "#1D4ED8", bg: "#DBEAFE" },
      statusAccepted: { text: "#15803D", bg: "#DCFCE7" },
      statusRejected: { text: "#B91C1C", bg: "#FEE2E2" },
      statusExpired: { text: "#D97706", bg: "#FEF3C7" },
      statusSpecial: { text: "#6D28D9", bg: "#EDE9FE" },
      statusValidated: { text: "#000091", bg: "#E8EEFF" },
      statusLocked: { text: "#92400E", bg: "#FEF3C7" },
      statusCancelled: { text: "#4B5563", bg: "#F3F4F6" },
    },
    gradient: "from-[#000091] via-[#0010C8] to-[#1212FF]",
    cardHover: "shadow-blue-50",
  },
  professional: {
    id: "professional",
    name: "Professionnel",
    description: "Design sobre et élégant pour un environnement corporate",
    colors: {
      primary: "#1e40af",
      primaryHover: "#1e3a8a",
      primaryLight: "#dbeafe",
      secondary: "#0f766e",
      accent: "#0284c7",
      background: "#f8fafc",
      surface: "#ffffff",
      border: "#e2e8f0",
      text: "#1e293b",
      textLight: "#64748b",
      textSecondary: "#475569",
      success: "#059669",
      warning: "#d97706",
      error: "#dc2626",
      statusDraft: { text: "#64748b", bg: "#f1f5f9" },
      statusSent: { text: "#1e40af", bg: "#dbeafe" },
      statusAccepted: { text: "#059669", bg: "#d1fae5" },
      statusRejected: { text: "#dc2626", bg: "#fee2e2" },
      statusExpired: { text: "#d97706", bg: "#fef3c7" },
      statusSpecial: { text: "#7c3aed", bg: "#ede9fe" },
      statusValidated: { text: "#1e40af", bg: "#dbeafe" },
      statusLocked: { text: "#92400e", bg: "#fef3c7" },
      statusCancelled: { text: "#475569", bg: "#f1f5f9" },
    },
    gradient: "from-blue-600 via-blue-700 to-teal-700",
    cardHover: "shadow-blue-100",
  },
  modern: {
    id: "modern",
    name: "Moderne",
    description: "Interface dynamique avec des couleurs vives et actuelles",
    colors: {
      primary: "#7c3aed",
      primaryHover: "#6d28d9",
      primaryLight: "#ede9fe",
      secondary: "#ec4899",
      accent: "#8b5cf6",
      background: "#faf5ff",
      surface: "#ffffff",
      border: "#e9d5ff",
      text: "#581c87",
      textLight: "#a78bfa",
      textSecondary: "#7e22ce",
      success: "#10b981",
      warning: "#f59e0b",
      error: "#ef4444",
      statusDraft: { text: "#64748b", bg: "#f1f5f9" },
      statusSent: { text: "#7c3aed", bg: "#ede9fe" },
      statusAccepted: { text: "#10b981", bg: "#d1fae5" },
      statusRejected: { text: "#ef4444", bg: "#fee2e2" },
      statusExpired: { text: "#f59e0b", bg: "#fef3c7" },
      statusSpecial: { text: "#ec4899", bg: "#fce7f3" },
      statusValidated: { text: "#7c3aed", bg: "#ede9fe" },
      statusLocked: { text: "#92400e", bg: "#fef3c7" },
      statusCancelled: { text: "#64748b", bg: "#f1f5f9" },
    },
    gradient: "from-purple-600 via-pink-500 to-purple-700",
    cardHover: "shadow-purple-100",
  },
  warm: {
    id: "warm",
    name: "Chaleureux",
    description: "Palette chaleureuse et accueillante inspirée de la nature",
    colors: {
      primary: "#ea580c",
      primaryHover: "#c2410c",
      primaryLight: "#ffedd5",
      secondary: "#d97706",
      accent: "#f59e0b",
      background: "#fffbeb",
      surface: "#ffffff",
      border: "#fed7aa",
      text: "#78350f",
      textLight: "#92400e",
      textSecondary: "#b45309",
      success: "#16a34a",
      warning: "#eab308",
      error: "#dc2626",
      statusDraft: { text: "#6B7280", bg: "#F1F5F9" },
      statusSent: { text: "#ea580c", bg: "#ffedd5" },
      statusAccepted: { text: "#16a34a", bg: "#dcfce7" },
      statusRejected: { text: "#dc2626", bg: "#fee2e2" },
      statusExpired: { text: "#eab308", bg: "#fef3c7" },
      statusSpecial: { text: "#7c3aed", bg: "#ede9fe" },
      statusValidated: { text: "#ea580c", bg: "#ffedd5" },
      statusLocked: { text: "#92400e", bg: "#fef3c7" },
      statusCancelled: { text: "#78350f", bg: "#fef3c7" },
    },
    gradient: "from-orange-600 via-amber-600 to-orange-700",
    cardHover: "shadow-orange-100",
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  themeType: ThemeType;
  setThemeType: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeType, setThemeType] = useState<ThemeType>("dsfr");

  const value = {
    currentTheme: themes[themeType],
    themeType,
    setThemeType,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
