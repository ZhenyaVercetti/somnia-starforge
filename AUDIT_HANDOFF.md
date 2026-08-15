# Handoff для аудита — 15 августа 2026

Документ для следующего агента Grok. Читать **до** любых правок.

## Роль и правила
- Пользователь — проджект, код не пишет. Пара: только он и ты.
- Ответы пользователю: **русский**, коротко, без воды.
- Комментарии в коде: **английский**.
- `DEPLOYMENT.md` — единственный источник адресов.
- Документы не трогать, пока пользователь явно не попросит.
- Не предлагать других людей/команды.

Правила проекта: `AGENTS.md`.

## Задача аудита (что просить / что делать)
1. **Frontend UX/layout** — Prepare + Collection сейчас главная боль. Проверить наложения, половины экрана, глубины, клики.
2. **Battle playback** — скорость, Skip, лог, итог, HP-бары.
3. **Склейка фронт ↔ контракт** — ABI, адреса, `startMatch`, события боя.
4. **Не ломать** магазин/реролл/лимиты без запроса: пользователь тестирует это сам.
5. После аудита: список дефектов с файлом+функцией+как воспроизвести. Не переписывать UI «с нуля», пока пользователь не скажет.

## Live testnet (актуально)
| Контракт | Адрес |
|---|---|
| StarForgeGame | `0x2087baAb3Ee7456E6B3100A58BAc7144662ea3fF` (old `0x227c…`) |
| StarForgeUnitNFT | `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1` |
| StarForgeRelic | `0x619e19df1975A8D289545834aAff3FEEf1b84909` |
| StarForgePlayerProfile | `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9` |

- Chain ID **50312**, RPC `https://dream-rpc.somnia.network`
- Те же адреса в `frontend/src/lib/contractAddresses.ts`
- Game на этом адресе: **Shadow Fleet** (ИИ всегда 8, пустые слоты игрока = сильные филлеры), Variant 1 battle events (emit, не storage), mint anti-abuse (daily 10 + free ship за level-up).
- Прогон 100 боёв (mid shop): **74–26**, последняя четверть ~60%. Fat shop 10–2 (83%).

## Что сделано в этой сессии (фронт, 13.08.2026)

### Бой (`BattleScene.ts`)
- Базовый темп **×2.55** от исходного таймлайна (сначала +70%, потом ещё +50%).
- **x2** = ×2 от нового базиса. **Skip** = ×3 от базиса, **не** прыжок в результат. Space/Esc = Skip; на экране итога Space/Esc/Enter = назад.
- Боевой лог: панель, цвета CRIT/DODGE/Last Stand/DESTROYED, 6 строк.
- Итог: VICTORY/DEFEAT, флот, раунды, киллы; лог/Skip/x2 скрываются.
- Живой `ROUND N/MAX`, счётчики YOUR/VOID FLEET, HP-бары с первого кадра.
- Полноэкранный `outer_frame` с боя **снят** (накрывал HUD).

### Подготовка (`PrepareScene.ts` + `HudChrome.ts`)
- Три оси: left **250**, center **960**, right **1670**.
- Слоты ставятся по **центру** ячейки. Первая ячейка: `gridFirstCenter()` — иначе сетка уезжает влево на полслота.
- Профиль, шоп и левые кнопки на одной оси `leftX`.
- AUTO / CLEAR стоят **слева и справа от equipped relics**, не у заголовка флота.
- Надпись RELICS выше слотов реликвий.
- Текст «Reroll to fill» убран.
- Логотип ×2.5 (`min(145/h, 625/w)`), `logoY = 6`.
- Пустые слоты флота: пульс только по **alpha**, не `scaleX` (иначе `setDisplaySize` взрывает текстуру).
- Команда 8 кораблей обязательна в UI; сессия команды: `prepareSession.ts` (memory + sessionStorage). Флаг `teamReady`, чтобы `loadOwnedUnits` не затирал восьмёрку пустым сейвом.
- `startMatch`: оценка газа ×1.3, минимум 12M; оверлей «RESOLVING…»; повторный клик блокируется.
- Корабли в слоте: `UnitVisualFactory` через **`setDisplaySize(slotSize)`**, не `setScale` от портрета 360px.

### Коллекция (`CollectionScene.ts`)
- Снова **левая половина 0–960**, не fullscreen.
- Фон панели **непрозрачный** (`alpha 1`), иначе Prepare просвечивает сквозь дырки слотов.
- Пока открыта: `PrepareScene.input.enabled = false`. На shutdown/GO BACK/Esc — включить обратно.
- Клик **x > 960** или Esc закрывает.
- Сетка 5 колонок, превью ~820 внутри половины, GO BACK по центру панели (480).
- Клик = multi-select, даблклик = в команду / экипировать.

### Старт (`BootScene.ts`)
- Только логотип + CONNECT WALLET. Без titlebar/testnet-плашки/`outer_frame`.

### Кошелёк
- `WalletSelectScene` удалена. RainbowKit модал.
- `WalletManager`: нет dummy `0x000…1`; `setSession` / `restoreFromWindow`.
- ABI вынесен в `frontend/src/lib/abis.ts`.

### Ассеты
- UI-хром перерисован (слоты, кнопки, профиль, рамки редкости). Скрипт: `scripts/optimize-ui-assets.py`.
- `outer_frame.png` больше **не вешается** на Prepare/Boot/Battle: новая текстура с толстой рамкой накрывала UI (depth 200).
- Модели кораблей и иконки реликвий не менялись по смыслу (только вписывание в слот).

### Контракты (не в этой сессии UI, но в рабочем дереве)
- `StarForgeGame.sol` / `StarForgeBattleLibrary.sol` — Shadow Fleet + Variant 1 events.
- Тесты: `test/StarForgeGame.test.js`.
- Скрипты прогонов: `scripts/testnet-*.js`.

## Известные дыры (проверять в первую очередь)
1. **Collection + Prepare одновременно.** `scene.launch`. Правая половина — живой Prepare. Следить, чтобы сетка/превью не вылезали за x=960 и чтобы Prepare не просвечивал слева.
2. **Глубины.** Старый spec (рамка 200, слоты 10) частично мёртв: `outer_frame` снят. Проверить клики и drag.
3. **Логотип ×2.5** может снова прижимать заголовок флота — проверить зазор logo bottom vs `fleetTitleY`.
4. **AUTO/CLEAR** у реликвий: не пересекать слоты реликвий и левую колонку кнопок.
5. **Shop empty slots** раньше дублировали `slot_shop` в нативном размере — проверено, второй спрайт не должен быть.
6. **TODO.md / CHANGELOG / FRONTEND_ARCH** до этого хэндоффа были **устаревшими** (Variant 1 «отложен», startBattle «заглушка»). Актуальная картина — этот файл + обновлённые доки от 13.08.2026.
7. **Лимиты магазина / реролл / daily 10** — пользователь тестирует сам. Не ломать без запроса.
8. **Браузерная проверка** в этой сессии не гонялась энд-то-энд с кошельком. Сборка `frontend`: `tsc && vite build` проходила.

## Карта файлов (фронт)
```
frontend/src/main.ts                 Phaser 1920x1080 FIT
frontend/src/main-react.tsx          RainbowKit / wagmi
frontend/src/scenes/BootScene.ts
frontend/src/scenes/PrepareScene.ts  главный хаб
frontend/src/scenes/CollectionScene.ts  launch поверх Prepare
frontend/src/scenes/BattleScene.ts
frontend/src/utils/HudChrome.ts      размеры + gridFirstCenter
frontend/src/utils/UnitVisualFactory.ts  слот = displaySize
frontend/src/lib/contractAddresses.ts
frontend/src/lib/abis.ts
frontend/src/lib/prepareSession.ts
frontend/src/lib/WalletManager.ts
```

## Как гонять
```
cd frontend
npm run dev
```
Кошелёк → testnet 50312 → Prepare. Команда должна переживать бой. Коллекция — левая половина.

Контракты: Hardhat, сеть `somniaTestnet`. Деплой Game: см. `DEPLOYMENT.md` (новый Game + setGameContract на NFT/Relic/Profile).

## Чего не делать без явного «да»
- Новый деплой контрактов
- Перерисовка UI «ещё раз с нуля»
- Магазин / реролл / цены / лимиты
- Возврат `outer_frame` на Prepare
- Полноэкранная коллекция
