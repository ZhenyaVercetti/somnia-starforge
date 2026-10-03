# Mainnet checklist

Статус 2026-10-03: не следующий шаг. Mainnet chain id 5031, токен SOMI, RPC `https://api.infra.mainnet.somnia.network/`. Не деплоить, пока не приняты клиент v2 и кузница.

Снято с этого списка: StarForgeToken, prize pool, пилоты, сезонные коллекции как условие релиза.

Домены `starforge.somi` и `starforgegame.somi` уже есть. Новые не покупать ради релиза.

- [ ] Принят `frontend-v2` и превью-бой
- [ ] Кузница на тестнете, адрес в `DEPLOYMENT.md`
- [ ] Echo и metadata боевых токенов приняты
- [ ] Замер `gasUsed` боя. Feed 4 сделан, если лимит ещё тесный
- [ ] Контракты верифицированы на explorer
- [ ] Отдельный mainnet-деплой, testnet-адреса в `DEPLOYMENT.md` не затирать
- [ ] Клиент смотрит на chain id 5031
