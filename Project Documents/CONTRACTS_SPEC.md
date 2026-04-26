# CONTRACTS_SPEC.md

**Версия:** 1.2 (26 апреля 2026) — НЕ ЗАВЕРШЁН
**Адрес Game (последний):** 0x0BB53b8b1e8Cb7Fc287d7cc35535705a1407Dc3C

**Статус:**
- Логика ИИ и shop preview добавлена
- BUY_PRICE = 0, REROLL_PRICE = 0
- **КРИТИЧЕСКАЯ ОШИБКА:** buyUnit / buyFromShop / rerollShop постоянно ревертят ("Incorrect payment")

**Что нужно проверить в первую очередь:**
- Реальные значения BUY_PRICE / REROLL_PRICE
- setUnitNFT / setGameContract после последнего деплоя
- paused() == false