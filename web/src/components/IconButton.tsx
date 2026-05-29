interface Props {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  /** Taille de l'icône Material Symbols. */
  size?: number;
}

/**
 * Bouton icône Material discret avec hover bleu standard (#1976d2 sur #e3f2fd).
 * Utilisé pour les actions secondaires en bout de ligne (édition, ajout, etc.).
 */
export function IconButton({ icon, title, onClick, disabled, size = 18 }: Props) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      style={{
        background: "transparent",
        border: 0,
        cursor: disabled ? "default" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        color: "#9aa0a6",
        padding: 2,
        borderRadius: 4,
        transition: "color 180ms, background 180ms",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLElement).style.color = "#1976d2";
        (e.currentTarget as HTMLElement).style.background = "#e3f2fd";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "#9aa0a6";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size }}>
        {icon}
      </span>
    </button>
  );
}
