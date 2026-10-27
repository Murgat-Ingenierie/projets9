// Marque Claude (étincelle à rayons), dessinée en SVG plutôt que tirée d'une
// police d'icônes : Material Symbols n'en a pas, et l'ancien « smart_toy »
// (un robot) ne disait rien de l'outil réellement derrière l'écran (#130).
//
// Douze rayons de longueurs inégales autour d'un centre, comme le logo
// d'Anthropic. Le SVG est autonome — pas de requête vers un CDN — et sa
// couleur suit `currentColor` par défaut, pour s'intégrer à la barre latérale
// (gris, puis bleu sur l'entrée active) comme les autres icônes.

/** Longueur relative de chaque rayon, dans l'ordre horaire : l'irrégularité
 *  est ce qui distingue la marque d'un simple astérisque. */
const RAYONS = [1, 0.78, 0.92, 0.7, 1, 0.82, 0.95, 0.72, 1, 0.8, 0.9, 0.74];

export function IconeClaude({
  taille = 24,
  couleur = "currentColor",
  className,
}: {
  taille?: number;
  couleur?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke={couleur} strokeWidth={2.1} strokeLinecap="round">
        {RAYONS.map((l, i) => {
          const a = (i * Math.PI) / 6;
          // Les rayons partent d'un petit cercle vide : réunis au centre, ils
          // formeraient une tache illisible aux petites tailles.
          const r0 = 2.2;
          const r1 = 2.2 + 8.8 * l;
          return (
            <line
              key={i}
              x1={12 + r0 * Math.sin(a)}
              y1={12 - r0 * Math.cos(a)}
              x2={12 + r1 * Math.sin(a)}
              y2={12 - r1 * Math.cos(a)}
            />
          );
        })}
      </g>
    </svg>
  );
}
