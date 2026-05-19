"""Import enrichi depuis le workbook Google Sheets (export xlsx).

Source : `data/source.xlsx` — onglets Epic, Projets, Projet non plannifiés,
Jalons, Detail des tache de projet, Chargés de projets.

Utilisation :
    /tmp/xlsxvenv/bin/python scripts/import_data.py [--api http://localhost:8088]

Idempotent : ré-exécutable sans doublons. Suppose AUTH_DISABLED=true côté API
(sinon, ajouter un --token).

Stratégie pour les FK :
    - Les projets de la source ont un trigramme (BDB, CIR, …) qui n'est PAS
      stocké en base ; on garde un dict en mémoire `trig → project.id` pour
      lier les tâches.
    - Les responsables tâches sont matchés au User par nom (normalisé).

Trous comblés par défaut :
    - Projet sans date : [2026-05-01, 2028-12-31] (ajusté si `fin prévu`
      ou `Jalon de fin maximum` année défini).
    - Tâche sans date : alignée sur la fenêtre du projet parent.
    - Jalon sans date : 2026-12-31.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
import unicodedata
from collections.abc import Iterable

import requests
from openpyxl import load_workbook


DEFAULT_PROJECT_START = dt.date(2026, 5, 1)
DEFAULT_PROJECT_END = dt.date(2028, 12, 31)
DEFAULT_MILESTONE_DATE = dt.date(2026, 12, 31)
DEFAULT_TASK_DURATION_DAYS = 30


def norm(s: str | None) -> str:
    if s is None:
        return ""
    s = str(s).strip()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return s.lower()


def slug_email(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", norm(name)) + "@lesfontaines.fr"


def to_date(v) -> dt.date | None:
    if v in (None, ""):
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    if isinstance(v, (int, float)):
        # Une année (ex: 2028.0) → 31 décembre
        year = int(v)
        if 2000 <= year <= 2100:
            return dt.date(year, 12, 31)
    if isinstance(v, str):
        try:
            return dt.datetime.fromisoformat(v).date()
        except ValueError:
            pass
    return None


class Api:
    def __init__(self, base: str):
        self.base = base.rstrip("/")
        self.s = requests.Session()

    def get(self, path: str, **params):
        r = self.s.get(self.base + path, params=params, timeout=10)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, json):
        r = self.s.post(self.base + path, json=json, timeout=10)
        if r.status_code >= 400:
            return r.status_code, r.json() if r.text else None
        return r.status_code, r.json()

    def put(self, path: str, json):
        r = self.s.put(self.base + path, json=json, timeout=10)
        if r.status_code >= 400:
            return r.status_code, r.json() if r.text else None
        return r.status_code, r.json()


def ensure_users(api: Api, names: Iterable[str]) -> dict[str, int]:
    """Crée les users manquants à partir des noms du sheet.

    Retourne un mapping `norm(nom) → user.id`.
    """
    existing_users = api.get("/api/users")
    out: dict[str, int] = {norm(u["nom"]): u["id"] for u in existing_users}
    created = 0
    for raw in names:
        nm = (raw or "").strip()
        if not nm or nm == "?":
            continue
        key = norm(nm)
        if key in out:
            continue
        payload = {
            "nom": nm,
            "email": slug_email(nm),
            "password": "changeme_dev",
            "role": "membre",
            "actif": True,
        }
        code, body = api.post("/api/users", payload)
        if code >= 400:
            print(f"  ! user {nm!r} refusé : {body}")
            continue
        out[key] = body["id"]
        created += 1
    print(f"users : {created} créés (total {len(out)})")
    return out


def ensure_epic(
    api: Api, trigramme: str, nom: str, *, statut: str = "idee", critere: str | None = None
) -> bool:
    existing = api.get("/api/epics")
    if any(e["trigramme"] == trigramme for e in existing):
        return False
    payload = {
        "trigramme": trigramme,
        "nom": nom,
        "critere_reussite": critere,
        "statut": statut,
        "categorie": "operationnel",
    }
    code, body = api.post("/api/epics", payload)
    if code >= 400:
        print(f"  ! epic {trigramme} refusé : {body}")
        return False
    return True


def import_projects(api: Api, wb) -> dict[str, int]:
    """Importe Projets + Projet non plannifiés. Retourne `trig → project.id`."""
    ws = wb["Projets"]
    rows = list(ws.iter_rows(values_only=True))[1:]

    existing = api.get("/api/projects")
    out: dict[str, int] = {}
    # On garde aussi un mapping (epic, nom) -> id pour idempotence
    by_name: dict[tuple[str, str], int] = {
        (p["epic_trigramme"], p["nom"]): p["id"] for p in existing
    }

    created = 0
    skipped = 0
    refused = 0
    for r in rows:
        if not any(c not in (None, "") for c in r):
            continue
        nom = (r[0] or "").strip()
        fin_prevu = to_date(r[1])
        jalon_max = to_date(r[2])
        raison = (r[3] or "").strip() or None
        trig = (r[4] or "").strip()
        epic = (r[5] or "").strip()
        rappel = (r[6] or "").strip()
        termine = bool(r[7])

        if not nom or not epic:
            continue

        # Crée l'epic à la volée s'il manque
        ensure_epic(api, epic.upper(), epic.upper())

        date_fin = fin_prevu or jalon_max or DEFAULT_PROJECT_END
        if date_fin < DEFAULT_PROJECT_START:
            date_fin = DEFAULT_PROJECT_END

        key = (epic.upper(), nom)
        if key in by_name:
            out[trig.upper()] = by_name[key]
            skipped += 1
            continue

        desc_parts = []
        if rappel:
            desc_parts.append(rappel)
        if raison:
            desc_parts.append(f"Raison fin : {raison}")
        description = " · ".join(desc_parts) or None

        statut = "realise" if termine else "en_cours"
        payload = {
            "epic_trigramme": epic.upper(),
            "nom": nom,
            "description": description,
            "date_debut": DEFAULT_PROJECT_START.isoformat(),
            "date_fin": date_fin.isoformat(),
            "statut": statut,
        }
        code, body = api.post("/api/projects", payload)
        if code >= 400:
            refused += 1
            print(f"  ! projet {nom!r} (epic {epic}) refusé : {body}")
            continue
        out[trig.upper()] = body["id"]
        by_name[key] = body["id"]
        created += 1

    # Projets non plannifiés → epic NPL
    ensure_epic(api, "NPL", "Projets non planifiés (à classer)", statut="idee")
    ws = wb["Projet non plannifiés"]
    np_created = 0
    for r in ws.iter_rows(values_only=True):
        nom = (r[0] or "").strip() if r and r[0] else ""
        if not nom:
            continue
        key = ("NPL", nom)
        if key in by_name:
            continue
        payload = {
            "epic_trigramme": "NPL",
            "nom": nom,
            "date_debut": DEFAULT_PROJECT_START.isoformat(),
            "date_fin": DEFAULT_PROJECT_END.isoformat(),
            "statut": "prevu",
        }
        code, body = api.post("/api/projects", payload)
        if code >= 400:
            print(f"  ! projet non planifié {nom!r} refusé : {body}")
            continue
        by_name[key] = body["id"]
        np_created += 1

    print(
        f"projets : {created} créés, {skipped} déjà présents, "
        f"{refused} refusés, {np_created} non planifiés"
    )
    return out


def import_tasks(
    api: Api, wb, projects_by_trig: dict[str, int], users: dict[str, int]
) -> None:
    ws = wb["Detail des tache de projet"]
    rows = list(ws.iter_rows(values_only=True))[1:]

    # On charge la fenêtre de chaque projet pour clipper
    projects = api.get("/api/projects")
    win = {p["id"]: (dt.date.fromisoformat(p["date_debut"]), dt.date.fromisoformat(p["date_fin"])) for p in projects}

    existing = api.get("/api/tasks")
    by_key: set[tuple[int, str]] = {(t["projet_id"], t["nom"]) for t in existing}

    created = 0
    refused = 0
    skipped = 0
    no_project = 0
    for r in rows:
        if not any(c not in (None, "") for c in r):
            continue
        trig = (r[0] or "").strip().upper()
        nom = (r[2] or "").strip()
        date_debut = to_date(r[3])
        jalon_max = to_date(r[4])
        responsable = (r[6] or "").strip()
        termine = bool(r[9])

        if not nom or not trig:
            continue

        pid = projects_by_trig.get(trig)
        if pid is None:
            no_project += 1
            continue

        if (pid, nom) in by_key:
            skipped += 1
            continue

        pstart, pend = win[pid]
        ts = date_debut or pstart
        te = jalon_max or (ts + dt.timedelta(days=DEFAULT_TASK_DURATION_DAYS))
        # Clipper dans la fenêtre du projet (INV-9), puis ré-aligner te ≥ ts
        ts = max(pstart, min(pend, ts))
        te = max(ts, min(pend, te))

        resp_id = users.get(norm(responsable))

        payload = {
            "projet_id": pid,
            "nom": nom,
            "date_debut": ts.isoformat(),
            "date_fin": te.isoformat(),
            "avancement": 100 if termine else 0,
            "statut": "realise" if termine else "prevu",
            "responsable_id": resp_id,
        }
        code, body = api.post("/api/tasks", payload)
        if code >= 400:
            refused += 1
            print(f"  ! tâche {nom!r} (projet trig {trig}) refusée : {body}")
            continue
        by_key.add((pid, nom))
        created += 1

    print(
        f"tâches : {created} créées, {skipped} déjà présentes, "
        f"{refused} refusées, {no_project} sans projet identifié"
    )


def import_milestones(api: Api, wb) -> None:
    """Jalons globaux → on les rattache à un epic transverse `TVS`."""
    ensure_epic(api, "TVS", "Jalons transverses (suivi général)", statut="actif",
                critere="Suivi des jalons réglementaires et événementiels")
    ws = wb["Jalons"]
    rows = list(ws.iter_rows(values_only=True))[1:]

    existing = api.get("/api/milestones")
    by_name = {(m.get("epic_trigramme") or "", m["nom"]) for m in existing}

    created = 0
    refused = 0
    for r in rows:
        if not r or not r[0]:
            continue
        nom = (r[0] or "").strip()
        date = to_date(r[1]) or DEFAULT_MILESTONE_DATE
        if ("TVS", nom) in by_name:
            continue
        payload = {
            "epic_trigramme": "TVS",
            "project_id": None,
            "nom": nom,
            "date": date.isoformat(),
            "atteint": False,
        }
        code, body = api.post("/api/milestones", payload)
        if code >= 400:
            refused += 1
            print(f"  ! jalon {nom!r} refusé : {body}")
            continue
        created += 1
    print(f"jalons : {created} créés, {refused} refusés")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8088")
    ap.add_argument("--xlsx", default="data/source.xlsx")
    args = ap.parse_args()

    print(f"API : {args.api}")
    print(f"Source : {args.xlsx}\n")

    api = Api(args.api)
    wb = load_workbook(args.xlsx, data_only=True)

    # 1. Users : chargés + responsables uniques des tâches
    names = set()
    for r in list(wb["Chargés de projets"].iter_rows(values_only=True))[1:]:
        if r and r[0]:
            names.add(r[0])
    for r in list(wb["Detail des tache de projet"].iter_rows(values_only=True))[1:]:
        if len(r) > 6 and r[6]:
            names.add(r[6])
    users = ensure_users(api, names)

    # 2. Projets (et epics manquants à la volée)
    projects_by_trig = import_projects(api, wb)

    # 3. Tâches
    import_tasks(api, wb, projects_by_trig, users)

    # 4. Jalons
    import_milestones(api, wb)

    # 5. Résumé final
    print("\n=== Résumé en base ===")
    for path in ("/api/epics", "/api/projects", "/api/tasks", "/api/milestones", "/api/users"):
        data = api.get(path)
        print(f"  {path} : {len(data)}")


if __name__ == "__main__":
    sys.exit(main())
