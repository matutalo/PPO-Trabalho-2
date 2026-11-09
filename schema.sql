-- Free Game Seeker - Banco de dados (SQLite), versão com 3 tabelas
PRAGMA foreign_keys = ON;

CREATE TABLE plataforma (
    id_plataforma INTEGER PRIMARY KEY AUTOINCREMENT,
    nome          TEXT NOT NULL UNIQUE,
    url           TEXT NOT NULL
);

CREATE TABLE jogo (
    id_jogo   INTEGER PRIMARY KEY AUTOINCREMENT,
    nome      TEXT NOT NULL,
    descricao TEXT,
    imagem    TEXT
);

CREATE TABLE oferta (
    id_oferta      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_jogo        INTEGER NOT NULL,
    id_plataforma  INTEGER NOT NULL,
    preco_original REAL,
    preco_atual    REAL NOT NULL DEFAULT 0,
    link_oferta    TEXT NOT NULL UNIQUE,
    data_inicio    TEXT,
    data_fim       TEXT,
    FOREIGN KEY (id_jogo)       REFERENCES jogo(id_jogo),
    FOREIGN KEY (id_plataforma) REFERENCES plataforma(id_plataforma)
);

INSERT INTO plataforma (nome, url) VALUES ('Steam', 'https://store.steampowered.com');
