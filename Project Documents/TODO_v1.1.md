# TODO_v1.1.md — Полировка

**Статус:** Priority 1, 2 и 3 полностью выполнены. Переходим к финальной полировке UX и стабильности.

## Priority 1 (критично) — ВЫПОЛНЕНО
- [x] Shop на preview (Вариант B)
- [x] buyUnit()
- [x] Оптимизированный getPlayerUnits
- [x] Полные синергии фракций
- [x] Обновлён main.ts + ABI

## Priority 2 — ВЫПОЛНЕНО
- [x] Player Profile UI
- [x] TEAM counter + «ОЧИСТИТЬ КОМАНДУ»
- [x] Компактный owned units grid (8 колонок, 42px)
- [x] Правильное отображение rewards после боя
- [x] Реальный цвет по rarity (getUnit из NFT + rectangle)
- [x] Улучшенный visual battle replay (4 волны, лазеры с двух сторон, взрывы)

## Priority 3 — Разбивка main.ts на сцены + UX (ВЫПОЛНЕНО)
- [x] BootScene + PrepareScene + BattleScene
- [x] Hover tooltip на всех юнитах (owned + shop)
- [x] Подсветка team-slots при drag-and-drop + защита от stacking
- [x] Обновление FRONTEND_ARCH.md и TODO

## Priority 4 — Финальная полировка UX и стабильность (в процессе)
- [ ] Автообновление Player Profile после buyUnit / buyFromShop / rerollShop / startMatch
- [ ] Автообновление owned grid и shop после всех действий (убрать ручной REFRESH где возможно)
- [ ] Плавная анимация появления новых юнитов в owned grid (scale + fade-in)
- [ ] Кнопка «REFRESH» вместо «REFRESH OWNED» + визуальная обратная связь
- [ ] Автоматическая очистка временных текстов («Юнит куплен!», «TX отправлена…», награды) через 4 секунды
- [ ] Улучшенный UX при ошибках (например, «Недостаточно STT»)
- [ ] Мелкие визуальные правки (выравнивание, отступы, читаемость)
- [ ] Обновление всех документов (TODO, CHANGELOG, FRONTEND_ARCH, GDD)

**Дедлайн:** 28 апреля 2026