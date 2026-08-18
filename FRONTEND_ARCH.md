# FRONTEND_ARCH.md — Архитектура фронтенда

**Стек:** Phaser 3.90.0 + Vite + TypeScript + React (только кошелёк) + viem/wagmi + RainbowKit  
**Дата актуализации:** 17.08.2026

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
- Данные: events / playerWon / HP / unit visuals из логов `BattleResolved` + `BattleEventEmitted` (Variant 1, не storage).
- **Статус 17.08: playback неприемлем.** Слой cinema / частицы / крен кораблей отклонён. Не латать. Полный реворк — TODO P0.
- Контрактный поток не менять.
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
frontend/src/utils/HudChrome.ts
frontend/src/utils/UnitVisualFactory.ts
frontend/src/utils/combatVfx.ts
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
