# Somnia StarForge — Game Design Document v1.6

**Статус:** v1.6.2 — **frontend depth + relic drag завершены** (13.05.2026)  
**Текущая версия в работе:** v1.6.2 → подготовка к финальному тестированию  
**v1.6.2 цели выполнены:**
- Полная система глубин (корабли 8 / слоты 10 / drag 30 / tooltip 100)
- Hover + drag + double-click на юнитах в команде
- Полноценный drag + click для equipped relics (свап / unequip)
- Визуальная полировка PrepareScene + CollectionScene

**Следующий шаг:** доработка BattleScene (частицы, улучшенные эффекты) + финальное тестирование v1.6.2

**v1.6 — CollectionScene + Механика реликвий и юнитов текущая цель:**
- Полностью переработанная CollectionScene с фильтрами, multi-select и instant add (double-click)
- Экипированные реликвии больше не отображаются в коллекции
- Полноценная система drag-and-drop и double-click для equipped реликвий в PrepareScene
- Аналогичная система для юнитов в команде (drag, double-click, возврат в коллекцию)
- CollectionScene остаётся открытой во время работы с реликвиями
- Улучшенная визуальная полировка PrepareScene (рамки, кнопки, свечение, фон)
Все юниты и реликвии теперь отображаются реальными портретами вместо цветных квадратиков. Добавлена лёгкая пульсация для ощущения живости.

## Актуальные адреса (testnet)
- **StarForgeUnitNFT**: `0x9D00dB7fb6faF315C9c63971ae34380d5b831a56`
- **StarForgeGame**: `0x52C428Ec735ef6fEb46334E626600ec31120cC80`
- **StarForgeRelic**: `0x83930224Ced8cEB6350fC9F41202B8fAA0033173`

## 1. Обзор и Vision
Somnia StarForge — полностью on-chain auto-battler (TFT / Auto Chess lite) в сеттинге «Echo of Dreams» Somnia.  
Юниты, магазин, команда, бой, реликвии и награды — всё детерминистично и выполняется на Somnia.

**Официальные домены:**  
- starforge.somi (основной)  
- starforgegame.somi

## 2. Core Gameplay Loop
1. **Prepare Phase** — PrepareScene (покупка юнитов, магазин реликвий, drag-and-drop, equipped relics)  
2. **Battle Phase** — полностью on-chain симуляция в StarForgeBattleLibrary  
3. **Reward Phase** — минт реликвий, обновление профиля, XP, level-up  
4. **Collection Phase** — просмотр всей коллекции (добавляется в v1.6)

## 3. Системы
**Боевая система (v1.5.6 — завершена)**  
- Полностью on-chain Speed Queue, 1–2 атаки за раунд, максимум 18 раундов  
- Crit (6/12/20%), Dodge, Last Stand, faction synergy (+2 ATK при 3+ юнитах одной фракции)  
- AI scaling + rarity scaling  
- BattleResult возвращает playerMaxHp / aiMaxHp и полный лог событий  

**Юниты** — ERC-721 StarForgeUnitNFT  
**Реликвии** — ERC-1155 StarForgeRelic (max 3 equipped)  
**Профиль игрока** — level, xp, wins, losses, currentAITier, winStreak  

## 4. Техническая архитектура
On-chain: Solidity 0.8.27+, UUPS-ready, ReentrancyGuard, Pausable, библиотеки.  
Frontend: Phaser 3.90.0 + Vite/React + viem/wagmi + @somniaforge/sdk + Sequence SDK (gasless в планах).

## 5. Визуал
UI Asset Generation — Reference Prompt
Эталонный промпт для всех UI-рамок и кнопок:
textHigh quality realistic metallic sci-fi HUD frame, exact size [WIDTH]x[HEIGHT] pixels, thick sharp dark purple and blue metallic border with subtle brushed metal texture and a few clean tech details, less curves, mostly straight lines, premium dark technological style, full solid bright green background #00FF00, flat realistic design, no glow, no soft edges, no pixel art, no cartoon look, isolated asset, chroma key perfect, professional AAA game UI quality
Использовать для:

Всех слотов (Team, Shop, Equipped, AI)
Кнопок
Profile frame
Любых новых HUD-элементов

Ключевые характеристики стиля:

Реалистичный металлический вид (brushed metal texture)
Тёмно-фиолетовый + синий цветовая схема
Минимальные tech-детали, прямые линии
Полный chroma key зелёный фон (#00FF00)
Премиум AAA качество, без пиксельного/мультяшного вида

## 6. Roadmap

**v1.5 — завершён (29 апреля 2026)**  
- Полностью рабочий core loop  
- On-chain battle resolution + реликвии + equipped system  
- Player Profile + новая XP-формула и награды  
- Финальная балансировка AI, CRIT, winrate 54–57%

**v1.6 (текущая — 13.05.2026)**
- [x] Полностью переработанная CollectionScene с фильтрами и multi-select
- [x] Полная механика equipped relics (drag, swap, unequip)
- [x] Исправлена система глубин и input во всех сценах
- [ ] Финальное тестирование и полировка BattleScene
- [ ] Подготовка к mainnet (оптимизация газа)
- [ ] Анти-абуз минтинга: daily limit 10 buyUnit + +1 бесплатный корабль за level-up  


**v1.7 — Глубина боя**  
- Классовые синергии  
- Positioning bonuses + роли юнитов  
- Cosmic Anomalies (рандомные события в бою)

**v1.8 — Расширение лора и атмосфера + усложнения**  
- Короткие видео-истории и/или анимации (осмысленный путь по level-ингу аккаунта)  
- Звуковое сопровождение (музыка, SFX, голосовые подсказки)
- внутренняя валюта (обычная + звёздная пыль)
- Звёздная кузница: сжигание кораблей и ковка новых
**v1.9 — Социалка и соревнование**  
- Лидерборды  
- Ачивки  
- Спонсорские Prize Pools  
- Solo-рейды + On-chain AI Agents

**v2.0+ — Масштаб и долгосрочное удержание**  
- Групповые рейд-боссы  
- Prestige / New Game+  
- Galaxy Seasons  
- Пилоты как отдельные NFT  
- Памятные коллекции  
- Покупка дополнительных брендовых .somi доменов (somniastarforge.somi, somniavoid.somi, void.somi и др.)

**Сохрани файл.**