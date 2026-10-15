# Архитектура клиента

Актуально 15.10.2026. Дизайн: [docs/GDD.md](docs/GDD.md). Клиент один: `frontend/`.

## Оболочка — Phaser 3.90

Vite + TypeScript. React только для кошелька (`src/main-react.tsx`, RainbowKit) и для боя.

| Сцена | Файл | Роль |
|---|---|---|
| Boot | `src/scenes/BootScene.ts` | Логотип, CONNECT. `?previewBattle=1` открывает бой |
| Prepare | `src/scenes/PrepareScene.ts` | Флот, магазин, реликвии, `startMatch` |
| Collection | `src/scenes/CollectionScene.ts` | Оверлей ангара |

Контрактный поток: `buyUnit`, `buyFromShop`, `rerollShop`, `generateTenShips`, `claimLevelUpShips`, `equipRelics`, `startMatch`.

После успешного разбора чека Prepare вызывает `openChainBattle`. События: `BattleResolved` и `BattleEventEmitted`. Байт эффекта: 1 crit, 2 dodge, 3 last stand. Клиент урон не считает.

Адреса: [src/lib/contractAddresses.ts](frontend/src/lib/contractAddresses.ts). Они должны совпадать с [DEPLOYMENT.md](DEPLOYMENT.md). Chain id 50312. RPC клиента: `https://dream-rpc.somnia.network`.

Портреты ангара: `public/assets/units/portraits/`, ключ `emperial` / `voidborn` / `mechanoid` и класс `fighter` / `cruiser` / `dreadnought` / `droneswarm`.

## Бой — React Three Fiber

Каталог `src/battle/`:

| Файл | Роль |
|---|---|
| `openBattle.tsx` | Монтирует сцену поверх страницы, прячет `#game`, усыпляет цикл Phaser |
| `BattleView.tsx` | Canvas, панель 1x / 2x / Skip, карточка итога |
| `ChainField.tsx` | Поле и проигрывание |
| `playback.ts` | Тайминг по уже посчитанным событиям |
| `shipMount.ts` | Грузит `/assets/ships/{empire\|voidborn\|mechanoids}_{fighter\|cruiser\|dreadnought\|swarm}.glb` |

Вход — `BattleInitData` из чека или из `src/utils/battlePreview.ts`. Закрытие возвращает на Prepare после настоящего боя и на Boot после превью.

Двенадцать GLB сейчас — заглушка. Замена описана в [ROADMAP.md](ROADMAP.md), фаза 1. Генератор `frontend/tools/build_ships.py` не запускать.

## Чего в клиенте больше нет

Phaser `BattleScene`, каталог `src/battle3d/`, спрайтовые корпуса, дроны, пушки и fx старого боя. Их постановка была в архиве, код снят 15.10.2026.
