#!/usr/bin/env python3
"""Ouvre la page planning dans Chromium headless et évalue du JS dessus.

Usage:
  echo "JS_EXPR" | scripts/inspect_gantt.py [--screenshot] [--url URL]

Le JS_EXPR doit retourner une valeur sérialisable JSON. Une IIFE est idiomatique :

  echo '(() => {
    const bars = document.querySelectorAll("svg g[tabindex]");
    return bars.length;
  })()' | /tmp/pwvenv/bin/python scripts/inspect_gantt.py

Conçu pour itérer sur le rendu Gantt sans intervention navigateur manuelle.
"""
import argparse
import json
import sys
from playwright.sync_api import sync_playwright


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:8088/")
    ap.add_argument("--screenshot", default=None, help="path to save full-page screenshot")
    ap.add_argument("--wait", type=int, default=800, help="ms to wait after page ready")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--height", type=int, default=1000)
    ap.add_argument(
        "--wait-selector",
        default="svg g[tabindex]",
        help="CSS selector to wait for before evaluating (use empty string to skip)",
    )
    args = ap.parse_args()

    js = sys.stdin.read().strip()
    if not js:
        sys.stderr.write("error: no JS expression on stdin\n")
        sys.exit(2)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": args.width, "height": args.height})
        page = ctx.new_page()
        # capturer erreurs console pour debug
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)

        page.goto(args.url, wait_until="domcontentloaded")
        if args.wait_selector:
            try:
                page.wait_for_selector(args.wait_selector, timeout=15000)
            except Exception as e:
                sys.stderr.write(f"timeout waiting for {args.wait_selector!r}: {e}\n")
                if errors:
                    sys.stderr.write("page errors:\n" + "\n".join(errors[:20]) + "\n")
                sys.exit(3)

        page.wait_for_timeout(args.wait)
        try:
            result = page.evaluate(js)
        except Exception as e:
            sys.stderr.write(f"eval error: {e}\n")
            sys.exit(4)

        if args.screenshot:
            page.screenshot(path=args.screenshot, full_page=True)

        browser.close()

    print(json.dumps(result, indent=2, default=str, ensure_ascii=False))


if __name__ == "__main__":
    main()
