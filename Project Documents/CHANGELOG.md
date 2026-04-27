# CHANGELOG — Somnia StarForge

## v1.3.4 — Полировка (27 апреля 2026)
- Названия артефактов теперь отображаются под слотами в магазине
- AI Opponent перенесён к правой стенке PrepareScene
- Увеличены и стабилизированы задержки после buy/reroll/startMatch (3 секунды)
- Улучшена очистка временных текстов и сообщений об ошибках
- Hover tooltip и drag-and-drop финальная полировка
- Обновлены все основные документы (GDD, CHANGELOG, DEPLOYMENT, TODO)
- Подготовка к v1.4

## v1.3 — Система артефактов + Полноценный on-chain бой (27 апреля 2026)
- Добавлен StarForgeRelic.sol (ERC-1155) с sequential ID и генерацией красивых имён
- Переписан StarForgeBattleLibrary.sol (решение stack too deep)
- Реализована полная система реликвий (_applyRelics, 6 типов эффектов)
- rerollShop + buyFromShop теперь работают с артефактами
- Полностью on-chain пошаговый бой (12 раундов, скорость, криты, last stand)
- startMatch возвращает BattleEvent[] + визуализация в BattleScene
- Постоянный ИИ-противник (ленивая генерация в startMatch)
- Профиль игрока (level, xp, wins, losses)

## v1.2 — Постоянный ИИ-противник и прогрессия (27 апреля 2026)
- Постоянный ИИ-оппонент (playerCurrentAI + _generateAIOpponent)
- Полностью рабочий drag-and-drop (один юнит на слот, replace, remove по клику / double-click)
- Hover tooltip на всех юнитах (owned, team, shop, AI)
- Исправлены buyUnit, rerollShop, buyFromShop
- Автообновление UI после действий
- Разбивка фронтенда на сцены (BootScene → PrepareScene → BattleScene)

## v1.1 — Полировка UX (26 апреля 2026)
- Hover tooltip на всех юнитах
- Подсветка team-slots + защита от stacking
- Плавные анимации появления новых юнитов
- Автообновление интерфейса
- Улучшенная обработка ошибок и очистка временных текстов

## v1.0 — MVP Core Loop (25–26 апреля 2026)
- Базовая покупка юнитов
- Формирование команды
- Запуск on-chain матча
- Базовая визуализация боя