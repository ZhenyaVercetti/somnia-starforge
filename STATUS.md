# STATUS

Срез на 15.10.2026. Адреса — только [DEPLOYMENT.md](DEPLOYMENT.md).

## На main

- Контракты тестнета — набор v1.6. Game, NFT, Relic и Profile с 17.08.2026 не передеплоены.
- Foundry и Echo не задеплоены.
- Клиент один: `frontend/`. Phaser ведёт Boot, Prepare, коллекцию и кошелёк. Бой — React Three Fiber в `frontend/src/battle/`, коммит `0649cb7` от 10.10.2026.
- `startMatch` и `?previewBattle=1` открывают одну сцену.
- 12 GLB в `frontend/public/assets/ships/` — заглушки из `frontend/tools/build_ships.py`. Это не результат image-to-3D.
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

## RPC, проверено 15.10.2026

Оба тестнет-адреса ответили `eth_chainId` = `0xc488` (50312):

- официальный `https://api.infra.testnet.somnia.network/`
- тот, что в клиенте и в Hardhat по умолчанию: `https://dream-rpc.somnia.network`

Официальный mainnet `https://api.infra.mainnet.somnia.network/` ответил `0x13a7` (5031). В `hardhat.config.js` сеть `somniaMainnet` всё ещё смотрит на плейсхолдер `REPLACE_WITH_SOMNIA_MAINNET_RPC`, чтобы случайный деплой туда не ушёл.

Клиент на официальный тестнет-RPC не переключался.

## Открыто

- Переключать ли клиент и Hardhat с `dream-rpc` на официальный testnet RPC. Оба живые.
- Удалять ли `frontend/tools/build_ships.py` после того, как появятся настоящие GLB. Сейчас скрипт оставлен и помечен «не запускать».
- Переносить ли достижения `first_battle`, `first_blood`, `last_stand` в сцену R3F. Их выдавала только старая Phaser-сцена. Живой `startMatch` с коммита `0649cb7` их уже не выдавал.
- Заполнять ли mainnet RPC в Hardhat. Плейсхолдер оставлен нарочно.
