"""Écran « Claude » — un formulaire qui ouvre une issue.

Aucun appel réseau : `_creer_issue` est remplacée. On vérifie le contrat : titre
préfixé par le type, auteur cité SANS @mention (un prénom peut coïncider avec un
compte GitHub hors équipe), aucun label (le gate humain est « claude-fix »), et
la route absente (503) sans jeton.
"""

import pytest

from app.config import settings
from app.routes import claude

DEMANDE = {
    "type": "bug",
    "titre": "Jalon non déplaçable",
    "description": "Depuis le planning, glisser un jalon ne fait rien. Merci @toto pour le signalement.",
}


@pytest.fixture
def configure(monkeypatch):
    monkeypatch.setattr(settings, "github_token", "ghp-test")


def test_sans_configuration_la_route_repond_503(client, auth):
    assert client.post("/api/claude/issues", json=DEMANDE, headers=auth).status_code == 503


def test_la_demande_devient_une_issue_signee_sans_mention(client, auth, configure, monkeypatch):
    recu = {}

    def fausse_issue(titre, corps):
        recu.update(titre=titre, corps=corps)
        return claude.IssueCreee(number=42, url="https://github.com/x/y/issues/42")

    monkeypatch.setattr(claude, "_creer_issue", fausse_issue)

    r = client.post("/api/claude/issues", json=DEMANDE, headers=auth)
    assert r.status_code == 201, r.text
    assert r.json() == {"number": 42, "url": "https://github.com/x/y/issues/42"}
    assert recu["titre"] == "[Bug] Jalon non déplaçable"
    assert "par Admin Test" in recu["corps"]
    assert "@toto" not in recu["corps"] and "toto" in recu["corps"]


def test_amelioration_a_son_prefixe(client, auth, configure, monkeypatch):
    monkeypatch.setattr(
        claude, "_creer_issue", lambda titre, corps: claude.IssueCreee(number=1, url="u") if titre.startswith("[Amélioration] ") else pytest.fail(titre)
    )
    r = client.post("/api/claude/issues", json={**DEMANDE, "type": "amelioration"}, headers=auth)
    assert r.status_code == 201, r.text


def test_description_trop_courte_refusee(client, auth, configure):
    r = client.post("/api/claude/issues", json={**DEMANDE, "description": "court"}, headers=auth)
    assert r.status_code == 422


def test_sans_jeton_401(client):
    assert client.post("/api/claude/issues", json=DEMANDE).status_code == 401
