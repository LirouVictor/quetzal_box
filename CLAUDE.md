# Quetzal Save Viewer

Site estático (Vite + JS puro) que lê saves `.sav` de **Pokémon Quetzal** (ROM hack de GBA sobre pokeemerald com engine expandida), mostra treinador, equipe e PC e exporta CSV / Showdown / JSON. Tudo roda no navegador; nada é enviado a servidor. Alvo principal: Chrome no Android em aparelho de entrada (Redmi Note 11), então **leveza é requisito**: sem framework, sem dependências de runtime, renderizar só o que está visível (uma caixa do PC por vez), sem efeitos caros de CSS.

## Comandos

- `npm run dev` / `npm run build` (saída em `dist/`) / `npm run preview`
- `npm test`: Vitest. Os testes sintéticos sempre rodam; os do save real (`test/parser.fixture.test.js`) só rodam se existir `fixtures/PokemonQuetzalPtBrAlpha9v0.sav` (ou `QUETZAL_SAVE=/caminho`). **Saves reais não são versionados** (`.gitignore`).
- `npm run tables`: regenera `src/data/*.json` a partir do pokeemerald-expansion e dos CSVs da PokeAPI (precisa de rede). Os JSON são versionados; o build não acessa rede.
- `npm run diff-saves -- a.sav b.sav`: compara dois saves para engenharia reversa (ver `tools/`).

## Estrutura

- `src/parser/save.js`: leitura crua (só números/textos). Offsets em constantes exportadas (`PARTY`, `PC`, ...).
- `src/parser/describe.js`: resolve nomes, tipos, natureza e marca a confiança de cada dado.
- `src/parser/charset.js`: tabela de caracteres Gen 3.
- `src/export.js`: CSV (BOM + `;`, padrão do Excel pt-BR), Showdown, JSON.
- `src/data/`: tabelas geradas + `quetzal-overrides.json` (manual: IDs próprios do Quetzal e exceções de item).
- `src/ui/`, `src/main.js`, `src/styles/`: interface.
- `public/sw.js` é gerado no build pelo plugin em `vite.config.js` (lista de precache).
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
| 0x54 | u32 | **desconhecido**; valores vistos: `0x40000000`, `0x50000000` e (no slot 79) `0x60000000`. Hipótese: bits 28–29 = número da habilidade (0/1/2 = 1ª/2ª/oculta), bit 30 sempre 1 | pendente |
| 0x58 | u8 | nível | confirmado |
| 0x59 | u8 | `0xFF` em todos (mail?) | desconhecido |
| 0x5A | 6×u16 | stats HP/Atk/Def/Spe/SpA/SpD | confirmado |
| 0x66 | u16 | varia (`0000`, `2202`, `1111`); não é o HP atual | desconhecido |

- Natureza = PID % 25 (conferida contra os stats).
- **HP atual não foi encontrado** no registro; a UI mostra só o HP máximo.
- Observação: todos os PP observados (equipe e PC) estão no máximo com 3 PP Ups (ex.: Tackle 56 = 35 × 1,6), até em Pokémon recém-capturados. Pode ser regra do Quetzal; não confirmado se o campo é o PP atual.

### Seções 5–15 (PC) — parcialmente confirmado

Concatenar os 0xFF4 bytes de dados de cada seção, em ordem de section ID (44 924 bytes no total).

| Offset | Campo | Status |
|---|---|---|
| 0x000 | caixa atual (u8) | provável |
| 0x001 | nomes das caixas, 9 bytes cada, 67 caixas | confirmado (todas "BOX1".."BOX67" no save de referência) |
| 0x25C | 67 bytes de wallpaper (0,1,2,3 repetindo) | provável |
| 0x461 | Pokémon, **38 bytes cada**, 30 por caixa | confirmado |

**Capacidade: problema em aberto.** 0x461 + 67×30×38 = 77 501 bytes, mas a área tem 44 924, que só comporta 1 152 Pokémon (38,4 caixas). O parser lê até onde cabe e avisa. Precisa confirmar quantas caixas o jogo realmente mostra e onde ficam as demais.

Registro de 38 bytes (bits contados em little-endian a partir do byte 0):

| Bits / bytes | Campo | Status |
|---|---|---|
| bits 0–10 | espécie (11 bits) | confirmado |
| bits 11–47 | **desconhecido** (nível/exp, item, natureza...?) | pendente |
| bits 48, 58, 68, 78 | golpes, 10 bits cada | confirmado |
| bits 88–191 | **desconhecido** (IVs, EVs, habilidade...?) | pendente |
| bytes 24–27 | PP dos 4 golpes | confirmado |
| bytes 28–37 | apelido (vazio = usar nome da espécie) | confirmado |

Nota: com 11 bits, o PC só representa espécies até 2047.

### IDs

- **Espécies 1–905** = Dex Nacional (nomes e tipos da PokeAPI).
- **Espécies > 905** = numeração própria do Quetzal (formas regionais, Gen 9). Mapeadas à mão em `src/data/quetzal-overrides.json`, todas como "provável" por enquanto:

  | ID | Espécie | Evidência |
  |---|---|---|
  | 951 | Raichu (Alola) | apelido padrão + Psychic |
  | 973 | Weezing (Galar) | apelido padrão + Fairy Wind |
  | 1210 | Basculegion | apelido padrão + Wave Crash / Last Respects |
  | 1224 | Arcanine (Hisui) | apelido padrão + Head Smash |
  | 1308 | Annihilape | apelido padrão + Rage Fist |
  | 1327 | Baxcalibur | apelido padrão + Glaive Rush |
  | 1469 | Pikachu (forma ?) | apelido padrão |

  **Hipótese a testar**: Annihilape (Nacional 979) = 1308 e Baxcalibur (998) = 1327 → a Gen 9 pode estar em `Nacional + 329`. Não aplicada no código.
- **Golpes, itens e habilidades** = enums do `rh-hideout/pokeemerald-expansion` (master). Validado pelo autor no save de referência (o gerador reproduz as tabelas do protótipo). **Exceção**: item 865 no Lucario é provavelmente Lucarionite (no master, 865 é outro item e Lucarionite é 334) — mapeado em `quetzal-overrides.json`. Isso sugere que a numeração de itens do Quetzal diverge do master a partir de algum ponto alto; itens altos (megapedras etc.) merecem desconfiança.

## Pendências de engenharia reversa

1. Habilidade na equipe (`0x54`).
2. PC: nível/exp, item, natureza, IVs, EVs, habilidade nos bits 11–47 e 88–191.
3. Tabela de espécies > 905.
4. Capacidade do PC (67 nomes × 38,4 caixas que cabem).
5. HP atual da equipe; significado de `0x59` e `0x66`.

Método: saves pareados com uma única mudança no jogo + `tools/diff-saves.mjs`.
