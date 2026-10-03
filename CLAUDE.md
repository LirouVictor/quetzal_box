# savDex

Site estático (Vite + JS puro) que lê saves de GBA — **Pokémon Quetzal** (ROM hack sobre pokeemerald com engine expandida), **Pokémon Unbound** (ROM hack de FireRed com o motor CFRU), os **jogos oficiais da Gen 3** (Emerald, FireRed/LeafGreen, Ruby/Sapphire) e os de **DS** (HeartGold/SoulSilver, Black/White) —, mostra treinador, equipe e PC e exporta CSV / Showdown / JSON. Aceita `.sav` e exports do GameShark/SharkPort (`.sps`) e do Action Replay DS (`.duc`). Tudo roda no navegador; nada é enviado a servidor. Alvo principal: Chrome no Android em aparelho de entrada (Redmi Note 11), então **leveza é requisito**: sem framework, sem dependências de runtime, renderizar só o que está visível (uma caixa do PC por vez), sem efeitos caros de CSS.

## Comandos

- `npm run dev` / `npm run build` (saída em `dist/`) / `npm run preview`
- `npm test`: Vitest. Os testes sintéticos sempre rodam; os do save real (`test/parser.fixture.test.js`) só rodam se existirem `fixtures/PokemonQuetzalPtBrAlpha9v0.sav` e `fixtures/PokemonQuetzalPtBrAlpha9v0-pc.sav` (Lucario e Basculegion movidos para a BOX1, posições 21 e 23) e, opcional, `fixtures/PokemonQuetzalPtBrAlpha9v0-3.sav` (Tyranitar e Scorbunny shinys na equipe, Serperior no PC), ou `QUETZAL_SAVE` / `QUETZAL_SAVE_PC` / `QUETZAL_SAVE_3`. **Saves reais não são versionados** (`.gitignore`).
- `npm run tables`: regenera `src/data/*.json` a partir do pokeemerald-expansion e dos CSVs da PokeAPI (precisa de rede). Os JSON são versionados; o build não acessa rede.
- `npm run dex`: regenera `src/data/dex.json` (linhas evolutivas com o método em português e em inglês e golpes por nível do jogo oficial mais recente; golpes ligados aos IDs do expansion pelo nome). Carregado sob demanda ao abrir o detalhe de um Pokémon; aparece como "provável" (o Quetzal pode ter mudado).
- `npm run gen3`: regenera `src/data/gen3.json` (tabelas da Gen 3 oficial a partir do decomp pret/pokeemerald + nomes da PokeAPI).
- Saves reais da Gen 3 para os testes (opcionais, não versionados): `fixtures/emerald.sav` e `fixtures/firered.sav`.
- `npm run nds`: regenera `src/data/nds.json` (itens da Gen 4 e da Gen 5, habilidades, tipos/stats e golpes como eram na época, formas; tudo da PokeAPI). Saves reais para os testes (opcionais): `fixtures/hgss.duc` e `fixtures/bw.duc`.
- `npm run unbound`: regenera `src/data/unbound.json` (tabelas do Unbound 2.1; ver a seção do Unbound). Saves reais para os testes (opcionais): `fixtures/unbound-a.sav` e `fixtures/unbound-b.sav`. Tudo em `fixtures/` fica fora do git.
- `npm run diff-saves -- a.sav b.sav`: compara dois saves para engenharia reversa (ver `tools/`).

## Estrutura

- `src/parser/load.js`: **porta de entrada**. Tira o embrulho (`container.js`: SharkPort `.sps`), identifica o formato (layout de 16 setores do Quetzal ou 14 setores da Gen 3 oficial) e confere a coerência antes de mostrar qualquer coisa. Save que não bate com nenhum formato gera `SaveError` claro ("não é de um jogo suportado"), nunca dados parciais. `SUPPORTED` lista os jogos (também na tela inicial do `index.html`).
- `src/parser/save.js`: leitura crua do **Quetzal** (só números/textos). Offsets em constantes exportadas (`PARTY`, `PC`, ...).
- `src/parser/gen3.js`: leitura e descrição dos **jogos oficiais da Gen 3** (formato público: Pokémon de 80/100 bytes criptografados com PID ^ OT ID e embaralhados por PID % 24; checksums por Pokémon e por setor). Produz o mesmo formato de `describe()`; `gen3Tables()` adapta as tabelas do app (golpes 1–354 com tipo/poder da Gen 3, tabela de tipos sem Fairy).
- `src/parser/nds.js`: leitura e descrição dos **jogos de DS** (ver a seção abaixo); `nds.json` só é carregado quando o save é de DS (`isNds`). `container.js` tira o cabeçalho do Action Replay DS (`.duc`).
- `src/parser/unbound.js`: leitura e descrição do **Pokémon Unbound** (ver a seção abaixo); as tabelas (`src/data/unbound.json`) só são carregadas quando o save é do Unbound (`isUnbound` em `load.js`, `extraTables` em `app.js`).
- `src/parser/describe.js`: resolve nomes, tipos, natureza, habilidade, nível (pela exp) e marca a confiança de cada dado.
- `src/parser/stats.js`: stats pela fórmula (stats base da PokeAPI), conferência da natureza contra os stats salvos e Hidden Power. `src/parser/natures.js`: tabela de naturezas e natureza pelo PID (byte baixo).
- `src/analysis.js`: fraquezas/resistências e cobertura da equipe (tabela de tipos em `src/data/typechart.json`).
- `src/search.js`: busca e filtros sobre equipe + PC.
- `src/ai/`: assistente opcional com IA (Gemini ou Groq, à escolha; chave do usuário no `localStorage`, chamada direta do navegador; CSP libera `generativelanguage.googleapis.com` e `api.groq.com`). `gemini.js`/`groq.js` são os clientes (mesma interface), `providers.js` escolhe, `http.js` tem as peças comuns. `prompt.js` monta o pedido (sem nível; referências `E1`/`C3-12`) e confere a resposta (só referências que existem); `view.js` desenha; `index.js` é o pacote carregado sob demanda, em duas etapas: `prepareAi` monta o pedido sem enviar e a janela `#ai-confirm` mostra o que vai/não vai e o texto exato; só `sendAi` envia (a confirmação pode ser desligada em Configurações da IA). Nunca enviar o `.sav` nem dados além dos Pokémon (sem nível, EVs, PID nem dados do treinador).
- `src/demo/`: **save de demonstração** (`demo.js`, carregado só ao tocar em "Ver um save de exemplo"): monta na hora um save do Quetzal com Pokémon fictícios (só espécies/itens conferidos; stats da equipe pela fórmula) usando `quetzal-writer.js`, que também é o gerador dos testes. Nunca grava no save do usuário; o exemplo não vira "último save".
- `src/parser/charset.js`: tabela de caracteres Gen 3.
- `src/i18n.js`: idioma da interface (português padrão; inglês se o navegador não for `pt-*` ou se o usuário escolher no botão EN/PT, salvo em `localStorage` `lang`; a troca recarrega a página). `t('texto em português', { param })`: as chaves são os próprios textos em português; o dicionário inglês fica em `src/i18n/en.js`, num pacote carregado só em inglês (`loadLang()` em `main.js`, com a página escondida até trocar os textos). Textos fixos do `index.html` levam `data-i18n` (conteúdo) ou `data-i18n-attr` (atributos). **Todo texto novo da interface passa por `t()` e ganha tradução em `en.js`**; `test/i18n.test.js` confere as chaves do código e do `index.html` e desenha as telas em inglês procurando textos sem tradução. Dados do parser (gênero, confiança, `where: 'Equipe'`, evidências) ficam em português e são traduzidos na hora de mostrar/exportar. O pedido à IA também sai no idioma da interface. Nos testes (Node) o idioma é sempre português.
- `src/export.js`: CSV (BOM + `;`, padrão do Excel pt-BR), Showdown, JSON.
- `src/history/`: **O que mudou / Histórico**. Ao abrir um save (não o de exemplo), `app.js` guarda a versão no IndexedDB (`ui/store.js`, store `history`, até 30 por save, só se o conteúdo mudou: `signature()`) e compara com a versão anterior diferente (`diffSaves`: novos, saíram, evoluíram, subiram de nível, golpes novos). Cada save é identificado por jogo + TID + SID + nome (`saveKey`). O mesmo Pokémon é achado pelo PID + OT na Gen 3; no Quetzal (o PC não tem PID) pela assinatura IVs + natureza + nº da habilidade + bola + shiny + gênero, que não muda ao evoluir nem ao trocar de lugar (conferido com os saves reais: os Pokémon levados da equipe para o PC não aparecem como novos).
- `src/ui/team-image.js`: **Imagem da equipe** (PNG 1080 px num canvas, carregada sob demanda): sprites do PokeAPI (CORS liberado), fonte Silkscreen, cores de tipo lidas do CSS. Compartilhar pelo `navigator.share` (Android) ou baixar. A CSP libera `blob:` em `img-src` para a prévia.
- `src/pages/`: janelas **Privacidade**, **Termos de uso** e **Novidades** (links do rodapé `#privacidade`, `#termos`, `#novidades`; o endereço com `#` abre a janela). Textos nos dois idiomas em `content.js`, carregado só ao abrir. São janelas e não páginas `.html` porque o service worker serve a página inicial em toda navegação e o Cloudflare Pages redireciona `.html`. **Ao mudar o que o app guarda no aparelho ou envia para fora, atualizar a Privacidade** (e `UPDATED`). Cada mudança visível ganha um item em `NEWS` (pt e en); a data da mais nova também vai em `latest.js` (o rodapé marca "Novidades" até o usuário abrir).
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

## Jogos de DS (Gen 4 e Gen 5) — CONFIRMADO com saves reais de HeartGold/SoulSilver e Black

Formato público (Project Pokémon/PKHeX), conferido com 2 exports do Action Replay DS (`.duc`: cabeçalho de 500 bytes `ARDS000000000001` + 256 KB de save): checksums de todos os Pokémon (354 no HG/SS, 457 no Black) e stats salvos da equipe = fórmula com os stats base da época.

- **Pokémon** de 136 bytes (+100 de batalha na equipe da Gen 4, +84 na Gen 5): PID, checksum (soma dos u16 dos 128 bytes), 4 blocos de 32 bytes na ordem `ORDERS[((PID >> 13) & 31) % 24]`, criptografados com o gerador do jogo (semente = checksum; dados de batalha com semente = PID). Bloco A: espécie (Dex Nacional), item (numeração da geração), OT ID, exp, amizade, **habilidade (nº nacional)**, EVs. B: golpes, PP, IVs (bit 30 ovo, bit 31 apelido), byte 0x40 (bit 1 fêmea, bit 2 sem gênero, bits 3+ forma); Gen 5: **natureza** em 0x41 e habilidade oculta no bit 0 de 0x42 (Gen 4: natureza = PID % 25). C: apelido. D: OT, bola em 0x83 (HG/SS: 0x86 se preenchido). Posição vazia = PID e checksum 0.
- **HeartGold/SoulSilver**: bloco geral em `0x0` (0xF628 bytes) e caixas em `0xF700` (0x12310), cada um com rodapé de 16 bytes (contador, tamanho, `0x20060623`, CRC-16-CCITT dos dados); metades em `0x0` e `0x40000`, vale a mais nova de cada bloco. Treinador `0x64` (nome, texto da Gen 4), TID `0x74`, SID `0x76`; equipe: contagem `0x94`, Pokémon de 236 bytes em `0x98`; 18 caixas de `0x1000` a partir de `0xF700`, nomes em `0xF700 + 0x12008` (0x28 cada).
- **Black/White**: treinador em `0x19404` (UTF-16), TID `0x19414`, SID `0x19416`, versão em `0x1941F` (20 White, 21 Black, 22/23 White 2/Black 2); equipe: contagem `0x18E04`, Pokémon de 220 bytes em `0x18E08`; 24 caixas de `0x1000` a partir de `0x400`, nomes em `0x04` (0x28 cada). **Black 2/White 2**: mesmas posições (PKHeX), aberto com aviso porque ainda não foi conferido com save real. Diamond/Pearl/Platinum ainda não (posições diferentes; falta save).
- Texto da Gen 4: tabela de 16 bits própria; só os caracteres conferidos (A–Z, a–z, 0–9, espaço, `.` `’` `-` `?`), o resto vira `?` (ex.: Pokémon japoneses de evento). Gen 5: UTF-16.
- Shiny = (TID ^ SID ^ PID alto ^ PID baixo) < 8; nível do PC pela curva da espécie; tipos, stats base e golpes **da época** (`nds.json`: Clefairy Normal, Rotom-Wash Electric/Ghost na Gen 4, Charm Normal, sem Fairy); tabela de tipos da Gen 2–5 (a mesma de `gen3.json`). Formas pelo número da forma = `form_order − 1` da PokeAPI.

## Pokémon Unbound (CFRU) — CONFIRMADO com 2 saves reais da versão 2.1

Conferido com 2 saves reais (2.1.1, mesmo treinador): os stats salvos dos 8 Pokémon de equipe batem exatamente com a fórmula usando os stats base do Unbound, o que valida espécie, stats base, natureza (PID % 25), IVs e EVs. Formato e posições das caixas também conferidos com o leitor do Unbound Cloud (Skeli789/Unbound-Cloud, do autor do Unbound; sem licença declarada, usado só como referência).

- 2 slots de **14 setores** (como o FireRed). Assinatura `0x01121999` = Unbound 2.1.0–2.1.1.1 (suportado); `0x01122000` = versões seguintes (abre com aviso: as tabelas são as da 2.1, que só ganharam itens no fim nas versões novas; 31 espécies tiveram stats/habilidades ajustados); `0x01121998` = 2.0 (erro claro, não suportado). Checksum com 0xFF0 bytes (seções 0, 4 e 13: 0xF24, 0xD98, 0x450).
- Treinador na seção 0 (nome, TID `0xA`, SID `0xC`).
- **Equipe**: seção 1, contagem `0x34` (u32), Pokémon de 100 bytes em `0x38`, **sem criptografia** e com os blocos sempre na ordem Growth/Attacks/EVs/Misc (checksum 0). Poké Ball no byte 10 do bloco Growth; IVs/ovo/habilidade oculta na palavra em +4 do bloco Misc (bit 30 ovo, bit 31 oculta). Nível e stats salvos.
- **PC**: 25 caixas de Pokémon de **58 bytes** ("comprimidos", sem criptografia): PID, OT ID, apelido, OT, espécie (28), item (30), exp (32), PP Ups (36), amizade (37), bola (38), 4 golpes de 10 bits (39–43), EVs (44–49), origem (52), IVs/ovo/oculta (54). Sem PP (calculado com o PP oficial e os PP Ups) nem stats (fórmula). Caixas 1–19 nas seções 5–13 (depois da caixa atual, u32); 20–22 nos setores **físicos** 30 (`0xB0C`–`0xFF0`) e 31 (`0`–`0xF80`); 23–24 nas seções 2 (`0xF18`–`0xFF0`) e 3 (`0`–`0xCC0`); 25 na seção 0 (`0xB0`). Nomes das caixas na seção 13, `0x361`, 9 bytes cada. **Conferidos com dados**: caixas 1–7 e 25 (3 Eternatus); 20–24 estavam vazias nos saves vistos.
- Natureza = PID % 25; shiny = (TID ^ SID ^ PID alto ^ PID baixo) < **16** (1/4096); habilidade: oculta pelo bit, senão PID & 1 (1ª/2ª); gênero pelo byte baixo do PID contra a taxa da espécie; nível do PC pela curva da espécie.
- **Tabelas** (`tools/build-unbound.mjs`): espécies, Dex Nacional, stats base, tipos, habilidades, gênero e curva do Unbound vêm do branch `Unbound` do Skeli789/Dynamic-Pokemon-Expansion (WTFPL); bolas do CFRU (`catching.h`, enum começando em 0 = Master Ball); 97 itens que os cabeçalhos públicos deixam sem nome (ex.: `0x37` Life Orb, `0xB1` Choice Specs) conferidos com as tabelas do Unbound 2.1 do Unbound Cloud. Golpes ligados aos IDs do app pelo nome (tipo, poder, descrição); PP oficial da PokeAPI (o expansion difere em alguns, ex.: Night Slash). Formas pelo nome da constante (`RAICHU_A` = Raichu de Alola) e sprites pelas formas da PokeAPI; sem forma correspondente, sprite da espécie base. Leech Fang e Steely Hit são golpes próprios (só nome).

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
