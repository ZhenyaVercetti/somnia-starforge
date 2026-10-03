# Mainnet checklist

Статус 2026-10-03: не следующий шаг. Mainnet chain id 5031, токен SOMI, RPC [https://api.infra.mainnet.somnia.network/](https://api.infra.mainnet.somnia.network/). Не деплоить, пока не приняты клиент v2 и кузница.

Курс: [StarForge_GDD_v1.7.md](StarForge_GDD_v1.7.md). Очередь: [BUILD_SEQUENCE.md](BUILD_SEQUENCE.md).

Снято с этого списка: StarForgeToken, prize pool, пилоты, сезонные коллекции как условие релиза.

Домены `starforge.somi` и `starforgegame.somi` уже есть. Новые не покупать ради релиза.

- [ ] Принят [frontend-v2](docs/build/01_CLIENT_V2.md) и превью-бой
- [ ] Кузница на тестнете, адрес в [DEPLOYMENT.md](DEPLOYMENT.md)
- [ ] Echo и metadata боевых токенов приняты, [docs/build/03_NFT.md](docs/build/03_NFT.md)
- [ ] Замер `gasUsed` боя. [Feed 4](docs/build/04_GAS.md) сделан, если лимит ещё тесный
- [ ] Контракты верифицированы на [explorer.somnia.network](https://explorer.somnia.network/)
- [ ] Отдельный mainnet-деплой, testnet-адреса в [DEPLOYMENT.md](DEPLOYMENT.md) не затирать
- [ ] Клиент смотрит на chain id 5031
