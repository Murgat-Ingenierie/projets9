"""Environnement minimal exigé par l'application, posé AVANT tout import de `app`.

`app.main` refuse de démarrer sans `KEYCLOAK_BASE_URL`/`KEYCLOAK_REALM` : une API
qui ne peut authentifier personne n'a pas à écouter sur un port. La contrepartie
est que la suite de tests, qui importe `app.main`, doit fournir ces valeurs.

Ce fichier vit à la RACINE du paquet (pas dans `tests/`) uniquement pour l'ordre
de chargement : pytest lit les `conftest.py` du plus haut vers le plus bas, donc
celui-ci s'exécute avant que `tests/conftest.py` n'importe quoi que ce soit.

Les valeurs sont fictives et ne sont jamais jointes : les tests surchargent
`get_current_user` (cf. `tests/conftest.py`), et ceux qui éprouvent la validation
des jetons construisent leurs propres payloads. Aucun appel réseau, donc — et
aucune adresse réelle dans un dépôt public.
"""

import os

os.environ.setdefault("KEYCLOAK_BASE_URL", "https://auth.invalid")
os.environ.setdefault("KEYCLOAK_REALM", "tests")
