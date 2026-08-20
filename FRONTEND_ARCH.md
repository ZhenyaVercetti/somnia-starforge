# FRONTEND_ARCH.md — Архитектура фронтенда

**Стек:** Phaser 3.90.0 + Three.js 0.185 (только слой боя) + Vite + TypeScript + React (только кошелёк) + viem/wagmi + RainbowKit  
**Дата актуализации:** 20.08.2026

Игра 1920×1080, `Phaser.Scale.FIT`, центр. Шрифты: Orbitron (заголовки), Rajdhani (UI) — Google Fonts в `index.html`.

## Сцены

| Сцена | Ключ | Как открывается |
|---|---|---|
| BootScene | `BootScene` | старт |
| PrepareScene | `PrepareScene` | после кошелька / возврат из боя |
| CollectionScene | `CollectionScene` | `scene.launch` поверх Prepare |
| BattleScene | `BattleScene` | `scene.start` после `startMatch` |

`WalletSelectScene` **удалена**. Кошелёк: RainbowKit модал (`WalletModal.tsx` + `main-react.tsx`).

## Кошелёк
- `WalletManager`: `setSession` / `restoreFromWindow`. Запрещён dummy-аккаунт `0x000…1`.
- Клиенты: `window.account`, `window.publicClient`, `window.walletClient`.
- Транзакции: `walletClient.sendTransaction` (не сырой `window.ethereum`). Перед tx — chain id **50312**.
- ABI: `frontend/src/lib/abis.ts`. Адреса: `frontend/src/lib/contractAddresses.ts` = `DEPLOYMENT.md` (`0x064f…`).
- `WalletManager.chainId` берётся из `walletClient.chain.id`.
- `startGame` ретраит Phaser и стопает Collection. Dismiss модалки во время коннекта не рвёт вход.

## PrepareScene
Три колонки, координата слота = **центр** ячейки.

- Оси: `leftX=250`, `centerX=960`, `rightX=1670` (`HudChrome.ts`).
- Первая ячейка ряда: `gridFirstCenter(center, count, size, gap)`. Нельзя считать `center - totalWidth/2` как x первого слота — сетка уедет влево.
- Слева на одной оси: профиль, шоп (3), кнопки REROLL / BUY / GENERATE / COLLECTION.
- Центр: YOUR FLEET n/8, сетка 4×2, ниже RELICS + 3 слота.
- AUTO и CLEAR — **слева и справа от equipped relics**, не у заголовка флота.
- Справа: ENEMY FLEET 4×2.
- START BATTLE по центру снизу.
- Команда 8 обязательна. `team` — массив из 8 слотов, **`-1` = пусто**, `>= 0` = tokenId (включая 0). На контракт уходит compact без пустых.
- Сессия: `lib/prepareSession.ts`, `slotFormat: 2`. Старые сессии с нулями читаются как пустые слоты.
- Экип из коллекции локальный до боя. `startMatch` шлёт calldata **и** пишет `equippedRelics` в storage. После боя чейн помнит сет.
- Флаг `teamReady`: не сейвить пустую команду до restore.
- `addMultipleUnitsToTeam` только добивает свободные слоты, флот не чистит.
- Drag: контейнер слота, не child-sprite.
- `startMatch`: gas ×1.3, min 12M; оверлей; `matchBusy` + `txBusy`.
- Кэш `getUnit` на сессию Prepare. Статы в бой с `container.unit`.
- Корабль в слоте: `UnitVisualFactory.createUnitWithFrame(..., slotSize)` → `setDisplaySize`, не scale от 360px.
- Пустой слот флота: пульс **только alpha**. `scaleX` ломает `setDisplaySize`.
- `outer_frame` на этой сцене **не рисуется**.

## CollectionScene
- `launch` поверх Prepare. Левая половина **0–960**, непрозрачная панель + затемнение справа.
- Пока открыта: `PrepareScene.input.enabled = false`. На stop/shutdown — `true`.
- Load: generation token, ответ после `stop` игнорируется.
- Клик `x > 960` или Esc / C / GO BACK — закрыть.
- Туториал Hangar рисуется в левой половине (центр 480), NEXT не закрывает ангар.
- ADD в флот фильтрует сетку только по принятым id.
- Сетка ангара 4 колонки + инспектор справа. Фильтры — чипы (редкость / фракция / класс или тип реликвии).
- Клик = select + инспектор. Даблклик или кнопка ADD/EQUIP = в команду / экипировать. Мультиселект + ADD N в доке.
- Корабли в команде и экипированные реликвии в списке не показываются.

## BattleScene
- Данные: events / playerWon / HP / unit visuals из логов `BattleResolved` + `BattleEventEmitted` (Variant 1, не storage). Контрактный поток не менять.
- **Слой:** Three.js под прозрачным Phaser. Канвас `#battle3d` (`pointer-events: none`, z-index 0). Phaser HUD z-index 2 (HP, лог, SKIP/x2, итог). `#game` прозрачный, z-index 2.
- **Камера:** сверху-сбоку. Слоты: inner |x|=4.35, outer |x|=9.05, ряд z=`[-6.55,-2.18,2.18,6.55]`. Камера `(0, 5.15, 21.6)` → `(0, 1.28, 0)`, FOV 42. После боя `focusWinner`.
- **Корабли:** hangar 3/4 карточки (`hulls.ts`). Арт носом влево → UV-flip **игрока**. Размер `worldFit` в catalog (fighter 2.12 / cruiser 2.62 / dread 3.18). Overlay-оружие не вешается. Wreck = destroyed-портрет + tint.
- **Drone Swarm:** 6 уникальных дронов (`assets/units/drones/{faction}_{0..3}.png`), компактный pack, иглы со своих дул. Не копии истребителей.
- **Космос:** тёмный clear + star sphere + слои `nebula_mid` / `nebula_close` с параллаксом + пыль near/far + FogExp2. Без планеты, без `battle_sky` / `battle_void` как wallpaper.
- **Playback:** 1 event = 1 выстрел (тонкий dart / beam / slug / needle). Спокойный idle. Атака — короткий lunge. SKIP/x2 через `timeScale`. Phaser 3.90 ParticleEmitter **запрещён**.
- **Расширение фракций/классов:** `battleCatalog.ts` + PNG. BattleScene не хардкодить под 3 фракции / 4 класса.
- **Превью без кошелька:** `?previewBattle=1`.
- **Статус:** визуал **не принят** (4/10, цель 8/10). P0 = строй без наложений и вид полноценного космического боя. Не новый жанр.
- `outer_frame` не рисуется.

## BootScene
- Параллакс + логотип + CONNECT WALLET. Без рамки и без лишних плашек.

## Ключевые файлы
```
frontend/src/main.ts
frontend/src/main-react.tsx
frontend/src/scenes/BootScene.ts
frontend/src/scenes/PrepareScene.ts
frontend/src/scenes/CollectionScene.ts
frontend/src/scenes/BattleScene.ts
frontend/src/battle3d/BattleWorld.ts
frontend/src/battle3d/hulls.ts
frontend/src/battle3d/canvasHost.ts
frontend/src/utils/battleCatalog.ts
frontend/src/utils/battleTypes.ts
frontend/src/utils/battlePreview.ts
frontend/src/utils/HudChrome.ts
frontend/src/utils/UnitVisualFactory.ts
frontend/src/utils/MetaHud.ts
frontend/src/utils/uiFactory.ts
frontend/src/utils/preloadGameAssets.ts
frontend/src/lib/WalletManager.ts
frontend/src/lib/prepareSession.ts
frontend/src/lib/abis.ts
frontend/src/lib/contractAddresses.ts
frontend/src/lib/gameAudio.ts
frontend/src/lib/achievements.ts
frontend/src/lib/tutorial.ts
frontend/src/lib/lore.ts
frontend/src/lib/unitNormalize.ts
```

## Межсценные методы Prepare
- `addSingleUnitToTeam(unitId)`
- `addMultipleUnitsToTeam(ids)`
- `equipSingleRelic(relicId)`
- `addMultipleRelicsToEquipped(ids)`
- `returnUnitToCollection` / `returnRelicToCollection` (если вызываются)

## Чего больше нет
- `WalletSelectScene.ts`
- `frontend/src/counter.ts`
- Полноэкранная коллекция (откатили 13.08)
- `outer_frame` поверх Prepare/Boot/Battle
- `battleCinema.ts`, `combatVfx.ts`, `BATTLE_REWORK_PROMPT.md`
