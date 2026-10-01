# Quetzal Save Viewer

Visualizador de saves de **Pokémon Quetzal** (ROM hack de GBA). Abra o `.sav` do emulador e veja treinador, equipe e PC. Dá para exportar tudo em planilha (CSV), texto do Pokémon Showdown ou JSON.

- **100% local:** o save é lido no navegador e não é enviado a nenhum servidor.
- **Leve:** sem framework. A página inicial pesa uns 8 KB comprimidos (sem as fontes). O parser e as tabelas (~29 KB comprimidos) só carregam quando você abre um save.
- **Offline (PWA):** depois da primeira visita, o app funciona sem internet. Os sprites já vistos ficam guardados.

> Projeto de fã, sem vínculo com Nintendo, Game Freak, The Pokémon Company ou com os autores do Quetzal. Sprites carregados do repositório [PokeAPI/sprites](https://github.com/PokeAPI/sprites).

## Como usar

1. Abra o site no Chrome do Android (ou em qualquer navegador moderno).
2. Toque em **Abrir arquivo .sav** e escolha o save na pasta do emulador (My Boy!, Pizza Boy, RetroArch…). No computador, também dá para arrastar o arquivo para a página.
3. Para instalar como app: menu do Chrome → **Instalar app** / **Adicionar à tela inicial**.
4. Uma cópia do último save aberto fica guardada no navegador (IndexedDB, só neste aparelho) e abre sozinha na próxima visita. Para ver o progresso mais recente, abra o `.sav` de novo. O botão **Esquecer este save** apaga a cópia.

### O que é lido hoje

| | Equipe | PC |
|---|---|---|
| Espécie, apelido, golpes, PP | ✅ | ✅ |
| Natureza, item, habilidade, IVs, EVs | ✅ | ✅ |
| Experiência | ✅ | ✅ (o jogo guarda ÷ 10) |
| Nível | ✅ | calculado pela experiência (curva conferida no jogo) |
| Stats | ✅ | não são guardados no PC |
| HP atual | ainda não | — |

Espécies com ID acima de 905 usam numeração própria do Quetzal. Elas são identificadas por uma tabela manual, e as que ainda não foram conferidas no jogo aparecem como **provável**. Itens com ID acima de 479 ainda não foram todos conferidos e aparecem como **provável**; a partir do 829 (megapedras novas) a numeração do Quetzal é diferente da tabela de referência, e só os itens já conferidos têm nome. Os detalhes técnicos estão em [`CLAUDE.md`](CLAUDE.md).

## Desenvolvimento

Requer Node 22 (ver `.node-version`).

```bash
npm install
npm run dev        # servidor local com hot reload
npm test           # testes (Vitest)
npm run build      # gera dist/
npm run preview    # serve dist/ (com service worker) em http://localhost:4173
```

### Testes com um save real

Saves reais **não** são versionados. Para rodar também os testes contra saves reais, coloque os arquivos em `fixtures/PokemonQuetzalPtBrAlpha9v0.sav` e `fixtures/PokemonQuetzalPtBrAlpha9v0-pc.sav` (ou defina `QUETZAL_SAVE` / `QUETZAL_SAVE_PC`). Sem ele, esses testes são pulados e os testes com saves sintéticos rodam normalmente.

### Tabelas de nomes e tipos

Os arquivos em `src/data/*.json` são gerados e versionados. O build não acessa a rede.

```bash
npm run tables     # baixa do pokeemerald-expansion e da PokeAPI e regenera src/data/*.json
```

`src/data/quetzal-overrides.json` é mantido à mão: tem as espécies com ID próprio do Quetzal e as exceções de item.

### Ferramentas de engenharia reversa

```bash
npm run diff-saves -- antes.sav depois.sav            # o que mudou entre dois saves
npm run diff-saves -- antes.sav depois.sav --party 1  # diff bit a bit do 1º da equipe
npm run diff-saves -- antes.sav depois.sav --pc 1 5   # diff bit a bit da caixa 1, posição 5
npm run diff-saves -- save.sav --pc 1 5               # mostra o registro em hex e bits
```

### Ícones

Os ícones do app (uma pena em pixel art, desenho original) são gerados por `node tools/make-icons.mjs` em `public/icons/`.

## Deploy no Cloudflare Pages

O build é estático e fica em `dist/`. Os caminhos são relativos (`base: './'`), então o mesmo build funciona na raiz de um domínio ou numa subpasta.

### Opção A: integração com o GitHub (recomendada, sem tokens)

1. No painel da Cloudflare: **Workers & Pages → Create → Pages → Connect to Git** e escolha este repositório.
2. Configuração de build:
   - **Framework preset:** None (ou Vite)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Production branch:** `main`
3. Salve. Cada push na `main` publica o site, e os outros branches geram URLs de prévia.

A Cloudflare lê a versão do Node em `.node-version`. Se precisar, defina `NODE_VERSION=22` em *Settings → Environment variables*.

### Opção B: upload direto com o Wrangler

```bash
npm run build
npx wrangler pages deploy dist --project-name quetzal-save-viewer
```

### Cabeçalhos

`public/_headers` vai junto para o `dist/` e configura:

- cache longo para `assets/*` (os nomes têm hash) e `no-cache` para `index.html`, `sw.js` e o manifest;
- Content-Security-Policy restrita: scripts só do próprio site, imagens só do site e de `raw.githubusercontent.com`. O hash do script inline de tema é calculado no build.

## GitHub Pages (alternativa)

Funciona sem mudar nada, porque os caminhos são relativos. Publique o conteúdo de `dist/` (por exemplo, com a action `actions/deploy-pages`). O arquivo `_headers` é ignorado pelo GitHub Pages.

## PWA e APK

- `public/manifest.webmanifest` tem nome, ícones 192/512 (inclusive *maskable*), `display: standalone` e `start_url`/`scope` relativos.
- O service worker (`src/sw-template.js`, gerado como `dist/sw.js` no build) faz o precache do app inteiro e guarda até 1500 sprites já vistos.
- Para gerar o APK: publique o site, abra <https://www.pwabuilder.com>, informe a URL e escolha **Android**. Para o app abrir sem a barra de endereço (TWA), publique o `assetlinks.json` que o PWABuilder gerar em `public/.well-known/assetlinks.json` e faça o deploy de novo.

## Estrutura

```
src/
  parser/      leitura do save (save.js), tabela de caracteres, descrição com nomes (describe.js)
  data/        tabelas JSON (geradas) + quetzal-overrides.json (manual)
  ui/          templates, sprites, download/cópia
  export.js    CSV / Showdown / JSON
  main.js      entrada leve (tema, abrir arquivo, service worker)
  app.js       carregado sob demanda: parser + tabelas + renderização
tools/         gerador de tabelas, diff de saves, gerador de ícones
test/          Vitest (saves sintéticos + save real opcional)
reference/     protótipo original (não entra no build)
```
