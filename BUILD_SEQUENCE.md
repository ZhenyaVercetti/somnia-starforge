# StarForge — последовательность для Build

Актуально 2026-10-03. Адреса только в [DEPLOYMENT.md](DEPLOYMENT.md). Старый GDD [Somnia_StarForge_GDD_v1.6.md](Somnia_StarForge_GDD_v1.6.md) снят с курса. Текущий дизайн: [StarForge_GDD_v1.7.md](StarForge_GDD_v1.7.md).

Build кормить по одному файлу. Следующий файл не давать, пока текущий не принят. GDD не скармливать как задачу.

## Очередь

1. [docs/build/01_CLIENT_V2.md](docs/build/01_CLIENT_V2.md) — новый клиент и бой. Контракты не трогать.
2. [docs/build/02_FORGE.md](docs/build/02_FORGE.md) — кузница. Только после приёмки визуала и реплея.
3. [docs/build/03_NFT.md](docs/build/03_NFT.md) — оформление NFT и торгуемое Эхо. Только после кузницы на тестнете.
4. [docs/build/04_GAS.md](docs/build/04_GAS.md) — возможный следующий этап, не блокер. Упаковка логов боя. Разрешение остаётся в `startMatch`. Не начинать, пока не принят реплей клиента v2.

Не в этой очереди: пилоты, внутренняя монета, сезоны, рейды, новые боевые эффекты, передача боевого корабля, продажа пыли, VRF в бою.

## Приёмка между шагами

- После 1: `/battle?preview=1` показывает меши, четыре оружия, crit, dodge, last stand, kill, звук. Кошелёк проходит buy, reroll, equip, `startMatch` по старым контрактам. `frontend/` не изменён.
- После 2: salvage, reforge, ascend на тестнете. `startMatch` и библиотека боя не менялись. Новые адреса вписаны в [DEPLOYMENT.md](DEPLOYMENT.md).
- После 3: боевой токен отдаёт нормальные metadata и помечен непередаваемым. Эхо передаётся и не читается боем.
- После 4: тот же победитель и те же удары на фикстуре, `gasUsed` ниже замера. Новый Game в [DEPLOYMENT.md](DEPLOYMENT.md). Foundry в `setGameContract` не передавать.

## Ветка

Шаг 1 — ветка `client-v2`, код в `frontend-v2/`. Шаги 2 и 3 — ветки `forge` и `nft-echo` от принятого `client-v2`. Шаг 4 — ветка `gas-battle`. В `main` не сливать, пока шаг не принят.
