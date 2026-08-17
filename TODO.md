# TODO — Somnia StarForge

Актуально **17.08.2026**. Контекст: `AUDIT_HANDOFF.md`. Live Game `0x064f…`.

## Сейчас (v1.6.4)
- [x] Аудит Prepare/Collection/Battle + контракты (17.08)
- [x] Фиксы аудита: token 0, EOA grind, drag/skip/tutorial/collection, persist relics
- [x] Game `0x064fE7661b1eb52b727e562E652764b94c008383` — verify-live + smoke
- [ ] Ручной прогон в браузере: кошелёк → 8 кораблей (включая #0 если есть) → бой → возврат → коллекция
- [ ] Пользователь сам тестирует лимиты магазина (daily 10, реролл)

## Приоритет 0
- [ ] Подготовка к mainnet (чеклист в MAINNET_LAUNCH_CHECKLIST.md) — не сейчас, testnet first
- [ ] Game ~24 КБ. Новый on-chain код — в library или взамен старого

## Приоритет 1
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
