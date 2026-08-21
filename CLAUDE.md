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

| Bloco | Onde | O que é |
|---|---|---|
| `<style>` | linha 8 | todo o CSS, minificado numa linha |
| `T[]` | ~linha 29 | o **plano por dia** — uma tarefa por objeto: `{id, d:data, p:prioridade, c:categoria, s:[fases], t:texto, w:porquê}` |
| `PHASE{}` | ~linha 95 | **ações imediatas por fase** (0..3), sem data — herdam o dia em que a fase foi selecionada |
| funções de render | ~linha 116+ | `render()` chama `renderGate/renderStats/timeline/tasks/crit` |

Constantes no topo do script: `START='2026-08-21'`, `END='2026-09-14'`, `KEY` (localStorage).

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
- Commit + push sempre no fim do trabalho (regra permanente do dono).
