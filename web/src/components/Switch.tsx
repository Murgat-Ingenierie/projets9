interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** Relie la case à un `<label htmlFor>` EXTÉRIEUR. Le libellé interne (prop
   *  `label`) ne sert que lorsque le texte accompagne la bascule ; dans les
   *  formulaires il est posé au-dessus, en frère, et doit donc viser cet id. */
  id?: string;
}

/**
 * Bouton bascule (style Material). Réutilisable pour tout champ booléen
 * (Fini, Atteint, Actif, etc.).
 */
export function Switch({ checked, onChange, label, disabled, id }: Props) {
  const trackBg = checked ? "#1976d2" : "#bdbdbd";
  const thumbX = checked ? 20 : 2;
  return (
    <label
      style={{
        // `relative` : la case ci-dessous est en `position: absolute`, et sans
        // ancêtre positionné son bloc conteneur est la fenêtre. Or la règle
        // `.form input { width: 100% }` s'applique aussi à elle — elle prenait
        // donc TOUTE la largeur de l'écran et débordait de la page. Invisible
        // sur grand écran, franchement gênant sur téléphone.
        position: "relative",
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
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none" }}
      />
    </label>
  );
}
