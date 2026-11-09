# Free Game Seeker

Site que mostra jogos da Steam que estão de graça por tempo limitado, além de jogos em promoção até R$ 10 e até R$ 20.

## Estrutura

```
free-game-seeker/
├── package.json     dependências e comandos
├── schema.sql       tabelas do banco (plataforma, jogo, oferta)
├── crawler.js       busca as promoções na Steam, grava no banco e gera site/ofertas.json
└── site/
    ├── index.html   página
    ├── style.css    visual
    ├── app.js       lê ofertas.json e desenha os cards
    └── ofertas.json gerado pelo crawler (já vem um exemplo)
```

## Como usar (precisa do Node.js 22.13 ou mais novo; confira com `node -v`)

1. Não precisa instalar nada: o SQLite já vem dentro do Node.

2. Rodar o crawler (cria o banco `free_game_seeker.db` na primeira vez):
   `npm run crawler`

3. Abrir o site (num segundo terminal):
   `npm run site`
   e acessar o endereço mostrado (normalmente http://localhost:3000).

   Não abra o index.html com duplo clique: o navegador bloqueia a leitura
   do ofertas.json nesse modo. Alternativa sem npx:
   `cd site` e `python -m http.server 8000`, depois http://localhost:8000

## Faixas de preço

O crawler guarda os jogos grátis (100% de desconto) e os jogos em promoção que custam até R$ 20.
No site, os botões **Grátis**, **Até R$ 10** e **Até R$ 20** filtram a lista.
Para mudar o limite, edite `PRECO_MAXIMO` no começo do `crawler.js` (e os botões no `site/index.html`).

## Mantendo atualizado

Rode `npm run crawler` de tempos em tempos (por exemplo, a cada 1 ou 2 horas).
O site recarrega a lista sozinho a cada 5 minutos.

## Como funciona

Steam -> crawler.js -> free_game_seeker.db (SQLite) -> site/ofertas.json -> site/app.js -> página
