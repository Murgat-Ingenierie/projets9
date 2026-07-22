import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "../api/client";
import { ErrorBanner } from "./ErrorBanner";

describe("ErrorBanner", () => {
  it("affiche [CODE] message pour une ApiError avec code", () => {
    const { container } = render(
      <ErrorBanner error={new ApiError(409, "INV-6", "Jalon orphelin")} />
    );
    expect(container.textContent).toBe("[INV-6] Jalon orphelin");
  });

  it("affiche le message seul si l'ApiError n'a pas de code", () => {
    const { container } = render(<ErrorBanner error={new ApiError(500, null, "Boom")} />);
    expect(container.textContent).toBe("Boom");
  });

  it("affiche le message d'une Error standard", () => {
    const { container } = render(<ErrorBanner error={new Error("réseau coupé")} />);
    expect(container.textContent).toBe("réseau coupé");
  });

  it("stringifie une valeur non-Error", () => {
    const { container } = render(<ErrorBanner error="souci brut" />);
    expect(container.textContent).toBe("souci brut");
  });

  it("ne rend rien quand error est nul", () => {
    const { container } = render(<ErrorBanner error={null} />);
    expect(container.innerHTML).toBe("");
  });
});
