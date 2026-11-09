// Free Game Seeker - crawler da Steam
// Busca jogos em promoção: grátis (100% de desconto) e baratos (até R$ 20).
// Grava em plataforma/jogo/oferta e gera site/ofertas.json para o site.
// Requer Node 22.13 ou mais novo. Uso: npm run crawler

import { DatabaseSync } from 'node:sqlite'; // SQLite já vem dentro do Node
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = 'free_game_seeker.db';
const JSON_SAIDA = path.join('site', 'ofertas.json'); // lido pelo site
const PRECO_MAXIMO = 20; // jogos em promoção até este valor (em R$)
const MAX_BARATOS = 100; // limite de jogos baratos por rodada (para não demorar demais)
const PAUSA_MS = 1500; // pausa entre requisições, para não ser bloqueado
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; FreeGameSeeker/1.0; projeto estudantil)',
};

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Banco ----------
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON');

const jaTemTabelas = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='oferta'")
  .get();
if (!jaTemTabelas) db.exec(fs.readFileSync('schema.sql', 'utf8'));

const idSteam = db.prepare("SELECT id_plataforma FROM plataforma WHERE nome = 'Steam'").get()
  .id_plataforma;

const buscarJogo = db.prepare('SELECT id_jogo FROM jogo WHERE nome = ?');
const inserirJogo = db.prepare(
  'INSERT INTO jogo (nome, descricao, imagem) VALUES (?, ?, ?)'
);
// Se a mesma promoção reaparecer (link já existe), reabre e atualiza o preço.
const salvarOferta = db.prepare(`
  INSERT INTO oferta (id_jogo, id_plataforma, preco_original, preco_atual, link_oferta, data_inicio)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(link_oferta) DO UPDATE SET
    data_inicio = CASE WHEN data_fim IS NOT NULL THEN datetime('now') ELSE data_inicio END,
    data_fim = NULL,
    preco_original = excluded.preco_original,
    preco_atual = excluded.preco_atual
`);

// ---------- Steam ----------
// 1) Lista os appids de jogos em promoção até um preço máximo ('free' ou um número)
async function buscarAppIds(precoMax, limite) {
  const ids = new Set();
  let inicio = 0;
  let total = Infinity;

  while (inicio < total && ids.size < limite) {
    const url =
      'https://store.steampowered.com/search/results/?query&count=100&infinite=1' +
      `&specials=1&maxprice=${precoMax}&category1=998&cc=br&l=portuguese&start=${inicio}`;
    const resp = await fetch(url, { headers: HEADERS });
    if (!resp.ok) throw new Error(`Busca da Steam falhou: HTTP ${resp.status}`);
    const json = await resp.json();

    total = json.total_count ?? 0;
    if (inicio === 0) console.log(`  Busca "${precoMax}": a Steam respondeu total_count = ${total}`);
    // Só appids simples (pacotes/bundles vêm com vírgula e são ignorados)
    for (const m of (json.results_html ?? '').matchAll(/data-ds-appid="(\d+)"/g)) {
      ids.add(m[1]);
    }
    inicio += 100;
    await esperar(PAUSA_MS);
  }
  return [...ids].slice(0, limite);
}

// 2) Confirma no detalhe do jogo o desconto e o preço final
async function detalhesDoJogo(appid) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=br&l=portuguese`;
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) return null;
  const json = await resp.json();
  const info = json[appid];
  if (!info?.success) return null;

  const d = info.data;
  const preco = d.price_overview;
  if (!preco || preco.discount_percent < 1) return null; // sem promoção (ou free-to-play)

  const precoAtual = preco.final / 100; // Steam devolve em centavos
  if (precoAtual > PRECO_MAXIMO) return null;

  return {
    nome: d.name,
    descricao: d.short_description ?? null,
    imagem: d.header_image ?? null,
    precoOriginal: preco.initial / 100,
    precoAtual,
    link: `https://store.steampowered.com/app/${appid}`,
  };
}

// ---------- Exporta as ofertas ativas para o site ----------
function exportarJson() {
  const ofertas = db
    .prepare(
      `SELECT j.nome, j.descricao, j.imagem, p.nome AS plataforma,
              o.preco_original, o.preco_atual, o.link_oferta, o.data_inicio, o.data_fim
       FROM oferta o
       JOIN jogo j       ON j.id_jogo = o.id_jogo
       JOIN plataforma p ON p.id_plataforma = o.id_plataforma
       WHERE o.data_fim IS NULL OR o.data_fim > datetime('now')
       ORDER BY o.preco_atual ASC, o.data_inicio DESC`
    )
    .all();

  fs.mkdirSync(path.dirname(JSON_SAIDA), { recursive: true });
  fs.writeFileSync(
    JSON_SAIDA,
    JSON.stringify({ atualizadoEm: new Date().toISOString(), ofertas }, null, 2)
  );
  const gratis = ofertas.filter((o) => o.preco_atual === 0).length;
  console.log(`${JSON_SAIDA} atualizado: ${ofertas.length} oferta(s), ${gratis} grátis.`);
}

// ---------- Execução ----------
async function main() {
  console.log('Buscando promoções na Steam...');
  const gratis = await buscarAppIds('free', Infinity); // todas as grátis
  const baratos = await buscarAppIds(PRECO_MAXIMO, MAX_BARATOS); // parte das baratas
  const appids = [...new Set([...gratis, ...baratos])];
  console.log(`${appids.length} candidatos encontrados.`);

  const linksVistos = [];

  for (const appid of appids) {
    try {
      const jogo = await detalhesDoJogo(appid);
      if (jogo) {
        db.exec('BEGIN');
        try {
          const row = buscarJogo.get(jogo.nome);
          const idJogo = row
            ? row.id_jogo
            : inserirJogo.run(jogo.nome, jogo.descricao, jogo.imagem).lastInsertRowid;
          salvarOferta.run(idJogo, idSteam, jogo.precoOriginal, jogo.precoAtual, jogo.link);
          db.exec('COMMIT');
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
        linksVistos.push(jogo.link);
        console.log(
          `  ✔ ${jogo.nome} (de R$ ${jogo.precoOriginal.toFixed(2)} por R$ ${jogo.precoAtual.toFixed(2)})`
        );
      }
    } catch (erro) {
      console.error(`  ✖ appid ${appid}: ${erro.message}`);
    }
    await esperar(PAUSA_MS);
  }

  // Ofertas que estavam abertas mas não apareceram mais: a promoção acabou.
  const marcas = linksVistos.map(() => '?').join(',') || "''";
  const encerradas = db
    .prepare(
      `UPDATE oferta SET data_fim = datetime('now')
       WHERE id_plataforma = ? AND data_fim IS NULL AND link_oferta NOT IN (${marcas})`
    )
    .run(idSteam, ...linksVistos).changes;

  console.log(`Concluído: ${linksVistos.length} ativas, ${encerradas} encerradas.`);
  exportarJson();
}

main()
  .catch((e) => {
    console.error('Erro no crawler:', e.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
