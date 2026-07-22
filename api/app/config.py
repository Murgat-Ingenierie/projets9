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
