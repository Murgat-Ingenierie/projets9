// @vitest-environment node
// Logique de build pure, sans DOM ; et sous jsdom `import.meta.url` n'est plus
// une URL file:, que readFileSync refuse.
import { describe, expect, it } from "vitest";
import { policesSvarSansCdn, retirerPolicesCdnSvar } from "./policesSvar";

const FACE_CDN =
  '@font-face{font-family:Roboto;font-style:normal;font-weight:400;src:local(""),' +
  'url(https://cdn.svar.dev/fonts/roboto/regular.woff2) format("woff2")}';

describe("retirerPolicesCdnSvar", () => {
  it("retire un @font-face servi par cdn.svar.dev sans toucher aux règles voisines", () => {
    expect(retirerPolicesCdnSvar(`.a{color:red}${FACE_CDN}.b{color:blue}`)).toBe(
      ".a{color:red}.b{color:blue}",
    );
  });

  it("conserve un @font-face d'une autre origine", () => {
    const local = "@font-face{font-family:X;src:url(/fonts/x.woff2)}";
    expect(retirerPolicesCdnSvar(local)).toBe(local);
  });

  // Garde-fou contre une montée de version de SVAR qui changerait la forme de
  // ses déclarations : la VRAIE feuille importée par GanttSvarPage ne doit plus
  // rien demander au CDN, sinon la CSP recommence à bloquer (#137).
  it("ne laisse aucune référence au CDN dans la feuille réelle de react-gantt", async () => {
    // Lecture disque et non `import "…?raw"` : Vitest vide les imports CSS, même
    // en `?raw`. Module désigné par une variable : le dépôt n'embarque pas
    // @types/node, `tsc` ne doit donc pas chercher à résoudre « node:fs ».
    const moduleFs = "node:fs";
    const { readFileSync } = (await import(/* @vite-ignore */ moduleFs)) as {
      readFileSync: (chemin: URL, encodage: "utf8") => string;
    };
    const cssGantt = readFileSync(
      new URL("../../node_modules/@svar-ui/react-gantt/dist-full/index.css", import.meta.url),
      "utf8",
    );
    expect(cssGantt).toContain("cdn.svar.dev"); // sinon ce test ne prouve plus rien
    const nettoye = retirerPolicesCdnSvar(cssGantt);
    expect(nettoye).not.toContain("cdn.svar.dev");
    expect(nettoye).toContain(".wx-willow-theme"); // le thème, lui, est intact
  });
});

describe("policesSvarSansCdn (plugin Vite)", () => {
  const transform = policesSvarSansCdn().transform as (code: string, id: string) => unknown;

  it("nettoie les feuilles des paquets SVAR", () => {
    expect(transform(FACE_CDN, "/app/node_modules/@svar-ui/react-gantt/dist-full/index.css")).toEqual({
      code: "",
      map: null,
    });
  });

  it("ignore tout autre fichier", () => {
    expect(transform(FACE_CDN, "/app/src/styles.css")).toBeNull();
    expect(transform(FACE_CDN, "/app/node_modules/@svar-ui/react-gantt/dist/index.js")).toBeNull();
    expect(transform(FACE_CDN, "/app/node_modules/@svar-ui/react-gantt/dist-full/index.css?raw")).toBeNull();
  });
});
