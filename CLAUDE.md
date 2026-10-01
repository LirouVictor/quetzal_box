# Quetzal Save Viewer

Site estático (Vite + JS puro) que lê saves `.sav` de **Pokémon Quetzal** (ROM hack de GBA sobre pokeemerald com engine expandida), mostra treinador, equipe e PC e exporta CSV / Showdown / JSON. Tudo roda no navegador; nada é enviado a servidor. Alvo principal: Chrome no Android em aparelho de entrada (Redmi Note 11), então **leveza é requisito**: sem framework, sem dependências de runtime, renderizar só o que está visível (uma caixa do PC por vez), sem efeitos caros de CSS.

## Comandos

- `npm run dev` / `npm run build` (saída em `dist/`) / `npm run preview`
- `npm test`: Vitest. Os testes sintéticos sempre rodam; os do save real (`test/parser.fixture.test.js`) só rodam se existirem `fixtures/PokemonQuetzalPtBrAlpha9v0.sav` e `fixtures/PokemonQuetzalPtBrAlpha9v0-pc.sav` (Lucario e Basculegion movidos para a BOX1, posições 21 e 23), ou `QUETZAL_SAVE` / `QUETZAL_SAVE_PC`. **Saves reais não são versionados** (`.gitignore`).
- `npm run tables`: regenera `src/data/*.json` a partir do pokeemerald-expansion e dos CSVs da PokeAPI (precisa de rede). Os JSON são versionados; o build não acessa rede.
- `npm run diff-saves -- a.sav b.sav`: compara dois saves para engenharia reversa (ver `tools/`).

## Estrutura

- `src/parser/save.js`: leitura crua (só números/textos). Offsets em constantes exportadas (`PARTY`, `PC`, ...).
- `src/parser/describe.js`: resolve nomes, tipos, natureza, habilidade, nível (pela exp) e marca a confiança de cada dado.
- `src/parser/charset.js`: tabela de caracteres Gen 3.
- `src/export.js`: CSV (BOM + `;`, padrão do Excel pt-BR), Showdown, JSON.
- `src/data/`: tabelas geradas + `quetzal-overrides.json` (manual: IDs próprios do Quetzal e exceções de item).
- `src/ui/`, `src/main.js`, `src/styles/`: interface.
- `src/sw-template.js` vira `dist/sw.js` no build (plugin em `vite.config.js` injeta a lista de precache). `public/_headers` tem cache e CSP para o Cloudflare Pages (hash do script inline calculado no build).
- `reference/quetzal-viewer.html`: protótipo original (só referência; não é usado no build).

## Regras do projeto

- **Não chutar.** O que não foi confirmado em save aparece como "não lido" ou "provável" na UI e nas exportações. Ao confirmar algo, atualizar este arquivo.
- Nomes de espécies, golpes, itens e habilidades ficam **em inglês** (o jogo PT-BR também usa inglês para eles; o Showdown exige). A interface é em português.
- Nada de marcas, logos ou assets de UI extraídos dos jogos. Sprites vêm do repositório PokeAPI/sprites por URL.
- Sem `window.claude`; downloads via Blob + `<a download>`.

---

## Formato do save

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
| 0x14 | 7 bytes | nome do OT | confirmado |
| 0x28 | u16 | espécie | confirmado |
| 0x2A | u16 | item | confirmado |
| 0x2C | u32 | experiência | confirmado |
| 0x31 | u8 | amizade | confirmado |
| 0x34 | 4×u16 | golpes | confirmado |
| 0x3C | 4×u8 | PP | confirmado (ver observação) |
| 0x40 | 6×u8 | EVs HP/Atk/Def/Spe/SpA/SpD | confirmado |
| 0x50 | u32 | IVs, 5 bits cada, mesma ordem | confirmado |
| 0x54 | u32 | bits 28–29 = **número da habilidade** (0 = 1ª, 1 = 2ª, 2 = oculta). Bit 30 sempre 1 (desconhecido); demais bits 0 nos saves vistos | confirmado (6 habilidades conferidas no jogo + 6 Pokémon cruzados com o PC) |
| 0x58 | u8 | nível | confirmado |
| 0x59 | u8 | `0xFF` em todos (mail?) | desconhecido |
| 0x5A | 6×u16 | stats HP/Atk/Def/Spe/SpA/SpD | confirmado |
| 0x66 | u16 | varia (`0000`, `2202`, `1111`); não é o HP atual | desconhecido |

- Natureza = PID % 25 (conferida contra os stats).
- **HP atual não foi encontrado** no registro; a UI mostra só o HP máximo.
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
| 38–47 | 10 | desconhecido | pendente |
| 48–87 | 4×10 | golpes | confirmado |
| 88–123 | 6×6 | **EVs ÷ 4**, ordem HP/Atk/Def/Spe/SpA/SpD | confirmado (6 Pokémon) |
| 124–153 | 6×5 | IVs, mesma ordem | confirmado (6 Pokémon) |
| 154–160 | 7 | desconhecido (bit 160 = 1 em vários Pokémon selvagens) | pendente |
| 161–165 | 5 | natureza (0–24, mesma ordem de PID % 25) | confirmado (6 Pokémon) |
| 166–167 | 2 | número da habilidade (0/1/2), igual a `0x54` da equipe | confirmado (6 Pokémon + sets coerentes) |
| 168–191 | 24 | desconhecido | pendente |
| bytes 24–27 | | PP dos 4 golpes | confirmado |
| bytes 28–37 | | apelido (vazio = usar nome da espécie) | confirmado |

- "Cruzado" = Pokémon que aparece na equipe de um save e no PC de outro (Lucario, Basculegion, Arcanine, Baxcalibur, Corviknight, Rillaboom): item, exp, natureza, habilidade, IVs e EVs batem exatamente. O teste `equipe → PC` cobre isso.
- O registro do PC **não tem** PID, OT, amizade nem stats. Os stats são recalculados pelo jogo ao tirar da caixa.
- **Nível**: não é guardado; vem da experiência. Todos os Pokémon nível 100 vistos (inclusive espécies "Slow", como Dragonite e Baxcalibur, e "Medium Fast", como Basculegion) têm exatamente 1 059 860 de exp, que é o máximo da curva **Medium Slow**. Hipótese adotada: o Quetzal usa Medium Slow para todas as espécies. Os níveis calculados assim são plausíveis (Machop 5, Charmander 7, Pelipper 26), mas ainda não foram conferidos no jogo.
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
  | 1308 | Annihilape | apelido padrão + Rage Fist |
  | 1327 | Baxcalibur | apelido padrão + Glaive Rush |
  | 1469 | Pikachu de boné vermelho | confirmado no jogo; qual boné, não determinado (sem sprite) |

  **Hipótese a testar**: Annihilape (Nacional 979) = 1308 e Baxcalibur (998) = 1327 → a Gen 9 pode estar em `Nacional + 329`. Não aplicada no código.
- **Golpes e itens** = enums do `rh-hideout/pokeemerald-expansion` (master). Golpes validados pelo autor; itens conferidos até 479 (Scizorite 309, Blazikenite 314, Charizardite Y 294, Aloraichium Z 389, Miracle Seed 429, Choice Band 442, Leftovers 472, Life Orb 479 — todos coerentes com quem segura).
- **Itens ≥ 829 divergem do master.** A partir do bloco de megapedras de Legends Z-A (829 = Clefablite no master), a ordem do Quetzal é outra e a diferença cresce: Raichu segura 860 (master: Raichunite X/Y = 858/859), Lucario 865 (Lucarionite Z = 864), Golisopod 871 (Golisopite = 868), Baxcalibur 877 (Baxcalibrite = 871). O código marca itens a partir de `itemsDivergeFrom` (829) como não mapeados, exceto os registrados à mão em `quetzal-overrides.json` como "provável". Entre 480 e 828 ainda não houve conferência.
- **Habilidades**: o save guarda só o número (1ª/2ª/oculta). O nome vem da tabela da espécie (PokeAPI, `pokemon_abilities.csv`). Se o slot estiver vazio, vale a primeira habilidade existente (como no expansion). Conferido com as 6 habilidades da equipe informadas pelo autor.

## Pendências de engenharia reversa

Resolvidas: habilidade da equipe (`0x54`), item/exp/natureza/IVs/EVs/habilidade no PC, número de caixas (37).

1. Confirmar no jogo alguns níveis do PC calculados pela curva Medium Slow.
2. Tabela de itens ≥ 829 (pedir ao autor o nome dos itens segurados por Raichu, Lucario, Golisopod e Baxcalibur) e conferir a faixa 480–828.
3. Tabela de espécies > 905 (hipótese Gen 9 = Nacional + 329 ainda não testada).
4. PC: bits 38–47, 154–160 e 168–191 (candidatos: gênero, shiny, Poké Ball, local/nível de captura, amizade).
5. HP atual da equipe; significado de `0x59`, `0x66` e do bit 30 de `0x54`.

Método: saves pareados com uma única mudança no jogo + `tools/diff-saves.mjs`.
