from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://gestion:gestion@db:5432/gestion_projet"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_min: int = 60

    seed_admin_email: str = "admin@local"
    seed_admin_password: str = "admin"
    seed_admin_name: str = "Admin"
    seed_csv_path: str = "/seed/epics.csv"

    max_active_users: int = 10

    auth_disabled: bool = False

    # --- Keycloak (realm partagé avec les autres applications) ---
    # Vides = adossement inactif : l'API reste sur le mode hérité (JWT maison) ou
    # débrayé (AUTH_DISABLED). Renseigner les trois pour activer l'OIDC.
    keycloak_base_url: str = ""
    keycloak_realm: str = ""
    # Audience attendue dans le jeton, et client qui porte les rôles applicatifs.
    # Vérifiée à la validation : sans elle, un jeton émis pour une AUTRE
    # application du même realm serait accepté ici.
    keycloak_api_audience: str = "projets9-api"

    # --- Sauvegardes (SPEC §4, écran 11) ---
    # Volume des dumps, monté EN LECTURE SEULE côté API : l'application peut
    # lister les sauvegardes et en demander une, jamais en supprimer ni en
    # altérer une. C'est le conteneur `backup` qui les écrit.
    backup_dir: str = "/backups"
    # Petit volume d'échange : l'API y dépose un fichier sentinelle, le
    # conteneur `backup` le voit, lance le dump et le retire. Évite d'installer
    # un client Postgres dans l'image API et de dupliquer backup.sh.
    backup_trigger_dir: str = "/trigger"

    # Origines CORS autorisées (liste séparée par des virgules). Vide par
    # défaut : front et API sont servis par le même proxy (même origine), donc
    # aucune requête cross-origin — pas besoin de CORS. À ne renseigner que si
    # le front est servi depuis une origine distincte. Jamais de "*" (invalide
    # avec allow_credentials, et non sécurisé).
    cors_origins: str = ""

    # Si true, la seed peuple le planning avec un jeu de démonstration
    # (cf. app.seed_demo). Idempotent, ne s'exécute jamais par-dessus des
    # données existantes. Destiné aux démos / au développement du front.
    seed_demo: bool = False


settings = Settings()
