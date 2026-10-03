# savDex

Site estático (Vite + JS puro) que lê saves de GBA — **Pokémon Quetzal** (ROM hack sobre pokeemerald com engine expandida) e os **jogos oficiais da Gen 3** (Emerald, FireRed/LeafGreen, Ruby/Sapphire) —, mostra treinador, equipe e PC e exporta CSV / Showdown / JSON. Aceita `.sav` e exports do GameShark/SharkPort (`.sps`). Tudo roda no navegador; nada é enviado a servidor. Alvo principal: Chrome no Android em aparelho de entrada (Redmi Note 11), então **leveza é requisito**: sem framework, sem dependências de runtime, renderizar só o que está visível (uma caixa do PC por vez), sem efeitos caros de CSS.

## Comandos

- `npm run dev` / `npm run build` (saída em `dist/`) / `npm run preview`
- `npm test`: Vitest. Os testes sintéticos sempre rodam; os do save real (`test/parser.fixture.test.js`) só rodam se existirem `fixtures/PokemonQuetzalPtBrAlpha9v0.sav` e `fixtures/PokemonQuetzalPtBrAlpha9v0-pc.sav` (Lucario e Basculegion movidos para a BOX1, posições 21 e 23) e, opcional, `fixtures/PokemonQuetzalPtBrAlpha9v0-3.sav` (Tyranitar e Scorbunny shinys na equipe, Serperior no PC), ou `QUETZAL_SAVE` / `QUETZAL_SAVE_PC` / `QUETZAL_SAVE_3`. **Saves reais não são versionados** (`.gitignore`).
- `npm run tables`: regenera `src/data/*.json` a partir do pokeemerald-expansion e dos CSVs da PokeAPI (precisa de rede). Os JSON são versionados; o build não acessa rede.
- `npm run dex`: regenera `src/data/dex.json` (linhas evolutivas com o método em português e em inglês e golpes por nível do jogo oficial mais recente; golpes ligados aos IDs do expansion pelo nome). Carregado sob demanda ao abrir o detalhe de um Pokémon; aparece como "provável" (o Quetzal pode ter mudado).
- `npm run gen3`: regenera `src/data/gen3.json` (tabelas da Gen 3 oficial a partir do decomp pret/pokeemerald + nomes da PokeAPI).
- Saves reais da Gen 3 para os testes (opcionais, não versionados): `fixtures/emerald.sav` e `fixtures/firered.sav`.
- `npm run diff-saves -- a.sav b.sav`: compara dois saves para engenharia reversa (ver `tools/`).

## Estrutura

- `src/parser/load.js`: **porta de entrada**. Tira o embrulho (`container.js`: SharkPort `.sps`), identifica o formato (layout de 16 setores do Quetzal ou 14 setores da Gen 3 oficial) e confere a coerência antes de mostrar qualquer coisa. Save que não bate com nenhum formato gera `SaveError` claro ("não é de um jogo suportado"), nunca dados parciais. `SUPPORTED` lista os jogos (também na tela inicial do `index.html`).
- `src/parser/save.js`: leitura crua do **Quetzal** (só números/textos). Offsets em constantes exportadas (`PARTY`, `PC`, ...).
- `src/parser/gen3.js`: leitura e descrição dos **jogos oficiais da Gen 3** (formato público: Pokémon de 80/100 bytes criptografados com PID ^ OT ID e embaralhados por PID % 24; checksums por Pokémon e por setor). Produz o mesmo formato de `describe()`; `gen3Tables()` adapta as tabelas do app (golpes 1–354 com tipo/poder da Gen 3, tabela de tipos sem Fairy).
- `src/parser/describe.js`: resolve nomes, tipos, natureza, habilidade, nível (pela exp) e marca a confiança de cada dado.
- `src/parser/stats.js`: stats pela fórmula (stats base da PokeAPI), conferência da natureza contra os stats salvos e Hidden Power. `src/parser/natures.js`: tabela de naturezas e natureza pelo PID (byte baixo).
- `src/analysis.js`: fraquezas/resistências e cobertura da equipe (tabela de tipos em `src/data/typechart.json`).
- `src/search.js`: busca e filtros sobre equipe + PC.
- `src/ai/`: assistente opcional com IA (Gemini ou Groq, à escolha; chave do usuário no `localStorage`, chamada direta do navegador; CSP libera `generativelanguage.googleapis.com` e `api.groq.com`). `gemini.js`/`groq.js` são os clientes (mesma interface), `providers.js` escolhe, `http.js` tem as peças comuns. `prompt.js` monta o pedido (sem nível; referências `E1`/`C3-12`) e confere a resposta (só referências que existem); `view.js` desenha; `index.js` é o pacote carregado sob demanda, em duas etapas: `prepareAi` monta o pedido sem enviar e a janela `#ai-confirm` mostra o que vai/não vai e o texto exato; só `sendAi` envia (a confirmação pode ser desligada em Configurações da IA). Nunca enviar o `.sav` nem dados além dos Pokémon (sem nível, EVs, PID nem dados do treinador).
- `src/demo/`: **save de demonstração** (`demo.js`, carregado só ao tocar em "Ver um save de exemplo"): monta na hora um save do Quetzal com Pokémon fictícios (só espécies/itens conferidos; stats da equipe pela fórmula) usando `quetzal-writer.js`, que também é o gerador dos testes. Nunca grava no save do usuário; o exemplo não vira "último save".
- `src/parser/charset.js`: tabela de caracteres Gen 3.
- `src/i18n.js`: idioma da interface (português padrão; inglês se o navegador não for `pt-*` ou se o usuário escolher no botão EN/PT, salvo em `localStorage` `lang`; a troca recarrega a página). `t('texto em português', { param })`: as chaves são os próprios textos em português; o dicionário inglês fica em `src/i18n/en.js`, num pacote carregado só em inglês (`loadLang()` em `main.js`, com a página escondida até trocar os textos). Textos fixos do `index.html` levam `data-i18n` (conteúdo) ou `data-i18n-attr` (atributos). **Todo texto novo da interface passa por `t()` e ganha tradução em `en.js`**; `test/i18n.test.js` confere as chaves do código e do `index.html` e desenha as telas em inglês procurando textos sem tradução. Dados do parser (gênero, confiança, `where: 'Equipe'`, evidências) ficam em português e são traduzidos na hora de mostrar/exportar. O pedido à IA também sai no idioma da interface. Nos testes (Node) o idioma é sempre português.
- `src/export.js`: CSV (BOM + `;`, padrão do Excel pt-BR), Showdown, JSON.
- `src/data/`: tabelas geradas + `quetzal-overrides.json` (manual: IDs próprios do Quetzal e exceções de item). `move-text.json` (descrições dos golpes) é carregado sob demanda, num pacote separado.
- `src/ui/`, `src/main.js`, `src/styles/`: interface. `src/ui/store.js` guarda uma cópia do último save no IndexedDB (só local) para abrir sozinha na próxima visita.
- `src/sw-template.js` vira `dist/sw.js` no build (plugin em `vite.config.js` injeta a lista de precache). Ele também recebe o `.sav` do menu Compartilhar do Android (`share_target` no manifest → POST `./share` → cache `qsv-share` → `./?shared=1`, lido em `src/main.js`). `public/_headers` tem cache e CSP para o Cloudflare Pages (hash do script inline calculado no build).
- `reference/quetzal-viewer.html`: protótipo original (só referência; não é usado no build).

## Regras do projeto

- **Não chutar.** O que não foi confirmado em save aparece como "não lido" ou "provável" na UI e nas exportações. Ao confirmar algo, atualizar este arquivo.
- Nomes de espécies, golpes, itens e habilidades ficam **em inglês** (o jogo PT-BR também usa inglês para eles; o Showdown exige). A interface é em português.
- Nada de marcas, logos ou assets de UI extraídos dos jogos. Sprites vêm do repositório PokeAPI/sprites por URL.
- Sem `window.claude`; downloads via Blob + `<a download>`.

---

## Gen 3 oficial (Emerald, FireRed/LeafGreen, Ruby/Sapphire) — formato público

Implementado a partir da documentação pública (Bulbapedia/PKHeX) e conferido com saves reais de Emerald e FireRed (os stats salvos de toda a equipe batem com a fórmula, o que valida criptografia, tabelas e natureza/IV/EV):

- 2 slots de **14 setores**; checksum por seção com tamanhos próprios (0: 0xF2C, 4: 0xF08, 13: 0x7D0, demais 0xF80; Ruby/Sapphire mudam as seções 0 e 4, aceitas também).
- Equipe na seção 1: Emerald/Ruby/Sapphire em `0x234` (contagem) / `0x238`; FireRed/LeafGreen em `0x34` / `0x38`. O jogo é identificado pela posição em que os checksums dos Pokémon batem; Ruby/Sapphire × Emerald pelo valor em `0xAC` da seção 0 (0 = Ruby/Sapphire).
- PC: seções 5–13 concatenadas (8 × 3968 + 2000 bytes): caixa atual (u32), 420 Pokémon de 80 bytes, nomes das 14 caixas em `0x8344`.
- Natureza = PID % 25; shiny pela fórmula (TID ^ SID ^ PID alto ^ PID baixo) < 8; gênero pelo byte baixo do PID contra a taxa da espécie; habilidade pelo bit 31 da palavra de IVs; nível do PC pela curva de experiência da espécie.
- O save guarda a **numeração interna** da Gen 3 (Treecko = 277); a tabela `gen3.json` converte para a Dex Nacional (sprites, evoluções, nomes).

## Formato do save (Quetzal)

Arquivo de 128 KB (0x20000) = 2 slots × 16 setores de 4 KB (0x1000).

### Setores — CONFIRMADO

| Offset no setor | Tamanho | Campo |
|---|---|---|
| 0x000–0xFF3 | 0xFF4 | dados |
| 0xFF4 | u16 | section ID (0–15) |
| 0xFF6 | u16 | checksum |
| 0xFF8 | u32 | assinatura `0x08012025` |
| 0xFFC | u32 | save index |

- Slot válido = o de maior save index (no save de referência: 80 contra 79).
- Os setores podem estar em qualquer ordem física; o section ID diz qual é qual.
- Checksum: soma dos u32 LE dos **0xFF4** bytes de dados (para todas as seções), depois `(sum >> 16) + (sum & 0xFFFF)` truncado a 16 bits. Conferido em todas as 32 seções do save de referência. O parser prefere o slot mais recente com checksums íntegros.

### Seção 0 (treinador) — CONFIRMADO

| Offset | Tipo | Campo |
|---|---|---|
| 0x00 | 7 bytes texto | nome |
| 0x0A | u16 | TID |
| 0x0C | u16 | SID |

### Texto

Charset Gen 3 ocidental (`0xBB`=A, `0xD5`=a, `0xA1`=0, `0x00`=espaço, `0xFF`=fim). Ver `charset.js`. **Hipótese**: a tradução PT-BR pode usar códigos próprios para letras acentuadas (ã, õ...); ainda não testado com um apelido acentuado.

### Seção 1 (equipe) — CONFIRMADO salvo indicação

Contagem em `0x6A4` (u8). Registros a partir de `0x6A8`, **104 bytes (0x68), sem criptografia**.

| Offset | Tipo | Campo | Status |
|---|---|---|---|
| 0x00 | u32 | PID | confirmado |
| 0x04 | u32 | OT ID (TID baixo, SID alto) | confirmado |
| 0x08 | 10 bytes | apelido | confirmado |
| 0x13 | u8 | flags: bit 3 (`0x08`) = **shiny**; bit 1 sempre 1 (desconhecido) | confirmado (3 shinys — Serperior, Tyranitar, Scorbunny, todos conferidos no jogo pelo autor — e 9 não shinys) |
| 0x14 | 7 bytes | nome do OT | confirmado |
| 0x23 | u16 (desalinhado) | provável **HP atual**: igual ao HP máximo em todos os Pokémon vistos (todos com HP cheio) | provável |
| 0x28 | u16 | espécie | confirmado |
| 0x2A | u16 | item | confirmado |
| 0x2C | u32 | experiência | confirmado |
| 0x30 | u8 | `0xFF` em todos | desconhecido |
| 0x31 | u8 | amizade (0 em Pokémon recém-tirados do PC, que não guarda amizade) | confirmado |
| 0x32 | u8 | **Poké Ball** (enum `PokeBall` do expansion) | confirmado (6 Pokémon cruzados com o PC) |
| 0x34 | 4×u16 | golpes | confirmado |
| 0x3C | 4×u8 | PP | confirmado (ver observação) |
| 0x40 | 6×u8 | EVs HP/Atk/Def/Spe/SpA/SpD | confirmado |
| 0x50 | u32 | IVs, 5 bits cada, mesma ordem | confirmado |
| 0x54 | u32 | bits 28–29 = **número da habilidade** (0 = 1ª, 1 = 2ª, 2 = oculta). Bit 30 sempre 1 (desconhecido); demais bits 0 nos saves vistos | confirmado (6 habilidades conferidas no jogo + 6 Pokémon cruzados com o PC) |
| 0x58 | u8 | nível | confirmado |
| 0x59 | u8 | `0xFF` em todos (mail?) | desconhecido |
| 0x5A | 6×u16 | stats HP/Atk/Def/Spe/SpA/SpD | confirmado |
| 0x66 | u16 | varia (`0000`, `2202`, `1111`); não é o HP atual | desconhecido |

- **Natureza = (PID & 0xFF) % 25** (o byte baixo do PID, não o PID inteiro). O jogo monta o PID como `225 + natureza` nos machos e `256 + natureza` nas fêmeas. Conferido em 12 Pokémon; explica o caso do Serperior (PID `0x1F0`: PID % 25 daria Gentle, o byte baixo dá Modest, a natureza mostrada no jogo) e do Tyranitar (`0x10F`). Por segurança o app ainda confere a natureza contra os stats salvos (`pidNature` fica `null` em todos os saves vistos).
- **Gênero** = regra da geração 3: fêmea se `(PID & 0xFF)` for menor que o limite da espécie (taxa de fêmeas em oitavos → 31, 63, 127, 191, 223); espécies sem gênero ou de gênero fixo seguem a espécie. Conferido: Tyranitar fêmea (`0x0F` < 127) e 11 machos.
- **Stats** = fórmula padrão das gerações 3+ com os stats base oficiais (PokeAPI): reproduz exatamente os stats salvos de todas as espécies vistas na equipe.
- **HP atual**: provavelmente o u16 em `0x23` (ver tabela); falta um save com um Pokémon ferido para confirmar. A UI mostra só o HP máximo.
- Observação: todos os PP observados (equipe e PC) estão no máximo com 3 PP Ups (ex.: Tackle 56 = 35 × 1,6), até em Pokémon recém-capturados. Pode ser regra do Quetzal; não confirmado se o campo é o PP atual.

### Seções 5–15 (PC) — CONFIRMADO salvo indicação

Concatenar os 0xFF4 bytes de dados de cada seção, em ordem de section ID (44 924 bytes no total).

| Offset | Campo | Status |
|---|---|---|
| 0x000 | caixa atual (u8) | provável |
| 0x001 | nomes das caixas, 9 bytes cada, espaço para 67 | confirmado ("BOX1".."BOX67" no save de referência) |
| 0x25C | 67 bytes de wallpaper (0,1,2,3 repetindo) | provável |
| 0x461 | Pokémon, **38 bytes cada**, 30 por caixa, **37 caixas** | confirmado |

O jogo mostra **37 caixas** (confirmado pelo autor): 1 110 registros, até 0x461 + 1110×38 = 0xA917. Os 1 623 bytes seguintes da área do PC não foram investigados. Os nomes de caixa têm espaço para 67, mas só os 37 primeiros são usados.

Registro de 38 bytes. Bits contados em little-endian a partir do byte 0 (bit *n* = bit `n % 8` do byte `n / 8`):

| Bits | Largura | Campo | Status |
|---|---|---|---|
| 0–10 | 11 | espécie | confirmado |
| 11–20 | 10 | item | confirmado |
| 21–37 | 17 | **experiência ÷ 10** | confirmado (6 Pokémon cruzados com a equipe) |
| 38–43 | 6 | **Poké Ball** (enum `PokeBall`: 1 Poké, 2 Great, 3 Ultra, 5 Premier conferidos no jogo; 25 = **Radiant Ball**, própria do Quetzal). Bit 43 sempre 0; a largura pode ser 5 | confirmado |
| 44 | 1 | **shiny** | confirmado (os shinys da BOX1, e só eles; o Serperior levado da equipe também tem o bit, igual ao bit 3 de `0x13` da equipe) |
| 45–47 | 3 | desconhecido | pendente |
| 48–87 | 4×10 | golpes | confirmado |
| 88–123 | 6×6 | **EVs ÷ 4**, ordem HP/Atk/Def/Spe/SpA/SpD | confirmado (6 Pokémon) |
| 124–153 | 6×5 | IVs, mesma ordem | confirmado (6 Pokémon) |
| 154–159 | 6 | desconhecido (só o Arcanine tem um bit ligado: 155) | pendente |
| 160 | 1 | **fêmea** (1) / macho (0). Ignorado em espécies sem gênero ou de gênero fixo (o Golett, sem gênero, tem 1); o app usa a taxa de gênero da espécie (PokeAPI) nesses casos | confirmado (12 Pokémon: 6 machos e 6 fêmeas) |
| 161–165 | 5 | natureza (0–24, mesma ordem) | confirmado (8 Pokémon cruzados com a equipe, inclusive o Serperior: Modest) |
| 166–167 | 2 | número da habilidade (0/1/2), igual a `0x54` da equipe | confirmado (6 Pokémon + sets coerentes) |
| 168–191 | 24 | desconhecido | pendente |
| bytes 24–27 | | PP dos 4 golpes | confirmado |
| bytes 28–37 | | apelido (vazio = usar nome da espécie) | confirmado |

- "Cruzado" = Pokémon que aparece na equipe de um save e no PC de outro (Lucario, Basculegion, Arcanine, Baxcalibur, Corviknight, Rillaboom): item, exp, natureza, habilidade, IVs e EVs batem exatamente. O teste `equipe → PC` cobre isso.
- O registro do PC **não tem** PID, OT, amizade nem stats. O app calcula os stats pela mesma fórmula (nos 6 Pokémon cruzados, os stats calculados no PC são iguais aos salvos na equipe).
- **Nível**: não é guardado; vem da experiência. Todos os Pokémon nível 100 vistos (inclusive espécies "Slow", como Dragonite e Baxcalibur, e "Medium Fast", como Basculegion) têm exatamente 1 059 860 de exp, o máximo da curva **Medium Slow**: o Quetzal usa essa curva para todas as espécies. **Confirmado** no jogo pelo autor com níveis calculados do PC (Scizor 59, Blaziken 92, Pelipper 26).
- EVs ÷ 4: o PC só guarda múltiplos de 4.
- Com 11 bits, o PC só representa espécies até 2047.

### IDs

- **Espécies 1–905** = Dex Nacional (nomes e tipos da PokeAPI).
- **Espécies > 905** = numeração própria do Quetzal (formas regionais, Gen 9). Mapeadas à mão em `src/data/quetzal-overrides.json`, todas como "provável" por enquanto:

  | ID | Espécie | Evidência |
  |---|---|---|
  | 951 | Raichu (Alola) | **confirmado no jogo** (o save também tem Raichu comum, 26) |
  | 973 | Weezing (Galar) | **confirmado no jogo** |
  | 1210 | Basculegion | **confirmado no jogo** (macho/fêmea não determinado) |
  | 1224 | Arcanine (Hisui) | **confirmado no jogo** |
  | 1308 | Annihilape | **confirmado pelo autor** |
  | 1327 | Baxcalibur | **confirmado pelo autor** |
  | 1469 | Pikachu "estilo Red" (boné branco/vermelho e jaqueta vermelha) | confirmado no jogo; forma própria do Quetzal, sem sprite na PokeAPI (silhueta) |

  **Hipótese a testar**: Annihilape (Nacional 979) = 1308 e Baxcalibur (998) = 1327 (ambos confirmados) → a Gen 9 pode estar em `Nacional + 329`. Falta um terceiro Pokémon da Gen 9 para testar; não aplicada no código.
- **Golpes e itens** = enums do `rh-hideout/pokeemerald-expansion` (master). Golpes validados pelo autor. Itens **conferidos até 510** (Pretty Feather 156, Charizardite Y 294, Scizorite 309, Blazikenite 314, Aloraichium Z 389, Miracle Seed 429, Choice Band 442, Leftovers 472, Life Orb 479, Assault Vest 503, Heavy-Duty Boots 510 — os dois últimos dados no jogo de propósito pelo autor). Entre 511 e 828 o nome do master é usado como "provável" (`itemsVerifiedUpTo` = 510).
- **Itens ≥ 829 divergem do master** (confirmado no jogo): Raichunite Y = 860 (master 859), Lucarionite Z = 865 (master 864), Golisopite = 871 (master 868), Baxcalibrite = 877 (master 871). O deslocamento é −1 até pelo menos o 865 e depois cresce (o Quetzal tem itens extras entre Lucarionite Z e Golisopite, e entre Golisopite e Baxcalibrite). Como Raichunite Y já está deslocada, o deslocamento começa em algum ponto entre **511 e 860**, possivelmente antes de 829; por isso a faixa 511–828 fica como "provável". A partir de `itemsDivergeFrom` (829), itens sem override aparecem como não mapeados. Para fechar: conferir no jogo um item entre 511 e 828 (ex.: uma berry como Lum 522/Sitrus 523, ou Tera Shards ~780).
- **Habilidades**: o save guarda só o número (1ª/2ª/oculta). O nome vem da tabela da espécie (PokeAPI, `pokemon_abilities.csv`). Se o slot estiver vazio, vale a primeira habilidade existente (como no expansion). Conferido com as 6 habilidades da equipe informadas pelo autor.

## Pendências de engenharia reversa

Resolvidas: habilidade da equipe (`0x54`), item/exp/natureza/IVs/EVs/habilidade no PC, número de caixas (37), curva de nível (Medium Slow para todas as espécies), Poké Ball (equipe e PC), shiny e gênero (PC e equipe), natureza da equipe pelo byte baixo do PID (fim da "natureza trocada"), Annihilape e Baxcalibur.

1. Tabela de itens: achar onde começa o deslocamento (faixa 511–860) e mapear os itens ≥ 829.
2. Tabela de espécies > 905 (hipótese Gen 9 = Nacional + 329: precisa de um terceiro Pokémon da Gen 9).
3. PC: bits 45–47, 154–159 e 168–191 (candidatos: local/nível de captura; precisa de um Pokémon recém-capturado).
4. Equipe: confirmar o HP atual em `0x23` (precisa de um Pokémon ferido); significado de `0x59`, `0x66`, do bit 1 de `0x13` e do bit 30 de `0x54`.

Método: saves pareados com uma única mudança no jogo + `tools/diff-saves.mjs`.
