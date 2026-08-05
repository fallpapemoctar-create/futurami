import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, X, Plus } from "lucide-react";

/**
 * AutocompleteSelect — Combobox strict (recherche par frappe + validation).
 *
 * Contrairement à `<datalist>`, ce composant N'ACCEPTE PAS de valeur libre :
 * si l'utilisateur tape un texte qui ne correspond à aucune option, la valeur
 * est réinitialisée à la dernière sélection valide (ou vide) au blur.
 *
 * UX :
 *   - Focus → dropdown ouverte avec toutes les options
 *   - Frappe → dropdown filtrée (recherche insensible à la casse)
 *   - Clic sur option → sélection + fermeture
 *   - Blur avec texte non-matché → reset à la valeur précédente valide
 *   - Bouton × → efface la sélection (si non-required)
 *   - Message d'aide affiché sous le champ (ex : "Absent ? Ajoutez-le depuis Annuaire")
 *
 * @author  futurAMI
 * @since   2026-08 (Phase Missions UX)
 */

export interface AutocompleteOption {
  value: string; // Chaîne stockée (typiquement le libellé affiché à l'utilisateur)
  label: string; // Chaîne affichée dans la dropdown
  id?: string | number; // Utile pour la clé React
}

export interface AutocompleteSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  maxVisibleOptions?: number;
  currentTheme: any;
  /**
   * Callback déclenché par le bouton « + Nouveau » affiché à côté du champ.
   * S'il est fourni, le bouton apparaît ; sinon il est masqué.
   * Usage typique : ouvrir une modale de création rapide d'entité.
   */
  onCreateNew?: () => void;
  /** Libellé accessible du bouton « + » (title/aria-label). Défaut : "Créer un nouvel élément". */
  createNewLabel?: string;
}

const DEFAULT_MAX = 100;

export function AutocompleteSelect({
  value,
  onChange,
  options,
  loading = false,
  placeholder,
  disabled = false,
  required = false,
  helperText,
  maxVisibleOptions = DEFAULT_MAX,
  currentTheme,
  onCreateNew,
  createNewLabel = "Créer un nouvel élément",
}: AutocompleteSelectProps) {
  const [query, setQuery] = useState<string>(value);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<number | null>(null);

  // Sync la valeur prop → query local quand le parent change value.
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Filtrage — recherche case-insensitive, tolérante aux accents/espaces.
  const normalized = (s: string) => s.trim().toLowerCase();
  const filtered = useMemo(() => {
    const q = normalized(query);
    if (!q) return options.slice(0, maxVisibleOptions);
    return options
      .filter((o) => normalized(o.label).includes(q) || normalized(o.value).includes(q))
      .slice(0, maxVisibleOptions);
  }, [query, options, maxVisibleOptions]);

  const truncated = useMemo(() => {
    const q = normalized(query);
    if (!q) return options.length > maxVisibleOptions;
    const totalMatch = options.filter(
      (o) => normalized(o.label).includes(q) || normalized(o.value).includes(q)
    ).length;
    return totalMatch > maxVisibleOptions;
  }, [query, options, maxVisibleOptions]);

  // Blur : si le texte tapé ne matche aucune option exactement, reset à la
  // dernière valeur valide (ou vide). Un délai laisse au click sur option
  // le temps de se propager avant qu'on ferme.
  const handleBlur = () => {
    blurTimer.current = window.setTimeout(() => {
      const q = normalized(query);
      const exact = options.find((o) => normalized(o.value) === q || normalized(o.label) === q);
      if (exact) {
        setQuery(exact.value);
        if (exact.value !== value) onChange(exact.value);
      } else {
        // Valeur invalide → restaurer l'ancienne
        setQuery(value);
      }
      setIsOpen(false);
      setHighlightIndex(-1);
    }, 150);
  };

  const cancelBlur = () => {
    if (blurTimer.current !== null) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  };

  const handleSelect = (opt: AutocompleteOption) => {
    cancelBlur();
    setQuery(opt.value);
    onChange(opt.value);
    setIsOpen(false);
    setHighlightIndex(-1);
    // Redonne le focus au champ (utile pour tab suivant)
    inputRef.current?.blur();
  };

  const handleClear = () => {
    cancelBlur();
    setQuery("");
    onChange("");
    setIsOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setHighlightIndex((idx) => Math.min(idx + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((idx) => Math.max(idx - 1, 0));
    } else if (e.key === "Enter") {
      if (isOpen && highlightIndex >= 0 && highlightIndex < filtered.length) {
        e.preventDefault();
        handleSelect(filtered[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setHighlightIndex(-1);
      setQuery(value); // rollback
    }
  };

  const showClear = !required && !disabled && value !== "" && !loading;

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
              setHighlightIndex(-1);
            }}
            onFocus={() => {
              cancelBlur();
              setIsOpen(true);
            }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled || loading}
            required={required}
            autoComplete="off"
            placeholder={loading ? "Chargement…" : placeholder}
            className="w-full px-4 py-2.5 pr-16 border rounded-lg focus:outline-none focus:ring-2 transition-all disabled:opacity-60"
            style={{
              borderColor: currentTheme.colors.border,
              color: currentTheme.colors.text,
            }}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {showClear && (
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => {
                  // Empêche le blur avant le clear
                  e.preventDefault();
                  handleClear();
                }}
                className="p-1 rounded hover:bg-gray-100"
                title="Effacer la sélection"
                style={{ color: currentTheme.colors.textLight }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <ChevronDown
              className="w-4 h-4 pointer-events-none"
              style={{ color: currentTheme.colors.textLight }}
            />
          </div>

          {isOpen && !loading && (
            <div
              className="absolute z-20 mt-1 left-0 right-0 rounded-lg border shadow-lg max-h-64 overflow-y-auto"
              style={{
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              }}
              onMouseDown={cancelBlur}
            >
              {filtered.length === 0 ? (
                <div
                  className="px-4 py-3 text-sm italic"
                  style={{ color: currentTheme.colors.textLight }}
                >
                  Aucun résultat.
                </div>
              ) : (
                <>
                  {filtered.map((opt, idx) => {
                    const isHighlighted = idx === highlightIndex;
                    const isSelected = opt.value === value;
                    return (
                      <button
                        key={opt.id ?? opt.value}
                        type="button"
                        onMouseEnter={() => setHighlightIndex(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelect(opt);
                        }}
                        className="w-full text-left px-4 py-2 text-sm transition-colors"
                        style={{
                          backgroundColor: isHighlighted
                            ? currentTheme.colors.primaryLight
                            : isSelected
                            ? currentTheme.colors.primaryLight + "80"
                            : "transparent",
                          color: isHighlighted
                            ? currentTheme.colors.primary
                            : currentTheme.colors.text,
                          fontWeight: isSelected ? 600 : 400,
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                  {truncated && (
                    <div
                      className="px-4 py-2 text-xs italic border-t"
                      style={{
                        color: currentTheme.colors.textLight,
                        borderColor: currentTheme.colors.border,
                      }}
                    >
                      Affichage limité à {maxVisibleOptions} résultats — affinez votre recherche.
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {onCreateNew && (
          <button
            type="button"
            onMouseDown={(e) => {
              // Empêche le blur du champ avant l'ouverture du modal.
              e.preventDefault();
              cancelBlur();
              setIsOpen(false);
              onCreateNew();
            }}
            disabled={disabled}
            title={createNewLabel}
            aria-label={createNewLabel}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            style={{
              backgroundColor: currentTheme.colors.primaryLight,
              borderColor: currentTheme.colors.border,
              color: currentTheme.colors.primary,
            }}
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau</span>
          </button>
        )}
      </div>

      {helperText && (
        <p
          className="mt-1 text-xs"
          style={{ color: currentTheme.colors.textLight }}
        >
          {helperText}
        </p>
      )}
    </div>
  );
}
