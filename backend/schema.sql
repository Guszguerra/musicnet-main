-- ================================================================
--  MusicNet — Schema MySQL
--  Execute: mysql -u root -p < schema.sql
-- ================================================================

CREATE DATABASE IF NOT EXISTS musicnet
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE musicnet;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    name          VARCHAR(100)    NOT NULL,
    handle        VARCHAR(50)     NOT NULL UNIQUE,
    email         VARCHAR(150)    NOT NULL UNIQUE,
    password_hash VARCHAR(255)    NOT NULL,
    avatar_url    VARCHAR(500)    DEFAULT 'https://i.pravatar.cc/150?img=1',
    bio           TEXT,
    accent_color  VARCHAR(7)      DEFAULT '#1DB954',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_handle (handle)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS posts (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    user_id       INT UNSIGNED    NOT NULL,
    caption       TEXT            NOT NULL,
    song_label    VARCHAR(255)    NOT NULL,
    album_art_url VARCHAR(500)    NOT NULL,
    preview_url   VARCHAR(500)    DEFAULT NULL,
    itunes_id     BIGINT          DEFAULT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_user_id (user_id),
    INDEX idx_created (created_at DESC),
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS likes (
    user_id       INT UNSIGNED    NOT NULL,
    post_id       INT UNSIGNED    NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    post_id       INT UNSIGNED    NOT NULL,
    user_id       INT UNSIGNED    NOT NULL,
    text          TEXT            NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_post_id (post_id),
    CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS follows (
    follower_id   INT UNSIGNED    NOT NULL,
    following_id  INT UNSIGNED    NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT fk_follows_follower  FOREIGN KEY (follower_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_follows_following FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reposts (
    user_id       INT UNSIGNED    NOT NULL,
    post_id       INT UNSIGNED    NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id),
    CONSTRAINT fk_reposts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reposts_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ── Seed — usuário padrão (senha: musicnet123) ───────────────────
INSERT IGNORE INTO users (name, handle, email, password_hash, avatar_url, bio) VALUES
(
    'Music Lover',
    '@musiclover_br',
    'user@musicnet.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'https://i.pravatar.cc/150?img=11',
    'Explorando novos sons todos os dias. 🎧'
),
(
    'Cadu Beats',
    '@cadubeats',
    'cadu@musicnet.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'https://i.pravatar.cc/150?img=33',
    'Produtor musical e entusiasta de jazz. 🎷'
);
