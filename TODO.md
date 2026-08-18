# TODO — Somnia StarForge

Актуально **17.08.2026**. Контекст: `AUDIT_HANDOFF.md`. Live Game `0x064f…`.

**Первая задача следующего агента:** выполнить `BATTLE_REWORK_PROMPT.md` целиком. Не начинать ничего другого, пока реворк боя не сдан.

## Сейчас (v1.6.5)
- [x] Аудит Prepare/Collection + контракты (17.08)
- [x] Game `0x064fE7661b1eb52b727e562E652764b94c008383` — verify-live + smoke
- [ ] Пользователь сам тестирует лимиты магазина (daily 10, реролл)

## Приоритет 0 — главный
- [ ] **Полный реворк боя по `BATTLE_REWORK_PROMPT.md`.** Читать этот файл до любой правки. Не латать BattleScene / combatVfx / battleCinema. Пересобрать playback. Приёмка в промпте: пустые клетки арены без светящихся точек.

## Приоритет 1
- [ ] Подготовка к mainnet — не сейчас, testnet first
- [ ] Game ~24 КБ. Новый on-chain код — в library или взамен старого
- [ ] Стабилизировать глубины после снятия `outer_frame` (если всплывут клики)

## Приоритет 2
- [ ] Дожать визуал лога/итога
- [ ] Автосид пустого магазина (нужно место в bytecode / library)

## Приоритет 3
- [ ] Дожать туториал
- [ ] Live NFT tokenURI (SVG) — только с миграцией, иначе сожжём 318 кораблей

## ARCHIVE — Готово в v1.6.4 (17.08.2026)
- Аудит 15 пунктов закрыт в коде
- EOA-only на buy/generate/shop/startMatch
- startMatch пишет equippedRelics
- Profile Ownable на live снят
- Сессия флота: empty = -1, token 0 валиден

## ARCHIVE — Готово в v1.6.1 (13.05.2026)
- Полная синхронизация глубин и input между PrepareScene и CollectionScene
- Рабочий drag & drop + double-click для юнитов в команде
- Полноценный drag + click для equipped relics (свап + unequip)
- Визуальная полировка (пульсация, реальные портреты, единый стиль кнопок)

## ARCHIVE — исходное ТЗ Variant 1 (сделано 13.08.2026)
См. git history `TODO.md` / `changelog.md`. Variant 1 live: emit, не storage.
