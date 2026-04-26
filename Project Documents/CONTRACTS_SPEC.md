# CONTRACTS_SPEC.md

**Версия:** 1.2 (26 апреля 2026)  
**Адрес Game:** 0xA8D096516d744e747FB9C735d20AAC1dEe079bac

**Фронтенд архитектура:**  
- BootScene, PrepareScene, BattleScene (Phaser 3.90.0)

**Shop (Вариант B):**  
- playerShopPreview[address][5]  
- rerollShop → только preview  
- buyFromShop / buyUnit → минтит реальный NFT

**Battle:**  
- Полные синергии фракций (Empire +30% def, Voidborn +45% atk, Mechanoids +25% power)  
- Rewards: 1–3 юнита в зависимости от score + synergyCount

**getPlayerUnits** — через mapping (оптимизировано).

**Планы v1.2:**  
- Постоянный ИИ-противник (on-chain хранение currentOpponent)  
- Генерация новой команды ИИ только после победы игрока  
- Глобальные баффы уровня применяются к ИИ

**Статус:** v1.1 полностью завершена.