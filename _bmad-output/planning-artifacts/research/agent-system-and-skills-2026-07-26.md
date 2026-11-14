---
title: Агентная система и skills для Spec-Driven Development InteriorsEditor
status: research-complete
date: 2026-07-26
updated: 2026-07-26
research_type: agent-system-and-skills
project: InteriorsEditor
source_verification: official-docs-local-skill-audit-live-skills-registry-github
---

# Агентная система и skills для Spec-Driven Development InteriorsEditor

## Резюме решения

Для InteriorsEditor рекомендуется **контролируемая гибридная система**:

- один главный агент владеет текущей целью, решениями и каноническими документами;
- до трёх узких subagents параллельно выполняют независимое read-heavy исследование или review;
- у каждого артефакта только один writer;
- subagents возвращают evidence packs, а не конкурирующие версии PRD/Architecture;
- человек утверждает product vision, Alpha scope, PRD, архитектурные invariants и readiness gate;
- после начала разработки один implementer владеет одним vertical slice, а независимый reviewer проверяет результат;
- BMAD остаётся единственным процессным spine; второй SDD-фреймворк и отдельный runtime agent orchestrator не нужны.

Single-agent режим нужен для синтеза и принятия решений. Multi-agent режим полезен для независимых исследований, поиска противоречий, тестовых матриц и adversarial review. Постоянная «команда автономных агентов», одновременно редактирующих одни документы, принесёт больше drift и конфликтов, чем пользы.

## 1. Термины: не смешивать разные сущности

| Сущность | Что это | Пример | Попадает в приложение? |
|---|---|---|---|
| **Agent** | Отдельная model session с задачей, контекстом и tools | исследователь renderer options | Нет |
| **Skill** | Повторяемый workflow: инструкции, references, optional scripts | `bmad-prd`, `planning`, `tdd` | Нет |
| **Library/package** | Runtime/build dependency, импортируемая кодом | `three`, `idb`, `vitest` | Да, если выбрана |
| **Repository** | Исходники или reference implementation | `blueprint3d-modern` | Не автоматически |
| **Plugin** | Устанавливаемый bundle skills/connectors/tools | plugin с GitHub connector | Нет, если не нужен workflow |
| **MCP/app connector** | Доступ к внешней системе или данным | GitHub, Notion, Linear | Только для агентной работы |

Официальная документация OpenAI определяет skill как пакет инструкций, ресурсов и optional scripts для повторяемого workflow; skills используют progressive disclosure и могут включаться явно или по совпадению description: [OpenAI — Build skills](https://learn.chatgpt.com/docs/build-skills). Открытый формат описан в [Agent Skills specification](https://agentskills.io/specification).

Следствие: Three.js skill не добавляет Three.js в продукт, а GitHub-репозиторий с floor planner не становится зависимостью, пока код явно не выбран и не проаудирован.

## 2. Single-agent против multi-agent

### 2.1 Подтвержденные свойства Codex

Официальная документация Codex рекомендует subagents прежде всего для параллельных read-heavy задач: exploration, tests, triage, summarization. Параллельные write-heavy задачи требуют большей осторожности из-за конфликтов и coordination overhead. Каждый subagent также расходует отдельные tokens и tools: [OpenAI Codex manual — Multi-agent operations](https://developers.openai.com/codex/codex-manual.md), [OpenAI — Subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

### 2.2 Сравнительная матрица

| Критерий | Один агент | Несколько автономных агентов | Контролируемый гибрид |
|---|---|---|---|
| Целостность vision | высокая | низкая/средняя | **высокая** |
| Скорость независимого research | низкая/средняя | высокая | **высокая** |
| Контекст канонических решений | постепенно загрязняется | фрагментирован | **централизован** |
| Риск противоречий | средний | высокий | **низкий при guardrails** |
| Конфликты файлов | низкие | высокие | **низкие: один writer** |
| Adversarial coverage | зависит от одного reasoning path | высокая | **высокая** |
| Стоимость tokens/coordination | низкая | высокая | **управляемая** |
| Аудируемость | средняя | низкая без протокола | **высокая** |
| Лучшее применение | synthesis, final decisions | массовое независимое исследование | **весь проект** |

### 2.3 Вывод

**Рекомендуется:** логически multi-role, физически controlled-hybrid.

Не нужно поддерживать шесть постоянно работающих агентов только потому, что BMAD описывает шесть ролей. BMAD roles — разные режимы мышления и ownership, а не обязательное число одновременных model sessions.

## 3. Операционная модель controlled-hybrid

### 3.1 Поток работы

```text
Human Product Owner
→ Orchestrator / Canonical Writer
→ 1–3 bounded read-only researchers in parallel
→ evidence packs
→ Orchestrator synthesis
→ independent adversarial reviewer
→ human approval gate
→ next BMAD artifact
```

### 3.2 Когда создавать subagent

Subagent оправдан, если задача:

- имеет независимый вход и проверяемый выход;
- может выполняться параллельно;
- не требует редактирования того же canonical artifact;
- возвращает источники, риски или review, а не финальное продуктовое решение.

Подходящие примеры:

- конкуренты и пользовательские сегменты;
- browser/GPU/storage research;
- topology edge cases;
- asset licensing scan;
- test matrix и threat model;
- независимый review PRD/Architecture;
- проверка package/API versions.

Не создавать subagent для:

- одного короткого решения;
- последовательного уточнения с пользователем;
- одновременного переписывания одного PRD;
- действий, требующих общего evolving context на каждом шаге;
- «делегировать всё» без bounded deliverable.

### 3.3 Стандарт subagent brief

Каждый brief должен содержать:

```yaml
objective: один конкретный вопрос
scope_in: что исследовать
scope_out: что не трогать
inputs: список канонических артефактов
write_policy: read-only | один явно назначенный файл
source_policy: primary sources first
output:
  - claims
  - evidence_links
  - confidence
  - risks
  - contradictions
  - open_questions
done_when: проверяемые условия
```

### 3.4 Guardrails

1. Не более трёх subagents одновременно до появления стабильной команды и метрик.
2. Main agent остаётся единственным владельцем user intent и окончательного ответа.
3. Один canonical artifact — один writer в каждый момент времени.
4. По умолчанию subagents read-only.
5. Параллельные writers допустимы только для разных файлов с непересекающимся scope.
6. Никакого silent merge: противоречащие выводы показываются как decision table.
7. Каждый вывод имеет `confirmed / recommended / provisional / open`.
8. Числа и актуальные версии получают ссылку и дату проверки.
9. Agent не меняет scope Alpha и архитектурные invariants без decision record.
10. Research notes не становятся требованиями автоматически; их принимает PM/Architect.
11. Implementation запрещена до BMAD readiness `READY`.
12. После readiness один implementer на vertical slice; reviewer не исправляет код в том же проходе без отдельного назначения.
13. Все `CAP-*`, `FR-*`, `NFR-*`, `AD-*` стабильны и не переиспользуются.
14. При расхождении PRD, UX, Architecture и SPEC работа останавливается на reconciliation, а не «выбирает удобный документ».

## 4. Роли и ответственность

| Роль | Основная ответственность | Может решать | Не должна делать |
|---|---|---|---|
| Human Product Owner | Vision, ценность, Alpha boundary, приоритет | Утверждать/отклонять scope и trade-offs | Делегировать агенту необратимые продуктовые решения |
| Orchestrator | Goal, context, decomposition, synthesis | Назначать bounded tasks, сводить evidence | Одновременно быть всеми независимыми reviewers |
| Analyst/Researcher | Market/domain/technical evidence | Формировать findings с confidence | Записывать finding как утверждённый FR |
| PM/Spec Owner | Product brief, PRD, Alpha scope, acceptance | Канонические requirements | Выбирать engine без Architect evidence |
| UX Owner | Mobile interaction model, states, accessibility | UX invariants и flows | Менять domain semantics |
| Architect | Architecture spine, ADR, NFR budgets | Технические invariants и boundaries | Расширять product scope |
| Asset/Import Specialist | GLB policy, pipeline, licenses, budgets | Технические import recommendations | Самостоятельно включать import в Alpha |
| QA/Performance | Test strategy, fixtures, device gates | Определять verification design | Подменять продуктовые success criteria |
| Adversarial Reviewer | Gaps, contradictions, unsafe assumptions | Findings with severity/evidence | Переписывать canonical artifact |
| Technical Writer | Index, terminology, cross-links, consistency | Структура и читабельность | Менять смысл требований без owner |
| Implementer, позже | Один approved vertical slice | Реализация в рамках story | Редактировать PRD под удобство кода |

## 5. Ownership артефактов

| Артефакт | Canonical owner | Contributors | Approval |
|---|---|---|---|
| Market/domain/technical research | Analyst | parallel researchers | Orchestrator |
| Product brief / PRFAQ | Analyst + Product Owner | PM, reviewer | Human Product Owner |
| PRD | PM | Analyst, UX, Architect | Human Product Owner |
| UX `DESIGN.md` / `EXPERIENCE.md` | UX Owner | PM, accessibility reviewer | Product Owner |
| Architecture spine / ADR | Architect | technical researchers, QA | Product Owner для trade-offs |
| SPEC kernel | PM/Architect по разделу | UX, QA | Human Product Owner |
| Epics/stories | PM | Architect, QA | Orchestrator/Product Owner |
| `project-context.md` | Architect | Tech Writer | Orchestrator |
| Readiness report | Independent Architect/Reviewer | PM, UX, QA | Human Product Owner |
| Story implementation | Один Implementer | none concurrently in same files | Reviewer |
| Code review | Independent Reviewer | QA/Architect при необходимости | Story owner после fixes |

**Правило:** contributor отдаёт patch suggestion или finding владельцу; он не становится вторым canonical writer.

## 6. Соответствие BMAD

BMAD официально разделяет Analysis, Planning, Solutioning и Implementation, а для сложного продукта рекомендует PRD + Architecture + UX. Epics/stories создаются после architecture, затем выполняется implementation-readiness check: [BMAD Getting Started](https://docs.bmad-method.org/tutorials/getting-started/), [BMAD Workflow Map](https://docs.bmad-method.org/reference/workflow-map/).

### 6.1 Фазы проекта

| Фаза | BMAD owner/skills | Результат для InteriorsEditor |
|---|---|---|
| Analysis | `bmad-agent-analyst`, `bmad-market-research`, `bmad-domain-research`, `bmad-technical-research`, `bmad-product-brief`, optional `bmad-prfaq` | research + strategic product brief |
| Planning | `bmad-agent-pm`, `bmad-prd`, `bmad-spec` | PRD, Alpha capability boundary, measurable FR/NFR |
| UX | `bmad-agent-ux-designer`, `bmad-ux` | mobile flows, states, gesture/numeric alternatives |
| Solutioning | `bmad-agent-architect`, `bmad-architecture` | architecture spine + ADR backlog |
| Decomposition | `bmad-create-epics-and-stories` | vertical slices после architecture |
| Context | `bmad-generate-project-context`, `bmad-agent-tech-writer`, `bmad-index-docs` | AI constitution, glossary, index |
| Gate | `bmad-check-implementation-readiness`, adversarial review | `READY / CONCERNS / NOT READY` |
| Implementation, не сейчас | `bmad-sprint-planning`, `bmad-create-story`, `bmad-dev-story`, `bmad-code-review` | story-by-story code only after READY |

Список стандартных BMAD agents и их workflows подтверждён официальным справочником: [BMAD — Agents](https://docs.bmad-method.org/reference/agents/).

### 6.2 Рекомендуемая последовательность документов

1. Market/domain/technical research.
2. Product brief.
3. Optional PRFAQ для stress-test ценности.
4. PRD.
5. UX spine.
6. SPEC kernel.
7. Architecture spine + spike ADRs.
8. Epics and stories.
9. Project context.
10. Implementation readiness.
11. Только после `READY` — sprint/story implementation.

Это соответствует BMAD context flow: каждый артефакт ограничивает следующий, вместо повторного изобретения решений каждым агентом.

## 7. Текущие установленные skills: аудит по фазам

Проверка выполнена по `$CODEX_HOME/skills` и project `.agents/skills` 2026-07-26. Ниже перечислены только релевантные навыки; наличие skill не означает, что его нужно активировать в каждом turn.

### 7.1 Сейчас: research и документация

| Skill | Scope | Как использовать |
|---|---|---|
| BMAD research/brief/PRD/UX/architecture skills | project | Основной process spine |
| `planning` | user | Разбивать будущую работу на vertical slices |
| `expectations` | user | ADR, gotchas, knowledge capture |
| `find-gaps` | user | Adversarial review acceptance criteria и планов |
| `diagrams` | user | Только когда схема действительно упрощает связи |
| `find-skills` | user | Редкий аудит внешнего skills ecosystem |

**Рекомендуемый минимальный набор на текущую фазу:** BMAD workflow нужного артефакта + максимум один специализированный reviewer. Не запускать `planning`, `find-gaps` и несколько BMAD writers одновременно над одним файлом.

### 7.2 Architecture/spec refinement

| Skill | Условие активации |
|---|---|
| `domain-driven-design` | После явного ADR о DDD/domain model; геометрическое ядро оправдывает применение |
| `hexagonal-architecture` | После ADR о ports/adapters; не вводить интерфейсы без boundary |
| `typescript-strict` | При создании schema/types и branded millimeter IDs |
| `api-design` | Для module contracts, importer/storage ports и versioned project schema |
| `functional` | Для pure topology/command transforms, если это подтверждает выбранный стиль |

Эти skills не должны подменять architecture decision. Их инструкции применяются **после** выбора паттерна, а не являются причиной выбрать паттерн.

### 7.3 Implementation, только после readiness

| Skill | Роль |
|---|---|
| `tdd` | Обязательный red-green-refactor workflow для code changes |
| `testing` | Domain/unit/property test design |
| `front-end-testing` | Browser behavior tests |
| `react-testing` | React component/hook patterns |
| `playwright` или `webapp-testing` | E2E/browser automation; выбирать один основной workflow на задачу |
| `fallow` | JS/TS health: dead code, duplication, cycles, complexity, boundaries |
| `characterisation-tests` / `finding-seams` | Позднее для unsafe legacy/refactoring, не для greenfield по умолчанию |

### 7.4 Review и hardening

| Skill | Когда |
|---|---|
| `build-graph` + `review-pr` | Структурный PR review после появления codebase |
| `review-delta` | Быстрый review конкретного change set |
| `test-design-reviewer` | Проверка качества тестов |
| `mutation-testing` | После стабильного быстрого unit suite, не в первом slice |
| `refactor-agent` / `refactoring` | Только behavior-preserving refactor с защитными тестами |
| `ci-debugging` | При реальном CI failure |

`fallow` должен оставаться доступным, но на документной фазе ему нечего анализировать.

## 8. Аудит внешних skills

### 8.1 Метод проверки

- install counts получены командой `npx skills find ...` 2026-07-26;
- GitHub stars получены через GitHub API 2026-07-26;
- source `SKILL.md` просмотрен до рекомендации;
- install counts и stars изменяются со временем;
- stars относятся ко всему repository, а не доказывают качество конкретного skill.

### 8.2 Результаты

| Skill | Проверенные метрики на дату среза | Аудит | Рекомендация |
|---|---:|---|---|
| [`addyosmani/agent-skills@spec-driven-development`](https://skills.sh/addyosmani/agent-skills/spec-driven-development) | 16.7K installs; [80 470 repo stars](https://api.github.com/repos/addyosmani/agent-skills) | Хороший gated flow `SPECIFY → PLAN → TASKS → IMPLEMENT`, но дублирует BMAD и ожидает собственные `tasks/plan.md`, `tasks/todo.md` | **Не устанавливать сейчас.** Использовать только как внешний audit checklist |
| [`freshtechbro/claudedesignskills@threejs-webgl`](https://skills.sh/freshtechbro/claudedesignskills/threejs-webgl) | 2.3K installs; [613 repo stars](https://api.github.com/repos/freshtechbro/claudedesignskills) | Широкий generic/Claude-oriented guide. Примеры по умолчанию включают continuous loop, full `devicePixelRatio`, shadows — это конфликтует с mobile budgets без адаптации | **Не устанавливать.** Официальные Three/R3F docs + project-specific skill позже |
| [`nexu-io/open-design@threejs`](https://skills.sh/nexu-io/open-design/threejs) | 2.1K installs; [81 700 repo stars](https://api.github.com/repos/nexu-io/open-design) | Repo-wide популярность высокая, но skill находится в широком design ecosystem и не является спецификацией topology/PWA editor | **Не устанавливать до отдельного source audit.** Не нужен на документной фазе |
| [`alinaqi/claude-bootstrap@pwa-development`](https://skills.sh/alinaqi/claude-bootstrap/pwa-development) | 2.6K installs; [703 repo stars](https://api.github.com/repos/alinaqi/claude-bootstrap); repo перенаправляет на `alinaqi/maggy` | Generic PWA recipe рекомендует `autoUpdate`/`skipWaiting` без project-specific ReleaseManifest, Durable boundary и migration/recovery protocol | **Не устанавливать.** Использовать Web Platform/Workbox docs |

### 8.3 Что можно создать позже

После spike разумнее создать один маленький project-scoped skill, чем устанавливать несколько generic packs:

`interiors-editor-technical-invariants`

Он может содержать:

- integer-mm и `mm → m` boundary;
- 0/45/90 topology invariants;
- command/undo rules;
- room identity policy;
- renderer disposal checklist;
- offline/update protocol;
- approved GLB allowlist/limits;
- reference scene и device gates.

Создавать его стоит только после утверждения ADR, иначе skill законсервирует неподтверждённые гипотезы.

## 9. Что не устанавливать

### 9.1 Второй process orchestrator

Не устанавливать второй SDD-фреймворк параллельно BMAD. Два набора gates, путей файлов, ролей и terminology создадут два источника процесса. `spec-driven-development` Addy Osmani полезен как checklist, но не как второй owner workflow.

### 9.2 Runtime multi-agent frameworks

Не добавлять AutoGen, CrewAI, LangGraph или аналогичный runtime в приложение/репозиторий ради разработки продукта. InteriorsEditor не содержит агентную функцию для конечного пользователя; встроенных Codex subagents + BMAD достаточно для development workflow.

### 9.3 Большие Claude/bootstrap bundles

Не устанавливать целый framework/repository ради одного PWA или Three.js skill. Помимо context noise, такие bundles могут приносить:

- чужую file layout;
- conflicting agent roles;
- auto-update patterns;
- assumptions о Next.js/desktop/continuous render;
- инструкции, ориентированные на другой agent host.

### 9.4 Дубли текущих user skills

Не копировать `planning`, `tdd`, `testing`, `fallow`, `playwright` и review skills в `.agents/skills`. User-scoped версия уже доступна; дубли с одинаковыми именами не merge-ятся и усложняют выбор. Официальная документация Codex предупреждает, что skills из разных locations могут показываться одновременно: [OpenAI — Where Codex loads local skills](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills).

### 9.5 Неактуальные connectors/plugins

Не подключать Notion, Slack, Google Drive, Linear и другие внешние системы «на будущее». Connector оправдан только когда канонический источник данных действительно находится там. Сейчас Markdown в проекте — достаточный source of truth.

## 10. Практический протокол по фазам

### Фаза A — стратегические документы

- Main: Analyst/Orchestrator.
- Parallel: market, technical, UX-risk researcher.
- Один writer product brief.
- Reviewer запускается после полного draft.
- Human gate: problem, audience, value, Alpha boundary.

### Фаза B — PRD и UX

- PM один пишет PRD.
- UX agent пишет отдельные UX artifacts.
- Technical researcher даёт feasibility constraints read-only.
- Reconciliation до финализации.
- Human gate: FR/NFR, non-goals, success metrics.

### Фаза C — Architecture/SPEC

- Architect один пишет spine/ADR.
- Topology, PWA/storage, renderer/import specialists работают параллельно только над research/spike reports.
- QA формирует verification matrix.
- Readiness reviewer не является автором PRD/Architecture.

### Фаза D — Implementation

- Один story file → один implementer → один branch/worktree/file scope.
- TDD и acceptance criteria обязательны.
- Review отдельным агентом.
- Параллельная реализация только независимых slices после стабилизации shared contracts.
- Изменение требования сначала обновляет canonical artifact через `bmad-correct-course`.

## 11. Метрики качества агентной системы

Через первые 3–5 крупных артефактов оценить:

| Метрика | Цель |
|---|---|
| Contradictions, найденные после approval | 0 critical |
| Canonical artifacts с двумя одновременными writers | 0 |
| Findings без evidence/confidence | 0 для меняющихся внешних фактов |
| Requirements без owner/acceptance | 0 |
| Subagent tasks, потребовавшие полного переделывания из-за размытого brief | < 20% |
| Время main agent на raw exploration | снижается, synthesis остаётся у main |
| Scope additions без human approval | 0 |
| Implementation до readiness | 0 |

Если coordination overhead превышает выигрыш, уменьшить число subagents до одного reviewer/researcher. Multi-agent — средство, не целевой KPI.

## 12. GitHub и официальные references

### Process, agents, skills

- [bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) — установленный process framework; на дату среза GitHub API показывал 51 143 stars.
- [BMAD Agents reference](https://docs.bmad-method.org/reference/agents/)
- [BMAD Workflow Map](https://docs.bmad-method.org/reference/workflow-map/)
- [OpenAI Codex manual](https://developers.openai.com/codex/codex-manual.md)
- [OpenAI Skills](https://github.com/openai/skills) — официальные примеры skills.
- [Agent Skills specification](https://agentskills.io/specification)
- [vercel-labs/skills](https://github.com/vercel-labs/skills) — CLI/ecosystem, используемый `npx skills`.

### Audited external skills

- [addyosmani/agent-skills — spec-driven-development](https://github.com/addyosmani/agent-skills/tree/main/skills/spec-driven-development)
- [freshtechbro/claudedesignskills — threejs-webgl](https://github.com/freshtechbro/claudedesignskills/tree/main/.claude/skills/threejs-webgl)
- [nexu-io/open-design — threejs](https://github.com/nexu-io/open-design/tree/main/skills/threejs)
- [alinaqi/maggy — pwa-development](https://github.com/alinaqi/maggy/tree/main/skills/pwa-development)

### Product-engineering references

Технические runtime libraries и floor-planner repositories перечислены отдельно в [technical-feasibility-2026-07-26.md](technical-feasibility-2026-07-26.md). Они не являются agent skills.

## 13. Итоговая конфигурация

**Принять сейчас:**

1. BMAD — единственный SDD/process spine.
2. Один main orchestrator/canonical writer.
3. Не более трёх bounded read-only subagents.
4. Один writer на artifact.
5. Independent adversarial review после synthesis.
6. Human approvals на Product Brief, PRD, UX, Architecture/SPEC и readiness.
7. Текущих user-scoped skills достаточно; внешние skills не устанавливать.
8. Project-specific technical invariants skill создать только после ADR/spikes.
9. Никаких runtime agent frameworks и implementation agents до `READY`.

**Переоценить позже:**

- необходимость custom Codex agents в `.codex/agents/`;
- число параллельных implementers;
- project-specific skill;
- connectors к Linear/GitHub/Notion;
- автоматизированный development loop.

Эта конфигурация сохраняет главное преимущество multi-agent — независимый параллельный анализ — без потери единого продуктового и архитектурного источника истины.
