"""Jeu de démonstration — peuple le planning pour une installation vierge.

Pourquoi : sans données, la vue Gantt (la vue centrale du produit) est vide au
premier démarrage. Ce module crée un jeu réaliste de pisciculture qui exerce
**chaque** élément visuel du planning et de la vue Charge :

- des barres de projets et de tâches réparties autour de la date du jour ;
- un projet **réalisé** dont toutes les tâches sont archivées → décoration
  « terminé » (barre aplatie + pastille verte) ;
- une tâche qui **déborde de la fenêtre de son projet** → hachure rouge
  (INV-9 est un non-invariant : le planning signale, l'API n'a pas bloqué) ;
- des **dépendances** FS, dont une qui **traverse deux projets** du même epic
  → flèche inter-projets ;
- des **jalons**, dont un atteint et un rattaché à **plusieurs projets** ;
- des **équipes** et leurs allocations horaires, dont une qui **dépasse** la
  capacité hebdomadaire → cellule rouge dans la vue Charge (là aussi un
  non-invariant délibéré) ;
- une série de **mesures** dans le temps sur l'epic phare.

Invocation :
- à la demande :  docker compose exec api python -m app.seed_demo
- au démarrage :  mettre SEED_DEMO=true dans .env (appelé par app.seed.main).

Idempotent : si un projet existe déjà (donc si la démo a déjà tourné, ou si de
vraies données sont présentes), le module ne fait **rien** — il ne clobbe
jamais des données existantes.

Écriture directe en base (comme app.seed), donc les invariants ne sont pas
appliqués par les routes. En garde-fou, `_verifier_invariants` rejoue les
fonctions `check_*` de app.invariants sur le jeu assemblé **avant** le commit :
si une modification de ces données venait violer un invariant, la seed refuse
d'écrire au lieu d'insérer silencieusement des données invalides. Les objets
ORM satisfont directement les Protocol des checks (les enums sont des
`(str, Enum)`), donc aucune conversion n'est nécessaire.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.invariants import (
    check_allocation_heures,
    check_allocation_refs,
    check_allocation_unique,
    check_dependency_acyclic,
    check_dependency_no_self,
    check_epic_basics,
    check_epic_date_order,
    check_epic_realise_consistency,
    check_epic_trigramme,
    check_equipe_nom,
    check_equipe_nom_unique,
    check_equipe_temps_dispo,
    check_measure_unit_consistency,
    check_milestone_has_projects,
    check_milestone_within_epic_max,
    check_project_dates,
    check_project_dates_within_epic,
    check_project_realise_consistency,
    check_task_dates,
)
from app.models.dependency import Dependency, DependencyType
from app.models.epic import Epic, EpicCategory, EpicStatus
from app.models.equipe import Equipe, TacheEquipe
from app.models.measure import Measure
from app.models.milestone import Milestone
from app.models.project import Project, ProjectStatus
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole

log = logging.getLogger("seed")
logging.basicConfig(level=logging.INFO, format="%(levelname)s [seed] %(message)s")

D = date  # alias court pour la table de données ci-dessous


def _admin_id(db: Session) -> int | None:
    admin = db.execute(
        select(User).where(User.email == settings.seed_admin_email)
    ).scalar_one_or_none()
    if admin is None:
        admin = db.execute(
            select(User)
            .where(User.actif.is_(True), User.role == UserRole.admin)
            .order_by(User.id)
        ).scalars().first()
    return admin.id if admin else None


def _ensure_epic(
    db: Session,
    admin_id: int,
    trigramme: str,
    nom: str,
    categorie: EpicCategory,
    couleur: str,
    *,
    critere: str | None = None,
    date_fin_prevue: date | None = None,
    jalon_fin_max: date | None = None,
) -> Epic:
    """Récupère l'epic s'il existe (importé du CSV), sinon le crée.

    Sur un epic existant, on **enrichit** seulement les champs que le CSV ne
    renseigne pas (couleur, bornes de date) — jamais son nom, son critère ou
    son statut.
    """
    e = db.get(Epic, trigramme)
    if e is None:
        e = Epic(
            trigramme=trigramme,
            nom=nom,
            statut=EpicStatus.actif if critere else EpicStatus.idee,
            categorie=categorie,
            critere_reussite=critere,
            couleur=couleur,
            date_fin_prevue=date_fin_prevue,
            jalon_fin_max=jalon_fin_max,
            updated_by_id=admin_id,
        )
        db.add(e)
    else:
        if e.couleur is None:
            e.couleur = couleur
        if e.date_fin_prevue is None:
            e.date_fin_prevue = date_fin_prevue
        if e.jalon_fin_max is None:
            e.jalon_fin_max = jalon_fin_max
        e.updated_by_id = admin_id
    return e


def seed_demo() -> None:
    with SessionLocal() as db:
        if db.execute(select(Project).limit(1)).scalar_one_or_none() is not None:
            log.info("Données déjà présentes (au moins un projet) — démo ignorée")
            return

        admin_id = _admin_id(db)
        if admin_id is None:
            log.warning("Aucun admin en base — démo ignorée")
            return

        # --- Epics (enrichis, ou créés si le CSV n'a pas tourné) -------------
        o50 = _ensure_epic(
            db, admin_id, "O50", "Objectif 50%", EpicCategory.operationnel, "#3f51b5",
            critere="Porter le débit à 250 l/s",
            date_fin_prevue=D(2026, 12, 31),
            jalon_fin_max=D(2026, 12, 31),
        )
        mai = _ensure_epic(
            db, admin_id, "MAI", "Maintenance industrielle", EpicCategory.operationnel,
            "#f57c00", critere="Réduire les arrêts non planifiés",
        )
        fab = _ensure_epic(
            db, admin_id, "FAB", "Fin des antibiotiques", EpicCategory.operationnel,
            "#388e3c", critere="Zéro traitement antibiotique",
        )
        db.flush()

        # --- Projets ---------------------------------------------------------
        def projet(epic, nom, debut, fin, statut, desc=None) -> Project:
            p = Project(
                epic_trigramme=epic.trigramme, nom=nom, description=desc,
                date_debut=debut, date_fin=fin, statut=statut,
                responsable_id=admin_id, updated_by_id=admin_id,
            )
            db.add(p)
            return p

        p_etude = projet(o50, "Étude débit des bassins", D(2026, 1, 12), D(2026, 3, 20),
                         ProjectStatus.realise, "Dimensionnement hydraulique amont.")
        p_pompes = projet(o50, "Installation pompes 250 l/s", D(2026, 4, 1), D(2026, 9, 30),
                          ProjectStatus.en_cours, "Génie civil, pose et mise en service.")
        p_filtration = projet(mai, "Révision station de filtration", D(2026, 5, 4),
                              D(2026, 8, 14), ProjectStatus.en_cours)
        p_probio = projet(fab, "Protocole probiotiques", D(2026, 6, 1), D(2026, 11, 30),
                          ProjectStatus.prevu)
        db.flush()

        # --- Tâches ----------------------------------------------------------
        def tache(projet, nom, debut, fin, statut) -> Task:
            t = Task(
                projet_id=projet.id, nom=nom, date_debut=debut, date_fin=fin,
                statut=statut, responsable_id=admin_id, updated_by_id=admin_id,
            )
            db.add(t)
            return t

        arch, ouv = TaskStatus.archive, TaskStatus.ouvert

        # Projet réalisé → toutes ses tâches archivées (INV-18).
        t_mesures = tache(p_etude, "Mesures de débit amont", D(2026, 1, 12), D(2026, 1, 30), arch)
        t_hydro = tache(p_etude, "Analyse hydraulique", D(2026, 2, 2), D(2026, 2, 27), arch)
        t_rapport = tache(p_etude, "Rapport de dimensionnement", D(2026, 3, 2), D(2026, 3, 20), arch)

        t_ao = tache(p_pompes, "Appel d'offres pompes", D(2026, 4, 1), D(2026, 4, 24), arch)
        t_livr = tache(p_pompes, "Commande & livraison", D(2026, 4, 27), D(2026, 6, 19), arch)
        t_socle = tache(p_pompes, "Génie civil socle", D(2026, 6, 22), D(2026, 8, 14), ouv)
        t_pose = tache(p_pompes, "Pose & raccordement", D(2026, 8, 17), D(2026, 9, 30), ouv)
        # Déborde la fenêtre du projet (fin 30/09) → hachure rouge, mutation acceptée.
        t_essais = tache(p_pompes, "Essais longue durée", D(2026, 7, 1), D(2026, 12, 15), ouv)

        t_diag = tache(p_filtration, "Diagnostic média filtrant", D(2026, 5, 4), D(2026, 5, 29), arch)
        t_masses = tache(p_filtration, "Remplacement des masses", D(2026, 6, 1), D(2026, 7, 10), ouv)
        t_perf = tache(p_filtration, "Contrôle de performance", D(2026, 7, 13), D(2026, 8, 14), ouv)

        t_souches = tache(p_probio, "Sélection des souches", D(2026, 6, 1), D(2026, 7, 15), ouv)
        t_pilote = tache(p_probio, "Essais en bassin pilote", D(2026, 7, 16), D(2026, 10, 30), ouv)
        db.flush()

        # --- Dépendances (FS, graphe acyclique) ------------------------------
        def dep(amont: Task, aval: Task) -> None:
            db.add(Dependency(
                tache_amont_id=amont.id, tache_aval_id=aval.id,
                type=DependencyType.FS, updated_by_id=admin_id,
            ))

        dep(t_mesures, t_hydro)
        dep(t_hydro, t_rapport)
        dep(t_rapport, t_livr)  # inter-projets : étude → installation, même epic O50
        dep(t_ao, t_livr)
        dep(t_livr, t_socle)
        dep(t_socle, t_pose)
        dep(t_pose, t_essais)
        dep(t_diag, t_masses)
        dep(t_masses, t_perf)
        dep(t_souches, t_pilote)

        # --- Jalons ----------------------------------------------------------
        def jalon(nom, d, atteint, projets) -> Milestone:
            m = Milestone(nom=nom, date=d, atteint=atteint, updated_by_id=admin_id)
            m.projects = projets
            db.add(m)
            return m

        jalon("Étude débit validée", D(2026, 3, 25), True, [p_etude])
        jalon("Mise en eau des pompes", D(2026, 10, 15), False, [p_pompes])
        # Rattaché à trois projets → ligne verticale couvrant plusieurs lignes.
        jalon("Revue trimestrielle Q3", D(2026, 9, 30), False,
              [p_pompes, p_filtration, p_probio])

        # --- Équipes & allocations -------------------------------------------
        def equipe(nom, capacite) -> Equipe:
            eq = Equipe(nom=nom, temps_dispo_hebdo=capacite, updated_by_id=admin_id)
            db.add(eq)
            return eq

        atelier = equipe("Atelier interne", 35)
        presta = equipe("Prestataire hydraulique", 20)
        bio = equipe("Équipe biologie", 12)
        db.flush()

        def allouer(t: Task, eq: Equipe, heures: float) -> None:
            db.add(TacheEquipe(
                tache_id=t.id, equipe_id=eq.id, heures_allouees=heures,
                updated_by_id=admin_id,
            ))

        allouer(t_socle, atelier, 120)
        allouer(t_socle, presta, 80)
        allouer(t_pose, presta, 100)
        allouer(t_masses, atelier, 60)
        allouer(t_perf, atelier, 30)
        allouer(t_souches, bio, 60)
        # 260 h étalées sur ~15 semaines (16/07 → 30/10) ⇒ ~17 h/sem, au-dessus
        # des 12 h/sem de l'équipe → cellules rouges dans la vue Charge, sur une
        # période qui recouvre « aujourd'hui » (surcharge = non-invariant assumé).
        allouer(t_pilote, bio, 260)

        # --- Mesures (unité cohérente par epic, INV-20) ----------------------
        for d, v, c in [
            (D(2026, 1, 31), 180.0, "Débit initial mesuré"),
            (D(2026, 3, 31), 195.0, None),
            (D(2026, 5, 31), 210.0, None),
            (D(2026, 7, 15), 228.0, "Après mise en service 1ʳᵉ pompe"),
        ]:
            db.add(Measure(
                epic_trigramme=o50.trigramme, date=d, valeur=v, unite="l/s",
                commentaire=c, updated_by_id=admin_id,
            ))

        db.flush()
        _verifier_invariants(db)
        db.commit()

        log.info(
            "Démo créée : 4 projets, 13 tâches, 10 dépendances, 3 jalons, "
            "3 équipes, 7 allocations, 4 mesures"
        )


def _verifier_invariants(db: Session) -> None:
    """Rejoue les checks de app.invariants sur tout le jeu, avant commit.

    Filet de sécurité : une écriture directe en base contourne les routes, donc
    les invariants. Si une retouche de la démo violait une règle, on veut un
    échec bruyant ici plutôt qu'une donnée invalide en base.
    """
    epics = list(db.execute(select(Epic)).scalars().all())
    projects = list(db.execute(select(Project)).scalars().all())
    tasks = list(db.execute(select(Task)).scalars().all())
    milestones = list(db.execute(select(Milestone)).scalars().all())
    deps = list(db.execute(select(Dependency)).scalars().all())
    equipes = list(db.execute(select(Equipe)).scalars().all())
    allocs = list(db.execute(select(TacheEquipe)).scalars().all())
    measures = list(db.execute(select(Measure)).scalars().all())

    epic_par_tri = {e.trigramme: e for e in epics}
    projet_par_id = {p.id: p for p in projects}
    taches_par_projet: dict[int, list[Task]] = defaultdict(list)
    for t in tasks:
        taches_par_projet[t.projet_id].append(t)

    for e in epics:
        check_epic_trigramme(e.trigramme)
        check_epic_basics(e)
        check_epic_date_order(e)
        if e.statut == "realise":
            projets_e = [p for p in projects if p.epic_trigramme == e.trigramme]
            jalons_e = [m for m in milestones
                        if any(p.epic_trigramme == e.trigramme for p in m.projects)]
            check_epic_realise_consistency(e, projets_e, jalons_e)

    for p in projects:
        check_project_dates(p)
        check_project_dates_within_epic(p, epic_par_tri[p.epic_trigramme])
        if p.statut == "realise":
            check_project_realise_consistency(p, taches_par_projet[p.id])

    for t in tasks:
        check_task_dates(t)

    for m in milestones:
        check_milestone_has_projects(m.project_ids)
        epics_du_jalon = {
            projet_par_id[p.id].epic_trigramme for p in m.projects
        }
        for tri in epics_du_jalon:
            check_milestone_within_epic_max(m, epic_par_tri[tri])

    for d in deps:
        check_dependency_no_self(d)
    check_dependency_acyclic(deps)

    noms_vus: list[str] = []
    for eq in equipes:
        check_equipe_nom(eq.nom)
        check_equipe_nom_unique(eq.nom, noms_vus)
        check_equipe_temps_dispo(eq.temps_dispo_hebdo)
        noms_vus.append(eq.nom)

    couples: list[tuple[int, int]] = []
    ids_taches = {t.id for t in tasks}
    ids_equipes = {eq.id for eq in equipes}
    for a in allocs:
        check_allocation_heures(a.heures_allouees)
        check_allocation_unique(a.tache_id, a.equipe_id, couples)
        check_allocation_refs(
            a.tache_id, a.equipe_id,
            tache_existe=a.tache_id in ids_taches,
            equipe_existe=a.equipe_id in ids_equipes,
        )
        couples.append((a.tache_id, a.equipe_id))

    vues: list[Measure] = []
    for mesure in measures:
        check_measure_unit_consistency(mesure, vues)
        vues.append(mesure)


if __name__ == "__main__":
    seed_demo()
