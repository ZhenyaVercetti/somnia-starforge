# STATUS

Срез на 15.10.2026. Адреса — только [DEPLOYMENT.md](DEPLOYMENT.md).

## На main

- Контракты тестнета — набор v1.6. Game, NFT, Relic и Profile с 17.08.2026 не передеплоены.
- Foundry и Echo не задеплоены.
- Клиент один: `frontend/`. Phaser ведёт Boot, Prepare, коллекцию и кошелёк. Бой — React Three Fiber в `frontend/src/battle/`, коммит `0649cb7` от 10.10.2026.
- `startMatch` и `?previewBattle=1` открывают одну сцену.
- 12 GLB в `frontend/public/assets/ships/` — процедурные заглушки, не image-to-3D. Генератор удалён.
- 12 портретов на месте. Файлы Empire приведены к `emperial_*`: загрузчик ангара просит нижний регистр, на Linux `Emperial_*` не находился.

## Принято

- Разрешение боя в `startMatch`. Клиент не пересчитывает урон.
- Магазин, ангар, Prepare и кошелёк на текущих контрактах.
- Курс дизайна: кузница — ядро, бой — проверка корпуса. См. [docs/GDD.md](docs/GDD.md).

## Не принято

- Визуал боя и текущие двенадцать корпусов.
- Кузница, metadata / Echo, упаковка газа, деплой в mainnet.

## Блокер корпусов

`grok-imagine-3d` на команде `e6b727ae-7a90-4c3f-bf60-9ab135a157be` отвечает HTTP 400:

```text
code: invalid-argument
error: Zero Data Retention teams do not have access to deferred endpoints. Indeed, those endpoints require to store data.
```

Тикет **T-G99754**. В консоли у этой команды ZDR выглядит выключенным, API на генерации отвечает, что команда Zero Data Retention. Пока расхождение не снято, прогон 12 портретов невозможен. Корпуса вручную не подменять.

Полный разбор: [docs/archive/image-to-3d-access-report.md](docs/archive/image-to-3d-access-report.md).

## RPC

Клиент на `https://api.infra.testnet.somnia.network/`, chain id 50312. Hardhat `somniaTestnet` по умолчанию остаётся на `https://dream-rpc.somnia.network`. 15.10.2026 оба ответили `eth_chainId` `0xc488`.

Mainnet RPC в Hardhat не заполнен: плейсхолдер `REPLACE_WITH_SOMNIA_MAINNET_RPC`. Это задача [фазы 5](ROADMAP.md). Официальный `https://api.infra.mainnet.somnia.network/` в тот же день ответил `0x13a7` (5031).

## Открыто

- Переносить ли достижения `first_battle`, `first_blood`, `last_stand` в сцену R3F. Их выдавала только старая Phaser-сцена. Живой `startMatch` с коммита `0649cb7` их уже не выдавал.
