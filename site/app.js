// Free Game Seeker - front-end
// Lê o ofertas.json (gerado pelo crawler) e desenha os cards na tela.
// Os botões filtram por preço: Grátis, até R$ 10 ou até R$ 20.

const REFRESH_MS = 5 * 60 * 1000; // recarrega a lista a cada 5 minutos

const lista = document.getElementById('lista');
const status = document.getElementById('status');
const atualizado = document.getElementById('atualizado');
const botoes = document.querySelectorAll('#filtros button');

let todas = []; // todas as ofertas do ofertas.json
let precoMin = 0; // limite de baixo da faixa
let precoMax = 0; // limite de cima da faixa (0 = só grátis)

// Datas do SQLite vêm em UTC no formato "AAAA-MM-DD HH:MM:SS"
function lerData(texto) {
  return new Date(texto.replace(' ', 'T') + 'Z');
}

function formatarDataHora(data) {
  return data.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatarPreco(valor) {
  return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

function criar(tag, classe, texto) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texto !== undefined) el.textContent = texto; // textContent evita injeção de HTML
  return el;
}

function criarCard(oferta) {
  const card = criar('article', 'card');

  if (oferta.imagem) {
    const img = criar('img');
    img.src = oferta.imagem;
    img.alt = oferta.nome;
    img.loading = 'lazy';
    card.append(img);
  }

  const corpo = criar('div', 'corpo');
  corpo.append(criar('h2', '', oferta.nome));

  if (oferta.descricao) corpo.append(criar('p', 'descricao', oferta.descricao));

  const atual = oferta.preco_atual ?? 0;
  const preco = criar('div', 'preco');
  if (oferta.preco_original) {
    preco.append(criar('span', 'antigo', formatarPreco(oferta.preco_original)));
  }
  preco.append(criar('span', 'gratis', atual > 0 ? formatarPreco(atual) : 'GRÁTIS'));
  corpo.append(preco);

  if (oferta.data_fim) {
    corpo.append(criar('p', 'fim', 'Termina em ' + formatarDataHora(lerData(oferta.data_fim))));
  }

  // Só aceita links https (segurança básica)
  if (oferta.link_oferta.startsWith('https://')) {
    const botao = criar('a', 'botao', 'Ver na ' + oferta.plataforma);
    botao.href = oferta.link_oferta;
    botao.target = '_blank';
    botao.rel = 'noopener noreferrer';
    corpo.append(botao);
  }

  card.append(corpo);
  return card;
}

// Desenha só as ofertas que cabem no filtro atual
function desenhar() { 
  const filtradas = todas.filter((o) => {
  const preco = o.preco_atual ?? 0;
  if (preco === 0) return precoMax === 0; // grátis só aparece no botão "Grátis"
  return preco > precoMin && preco <= precoMax;
});
  lista.replaceChildren(...filtradas.map(criarCard));

  if (filtradas.length) {
    status.textContent = '';
  } else if (precoMax === 0) {
    status.textContent = 'Nenhuma promoção grátis no momento. Veja as opções "Até R$ 10" ou "Até R$ 20".';
  } else {
    status.textContent = 'Nenhuma promoção encontrada nessa faixa de preço.';
  }
}

botoes.forEach((botao) => {
  botao.addEventListener('click', () => {
    precoMin = Number(botao.dataset.min);
    precoMax = Number(botao.dataset.max);
    botoes.forEach((b) => b.classList.toggle('ativo', b === botao));
    desenhar();
  });
});

async function carregar() {
  try {
    // ?t= evita que o navegador use uma versão antiga do arquivo em cache
    const resp = await fetch('ofertas.json?t=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const dados = await resp.json();

    todas = dados.ofertas;
    desenhar();
    atualizado.textContent = 'Atualizado em ' + formatarDataHora(new Date(dados.atualizadoEm));
  } catch (erro) {
    status.textContent = 'Não foi possível carregar as promoções agora.';
    console.error(erro);
  }
}

carregar();
setInterval(carregar, REFRESH_MS);
