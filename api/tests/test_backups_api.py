"""Sauvegardes (SPEC §4, écran 11) : historique + demande de dump.

L'API ne fabrique pas les dumps — elle lit un dossier et dépose une sentinelle.
Les tests pointent donc `backup_dir`/`backup_trigger_dir` vers des dossiers
temporaires : aucun conteneur `backup` n'est nécessaire.
"""

import gzip

import pytest

from app.config import settings


@pytest.fixture
def dirs(tmp_path, monkeypatch):
    backups = tmp_path / "backups"
    trigger = tmp_path / "trigger"
    backups.mkdir()
    trigger.mkdir()
    monkeypatch.setattr(settings, "backup_dir", str(backups))
    monkeypatch.setattr(settings, "backup_trigger_dir", str(trigger))
    return backups, trigger


def _dump(directory, name: str, contenu: bytes = b"-- dump") -> None:
    (directory / name).write_bytes(gzip.compress(contenu))


def test_historique_vide_quand_aucun_dump(client, auth, dirs):
    r = client.get("/api/backups", headers=auth)
    assert r.status_code == 200
    assert r.json() == []


def test_historique_liste_les_dumps_avec_taille(client, auth, dirs):
    backups, _ = dirs
    _dump(backups, "gestion_projet_2026-07-01_03-00-00.sql.gz", b"a" * 100)
    r = client.get("/api/backups", headers=auth)
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["nom"] == "gestion_projet_2026-07-01_03-00-00.sql.gz"
    assert body[0]["taille_octets"] > 0
    assert body[0]["date"]


def test_historique_trie_du_plus_recent_au_plus_ancien(client, auth, dirs):
    backups, _ = dirs
    import os
    import time

    for i, nom in enumerate(
        [
            "gestion_projet_2026-07-01_03-00-00.sql.gz",
            "gestion_projet_2026-07-02_03-00-00.sql.gz",
            "gestion_projet_2026-07-03_03-00-00.sql.gz",
        ]
    ):
        _dump(backups, nom)
        # mtime croissant explicite : c'est lui qui porte le tri.
        os.utime(backups / nom, (time.time() + i, time.time() + i))

    noms = [b["nom"] for b in client.get("/api/backups", headers=auth).json()]
    assert noms == [
        "gestion_projet_2026-07-03_03-00-00.sql.gz",
        "gestion_projet_2026-07-02_03-00-00.sql.gz",
        "gestion_projet_2026-07-01_03-00-00.sql.gz",
    ]


def test_historique_ignore_les_fichiers_hors_dumps(client, auth, dirs):
    """Les `.part` (dumps en cours) et autres fichiers ne doivent pas apparaître."""
    backups, _ = dirs
    _dump(backups, "gestion_projet_2026-07-01_03-00-00.sql.gz")
    (backups / ".gestion_projet_2026-07-02.sql.gz.part").write_bytes(b"incomplet")
    (backups / "notes.txt").write_text("bruit")

    noms = [b["nom"] for b in client.get("/api/backups", headers=auth).json()]
    assert noms == ["gestion_projet_2026-07-01_03-00-00.sql.gz"]


def test_historique_sans_volume_monte_renvoie_une_liste_vide(client, auth, monkeypatch, tmp_path):
    """Hors Docker le volume n'existe pas : ce n'est pas une erreur serveur."""
    monkeypatch.setattr(settings, "backup_dir", str(tmp_path / "absent"))
    r = client.get("/api/backups", headers=auth)
    assert r.status_code == 200
    assert r.json() == []


def test_demander_un_backup_depose_la_sentinelle(client, auth, dirs):
    _, trigger = dirs
    r = client.post("/api/backups", headers=auth)
    assert r.status_code == 202
    assert r.json()["demande"] is True
    assert (trigger / "backup.request").is_file()


def test_demandes_repetees_se_fondent_en_une_seule(client, auth, dirs):
    """Nom de sentinelle fixe : 3 clics = 1 dump, pas 3 (comportement voulu)."""
    _, trigger = dirs
    for _ in range(3):
        assert client.post("/api/backups", headers=auth).status_code == 202
    assert len(list(trigger.iterdir())) == 1


def test_demander_un_backup_ne_cree_aucun_dump_lui_meme(client, auth, dirs):
    """L'API ne fabrique pas les dumps : l'historique reste vide après la demande."""
    backups, _ = dirs
    client.post("/api/backups", headers=auth)
    assert client.get("/api/backups", headers=auth).json() == []


def test_service_de_sauvegarde_injoignable_renvoie_503(client, auth, monkeypatch, tmp_path):
    """Volume d'échange non inscriptible : le dire, plutôt que mentir un succès."""
    cible = tmp_path / "fichier"
    cible.write_text("je ne suis pas un dossier")
    # mkdir() sur un chemin déjà occupé par un FICHIER lève OSError.
    monkeypatch.setattr(settings, "backup_trigger_dir", str(cible / "sous-dossier"))
    r = client.post("/api/backups", headers=auth)
    assert r.status_code == 503
    assert "sauvegarde" in r.json()["detail"].lower()
