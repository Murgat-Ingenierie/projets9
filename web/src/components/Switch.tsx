interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Bouton bascule (style Material). Réutilisable pour tout champ booléen
 * (Fini, Atteint, Actif, etc.).
 */
export function Switch({ checked, onChange, label, disabled }: Props) {
  const trackBg = checked ? "#1976d2" : "#bdbdbd";
  const thumbX = checked ? 20 : 2;
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        userSelect: "none",
      }}
    >
      <span
        role="switch"
        aria-checked={checked}
        style={{
          position: "relative",
          width: 40,
          height: 20,
          background: trackBg,
          borderRadius: 999,
          transition: "background 120ms",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: thumbX,
            width: 16,
            height: 16,
            background: "white",
            borderRadius: "50%",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            transition: "left 120ms",
          }}
        />
      </span>
      {label && <span>{label}</span>}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
      />
    </label>
  );
}
