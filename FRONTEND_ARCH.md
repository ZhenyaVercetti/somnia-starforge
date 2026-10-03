# FRONTEND_ARCH.md

Актуально 2026-10-03. Дизайн: [StarForge_GDD_v1.7.md](StarForge_GDD_v1.7.md).

## Legacy — `frontend/`

Phaser 3.90.0 + Three.js 0.185 + Vite + React только для кошелька. Сцены: Boot, Prepare, Collection overlay, Battle. Бой: Phaser HUD поверх `BattleWorld`. Корабли — карточки в `battle3d/hulls.ts`. Визуал не принят.

Этот клиент не развивать. Он остаётся запускаемым, пока v2 не принят. Адреса в [frontend/src/lib/contractAddresses.ts](frontend/src/lib/contractAddresses.ts) должны совпадать с [DEPLOYMENT.md](DEPLOYMENT.md). Chain id 50312.

Контрактный поток, который v2 обязан сохранить: `buyUnit`, `buyFromShop`, `rerollShop`, `generateTenShips`, `claimLevelUpShips`, `equipRelics`, `startMatch`. События боя: `BattleResolved` и `BattleEventEmitted`. Эффект 1 crit, 2 dodge, 3 last stand.

## Planned — `frontend-v2/`

Ещё не в `main`. Ветка `client-v2`. React + React Three Fiber, один canvas. Phaser не импортировать. Старые PNG корпусов не грузить.

Экраны: `/` кошелёк, `/forge` алтарь, `/collection`, `/battle`. Превью без кошелька: `/battle?preview=1`.

Спека: [docs/build/01_CLIENT_V2.md](docs/build/01_CLIENT_V2.md). Кузница и Echo подключаются следующими файлами [BUILD_SEQUENCE.md](BUILD_SEQUENCE.md), не этим.
