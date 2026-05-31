import { useTheme } from "../contexts/ThemeContext";

export type StatusType =
  | "draft"
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "special"
  | "validated"
  | "locked"
  | "Brouillon"
  | "Validée"
  | "Terminée"
  | "Annulée"
  | "Disponible"
  | "Occupé"
  | "Indisponible";

interface StatusChipProps {
  status: StatusType;
  className?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  rejected: "Rejeté",
  expired: "Expiré",
  special: "Spécial",
  validated: "Validé",
  locked: "Verrouillé",
  Brouillon: "Brouillon",
  Validée: "Validée",
  Terminée: "Terminée",
  Annulée: "Annulée",
  Disponible: "Disponible",
  Occupé: "Occupé",
  Indisponible: "Indisponible",
};

export function StatusChip({ status, className = "" }: StatusChipProps) {
  const { currentTheme } = useTheme();

  const getStatusColors = () => {
    const statusLower = status.toLowerCase();

    switch (statusLower) {
      case "draft":
      case "brouillon":
        return currentTheme.colors.statusDraft;

      case "sent":
      case "envoyé":
        return currentTheme.colors.statusSent;

      case "accepted":
      case "accepté":
      case "validée":
      case "terminée":
      case "disponible":
        return currentTheme.colors.statusAccepted;

      case "rejected":
      case "rejeté":
      case "refusé":
        return currentTheme.colors.statusRejected;

      case "cancelled":
      case "annulée":
        return currentTheme.colors.statusCancelled;

      case "expired":
      case "expiré":
        return currentTheme.colors.statusExpired;

      case "indisponible":
      case "occupé":
        return currentTheme.colors.statusExpired;

      case "special":
      case "spécial":
        return currentTheme.colors.statusSpecial;

      case "validated":
      case "validé":
        return currentTheme.colors.statusValidated;

      case "locked":
      case "verrouillé":
        return currentTheme.colors.statusLocked;

      default:
        return currentTheme.colors.statusDraft;
    }
  };

  const colors = getStatusColors();
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${className}`}
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
      }}
    >
      {label}
    </span>
  );
}
