import { ChevronRight, Home } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
}

export function Breadcrumb({ items, showHome = true }: BreadcrumbProps) {
  const { currentTheme } = useTheme();

  return (
    <nav className="flex items-center gap-2 mb-6 text-sm" aria-label="Fil d'Ariane">
      {showHome && (
        <>
          <button
            onClick={items[0]?.onClick}
            className="flex items-center gap-1 hover:opacity-70 transition-opacity"
            style={{ color: currentTheme.colors.textLight }}
            aria-label="Accueil"
          >
            <Home className="w-4 h-4" />
          </button>
          {items.length > 0 && (
            <ChevronRight className="w-4 h-4" style={{ color: currentTheme.colors.border }} />
          )}
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center gap-2">
            {item.onClick && !isLast ? (
              <button
                onClick={item.onClick}
                className="hover:opacity-70 transition-opacity"
                style={{ color: currentTheme.colors.textLight }}
              >
                {item.label}
              </button>
            ) : (
              <span
                className={isLast ? "font-semibold" : ""}
                style={{ color: isLast ? currentTheme.colors.text : currentTheme.colors.textLight }}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight className="w-4 h-4" style={{ color: currentTheme.colors.border }} />
            )}
          </div>
        );
      })}
    </nav>
  );
}
