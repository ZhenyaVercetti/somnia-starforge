# TODO — Somnia StarForge

## Приоритет 0 (Блокер)
- [x] Поднять все временные тексты на самый верх (PrepareScene, BattleScene)
- [x] Исправить позиционирование Team-блока и логотипа
- [x] Добавить параллакс-фон в BootScene
- [x] Сделать модал авторизации полупрозрачным
- [x] Протестировать replay боя через события (после деплоя Game v1.6)
- [x] Доработать BattleScene: частицы двигателей, улучшенные взрывы, live HP бары
- [x] Полностью переработанная CollectionScene с фильтрами и multi-select
- [x] Полная механика equipped relics (drag, swap, unequip)
- [x] Исправлена система глубин и input во всех сценах
- [x] Финальное тестирование и полировка BattleScene
- [ ] Подготовка к mainnet (оптимизация газа)
- [ ] Анти-абуз минтинга: daily limit 10 buyUnit + +1 бесплатный корабль за level-up  
- [x] Полностью переработать BattleScene (2.5D + частицы + анимации) — завершено в v1.6

## Приоритет 1 (Высокий) — Актуально на 13.05.2026
- [x] Исправить систему глубин (PrepareScene + CollectionScene)
  - Корабли/реликвии: depth 8
  - Слоты/рамки: depth 10 (только визуальные, интерактивность отключена)
  - Drag: depth 30
  - Tooltip: depth 100
  - Внешняя рамка: depth 200
- [x] Починить hover, drag, double-click на юнитах в команде (PrepareScene)
- [x] Добавить полноценный drag + click (unequip/swap) для equipped relics


## Приоритет 2 (Средний)
- [x] Полная переработка CollectionScene (фильтры, multi-select, превью, floating panel)
- [x] Механика equipped relics (drag between slots + unequip)
- [ ] Улучшенный боевой лог (цвета, иконки, анимация событий)
- [ ] Экран победы/поражения с анимацией

## Приоритет 3 (Низкий)
- [ ] Улучшенные туториалы
- [ ] Система достижений
- [ ] Звуки и музыка

## Готово в v1.6.1 (13.05.2026)
- Полная синхронизация глубин и input между PrepareScene и CollectionScene
- Рабочий drag & drop + double-click для юнитов в команде
- Полноценный drag + click для equipped relics (свап + unequip)
- Визуальная полировка (пульсация, реальные портреты, единый стиль кнопок)



дополнительное ТЗ после полировок 1.6 

ТЗ: Газ-оптимизация lastBattleEvents (Вариант 1)
Задача:
Оптимизировать хранение истории последнего боя в StarForgeGame.sol для снижения gas cost на 1.8–2.1 млн gas за матч.
Приоритет: Высокий (v1.7 / после основного релиза v1.6)
Статус: Отложено. Сохранить в TODO.md
1. Текущая проблема
В функции startMatch после _simulateBattle происходит:

delete lastBattleEvents[msg.sender]
Цикл push до 120 BattleEvent (каждый с полями + string specialEffect)
Аналогично для lastPlayerMaxHp и lastAIMaxHp

Ориентировочная стоимость: 2.0–2.8 млн gas только на запись истории боя.
2. Решение (Вариант 1 — рекомендуемый)

Полностью убрать хранение lastBattleEvents в storage.
Оставить только краткий summary + bytes32 lastBattleId.
Все детальные события боя отправлять через emit (логи).
Фронтенд для реплея использует события по lastBattleId + getLogs.

Ожидаемая экономия: 1.8–2.1 млн gas за один матч (≈ 75–80%).
3. Точные изменения в коде
3.1 Удалить из контракта
mapping(address => StarForgeBattleLibrary.BattleEvent[]) public lastBattleEvents;
3.2 Добавить новые переменные и события
solidity
bytes32 public lastBattleId;

event BattleResolved(
    bytes32 indexed battleId,
    address indexed player,
    bool playerWon,
    uint16[] playerMaxHp,
    uint16[] aiMaxHp
);

event BattleEventEmitted(
    bytes32 indexed battleId,
    uint8 round,
    bool isPlayerSide,
    uint8 attackerIndex,
    uint8 targetIndex,
    uint16 damage,
    uint16 remainingHp,
    string specialEffect
);3.3 Обновить функцию startMatch (заменить блок после симуляции)
Старый код (удалить):
delete lastBattleEvents[msg.sender];
for (uint256 i = 0; i < result.events.length; i++) {
    lastBattleEvents[msg.sender].push(result.events[i]);
}

delete lastPlayerMaxHp[msg.sender];
... (аналогично для aiMaxHp)
Новый код (вставить вместо):
solidity
bytes32 battleId = keccak256(abi.encodePacked(
    msg.sender,
    block.timestamp,
    block.prevrandao,
    result.playerWon
));

lastBattleId = battleId;

lastPlayerWon[msg.sender] = result.playerWon;

delete lastPlayerMaxHp[msg.sender];
for (uint256 i = 0; i < result.playerMaxHp.length; i++) {
    lastPlayerMaxHp[msg.sender].push(result.playerMaxHp[i]);
}

delete lastAIMaxHp[msg.sender];
for (uint256 i = 0; i < result.aiMaxHp.length; i++) {
    lastAIMaxHp[msg.sender].push(result.aiMaxHp[i]);
}

// Эмитим summary
emit BattleResolved(battleId, msg.sender, result.playerWon, result.playerMaxHp, result.aiMaxHp);

// Эмитим все события боя (дешево)
for (uint256 i = 0; i < result.events.length; i++) {
    StarForgeBattleLibrary.BattleEvent memory e = result.events[i];
    emit BattleEventEmitted(
        battleId,
        e.round,
        e.isPlayerSide,
        e.attackerIndex,
        e.targetIndex,
        e.damage,
        e.remainingHp,
        e.specialEffect
    );
}
3.4 Обновить getLastBattleResult
Оставить как есть (он уже использует lastPlayerWon, lastPlayerMaxHp, lastAIMaxHp).
Добавить возврат lastBattleId.
4. Что делать с фронтендом (позже)

В BattleScene или ResultScene подписаться на BattleResolved и BattleEventEmitted по lastBattleId.
Для реплея собирать события через viem.getLogs или wagmi useWatchContractEvent.

5. Дополнительно

После деплоя новой версии Game обновить DEPLOYMENT.md.
Протестировать на testnet: убедиться, что replay работает и gas упал.
Добавить в clearPlayerUnits также очистку lastBattleId (опционально).