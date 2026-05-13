# TODO — Somnia StarForge

## Приоритет 0 (Блокер)
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
- [ ] Доработать BattleScene: частицы двигателей, улучшенные взрывы, live HP бары

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