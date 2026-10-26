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


def test_sans_jeton_github_la_route_repond_503(client, auth):
    r = client.post("/api/claude/chat", json={"messages": [{"role": "user", "content": "Bonjour"}]}, headers=auth)
    assert r.status_code == 503


def test_claude_injoignable_l_issue_est_ouverte_telle_quelle(client, auth, configure, monkeypatch):
    """Comme murgatchat : crédit épuisé ou panne, la demande part quand même."""
    import anthropic

    def plante(m):
        raise anthropic.AnthropicError("credit balance is too low")

    monkeypatch.setattr(claude, "_appeler_claude", plante)
    recu = {}
    monkeypatch.setattr(
        claude, "_creer_issue", lambda t, c: (recu.update(titre=t, corps=c), claude.IssueCreee(number=7, url="u"))[1]
    )

    fil = [
        {"role": "user", "content": "Le jalon ne bouge pas\nquand je le glisse"},
        {"role": "assistant", "content": "Où exactement ?"},
        {"role": "user", "content": "Dans le planning, merci @toto"},
    ]
    r = client.post("/api/claude/chat", json={"messages": fil}, headers=auth)
    assert r.status_code == 200, r.text
    assert r.json()["issue"]["number"] == 7 and "indisponible" in r.json()["reply"]
    assert recu["titre"] == "[Demande] Le jalon ne bouge pas"
    assert "Où exactement" not in recu["corps"]  # seuls les messages de l'utilisateur
    assert "glisse" in recu["corps"] and "@toto" not in recu["corps"] and "toto" in recu["corps"]


def test_sans_cle_anthropic_pas_de_dialogue_mais_une_issue(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "github_token", "ghp-test")
    monkeypatch.setattr(claude, "_appeler_claude", lambda m: pytest.fail("Claude ne doit pas être appelé"))
    monkeypatch.setattr(claude, "_creer_issue", lambda t, c: claude.IssueCreee(number=8, url="u"))
    r = client.post("/api/claude/chat", json={"messages": [{"role": "user", "content": "Bonjour à tous"}]}, headers=auth)
    assert r.status_code == 200 and r.json()["issue"]["number"] == 8


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
