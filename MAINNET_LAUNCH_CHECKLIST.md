# Mainnet checklist

Статус 15.10.2026: не следующий шаг. Mainnet chain id 5031, токен SOMI, RPC [https://api.infra.mainnet.somnia.network/](https://api.infra.mainnet.somnia.network/) (в этот день ответил `0x13a7`). Не деплоить, пока не приняты бой в `frontend/` и кузница.

Курс: [docs/GDD.md](docs/GDD.md). Очередь: [ROADMAP.md](ROADMAP.md), фаза 5.

Снято с этого списка: StarForgeToken, prize pool, пилоты, сезонные коллекции как условие релиза. Отдельный клиент v2 снят решением от 15.10.2026.

Домены `starforge.somi` и `starforgegame.somi` уже есть. Новые не покупать ради релиза.

- [ ] Принят бой в `frontend/` ([ROADMAP](ROADMAP.md), фаза 1) и превью `?previewBattle=1`
- [ ] Кузница на тестнете, адрес в [DEPLOYMENT.md](DEPLOYMENT.md)
- [ ] Echo и metadata боевых токенов приняты ([ROADMAP](ROADMAP.md), фаза 3)
- [ ] Замер `gasUsed` боя. Фаза 4 сделана, если лимит ещё тесный
- [ ] Контракты верифицированы на [explorer.somnia.network](https://explorer.somnia.network/)
- [ ] Отдельный mainnet-деплой, testnet-адреса в [DEPLOYMENT.md](DEPLOYMENT.md) не затирать
- [ ] Клиент смотрит на chain id 5031
- [ ] В Hardhat заполнен mainnet RPC. До этой фазы плейсхолдер `REPLACE_WITH_SOMNIA_MAINNET_RPC` не снимать. Официальный URL: `https://api.infra.mainnet.somnia.network/`
