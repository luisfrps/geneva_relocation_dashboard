# Geneva Relocation Dashboard — project guide

Painel pessoal de recrutamento + mudança para Genebra (MSC, alvo de início a 14-09-2026).

- Dono: **Luís** (luis.frps@gmail.com)
- Repo: https://github.com/luisfrps/geneva_relocation_dashboard (branch `main`)
- Live: https://luisfrps.github.io/geneva_relocation_dashboard (GitHub Pages, servido da raiz de `main`)
- Local: `P:\10_Personal\Applications\geneva_relocation_dashboard`

## O que é

**Uma única página estática**: [index.html](index.html) — HTML + CSS + JS inline, sem build,
sem dependências, sem servidor. Editar o ficheiro e fazer push É o deploy (Pages publica a raiz
de `main` em ~1 min).

Ao lado dela vivem só os ficheiros que a tornam instalável (PWA):
[manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js), `icon-192.png`, `icon-512.png` e
[scripts/make-icons.mjs](scripts/make-icons.mjs), que regenera os ícones (`node scripts/make-icons.mjs`).

## Instalação (PWA)

O botão «Instalar neste computador» usa o evento `beforeinstallprompt`. Quando o browser não o
dispara (Firefox, Safari, ou critérios por cumprir), o botão abre em vez disso um modal com as
instruções por browser — nunca fica um botão que não faz nada.

- **O service worker é rede-primeiro**, de propósito: o conteúdo muda muito e um cache-first
  deixava o painel preso numa versão antiga. Offline continua a funcionar com o que já foi servido.
- **Ao mudar a lista `ASSETS` do `sw.js`, sobe o `VERSION`** — é o que limpa os caches antigos.
- Instalar exige HTTPS (ou localhost) + manifest + service worker com `fetch`. O browser embutido
  do preview do Claude Code **não regista service workers** («unknown error when fetching the
  script»), por isso a instalação só se testa no browser real ou no GitHub Pages.
- O estado vive no `localStorage` da origem, e a app instalada partilha-o com o browser de onde
  foi instalada. Instalar de outro browser começa do zero — está dito no modal de ajuda.

## Estrutura do index.html

| Bloco | O que é |
|---|---|
| `<style>` | todo o CSS, minificado numa linha |
| `T[]` | o **plano por dia** — uma tarefa por objeto: `{id, d:data, p:prioridade, c:categoria, s:[fases], t:texto, w:porquê}` |
| `PHASE{}` | **ações imediatas por fase** (0..3), sem data — herdam o dia em que a fase foi selecionada |
| `PLACES[]` | separador «Services & addresses» — moradas verificadas: `{g:grupo, k:kicker, items:[{n,a:morada,c:contactos,u:url,w:para quê}]}` |
| `MAILS[]` | separador «Ready-to-send messages» — minutas: `{g,k,items:[{id,t,to,addr?,when,lang,s:assunto,b:corpo,n?:nota}]}` |
| `GUIDE[id]` | o guia de cada tarefa: `{h, hp, l?, lp?}` — explicação e checklist, EN e PT no MESMO objeto |
| `PT`, `PT_T`, `PT_PL`, `PT_M` | a tradução para português (ver secção própria) |
| funções de render | `render()` faz o plano (`renderGate/renderStats/timeline/tasks/crit`); `renderPlaces()`/`renderMails()` são chamados por `applyLang()` |

Constantes no topo do script: `START='2026-08-21'`, `TARGET='2026-09-14'` (data de início na MSC,
alimenta o contador), `END='2026-09-30'` (horizonte do plano — a burocracia de chegada não acaba no
primeiro dia de trabalho), `KEY` (localStorage). **`TARGET` e `END` são coisas diferentes**; o
contador usa `TARGET`, a timeline usa `END`.

Três separadores (`setView('Plan'|'Places'|'Mails')`, `.view.on` mostra). Só o plano tem estado;
os outros dois são referência estática com um botão de copiar (`copyMail`) e um `mailto:`.

## Modelo de fases (o coração da app)

`STAGES = ['Interview process','Verbal offer','Contract received','Contract signed']` (0..3).

- Cada tarefa de `T` declara `s:[...]` — as fases em que é relevante. `COMMON=[0,1,2,3]` = sempre.
- `active(t)` filtra o plano pela fase atual: tarefas de fases obsoletas **desaparecem**, não
  ficam a acumular atraso falso.
- Mudar de fase carimba `S.stageStarted[fase]` com o dia de hoje; as `PHASE[fase]` passam a
  contar a partir daí e transitam para a frente até serem feitas.
- Regra de negócio: nada irreversível (reservas não reembolsáveis, viagem) antes da fase 3 —
  as tarefas de execução vivem todas em `s:[3]`.

## Idioma (EN ⇄ PT)

Botão à direita dos separadores. `S.lang` (`'en'` por omissão) fica no mesmo blob do
localStorage, logo viaja no export/import. **O inglês é a fonte**: uma chave em falta cai para
inglês, nunca falha.

Quatro dicionários, cada um com a chave que dá menos hipóteses de partir:

| Dicionário | Chave | Valor |
|---|---|---|
| `PT` | a própria frase inglesa, ou um nome curto (`heroSub`, `sidePhases`, `footerTxt`) | a frase em PT |
| `PT_T` | **id da tarefa** (`'2101'`, `'g1501'`, `'phase3a'`) | `[texto, porquê]` |
| `PT_PL` | o `n` inglês da morada | `[nome, para quê, contactos, morada]` |
| `PT_M` | id da mensagem (`'m11'`) | `[título, para quem, quando, nota]` |

Acessores: `P(chave)` / `PF(chave,{v})` para interface, `TT(t)`/`TW(t)` para tarefas,
`PL(p,i,fallback)`, `MT(m,i,fallback)`.

- **HTML estático**: um atributo `data-i` marca o elemento. `data-i` vazio → a chave é o próprio
  inglês; `data-i="heroSub"` → chave explícita. No arranque, `data-k` guarda o HTML inglês
  original, e é para aí que o EN volta — por isso o inglês nunca depende do dicionário.
- **`data-i` troca `innerHTML`**, por isso nunca o ponhas num elemento que contenha um nó com
  estado (o `<input id="imp">` está fora do `<span data-i>` de propósito).
- **Frases com números** usam marcadores `{n}` e `PF()`, nunca concatenação — em PT a ordem muda.
- **As datas seguem a língua** (`loc()` → `pt-PT`/`en-GB`). Isto é só apresentação: as chaves
  `YYYY-MM-DD` do estado continuam iguais.
- **O corpo das mensagens NÃO se traduz.** Uma carta para a alfândega suíça tem de chegar em
  francês; só os metadados (título, para quem, quando, nota) mudam de língua. Está dito no ecrã.
- Ao acrescentar uma tarefa, acrescenta a entrada em `PT_T` com o mesmo id.

## Guias e checklists

Cada tarefa tem um botão «Como fazer isto» que abre um modal com a explicação e, quase sempre,
uma checklist. **Todas as 117 tarefas (105 do `T` + 12 do `PHASE`) têm guia** — verifica com
`[...T,...Object.values(PHASE).flat()].filter(t=>!GUIDE[t.id])` no console.

- `GUIDE` é a **exceção ao padrão dos outros dicionários**: PT vive no mesmo objeto (`hp`, `lp`),
  não num dicionário à parte. São 117 entradas com listas emparelhadas; separá-las garantia
  desalinhamento. `gItems()` só usa `lp` se `lp.length === l.length`, senão cai para inglês.
- `\n` no `h`/`hp` vira `<br>`. Tudo o resto é escapado.
- O estado das checkboxes é `S.sub[taskId][índice]`, no mesmo blob do localStorage.
- **O lembrete diário** é o painel «Listas por terminar» (`renderLists`): mostra toda a tarefa
  com checklist incompleta cuja data já chegou, todos os dias, independentemente do dia
  selecionado. É por isso que `openLists()` filtra por `t.d <= clamp(td())` e não por `sel`.
- Marcar a tarefa como feita **não** limpa a checklist, e completar a checklist **não** marca a
  tarefa — de propósito: uma é a intenção, a outra é o progresso.

## Estado

Tudo no browser, em `localStorage` sob a chave `genevaRelocationDashboard2026`:
`{done:{id:iso}, custom:[], stage:0..3, stageStarted:{}, lang:'en'|'pt', sub:{taskId:{i:1}}}`. Export/Import JSON (`version:3`)
nos botões da barra. **Não há backend** — mexer no formato do estado parte os backups antigos;
o `imp` handler aceita `{state}` ou o objeto direto.

## Trabalhar aqui

- Não há `npm`, testes nem build. Abrir `index.html` no browser é o ciclo completo.
- Datas são **locais**, nunca UTC: `td()` e `pd()` constroem/leem `YYYY-MM-DD` com campos locais
  de propósito — `toISOString()` daria o dia errado à noite. Não "arrumar" isto.
- **O repositório é PÚBLICO** e o GitHub Pages serve-o a quem tiver o link. Nada de nomes de
  terceiros, emails pessoais, números de telefone, moradas privadas ou detalhes de emprego neste
  ficheiro. Nas minutas usa `[nome]`, `[telefone]`. Emails institucionais (consulado, alfândega,
  `info@zentralstelle.ch`) podem ficar; o email de uma pessoa concreta não.
- **Não afirmar o que não está verificado.** Duas tarefas já mandaram o dono fazer coisas
  impossíveis — guardar um convite que nunca foi enviado, e tratar como reembolsável um custo que
  ninguém se ofereceu para pagar. Regra: uma tarefa só afirma um facto se ele estiver numa fonte
  (email, agenda) ou tiver sido dito pelo dono. Caso contrário é «confirmar X», não «fazer X».
- **Pressupostos vivem à vista**, na caixa `data-i="assum"` no topo do plano — não escondidos
  dentro do texto das tarefas. Ao acrescentar um pressuposto novo, acrescenta-o lá.
- **Tarefas condicionais ganham etiqueta automaticamente**: `cond(t)` marca as categorias
  `Vehicle`/`Travel`/`Insurance` com «SE FORES DE CARRO» e `Customs` com «SE LEVARES AS TUAS
  COISAS». Se puseres uma tarefa condicional noutra categoria, a etiqueta não aparece — mete a
  condição no próprio texto.
- **`TARGET` (14 de setembro) é um pressuposto, não um facto.** Nenhuma mensagem da MSC alguma vez
  nomeou data de início. Se surgir uma data real, muda `TARGET` e desloca as datas das tarefas.
- As tarefas são texto do dono. Ao alterar conteúdo, manter o `id` (é a chave do `done`) —
  mudar um `id` faz o utilizador perder o check dessa tarefa.
- **Os ids seguem `DDNN` (dia do mês + sequência) e por isso colidem entre agosto e setembro**:
  21 ago e 21 set dariam ambos `2101`. As tarefas de 15–30 de setembro levam prefixo `g`
  (`g1501`, `g2301`…). Ao adicionar tarefas, confirmar `new Set(T.map(t=>t.id)).size === T.length`.
- Moradas e prazos legais (OCPM 14 dias, LAMal 3 meses, matrícula 1 ano) foram verificados nas
  fontes oficiais em agosto de 2026. Não inventar uma morada: confirmar antes de a escrever.
- As minutas de email são rascunhos do dono, não aconselhamento. A do 2.º pilar diz o que a lei
  já determina (só é partilhado o que foi constituído durante o casamento) — não a transformar
  numa promessa de que resolve um partilha que o tribunal não ordenou.
- Commit + push sempre no fim do trabalho (regra permanente do dono).
