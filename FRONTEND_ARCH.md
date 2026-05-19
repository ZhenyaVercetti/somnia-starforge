# FRONTEND_ARCH.md — Архитектура фронтенда

**Стек:** Phaser 3.90.0 + Vite + TypeScript + viem/wagmi + @somniaforge/sdk

## v1.6 — Архитектурные изменения

## v1.6.3 — 19.05.2026 (Значительные изменения архитектуры)

**1. Авторизация**
- BootScene сразу открывает RainbowKit модал
- WalletModal автоматически закрывается после подключения
- `account` и `publicClient` сохраняются в `window`

**2. CollectionScene**
- Реликвии с настоящими портретами
- 7 в ряд
- Простой клик = выбор + подсветка
- Двойной клик = добавление в equipped (замена справа налево)

**3. Межсценное взаимодействие**
- Новые методы: `equipSingleRelic()`, `addMultipleRelicsToEquipped()`, `returnRelicToCollection()`

### Межсценное взаимодействие
- CollectionScene теперь запускается через `scene.launch()` (обе сцены могут быть активны одновременно)
- Добавлены новые методы межсценного взаимодействия:
  - `addSingleUnitToTeam(unitId)` — быстрое добавление юнита
  - `equipSingleRelic(relicId)` — быстрое экипирование реликвии
  - `returnUnitToCollection(unitId)` — возврат юнита в коллекцию
  - `returnRelicToCollection(relicId)` — возврат реликвии в коллекцию
  - `addMultipleRelicsToEquipped(relicIds[])` — массовое экипирование

### PrepareScene
- Полноценный drag-and-drop + double-click для equipped реликвий и team юнитов
- Единая система снятия/обмена элементов (drag между слотами = swap, drag за пределы = remove)

### CollectionScene
- Поддержка параметра `equippedRelicIds` при запуске (фильтрация уже экипированных реликвий)
- Разделение single/double click (двойной клик = instant add, одинарный = multi-select)
- CollectionScene больше не закрывается после активации реликвий
## Актуальная структура файлов (v1.1)

**Сцены:**
- `src/main.ts` — только запуск игры и конфиг
- `src/scenes/BootScene.ts` — preload, подключение MetaMask, инициализация контрактов
- `src/scenes/PrepareScene.ts` — основной интерфейс (owned, shop, drag-and-drop, профиль, кнопки)
- `src/scenes/BattleScene.ts` — отдельная сцена визуального боя

**Статус:** Полная разбивка main.ts на сцены завершена.

## Как работаем вдвоём
- Я пишу всю логику контрактов + хуки
- Ты/фронт — только Phaser-сцены и UI
- При отсутствии фронт-девов — я правлю сцены полностью

**Следующий шаг:** Priority 4 — финальная полировка UX и стабильность.