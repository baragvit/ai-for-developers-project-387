# Созвон — запись на звонок

[![hexlet-check](https://github.com/baragvit/ai-for-developers-project-387/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/baragvit/ai-for-developers-project-387/actions)
[![CI](https://github.com/baragvit/ai-for-developers-project-387/actions/workflows/ci.yml/badge.svg)](https://github.com/baragvit/ai-for-developers-project-387/actions/workflows/ci.yml)

Учебный проект [Хекслета](https://ru.hexlet.io/programs/ai-for-developers) «Календарь звонков (продолжение)»: работа агентов над приложением «Запись на звонок» автоматизирована в GitHub — задачи из issue, реализация и ревью в pull request, регулярный аудит. Само приложение — упрощённый сервис бронирования встреч по мотивам [Cal.com](https://cal.com). Как это должно работать: https://files.hexlet.app/a/2ipc5m

**Демо:** https://call-booking-r8mx.onrender.com (Render, бесплатный план: после простоя первый запрос может идти до минуты). Если демо недоступно, запустите приложение в Docker:

```bash
git clone https://github.com/baragvit/ai-for-developers-project-387.git
cd ai-for-developers-project-387
docker build -t call-booking .
docker run --rm -p 8080:8080 call-booking   # откройте http://127.0.0.1:8080
```

## Происхождение

Приложение перенесено из первого проекта [`baragvit/ai-for-developers-project-386`](https://github.com/baragvit/ai-for-developers-project-386) (состояние на релизе [v0.2.0](https://github.com/baragvit/ai-for-developers-project-386/releases/tag/v0.2.0)). Там остались исходная спецификация и решения:

- спецификация — issue [#11 «Спецификация: запись на звонок»](https://github.com/baragvit/ai-for-developers-project-386/issues/11), реализованная в PR [#21](https://github.com/baragvit/ai-for-developers-project-386/pull/21);
- карта проектирования — issue [#1](https://github.com/baragvit/ai-for-developers-project-386/issues/1) и её решённые вопросы [#2–#10](https://github.com/baragvit/ai-for-developers-project-386/issues?q=is%3Aissue+label%3Awayfinder%3Agrilling%2Cwayfinder%3Aresearch);
- тикеты реализации — [#12–#20](https://github.com/baragvit/ai-for-developers-project-386/issues?q=is%3Aissue+label%3Aready-for-agent).

Решения, принятые в первом проекте, перенесены сюда как [ADR](docs/adr/), термины — в [`GLOSSARY.md`](GLOSSARY.md). Новые задачи заводятся в [issues этого репозитория](https://github.com/baragvit/ai-for-developers-project-387/issues).

Сценарий один: владелец календаря публикует типы встреч, гость выбирает свободный слот и записывается на звонок, а владелец видит список предстоящих встреч. Авторизации, личных кабинетов и интеграций с внешними календарями нет — функциональность намеренно ограничена, чтобы пройти весь путь от проектирования API до запуска в контейнере.

## Роли и правила

**Владелец календаря** — один заранее заданный профиль (настраивается переменными окружения).

- Создаёт типы встреч: id (slug, например `code-review`), название, описание и длительность от 5 до 240 минут, кратную 5. Редактировать и удалять типы нельзя.
- Видит предстоящие встречи всех типов одним списком.

**Гость** — бронирует без регистрации.

- Видит список типов встреч с названием, описанием и длительностью.
- Выбирает тип, открывает календарь и выбирает свободный слот.
- Оставляет имя, email и комментарий и получает подтверждение.

**Правила бронирования**

- Запись открыта на 14 дней вперёд, начиная с сегодняшнего дня в часовом поясе владельца.
- Слоты идут подряд с шагом, равным длительности встречи, в рабочие дни и часы владельца (по умолчанию пн–пт, 09:00–18:00).
- Прошедшее время забронировать нельзя.
- **На одно и то же время нельзя создать две записи, даже если это разные типы встреч.** Запрещено и частичное наложение интервалов. Занятые слоты показываются гостю зачёркнутыми.
- Следующая встреча может начинаться ровно в момент окончания предыдущей.
- Правила действуют и для одновременных запросов: из двух бронирований одного времени проходит одно, второе получает `409 SLOT_TAKEN`.

## Сценарий: от типа встречи до записи у владельца

1. Владелец открывает кабинет владельца (`/admin`), нажимает «Новый тип встречи» и задаёт id, название, описание и длительность.
2. Гость открывает главную страницу, нажимает «Записаться» и в каталоге типов встреч видит новый тип с названием, описанием и длительностью.
3. Гость выбирает тип встречи, открывает календарь на ближайшие 14 дней и выбирает день.
4. Гость выбирает свободный слот; занятое время, в том числе встречами других типов, выбрать нельзя.
5. Гость вводит имя, email и комментарий, подтверждает запись и видит подтверждение.
6. Владелец на вкладке «Предстоящие встречи» видит новую запись вместе со встречами остальных типов.

## Design First: контракт API

Сначала договариваемся о поведении и HTTP-контракте, затем независимо реализуем фронтенд и бэкенд.

- Контракт описан на [TypeSpec](https://typespec.io/): [`api-contract/main.tsp`](api-contract/main.tsp) — единственный источник правды для фронтенда и бэкенда.
- `npm run contract` (то же `make contract` / `mise run contract`) генерирует из него файлы, которые нельзя править руками:
  - `api-contract/openapi.yaml` — OpenAPI;
  - `frontend/src/api/schema.d.ts` — типы клиента `openapi-fetch`;
  - `backend/src/api/model/schema.d.ts` — типы DTO бэкенда;
  - `backend/src/api/model/zod/` — zod-схемы запросов бэкенда.
- `mise run contract:check` перегенерирует эти файлы и падает, если они отличаются от закоммиченных. Это первый шаг `mise run check`.
- Фронтенд обращается к API только через `frontend/src/api`: линтер запрещает `fetch`, `XMLHttpRequest` и `openapi-fetch` в остальном коде.
- Фронтенд можно запустить без бэкенда на моке [Prism](https://stoplight.io/open-source/prism), который отвечает примерами из контракта.

| Метод | Путь | Кто | Что делает |
| --- | --- | --- | --- |
| GET | `/api/owner` | гость | профиль владельца, рабочие часы и окно записи |
| GET | `/api/event-types` | гость | список типов встреч |
| GET | `/api/event-types/{id}` | гость | тип встречи |
| GET | `/api/event-types/{id}/slots` | гость | слоты на 14 дней с признаком `available` |
| POST | `/api/bookings` | гость | бронирование (`409 SLOT_TAKEN`, если время занято) |
| POST | `/api/admin/event-types` | владелец | создание типа встречи |
| GET | `/api/admin/bookings` | владелец | предстоящие встречи всех типов |

## Стек и структура

```
api-contract/   TypeSpec-контракт, OpenAPI и Prism-мок
frontend/       React 19 + Vite + TypeScript, Tailwind CSS, shadcn/ui, TanStack Query
backend/        Node.js 22 + Fastify + TypeScript, zod; данные хранятся в памяти процесса
e2e/            сценарные тесты на Playwright (десктоп и мобильный вьюпорт)
Dockerfile      один образ: бэкенд отдаёт API и собранный фронтенд
```

Бэкенд разделён на слои: `api/` (маршруты, валидация сгенерированными zod-схемами, маппинг DTO ↔ домен) → `services/` (бизнес-логика на доменных типах, ошибки возвращаются как `Result`) → `domain/` (чистые функции: слоты, пересечение интервалов) → `storage/` (репозитории). Хранилище in-memory: после перезапуска данные сбрасываются, демо-типы встреч создаются заново.

## Запуск локально

Версии инструментов зафиксированы в [`mise.toml`](mise.toml) (Node.js 22.23.4). Установите [mise](https://mise.jdx.dev/getting-started.html), он поставит нужный Node.js.

```bash
git clone https://github.com/baragvit/ai-for-developers-project-387.git
cd ai-for-developers-project-387
mise install        # Node.js из mise.toml
make install        # npm ci для всех пакетов
```

**Фронтенд на моке API** (Prism отвечает примерами из контракта):

```bash
make mock           # Prism на :4010
make dev-mock       # в другом терминале; откройте http://127.0.0.1:5391
```

**Фронтенд + настоящий бэкенд:**

```bash
make dev-backend    # API на :7341, перезапуск при изменениях
make dev-frontend   # в другом терминале; откройте http://127.0.0.1:5391
```

**Production-сборка** (одно приложение на одном порту):

```bash
make build && make start   # http://127.0.0.1:7341
```

**Docker:**

```bash
docker build -t call-booking .
docker run --rm -p 8080:8080 call-booking   # http://127.0.0.1:8080
```

### Переменные окружения бэкенда

| Переменная | По умолчанию | Описание |
| --- | --- | --- |
| `PORT` | `7341` (в Docker `8080`) | порт HTTP-сервера |
| `HOST` | `0.0.0.0` | адрес, на котором слушает сервер |
| `OWNER_NAME` | `Анна Смирнова` | имя владельца календаря |
| `OWNER_TIMEZONE` | `Europe/Moscow` | часовой пояс рабочих часов (IANA) |
| `WORKDAY_START` / `WORKDAY_END` | `09:00` / `18:00` | рабочие часы, `HH:mm` |
| `WORKING_DAYS` | `1,2,3,4,5` | рабочие дни по ISO: 1 — пн, 7 — вс |
| `BOOKING_WINDOW_DAYS` | `14` | на сколько дней вперёд открыта запись |
| `SEED_DEMO_DATA` | `true` | создать демо-типы встреч при старте |
| `STATIC_DIR` | `frontend/dist` | каталог собранного фронтенда |

## Проверки

Все проверки одной командой, той же, что в CI (`make check` делает то же):

```bash
mise run check
```

Она по порядку запускает шаги, каждый доступен и отдельно:

| Шаг | Отдельно | Что делает |
| --- | --- | --- |
| `contract:check` | `mise run contract:check` | сгенерированные из контракта файлы актуальны |
| `check:workflows` | `mise run check:workflows` | в воркфлоу нет значений, обрезанных YAML-комментарием (` #` в незакавыченной строке), а `run-name` и фильтр бюджета в `opencode.yml` совпадают ([`scripts/check-workflows.mjs`](scripts/check-workflows.mjs)) |
| `lint` | `make lint` | oxlint для фронтенда и бэкенда |
| `typecheck` | `make typecheck` | tsc во всех пакетах |
| `test` | `make test` | Vitest: домен, сервисы и API бэкенда, компоненты фронтенда |
| `check:rule-guard` | `make check-rule-guard` | тесты конфликтов падают, если отключить проверку пересечения (см. ниже) |
| `e2e` | `make e2e` | Playwright: собирает production-сборку, поднимает сервер и прогоняет сценарии |

Для e2e один раз установите браузер: `cd e2e && npx playwright install --with-deps chromium`. Сервер e2e слушает порт `E2E_PORT` (по умолчанию `7399`); локально уже запущенный на этом порту сервер переиспользуется, поэтому в параллельных копиях репозитория задавайте разные порты: `E2E_PORT=7420 mise run check`.

### Границы тестирования

Тест проверяет поведение через публичную границу (HTTP-ответ, видимое в браузере), а не внутреннюю реализацию. Время фиксируется внедряемыми часами.

| Граница | Где | Что проверяет |
| --- | --- | --- |
| Домен | `backend/test/schedule.test.ts`, `backend/test/overlaps.test.ts` | генерация слотов: окно 14 дней, рабочие дни и часы в поясе владельца, сетка, прошедшие слоты, переход на зимнее время; пересечение полуоткрытых интервалов |
| Сервисы | `backend/test/booking-service.test.ts`, `backend/test/event-type-service.test.ts` | бронирование и типы встреч через `Result`, без HTTP |
| API (главная) | `backend/test/api.test.ts`, `backend/test/booking-conflicts.test.ts` | полное Fastify-приложение через `injectChecked`: статусы, тела, коды ошибок, порядок проверок, примыкание, пересечение разных типов, параллельные запросы |
| Компоненты | `frontend/src/**/*.test.tsx` | Vitest + Testing Library на мокнутом клиенте: раскладка по часовому поясу, пустые состояния, обработка ошибок |
| Браузер | `e2e/tests/booking.spec.ts` | Playwright против production-сборки с настоящим сервером, без моков API; десктоп и мобильный (Pixel 7) |

API-тесты вызывают сервер через `injectChecked` (`backend/test/contract.ts`): метод и путь должны быть операцией из `api-contract/openapi.yaml`, статус — объявлен у операции, тело — соответствовать схеме ответа. Иначе тест падает.

Обязательные браузерные сценарии: главная → каталог с названием, описанием и длительностью; гость бронирует слот, видит подтверждение, встреча появляется у владельца; время, занятое встречей другого типа, недоступно; гонка за слот даёт понятное сообщение о конфликте; валидация формы брони; владелец создаёт тип, он появляется в каталоге, дубликат id отклоняется.

### Проверка тестов правила неналожения

Шаг `check:rule-guard` команды `mise run check`; отдельно — `mise run check:rule-guard` или `make check-rule-guard`. Он накладывает патч `scripts/rule-guard/disable-overlap-check.patch`, который отключает проверку пересечения, запускает `backend/test/booking-conflicts.test.ts` и снимает патч при любом исходе. Он успешен, только если упали ровно тесты из `scripts/rule-guard/expected-failures.txt`, а остальные прошли; удалённый или ослабленный тест конфликта и устаревший патч роняют его.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) на каждый push и pull request запускает `mise run check` (в том числе `check:rule-guard`), а затем собирает Docker-образ и делает смоук-тест: `/api/owner`, `/api/event-types` и SPA на `/` отвечают.

**Браузерная проверка PR.** На pull request задание `browser-check` делает checkout точного `github.event.pull_request.head.sha`, а не временного merge-коммита, и прогоняет Playwright (desktop) против production-сборки с `E2E_EVIDENCE=1`: trace и скриншот пишутся и для успешных тестов. Артефакт `browser-check-<SHA>` содержит `browser-check.txt` (SHA из события, фактический `git rev-parse HEAD`, результат, ссылку на прогон), HTML-отчёт и trace. Модель и секреты не нужны. Артефакт завершённого прогона остаётся свидетельством своей версии и после нового push; прогон, отменённый новым push (`concurrency` CI), артефакта не оставляет. Перед мержем сверьте SHA артефакта с текущим head PR и откройте trace (`npx playwright show-trace trace.zip` или [trace.playwright.dev](https://trace.playwright.dev)).

**Защита `main`.** Мерж в `main` только через PR с успешным заданием `checks` (правило защиты ветки). Release PR создаётся с `GITHUB_TOKEN` и сам CI не запускает: перед мержем закройте и снова откройте его или добавьте в ветку пустой коммит от своего имени, чтобы `checks` прошёл.

## Агент в GitHub

Агент — [OpenCode](https://opencode.ai/docs/github/) в GitHub Actions. Он работает с теми же скиллами и правилами, что и локальный агент первого проекта: скиллы лежат в репозитории (`.agents/skills/`, `.claude/skills/`), OpenCode находит их сам; настройки трекера — в [`docs/agents/`](docs/agents/), правила — в [`AGENTS.md`](AGENTS.md).

| Воркфлоу | Событие | Модель | Назначение | Где результат |
| --- | --- | --- | --- | --- |
| [`opencode.yml`](.github/workflows/opencode.yml) | `issue_comment` и `pull_request_review_comment`, `types: [created]` | `opencode/deepseek-v4.1-flash` (OpenCode Zen, оплата по токенам) | ответ на команду в обсуждении issue или PR и в комментарии к строке diff; по просьбе — ветка и PR с правками или коммит в ветку PR | комментарий `opencode-agent[bot]` в том же issue или PR; прогон — во вкладке [Actions](https://github.com/baragvit/ai-for-developers-project-387/actions/workflows/opencode.yml) |
| [`opencode-review.yml`](.github/workflows/opencode-review.yml) | `pull_request`, `types: [opened, synchronize, reopened, ready_for_review]` | `opencode/deepseek-v4.1-flash` (OpenCode Zen, оплата по токенам) | независимое авторевью каждого PR, в том числе PR агента, по критериям [`REVIEW.md`](REVIEW.md): сверка со спецификацией, тикетами и согласованием по ссылкам из описания, diff и результатами CI; код не меняет | комментарий `github-actions[bot]` «Авторевью» в PR; прогон — во вкладке [Actions](https://github.com/baragvit/ai-for-developers-project-387/actions/workflows/opencode-review.yml) |
| [`opencode-triage.yml`](.github/workflows/opencode-triage.yml) | `issues`, `types: [opened]` | `opencode/deepseek-v4.1-flash` (OpenCode Zen, оплата по токенам) | автотриаж нового обращения по скиллу `triage` с учётом текущего приложения и настроек [`docs/agents/`](docs/agents/); если данных не хватает — вопросы и метка `needs-info`, иначе — `needs-triage` и предложенный следующий шаг; код не меняет | комментарий `opencode-agent[bot]` в issue и метки категории и состояния; прогон — во вкладке [Actions](https://github.com/baragvit/ai-for-developers-project-387/actions/workflows/opencode-triage.yml) |

**Как вызвать.** Команды — набор OpenCode по умолчанию, `mentions` не переопределён: `/opencode` и `/oc`. Название скилла передаётся текстом команды, например `/oc запусти скилл to-spec по обсуждению этого issue` или `/oc explain this issue`. Агент не задаёт вопросов в ходе сессии: вопросы и решения остаются в обсуждении, следующая сессия читает их перед работой.

**Как проверить настройки.** Отправьте в issue комментарий с командой из этого issue, например `/oc explain this issue`, и попросите агента назвать настройки проекта. Если он прочитал [`AGENTS.md`](AGENTS.md) и [`docs/agents/`](docs/agents/), в ответе будут: трекер — GitHub Issues в `baragvit/ai-for-developers-project-387` через `gh` CLI (первый проект `baragvit/ai-for-developers-project-386` — только история); скиллы из `.agents/skills/`, в том числе `to-spec`, `to-tickets` и `implement-spec`; все проверки — команда `mise run check` (она же `make check`), то есть `contract:check` → `check:workflows` → `lint` → `typecheck` → `test` → `check:rule-guard` → `e2e`. Другой репозиторий, неполный список скиллов или другая команда означают, что настройки не подхватились.

**Кто может вызвать.** Запуск пропускается до вызова модели, если в комментарии нет команды, автор — бот (в том числе сам агент) или не владелец, участник организации или коллаборатор репозитория. OpenCode дополнительно проверяет, что у автора есть права на запись. Для PR из fork агент не запускается, так как он забрал бы и мог выполнить код fork с ключом модели; `pull_request_target` не используется.

**Автотриаж.** Новое issue разбирает [`opencode-triage.yml`](.github/workflows/opencode-triage.yml): агент сверяет запрос с кодом и ADR, задаёт вопросы при нехватке данных или предлагает следующий шаг, не меняя код и не создавая ветки и PR. Issue пропускаются, если у них уже есть `ready-for-agent`, `ready-for-human` или `wontfix`: тикеты `to-spec` и `to-tickets` уже размечены на реализацию, `ready-for-human` ждёт человека, а `wontfix` закрыт по решению, поэтому повторный разбор им не нужен. Кроме того, issue, которые агент создаёт через `GITHUB_TOKEN`, вообще не запускают воркфлоу. Как и в `opencode.yml`, запуск идёт только для авторов с `author_association` `OWNER`, `MEMBER` или `COLLABORATOR`; боты и внешние авторы его не запускают, чтобы не тратить ключ модели на недоверенный ввод. Задание ограничено `timeout-minutes: 15`, группа `concurrency` общая с `opencode.yml`, поэтому автотриаж и ручной `/oc` в одном issue идут по очереди.

**Авторизация и права.** Стандартный режим OpenCode: установлено GitHub App [opencode-agent](https://github.com/apps/opencode-agent), воркфлоу через `id-token: write` обменивает OIDC-токен на токен приложения, и комментарии и push идут от имени приложения. Поэтому у `actions/checkout` стоит `persist-credentials: false`, а `GITHUB_TOKEN` для `gh` в скиллах получает `contents: read` и `pull-requests: read` на чтение, `actions: read` для подсчёта бюджета и `issues: write`, чтобы `to-spec`, `to-tickets` и `triage` создавали issue, ставили метки и связывали тикеты. Issue, созданные этим токеном, не запускают другие воркфлоу.

**Ключ, модели и сессии.** Ключ модели — секрет `OPENCODE_API_KEY` в *Settings → Secrets and variables → Actions*; основную работу ведёт платная модель Zen `opencode/deepseek-v4.1-flash` (та же модель, что бесплатная `-free`, но без лимитов бесплатного тарифа) (`MODEL` в `opencode.yml`, `model` в `opencode-triage.yml`, `--model` в `opencode-review.yml`), оплата по токенам с баланса консоли OpenCode; бесплатная версия была медленной из-за очереди и лимитов. Заголовок сессии делает отдельная `small_model`: в корневом [`opencode.json`](opencode.json) она задана как `opencode/deepseek-v4.1-flash-free`; без этого OpenCode берёт платную `opencode/gpt-5.4-nano`, и заголовок падает с «Insufficient account funds». Сессии не публикуются: в OpenCode v1.19.5 публикация сессий отключена.

**Ограничения и остановка.** До вызова модели `opencode.yml` ставит mise (Node из `mise.toml`), зависимости (`mise run install`) и Chromium для Playwright, чтобы агент мог запускать `mise run check`. Затем он выполняет те же шаги, что action `anomalyco/opencode/github@v1.19.5` (`opencode github run` с OIDC), но ставит CLI ровно версии `1.19.5`: сам action при каждом запуске ставит последний релиз. У задания `timeout-minutes: 60`, у вызова агента — `timeout 55m`, чтобы причина успела записаться; `concurrency` задания `agent` держит один прогон на issue или PR, следующий ждёт в очереди. Группа задана на задании, а не на воркфлоу: в группе ждёт только один прогон, а воркфлоу стартует на каждый комментарий, в том числе на ответ агента; пропущенное задание в группу не попадает и не вытесняет ожидающий запрос человека. Текущий прогон останавливает **Cancel workflow** в Actions, будущие — **Disable workflow**; уже отправленный провайдеру запрос может доработать по его правилам, при необходимости ключ отзывается в [консоли OpenCode](https://opencode.ai/auth).

**Предел запусков на PR.** Не больше трёх допущенных запросов к агенту на один PR, проверка — кодом до вызова модели (шаг `Check run budget`). Считается каждый допущенный запрос человека в этом PR: общий комментарий и комментарий к строке, а также отмена, таймаут и каждый Re-run, так как попытка тратится в момент шага `Admit request`. Счётчик — история Actions этого воркфлоу: прогоны с заголовком `opencode #<PR>` (`run-name`) и все их `run_attempt`, у которых шаг `Admit request` успешен. Токены агента не могут переписать историю Actions, комментарии в PR — только отчёт. Ограничение держится, пока история хранится и конфигурация воркфлоу не изменена; администратор репозитория может изменить и то и другое. Новый PR получает новый бюджет, issue не ограничены, поэтому это не предел расходов по задаче. Отдельное задание `report` без модели публикует в PR причину, последний SHA PR и ссылку на логи со статусом «нужен человек»:

| Причина | Когда |
| --- | --- |
| `limit_exhausted` | бюджет PR исчерпан, модель не вызывалась |
| `timeout` | вызов агента превысил `timeout 55m` |
| `infra` | сбой checkout, установки mise, зависимостей, Playwright или OpenCode, нет секрета `OPENCODE_API_KEY` |
| `agent_failed` | агент завершился с ошибкой |
| `unknown` | задание отменено или упёрлось в тайм-аут задания без записанной причины: проверьте лог |

**Запросы разрешений.** На раннере некому ответить на запрос разрешения OpenCode, поэтому `ask` повисает до тайм-аута. По умолчанию в режиме `ask` работают `external_directory` (файлы вне репозитория) и `doom_loop` (повтор одного и того же вызова). В `opencode.yml` и `opencode-triage.yml` `OPENCODE_PERMISSION` разрешает `/tmp`, где implement-spec хранит заметки, и запрещает остальное: отказ приходит агенту как ошибка, и он продолжает работу.

Следующее действие выбирает человек: новый PR, исправление вручную или пересмотр подхода. Автоматического цикла исправлений нет.

**Авторевью.** [`opencode-review.yml`](.github/workflows/opencode-review.yml) запускается на `pull_request` (`opened`, `synchronize`, `reopened`, `ready_for_review`) отдельно от реализации и не продолжает её сессию. Он работает на обычном `opencode run`, а не на `opencode github run`: тот проверяет права отправителя события и на PR, открытых приложением агента, получает `permission: none`. Поэтому доверие проверяет сам воркфлоу: ветка этого репозитория (PR из fork не получают секрет модели, `pull_request_target` не используется), не черновик, не ветка release-please, автор — `OWNER`, `MEMBER`, `COLLABORATOR` или `opencode-agent[bot]`. Фильтра по типу `Bot` нет, иначе PR агента остались бы без ревью.

1. Шаг без модели собирает контекст: описание PR, коммиты, diff, issue по ссылкам из описания (обращение, спецификация, тикеты, согласование) с комментариями, прошлые ревью и решения по ним, статусы CI (ждёт завершения CI до 10 минут). [`REVIEW.md`](REVIEW.md) берётся из базовой ветки, поэтому PR не может ослабить критерии своего ревью.
2. `opencode run` получает всё это файлами. В `OPENCODE_CONFIG_CONTENT` запрещены правка файлов, bash, веб и подагенты, а `OPENCODE_DISABLE_PROJECT_CONFIG` не даёт PR расширить права через `opencode.json`. Таймаут вызова — 20 минут.
3. Отдельный шаг публикует итог `gh pr comment`: текст ревью с проверенным SHA или причину сбоя (`timeout`, `agent_failed`).

Права `GITHUB_TOKEN`: `contents: read` для кода, `issues: read` для исходного issue и согласования, `actions: read`, `checks: read` и `statuses: read` для результатов CI, `pull-requests: write` для комментария. OIDC и токен приложения не нужны. У задания `timeout-minutes: 35`, `concurrency` с `cancel-in-progress: true` отменяет ревью устаревшего head того же PR. Замечание ревью само исправление не запускает: подтверждённое замечание человек передаёт агенту командой `/oc` в PR, ошибочное отклоняет ответом с причиной. Это расходует бюджет PR. Если авторевью не стартовало, проверьте источник токена, которым открыт PR (PR от `GITHUB_TOKEN` не запускают воркфлоу), и ожидающее подтверждение запуска в PR.

**PR и ревью.** Шаблон [`.github/pull_request_template.md`](.github/pull_request_template.md): связанные задачи, что сделано, проверки (команды, ссылки на прогоны, проверенный SHA, браузерный артефакт), риск с обоснованием глубины проверки и способ отката. Заголовок PR — Conventional Commit: при squash он становится сообщением коммита в `main`.

## Аудит скорости (Lighthouse)

Раз в сутки, в 03:17 по Москве (`cron: "17 3 * * *"` с `timezone: Europe/Moscow`), и вручную кнопкой **Run workflow** воркфлоу `lighthouse-audit` проверяет скорость рабочего экземпляра: главную страницу `/` и страницу записи гостя `/book/consultation`. Адрес берётся из переменной репозитория `vars.APP_URL` (*Settings → Secrets and variables → Actions → Variables*, например `https://call-booking-r8mx.onrender.com`). Перед аудитом шаг без модели будит бесплатный Render повторами запроса к `/api/owner` до ~2 минут; если приложение не ответило, прогон фиксирует «нет данных» и не создаёт находок и исправлений.

**Где лежит файл.** [`.github/workflows/lighthouse-audit.yml`](.github/workflows/lighthouse-audit.yml). Агент подготовил его в `docs/workflows/`: у приложения `opencode-agent` нет права `workflows`, и push в `.github/workflows/` отклоняется. Человек перенёс файл отдельным коммитом в ту же ветку; поменялся только комментарий о пути в начале файла. Так же придётся поступать с любой правкой воркфлоу через агента.

**Что делает прогон.** Шаг без модели запускает Lighthouse для двух страниц с `--output=json --output=html` и складывает отчёты в `runner.temp`, а не в рабочее дерево. Артефакт `lighthouse-audit-<SHA>-<UTC-время>` (хранится 30 дней) содержит JSON и HTML Lighthouse, если приложение ответило, и всегда — `summary.json` со SHA, временем, адресами, метриками и стабильными ключами находок. Ключевые метрики — Performance, LCP, CLS, TBT — выводятся в job summary. Там же появляется вывод агента при любом исходе: новая находка, дубль, нет находок или нет данных, со ссылкой на прогон.

**Права и агент.** Задание агента получает только `contents: read` (прочитать код), `actions: read` (скачать артефакт с отчётом своего прогона) и `issues: write` (искать и создавать issue); записи в код, ветки и PR нет. Модель — `opencode/deepseek-v4.1-flash`, action `anomalyco/opencode/github` закреплён на `810c0e…` (v1.19.5). Перед созданием issue агент ищет открытые и закрытые issue с меткой `performance-audit` по стабильному ключу `<!-- audit-finding: <audit-id> <path> -->` в теле; если такая задача уже есть и новых сведений нет, ни issue, ни комментарий не создаются. Issue по находке — входящее обращение без `ready-for-agent`: в нём проблема, проверенный адрес и страница, значения Performance/LCP/CLS/TBT текстом (артефакт временный), предлагаемое действие и ссылки на прогон и артефакт. Нужны метки `performance-audit` и `training`; воркфлоу создаёт их при прогоне. Issue создаёт `github-actions[bot]`, поэтому `opencode-triage` их не разбирает: находку оценивает человек. Если по страницам нет данных и нет учебной находки, модель не вызывается, а job summary сообщает «нет данных» с причиной.

**Учебный сценарий.** При ручном запуске включите `training: true` — шаг в раннере добавит в отчёт явно помеченную учебную находку. Issue по ней выходит с `[учебный]` в заголовке и меткой `training`, это не дефект приложения. Учебные данные и отчёты не коммитятся: они живут только в `runner.temp` и артефакте.

**Как проверить вручную.** Убедитесь, что задана `vars.APP_URL`. Откройте *Actions → lighthouse-audit → Run workflow*, при необходимости включите `training: true`. Проверьте job summary (метрики и вывод агента), артефакт с SHA и временем, а для учебного запуска — issue с `[учебный]` и меткой `training`. Сам аудит в рамках разработки не запускается: первый прогон делает человек после мержа и переноса файла.

## Релизы

Версии и `CHANGELOG.md` выпускает [release-please](https://github.com/googleapis/release-please) из [Conventional Commits](https://www.conventionalcommits.org/ru/). Версия одна на всё приложение — в корневом `package.json`, тег `vX.Y.Z`; пакеты `api-contract`, `backend`, `frontend` и `e2e` в релизе не участвуют.

1. На каждый push в `main` workflow [`.github/workflows/release-please.yml`](.github/workflows/release-please.yml) создаёт или обновляет release PR: новая версия в `package.json` и `package-lock.json` и запись в `CHANGELOG.md`.
2. Человек проверяет и мержит release PR — тогда создаются тег и GitHub Release. Docker-образ не публикуется.

Как считается версия: первый релиз — `0.1.0`; до `1.0.0` `feat` и breaking change (`feat!`) поднимают minor, `fix` — patch. В CHANGELOG попадают `feat`, `fix`, `perf` и `revert`. Чтобы выпустить `1.0.0`, добавьте в тело коммита строку `Release-As: 1.0.0`. Настройки — в [`release-please-config.json`](release-please-config.json), последняя выпущенная версия — в [`.release-please-manifest.json`](.release-please-manifest.json).

Release PR создаётся с `GITHUB_TOKEN`, поэтому CI на нём не запускается: он меняет только версию и CHANGELOG. Чтобы workflow мог открывать PR, в настройках репозитория включите *Settings → Actions → General → Allow GitHub Actions to create and approve pull requests*.

## Деплой

Приложение упаковано в один Docker-образ ([`Dockerfile`](Dockerfile) в корне): Node-процесс отдаёт и API, и собранный фронтенд, стартует сам при запуске контейнера и слушает порт из переменной `PORT` (по умолчанию в образе — `8080`).

```bash
docker build -t call-booking .
docker run --rm -e PORT=3000 -p 3000:3000 call-booking   # http://localhost:3000
```

Рабочий экземпляр: https://call-booking-r8mx.onrender.com — Web Service на [Render](https://render.com) (runtime Docker, ветка `main`). Пока он собирается из репозитория первого проекта [`ai-for-developers-project-386`](https://github.com/baragvit/ai-for-developers-project-386), код в котором совпадает с этим. Сервис подключён к публичному репозиторию без GitHub-приложения Render, поэтому коммиты сами не выкатываются: новый деплой запускает агент через Render MCP (`trigger_deploy`) или кнопка **Manual Deploy** в Dashboard. Render сам передаёт `PORT`. Для ручной настройки есть blueprint [`render.yaml`](render.yaml).

**Данные сбрасываются после перезапуска.** Хранилище in-memory (см. [ADR-0002](docs/adr/0002-in-memory-single-process-storage.md)): записи живут только в памяти процесса и пропадают при каждом деплое, рестарте и засыпании бесплатного инстанса Render после ~15 минут простоя; демо-типы встреч создаются заново при старте.

### Деплой агентом через Render MCP

Сервис создан и проверен агентом Cursor через [Render MCP](https://render.com/docs/mcp-server). Проектная конфигурация — [`.cursor/mcp.json`](.cursor/mcp.json); ключа в ней нет, он подставляется из переменной окружения:

```json
{ "mcpServers": { "render": { "url": "https://mcp.render.com/mcp",
  "headers": { "Authorization": "Bearer ${env:RENDER_API_KEY}" } } } }
```

Подключение:

1. В Render Dashboard: **Account Settings → API Keys → Create API Key**.
2. Экспортируйте ключ в окружение, из которого запускается Cursor, например в `~/.bashrc`: `export RENDER_API_KEY=rnd_...`. Ключ не коммитьте — `.env` и `.env.*` в `.gitignore`.
3. Запустите Cursor из этого окружения (`source ~/.bashrc && cursor .`), в **Cursor Settings → MCP** включите сервер `render` и откройте новый чат.
4. Попросите агента выбрать workspace и создать Web Service (runtime Docker, репозиторий, ветка `main`); агент дождётся деплоя и проверит сервис по ссылке.

---

<details>
<summary>Автоматические тесты Хекслета</summary>

Тесты запускаются на каждый коммит. За запуск отвечает файл `.github/workflows/hexlet-check.yml` — не удаляйте и не переименовывайте ни его, ни репозиторий.

</details>
