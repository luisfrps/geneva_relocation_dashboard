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

## Estrutura do index.html

| Bloco | O que é |
|---|---|
| `<style>` | todo o CSS, minificado numa linha |
| `T[]` | o **plano por dia** — uma tarefa por objeto: `{id, d:data, p:prioridade, c:categoria, s:[fases], t:texto, w:porquê}` |
| `PHASE{}` | **ações imediatas por fase** (0..3), sem data — herdam o dia em que a fase foi selecionada |
| `PLACES[]` | separador «Services & addresses» — moradas verificadas: `{g:grupo, k:kicker, items:[{n,a:morada,c:contactos,u:url,w:para quê}]}` |
| `MAILS[]` | separador «Ready-to-send messages» — minutas: `{g,k,items:[{id,t,to,addr?,when,lang,s:assunto,b:corpo,n?:nota}]}` |
| funções de render | `render()` faz o plano (`renderGate/renderStats/timeline/tasks/crit`); `renderPlaces()`/`renderMails()` correm **uma vez** no arranque |

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

## Estado

Tudo no browser, em `localStorage` sob a chave `genevaRelocationDashboard2026`:
`{done:{id:iso}, custom:[], stage:0..3, stageStarted:{}}`. Export/Import JSON (`version:3`)
nos botões da barra. **Não há backend** — mexer no formato do estado parte os backups antigos;
o `imp` handler aceita `{state}` ou o objeto direto.

## Trabalhar aqui

- Não há `npm`, testes nem build. Abrir `index.html` no browser é o ciclo completo.
- Datas são **locais**, nunca UTC: `td()` e `pd()` constroem/leem `YYYY-MM-DD` com campos locais
  de propósito — `toISOString()` daria o dia errado à noite. Não "arrumar" isto.
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
