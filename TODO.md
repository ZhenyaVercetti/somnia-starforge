# TODO — StarForge

Актуально **2026-10-03**. Курс: [StarForge_GDD_v1.7.md](StarForge_GDD_v1.7.md). Очередь: [BUILD_SEQUENCE.md](BUILD_SEQUENCE.md). Адреса: [DEPLOYMENT.md](DEPLOYMENT.md).

Старый P0 «доработать Phaser/карточки до 8/10» снят. Legacy-бой не принят и не чинится.

## Сейчас
- [ ] Feed 1. Клиент v2, ветка `client-v2`, папка `frontend-v2/`. [docs/build/01_CLIENT_V2.md](docs/build/01_CLIENT_V2.md). Контракты не трогать.
- [ ] Приёмка превью-боя и кошелька на старом `startMatch`.
- [ ] Feed 2. Кузница, [docs/build/02_FORGE.md](docs/build/02_FORGE.md). Только после приёмки визуала.
- [ ] Feed 3. NFT metadata и Echo, [docs/build/03_NFT.md](docs/build/03_NFT.md). Только после кузницы на тестнете.
- [ ] Feed 4, не блокер. Упаковка логов боя, [docs/build/04_GAS.md](docs/build/04_GAS.md). После приёмки реплея. Сначала замер `gasUsed`.

## Не делать
- Не чинить `frontend/` ради нового боя.
- Не усложнять библиотеку боя.
- Не передавать Foundry в `setGameContract`.
- Не передеплоить NFT и Profile без плана миграции.
- Не вести внутреннюю монету, пилотов, рейды, VRF в бой.

## ARCHIVE — снято 2026-10-03
P0 от 20.08: доработка `#battle3d` и hangar-портретов до 8/10. Заменено клиентом v2. Снимок: [AUDIT_HANDOFF.md](AUDIT_HANDOFF.md).
