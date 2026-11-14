CREATE TABLE catalog_data.catalog_resource (
  resource_hash char(64) PRIMARY KEY
    CHECK (resource_hash ~ '^[0-9a-f]{64}$'),
  byte_length integer NOT NULL CHECK (byte_length BETWEEN 1 AND 26214400),
  media_type varchar(32) NOT NULL
    CHECK (media_type IN ('model/gltf-binary', 'image/png')),
  resource_bytes bytea NOT NULL,
  CHECK (octet_length(resource_bytes) = byte_length),
  CHECK (
    (media_type = 'model/gltf-binary' AND byte_length <= 26214400) OR
    (media_type = 'image/png' AND byte_length <= 262144)
  )
);

CREATE TABLE catalog_data.catalog_publication (
  catalog_version varchar(64) PRIMARY KEY
    CHECK (catalog_version ~ '^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$'),
  published_at timestamptz NOT NULL UNIQUE,
  envelope_hash char(64) NOT NULL UNIQUE
    CHECK (envelope_hash ~ '^[0-9a-f]{64}$'),
  envelope_bytes bytea NOT NULL
    CHECK (octet_length(envelope_bytes) BETWEEN 1 AND 262144),
  asset_count smallint NOT NULL CHECK (asset_count BETWEEN 1 AND 256)
);

CREATE TABLE catalog_data.catalog_current (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  catalog_version varchar(64) NOT NULL UNIQUE
    REFERENCES catalog_data.catalog_publication(catalog_version)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE TABLE catalog_data.catalog_asset (
  catalog_version varchar(64) NOT NULL
    REFERENCES catalog_data.catalog_publication(catalog_version)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  asset_id varchar(64) NOT NULL
    CHECK (asset_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  label varchar(240) NOT NULL
    CHECK (char_length(label) BETWEEN 1 AND 120 AND octet_length(label) <= 240),
  section varchar(32) NOT NULL CHECK (section IN (
    'furniture', 'plumbing', 'appliances-electronics', 'lighting', 'accessories'
  )),
  category varchar(16) NOT NULL CHECK (category IN (
    'seating', 'tables', 'storage', 'sleep', 'plumbing', 'appliance',
    'electronics', 'lighting', 'accessory'
  )),
  anchor_class varchar(8) NOT NULL CHECK (anchor_class IN ('floor', 'wall')),
  front_direction varchar(16) NOT NULL CHECK (front_direction = 'positive-z'),
  width_mm integer NOT NULL CHECK (width_mm BETWEEN 1 AND 100000),
  depth_mm integer NOT NULL CHECK (depth_mm BETWEEN 1 AND 100000),
  height_mm integer NOT NULL CHECK (height_mm BETWEEN 1 AND 100000),
  footprint_width_mm integer NOT NULL CHECK (footprint_width_mm = width_mm),
  footprint_depth_mm integer NOT NULL CHECK (footprint_depth_mm = depth_mm),
  model_hash char(64) NOT NULL
    REFERENCES catalog_data.catalog_resource(resource_hash)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  thumbnail_hash char(64)
    REFERENCES catalog_data.catalog_resource(resource_hash)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (catalog_version, asset_id)
);

CREATE TABLE catalog_data.catalog_variant_slot (
  catalog_version varchar(64) NOT NULL,
  asset_id varchar(64) NOT NULL,
  slot_id varchar(64) NOT NULL
    CHECK (slot_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  label varchar(240) NOT NULL
    CHECK (char_length(label) BETWEEN 1 AND 120 AND octet_length(label) <= 240),
  slot_kind varchar(16) NOT NULL CHECK (slot_kind = 'model-resource'),
  PRIMARY KEY (catalog_version, asset_id, slot_id),
  UNIQUE (catalog_version, asset_id),
  FOREIGN KEY (catalog_version, asset_id)
    REFERENCES catalog_data.catalog_asset(catalog_version, asset_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE TABLE catalog_data.catalog_variant_option (
  catalog_version varchar(64) NOT NULL,
  asset_id varchar(64) NOT NULL,
  slot_id varchar(64) NOT NULL,
  variant_id varchar(64) NOT NULL
    CHECK (variant_id ~ '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$'),
  label varchar(240) NOT NULL
    CHECK (char_length(label) BETWEEN 1 AND 120 AND octet_length(label) <= 240),
  model_hash char(64) NOT NULL
    REFERENCES catalog_data.catalog_resource(resource_hash)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  PRIMARY KEY (catalog_version, asset_id, slot_id, variant_id),
  FOREIGN KEY (catalog_version, asset_id, slot_id)
    REFERENCES catalog_data.catalog_variant_slot(catalog_version, asset_id, slot_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT
);

REVOKE ALL ON SCHEMA catalog_data, catalog_migration FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA catalog_data, catalog_migration FROM PUBLIC;

-- Roles are pre-created by the operator; these grants are the complete matrix.
GRANT USAGE ON SCHEMA catalog_data TO catalog_publish, catalog_runtime;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA catalog_data TO catalog_publish;
REVOKE UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA catalog_data FROM catalog_publish;
GRANT UPDATE (catalog_version) ON catalog_data.catalog_current TO catalog_publish;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog_data TO catalog_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA catalog_data REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog_migration REVOKE ALL ON TABLES FROM PUBLIC;
