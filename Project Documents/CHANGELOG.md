## v1.2 (26 апреля 2026) — НЕ ЗАВЕРШЁН
- Добавлена логика постоянного ИИ-противника (playerCurrentAI, _generateAIOpponent, getCurrentAI)
- Добавлена initializeShopPreview
- BUY_PRICE / REROLL_PRICE = 0 (тестнет)
- Обновлён фронтенд (loadCurrentAI, placeholder в shop, gas-лимиты)

**КРИТИЧЕСКАЯ ПРОБЛЕМА:** buyUnit, buyFromShop и rerollShop НЕ РАБОТАЮТ (постоянные revert). Core loop сломан. v1.2 нельзя считать завершённым.