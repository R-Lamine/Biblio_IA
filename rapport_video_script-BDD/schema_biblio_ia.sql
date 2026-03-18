-- ============================================================
-- Biblio-IA — Script de création de la base de données
-- MySQL 8.0
-- RADJI Lamine & OUAHAB Bouthayna — M1 IM — UHA 2025-2026
-- ============================================================

CREATE DATABASE IF NOT EXISTS biblioia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE biblioia;

-- ------------------------------------------------------------
-- Table : users
-- ------------------------------------------------------------
CREATE TABLE users (
    id           CHAR(36)     NOT NULL PRIMARY KEY,
    username     VARCHAR(100) NOT NULL UNIQUE,
    email        VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role         ENUM('adherent', 'bibliothecaire') NOT NULL DEFAULT 'adherent',
    est_bloque   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_username (username),
    INDEX idx_users_email    (email)
);

-- ------------------------------------------------------------
-- Table : books
-- ------------------------------------------------------------
CREATE TABLE books (
    id                 CHAR(36)     NOT NULL PRIMARY KEY,
    title              VARCHAR(255) NOT NULL,
    author             VARCHAR(255) NOT NULL,
    isbn               VARCHAR(20)  UNIQUE,
    publication_year   INT,
    category           VARCHAR(100),
    resume_ia          TEXT,
    cover_image_url    VARCHAR(500),
    shelf_row          VARCHAR(10),
    shelf_number       VARCHAR(10),
    quantity_total     INT          NOT NULL DEFAULT 1,
    quantity_available INT          NOT NULL DEFAULT 1,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_books_title    (title),
    INDEX idx_books_author   (author),
    INDEX idx_books_category (category),
    INDEX idx_books_isbn     (isbn)
);

-- ------------------------------------------------------------
-- Table : loans
-- ------------------------------------------------------------
CREATE TABLE loans (
    id          CHAR(36)  NOT NULL PRIMARY KEY,
    book_id     CHAR(36)  NOT NULL,
    user_id     CHAR(36)  NOT NULL,
    loan_date   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date    TIMESTAMP NOT NULL,
    return_date TIMESTAMP,
    status      ENUM('active', 'returned', 'overdue') NOT NULL DEFAULT 'active',
    CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books(id),
    CONSTRAINT fk_loans_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_loans_user (user_id, status),
    INDEX idx_loans_book (book_id, status)
);

-- ------------------------------------------------------------
-- Table : reservations
-- ------------------------------------------------------------
CREATE TABLE reservations (
    id               CHAR(36)  NOT NULL PRIMARY KEY,
    book_id          CHAR(36)  NOT NULL,
    user_id          CHAR(36)  NOT NULL,
    reservation_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status           ENUM('pending', 'fulfilled', 'cancelled') NOT NULL DEFAULT 'pending',
    CONSTRAINT fk_reservations_book FOREIGN KEY (book_id) REFERENCES books(id),
    CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_reservations_book (book_id, status),
    INDEX idx_reservations_user (user_id, status)
);

-- ------------------------------------------------------------
-- Table : ai_analyses
-- ------------------------------------------------------------
CREATE TABLE ai_analyses (
    id            CHAR(36)     NOT NULL PRIMARY KEY,
    analysis_type VARCHAR(100) NOT NULL,
    input_data    JSON,
    output_data   JSON,
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_analyses_type (analysis_type)
);
