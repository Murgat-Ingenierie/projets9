"""Écran « Claude » — ce qui compte est le contrat, pas le modèle.

Aucun appel réseau : `_appeler_claude` et `_creer_issue` sont remplacés. On
vérifie que le texte revient tel quel, que l'appel d'outil ouvre UNE issue
(sans label — le gate humain est le label « claude-fix »), que l'auteur est
cité sans @mention, et que la route est absente (503) sans configuration.
"""

from types import SimpleNamespace

import pytest

from app.config import settings
from app.routes import claude


@pytest.fixture
def configure(monkeypatch):
    monkeypatch.setattr(settings, "anthropic_api_key", "sk-test")
    monkeypatch.setattr(settings, "github_token", "ghp-test")


def _reponse(*blocs):
    return SimpleNamespace(content=list(blocs))


def _texte(t):
    return SimpleNamespace(type="text", text=t)


def _outil(**entree):
    return SimpleNamespace(type="tool_use", name="creer_issue", input=entree)


def test_sans_configuration_la_route_repond_503(client, auth):
    r = client.post("/api/claude/chat", json={"messages": [{"role": "user", "content": "Bonjour"}]}, headers=auth)
    assert r.status_code == 503


def test_une_question_revient_sans_issue(client, auth, configure, monkeypatch):
    monkeypatch.setattr(claude, "_appeler_claude", lambda m: _reponse(_texte("Où exactement ?")))
    monkeypatch.setattr(claude, "_creer_issue", lambda *a: pytest.fail("aucune issue attendue"))

    r = client.post("/api/claude/chat", json={"messages": [{"role": "user", "content": "Ça bugue"}]}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json() == {"reply": "Où exactement ?", "issue": None}


def test_l_appel_d_outil_ouvre_une_issue_signee_sans_mention(client, auth, configure, monkeypatch):
    monkeypatch.setattr(
        claude,
        "_appeler_claude",
        lambda m: _reponse(_outil(titre="Jalon non déplaçable", corps="## Résumé\nmerci @toto", type="bug")),
    )
    recu = {}

    def fausse_issue(titre, corps):
        recu.update(titre=titre, corps=corps)
        return claude.IssueCreee(number=42, url="https://github.com/x/y/issues/42")

    monkeypatch.setattr(claude, "_creer_issue", fausse_issue)

    r = client.post("/api/claude/chat", json={"messages": [{"role": "user", "content": "Crée l'issue"}]}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["issue"] == {"number": 42, "url": "https://github.com/x/y/issues/42"}
    assert "#42" in r.json()["reply"]  # pas de texte du modèle → phrase par défaut
    assert recu["titre"] == "[Bug] Jalon non déplaçable"
    assert "par Admin Test" in recu["corps"]
    assert "@toto" not in recu["corps"] and "toto" in recu["corps"]


def test_le_dernier_message_doit_venir_de_l_utilisateur(client, auth, configure):
    r = client.post(
        "/api/claude/chat",
        json={"messages": [{"role": "user", "content": "a"}, {"role": "assistant", "content": "b"}]},
        headers=auth,
    )
    assert r.status_code == 422


def test_sans_jeton_401(client):
    r = client.post("/api/claude/chat", json={"messages": [{"role": "user", "content": "a"}]})
    assert r.status_code == 401
