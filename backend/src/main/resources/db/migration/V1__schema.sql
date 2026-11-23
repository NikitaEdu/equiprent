-- EquipRent: початкова схема даних
-- Розширення btree_gist потрібне для обмеження EXCLUDE з оператором "=" по bigint
-- разом з оператором "&&" по daterange; pg_trgm — для пошуку за підрядком назви.
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE app_user (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(254) NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    phone         VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('CLIENT', 'MANAGER')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ux_app_user_email ON app_user (lower(email));

CREATE TABLE category (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE,
    slug VARCHAR(80) NOT NULL UNIQUE
);

-- Тип обладнання (товарна позиція каталогу)
CREATE TABLE equipment_type (
    id                  BIGSERIAL PRIMARY KEY,
    category_id         BIGINT        NOT NULL REFERENCES category (id),
    name                VARCHAR(150)  NOT NULL,
    brand               VARCHAR(80),
    description         TEXT          NOT NULL,
    deposit             NUMERIC(10, 2) NOT NULL CHECK (deposit >= 0),
    service_buffer_days INTEGER       NOT NULL DEFAULT 0 CHECK (service_buffer_days BETWEEN 0 AND 7),
    max_rental_days     INTEGER       NOT NULL DEFAULT 30 CHECK (max_rental_days BETWEEN 1 AND 365),
    late_fee_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.50 CHECK (late_fee_multiplier >= 1),
    image_url           VARCHAR(300),
    active              BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
    version             BIGINT        NOT NULL DEFAULT 0
);
CREATE INDEX ix_equipment_type_category ON equipment_type (category_id);
CREATE INDEX ix_equipment_type_name_trgm ON equipment_type USING gin (lower(name) gin_trgm_ops);

-- Ступінчастий тариф: ставка за добу залежить від тривалості оренди
CREATE TABLE tariff (
    id                BIGSERIAL PRIMARY KEY,
    equipment_type_id BIGINT         NOT NULL REFERENCES equipment_type (id) ON DELETE CASCADE,
    min_days          INTEGER        NOT NULL CHECK (min_days >= 1),
    daily_rate        NUMERIC(10, 2) NOT NULL CHECK (daily_rate > 0),
    CONSTRAINT ux_tariff_type_min_days UNIQUE (equipment_type_id, min_days)
);

-- Фізичний екземпляр обладнання
CREATE TABLE equipment_unit (
    id                BIGSERIAL PRIMARY KEY,
    equipment_type_id BIGINT      NOT NULL REFERENCES equipment_type (id),
    inventory_number  VARCHAR(30) NOT NULL UNIQUE,
    condition_note    VARCHAR(300),
    status            VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'MAINTENANCE', 'RETIRED')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_equipment_unit_type ON equipment_unit (equipment_type_id);

-- Бронювання конкретного екземпляра.
-- start_date..end_date — дні оренди включно; blocked — напіввідкритий інтервал,
-- який блокує екземпляр: дні оренди плюс технічна перерва після неї.
CREATE TABLE booking (
    id                 BIGSERIAL PRIMARY KEY,
    client_id          BIGINT         NOT NULL REFERENCES app_user (id),
    equipment_type_id  BIGINT         NOT NULL REFERENCES equipment_type (id),
    unit_id            BIGINT         NOT NULL REFERENCES equipment_unit (id),
    start_date         DATE           NOT NULL,
    end_date           DATE           NOT NULL,
    buffer_days        INTEGER        NOT NULL CHECK (buffer_days >= 0),
    blocked            DATERANGE GENERATED ALWAYS AS
                           (daterange(start_date, end_date + 1 + buffer_days, '[)')) STORED,
    status             VARCHAR(20)    NOT NULL
        CHECK (status IN ('PENDING', 'CONFIRMED', 'ISSUED', 'RETURNED', 'CANCELLED', 'REJECTED')),
    rental_days        INTEGER        NOT NULL CHECK (rental_days >= 1),
    daily_rate         NUMERIC(10, 2) NOT NULL,
    rental_cost        NUMERIC(12, 2) NOT NULL,
    deposit            NUMERIC(10, 2) NOT NULL,
    late_fee           NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_return_date DATE,
    client_comment     VARCHAR(500),
    reject_reason      VARCHAR(500),
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    version            BIGINT         NOT NULL DEFAULT 0,
    CONSTRAINT ck_booking_dates CHECK (end_date >= start_date),
    -- Інваріант: активні бронювання одного екземпляра не перетинаються
    CONSTRAINT ex_booking_unit_no_overlap
        EXCLUDE USING gist (unit_id WITH =, blocked WITH &&)
        WHERE (status IN ('PENDING', 'CONFIRMED', 'ISSUED'))
);
CREATE INDEX ix_booking_client_created ON booking (client_id, created_at DESC);
CREATE INDEX ix_booking_type ON booking (equipment_type_id);
CREATE INDEX ix_booking_status_start ON booking (status, start_date);

-- Історія станів: створення, погодження, видача, повернення тощо
CREATE TABLE booking_event (
    id          BIGSERIAL PRIMARY KEY,
    booking_id  BIGINT      NOT NULL REFERENCES booking (id) ON DELETE CASCADE,
    event_type  VARCHAR(20) NOT NULL,
    from_status VARCHAR(20),
    to_status   VARCHAR(20) NOT NULL,
    actor_id    BIGINT      NOT NULL REFERENCES app_user (id),
    note        VARCHAR(500),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_booking_event_booking ON booking_event (booking_id, occurred_at);
