# Somnia StarForge — Game Design Document v1.3

**Статус:** MVP полностью реализован и протестирован на testnet  
**Дата:** 22 апреля 2026  
**Адреса на testnet:**
- StarForgeUnitNFT: `0x9D00dB7fb6faF315C9c63971ae34380d5b831a56`
- StarForgeGame: `0xEF96B4574ca47815D2D9ae35FD7EBBe90f228847`

---

## 1. Обзор и Vision

**Somnia StarForge** — это on-chain auto-battler в стилистике «Эхо Снов» Somnia. Игроки собирают флот из NFT-кораблей и пилотов, расставляют их на поле и запускают полностью детерминистичные бои, которые разрешаются on-chain.

**Ключевые принципы MVP:**
- Всё важное (shop, battle resolution, профиль, награды) — полностью on-chain и детерминистично.
- NFT-юниты полностью совместимы с будущей космической стратегией (та же вселенная, те же ассеты).
- **Sequence gasless отложен** до v1.5 (широкая casual-аудитория). На testnet используем MetaMask + viem/wagmi — это оптимально для целевой крипто-аудитории Somnia Quest.
- Реал-тайм элементы через Somnia Data Streams будут добавлены позже.

**Жанр:** Auto-Battler / Auto-Chess lite  
**Платформа:** Браузер (Phaser 3 + Vite) + Somnia Testnet/Mainnet  
**Целевая аудитория MVP:** Игроки Somnia Quest, фанаты TFT/Auto Chess, коллекционеры NFT.

---

## 2. Core Gameplay Loop (MVP — полностью реализовано)

1. **Shop Phase**  
   - 5 слотов shop  
   - `rerollShop()` (0.0005 STT)  
   - `buyFromShop(uint256 slot)` (0.001 STT)

2. **Position Phase**  
   - Динамический список owned units (`getPlayerUnits`)  
   - Drag-and-drop на 4×2 grid

3. **Battle Phase** (5–8 сек)  
   - Полностью on-chain `startMatch(uint256[] team)`  
   - Проверка владения, синергии фракций, детерминистичный resolver

4. **Reward Phase**  
   - Автоматический mint 1 юнита + обновление профиля  
   - Автообновление UI после боя

Цикл работает стабильно: REROLL → BUY из слота → START BATTLE → награда.

---

## 3. Фракции и Юниты (MVP — 3 фракции)

### Empire (Империя)
- **Стиль:** Дисциплина, щиты, контроль.
- **Синергия (3+):** +30% к защите всех юнитов.
- **Юниты:**
  - Fighter (6/4/5) — базовый
  - Cruiser (5/7/4) — танк
  - Dreadnought (8/8/3) — тяжёлый
  - Drone Swarm (4/3/8) — быстрый

### Voidborn (Рождённые Пустотой)
- **Стиль:** Агрессия, критические удары, высокая атака.
- **Синергия (3+):** +45% к урону.
- **Юниты:**
  - Void Fighter (7/3/6)
  - Shadow Cruiser (6/5/7)
  - Abyssal Dreadnought (9/6/4)
  - Void Drone (5/2/9)

### Mechanoids (Механоиды)
- **Стиль:** Ремонт, дроны, устойчивость.
- **Синергия (3+):** +25% к восстановлению после боя.
- **Юниты:**
  - Mech Fighter (5/5/6)
  - Repair Cruiser (4/8/5)
  - Siege Dreadnought (7/9/3)
  - Nano Swarm (3/4/8)

**Редкость юнитов:** Common (1), Rare (2), Legendary (3).  
**NFT:** ERC-721 с on-chain metadata (name, faction, rarity, attack, defense, speed).

---

## 4. On-Chain Архитектура (реализовано)

**StarForgeUnitNFT.sol**
- ERC-721 + on-chain metadata + stats
- `mintUnit()` (только от Game)
- `getUnit()`, `totalSupply()`

**StarForgeGame.sol**
- `buyUnit()` — прямой минт
- `rerollShop()` + `_generateShop()` (5 слотов)
- `buyFromShop(uint256 slot)`
- `startMatch(uint256[] team)` — проверка владения + симуляция боя
- `getPlayerUnits(address)`, `getPlayerShop(address)`
- `PlayerProfile` (level, xp, wins, losses)
- ReentrancyGuard + Pausable + Ownable

**Frontend (main.ts)**
- Полноценный shop 5 слотов + кнопки BUY
- Динамический список owned units
- Drag-and-drop + визуальный бой

---

## 5. Экономика и Revenue (User Experience + Revenue)

**Цены (testnet → mainnet):**
- Buy unit / buyFromShop: 0.001 STT
- Reroll shop: 0.0005 STT

**Revenue модель:**
- Все платежи идут в treasury контракта
- 5% от всех транзакций в STT → treasury (в будущем)

**Баланс:**
- Игрок всегда получает минимум 1 юнит за матч
- Прогресс не останавливается

---

## 6. Технический Стек (актуально на MVP)

**On-Chain:**
- Solidity 0.8.27+
- Remix (деплой)
- ReentrancyGuard + Pausable

**Frontend:**
- Phaser 3 + Vite + TypeScript
- viem + wagmi
- **MetaMask** (основной способ подключения на testnet)
- Sequence gasless — **отложен до v1.5**

**Testnet:** Chain ID 50312, RPC `https://dream-rpc.somnia.network`

---

## 7. UI/UX (MVP)

- Lobby → Shop (5 слотов) → Preparation (drag-and-drop) → Battle → Reward
- Визуал: неоновые туманности, surreal космос, glow-эффекты

---

## 8. Roadmap

**v1.0 — StarForge MVP (готово)**
- Полный core loop + shop 5 слотов + buyFromShop
- Динамические owned units + drag-and-drop
- On-chain battle

**v1.1 — Полировка**
- Улучшенный battle resolver + визуальный replay
- Разные визуалы юнитов по фракции/rarity
- Player Profile UI (level, xp, wins/losses)

**v1.5 — Ranked + Gasless**
- Leaderboard + призы
- Sequence gasless (embedded wallet)
- Season pass

**v2.0 — Deep Space**
- 5 фракций, реликвии, guild system

**v3.0 — Somnia Void (Космическая Стратегия)**
- Полноценная 4X-стратегия с теми же NFT

---

## 9. Риски и Митигация

(Без изменений)

---

**Конец документа v1.3**  
MVP готов к дальнейшей разработке и тестированию. Все механики core loop работают стабильно on-chain.
