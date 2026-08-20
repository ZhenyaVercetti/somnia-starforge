# TODO — Somnia StarForge

Актуально **20.08.2026**. Контекст: `AUDIT_HANDOFF.md`. Live Game `0x064f…`.

**Первая задача следующего агента:** доработать **текущий** экран боя (Three.js слой + Phaser HUD). Не начинать новый жанр и не откатывать архитектуру без явного «да».

## Сейчас (v1.6.5 + 3D battle layer)
- [x] Аудит Prepare/Collection + контракты (17.08)
- [x] Game `0x064fE7661b1eb52b727e562E652764b94c008383` — verify-live + smoke
- [x] Слой боя переведён на Three.js (`BattleWorld`) + hangar-портреты как стоячие карточки; Phaser только HUD
- [x] Удалены cinema / `combatVfx` / Phaser ParticleEmitter и файл `BATTLE_REWORK_PROMPT.md`
- [ ] Пользователь сам тестирует лимиты магазина (daily 10, реролл)
- [ ] **Бой не принят.** Нужна визуальная доработка текущего экрана, не новый тотальный реворк

## Приоритет 0 — главный
- [ ] **Доработка текущего экрана боя до приёмки.** Архитектура уже есть: `#battle3d` + `BattleWorld` + catalog + `?previewBattle=1`. Контрактные события не менять (`BattleResolved` / `BattleEventEmitted`, Variant 1). Не возвращать cinema, top-down 2D, примитивные hulls, натяжку портретов на боксы. Не трогать Phaser 3.90 ParticleEmitter.

  Что править на этом экране:
  - корабли: выглядят как корабли, помещаются в кадр, смотрят на противника
  - космос: тёмный, без яркой полосы скоплений и без большой планеты
  - Drone Swarm: рой истребителей, не один кривой корпус
  - поведение: живой idle / лёгкий крен на выстреле, без дешёвого «кино»
  - выстрелы и попадания читаются, без висящих спрайтов и чёрных прямоугольников
  - новые фракции/классы — только через `battleCatalog.ts` + PNG, без правок BattleScene

## Приоритет 1
- [ ] Подготовка к mainnet — не сейчас, testnet first
- [ ] Game ~24 КБ. Новый on-chain код — в library или взамен старого
- [ ] Стабилизировать глубины после снятия `outer_frame` (если всплывут клики)

## Приоритет 2
- [ ] Дожать визуал лога/итога боя
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

## ARCHIVE — Готово в v1.6.1 (13.08.2026)
- Полная синхронизация глубин и input между PrepareScene и CollectionScene
- Рабочий drag & drop + double-click для юнитов в команде
- Полноценный drag + click для equipped relics (свап + unequip)
- Визуальная полировка (пульсация, реальные портреты, единый стиль кнопок)

## ARCHIVE — исходное ТЗ Variant 1 (сделано 13.08.2026)
См. git history `TODO.md` / `changelog.md`. Variant 1 live: emit, не storage.
