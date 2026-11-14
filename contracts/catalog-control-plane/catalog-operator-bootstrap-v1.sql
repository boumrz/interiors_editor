-- Run once as the local database operator before Flyway. Passwords are supplied
-- out-of-band and are intentionally absent from source control.
CREATE ROLE catalog_migrate LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE catalog_publish LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE catalog_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

CREATE SCHEMA catalog_migration AUTHORIZATION catalog_migrate;
CREATE SCHEMA catalog_data AUTHORIZATION catalog_migrate;

DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO catalog_migrate, catalog_publish, catalog_runtime',
    current_database()
  );
END
$$;

REVOKE ALL ON SCHEMA catalog_data, catalog_migration FROM PUBLIC;
ALTER ROLE catalog_migrate SET search_path = catalog_migration, catalog_data, pg_catalog;
ALTER ROLE catalog_publish SET search_path = catalog_data, pg_catalog;
ALTER ROLE catalog_runtime SET search_path = catalog_data, pg_catalog;
