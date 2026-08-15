# FRONTEND_ARCH.md — Архитектура фронтенда

**Стек:** Phaser 3.90.0 + Vite + TypeScript + React (только кошелёк) + viem/wagmi + RainbowKit  
**Дата актуализации:** 13.08.2026

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
- Транзакции: `walletClient.sendTransaction` (не сырой `window.ethereum`).
- ABI: `frontend/src/lib/abis.ts`. Адреса: `frontend/src/lib/contractAddresses.ts` = `DEPLOYMENT.md`.

## PrepareScene
Три колонки, координата слота = **центр** ячейки.

- Оси: `leftX=250`, `centerX=960`, `rightX=1670` (`HudChrome.ts`).
- Первая ячейка ряда: `gridFirstCenter(center, count, size, gap)`. Нельзя считать `center - totalWidth/2` как x первого слота — сетка уедет влево.
- Слева на одной оси: профиль, шоп (3), кнопки REROLL / BUY / GENERATE / COLLECTION.
- Центр: YOUR FLEET n/8, сетка 4×2, ниже RELICS + 3 слота.
- AUTO и CLEAR — **слева и справа от equipped relics**, не у заголовка флота.
- Справа: ENEMY FLEET 4×2.
- START BATTLE по центру снизу.
- Команда 8 обязательна. `team` — массив из 8 слотов, `0` = пусто. Пустые слоты на контракте = сильный ИИ (Shadow Fleet).
- Сессия: `lib/prepareSession.ts` хранит команду и 3 реликвии. Экип из коллекции **локальный**, без `equipRelics`. В бой уходит в `startMatch`.
- Флаг `teamReady`: не сейвить пустую команду до restore.
- `startMatch`: gas ×1.3, min 12M; оверлей; антидаблклик.
- Корабль в слоте: `UnitVisualFactory.createUnitWithFrame(..., slotSize)` → `setDisplaySize`, не scale от 360px.
- Пустой слот флота: пульс **только alpha**. `scaleX` ломает `setDisplaySize`.
- `outer_frame` на этой сцене **не рисуется**.

## CollectionScene
- `launch` поверх Prepare. Левая половина **0–960**, непрозрачная панель + затемнение справа.
- Пока открыта: `PrepareScene.input.enabled = false`. На stop/shutdown — `true`.
- Клик `x > 960` или Esc / GO BACK — закрыть.
- Сетка ангара 4 колонки + инспектор справа. Фильтры — чипы (редкость / фракция / класс или тип реликвии).
- Клик = select + инспектор. Даблклик или кнопка ADD/EQUIP = в команду / экипировать. Мультиселект + ADD N в доке.
- Корабли в команде и экипированные реликвии в списке не показываются.

## BattleScene
- Данные: events / playerWon / HP / unit visuals из логов `BattleResolved` + `BattleEventEmitted` (Variant 1, не storage).
- Скорость через `time.timeScale` / `tweens.timeScale`:
  - normal **2.55**, x2 **5.1**, Skip **7.65** (от исходного таймлайна).
- Skip **не** skip-to-result. На итоге клавиши ведут назад.
- Лог: 6 строк, CRIT / DODGE / Last Stand / DESTROYED.
- HP-бары видны с первого кадра.
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
frontend/src/lib/WalletManager.ts
frontend/src/lib/prepareSession.ts
frontend/src/lib/abis.ts
frontend/src/lib/contractAddresses.ts
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
