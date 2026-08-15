# TODO — Somnia StarForge

Актуально **13.08.2026**. Контекст аудита: `AUDIT_HANDOFF.md`.

## Сейчас (после аудита 15.08.2026)
- [x] Аудит Prepare/Collection/Battle + контракты
- [x] Last Stand 1 раз, unique team/relics, previousGame для free ships
- [x] Boot гасится после Connect; команда выровнена по слотам
- [ ] Прогнать руками на новом Game: кошелёк → 8 кораблей → бой → возврат команды → коллекция
- [ ] Пользователь сам тестирует лимиты магазина (daily 10, реролл) — не ломать без запроса

## Приоритет 0 (Блокер)
- [x] Поднять все временные тексты на самый верх (PrepareScene, BattleScene)
- [x] Исправить позиционирование Team-блока и логотипа
- [x] Добавить параллакс-фон в BootScene
- [x] Сделать модал авторизации полупрозрачным
- [x] Replay боя через события (Variant 1 live на Game 0x227c…)
- [x] BattleScene: частицы, взрывы, live HP
- [x] CollectionScene: фильтры + multi-select (итерация 13.08 — половина экрана)
- [x] Equipped relics (drag, swap, unequip)
- [x] Анти-абуз минтинга: daily 10 buyUnit + free ship за level-up — **live**
- [x] Variant 1 lastBattleEvents (emit, не storage) — **live**, не «отложено»
- [ ] Подготовка к mainnet (чеклист в MAINNET_LAUNCH_CHECKLIST.md)
- [x] BattleScene 2.5D + частицы + анимации

## Приоритет 1
- [x] Hover / drag / double-click команды
- [x] Drag + click equipped relics
- [ ] Стабилизировать глубины после снятия `outer_frame` (старый spec depth 200 больше не верный)

## Приоритет 2
- [x] Боевой лог: цвета, DESTROYED, анимация строк (базовый вариант 13.08)
- [x] Экран победы/поражения со статами (базовый вариант 13.08)
- [ ] Дожать визуал лога/итога после аудита layout

## Приоритет 3 (Низкий)
- [ ] Улучшенные туториалы
- [ ] Система достижений
- [ ] Звуки и музыка

## ARCHIVE — Готово в v1.6.1 (13.05.2026)
- Полная синхронизация глубин и input между PrepareScene и CollectionScene
- Рабочий drag & drop + double-click для юнитов в команде
- Полноценный drag + click для equipped relics (свап + unequip)
- Визуальная полировка (пульсация, реальные портреты, единый стиль кнопок)



## ARCHIVE — исходное ТЗ Variant 1 (сделано 13.08.2026)

ТЗ: Газ-оптимизация lastBattleEvents (Вариант 1)
Задача:
Оптимизировать хранение истории последнего боя в StarForgeGame.sol для снижения gas cost на 1.8–2.1 млн gas за матч.
Приоритет: Высокий (v1.7 / после основного релиза v1.6)
Статус: **Сделано и задеплоено** на Game `0x227cF27Ec12c1cCBfE536f10AE1f765DEfA8cb8a` (13.08.2026). Ниже — исходное ТЗ, оставлено как история.
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