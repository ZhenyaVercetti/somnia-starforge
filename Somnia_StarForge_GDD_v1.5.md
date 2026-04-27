# Somnia StarForge — Game Design Document v1.3.4

**Статус:** v1.3 полностью завершён. Идёт полировка v1.3.4  
**Дата:** 27 апреля 2026  
**Цель версии:** полностью рабочий core loop с постоянным ИИ-противником, системой артефактов и on-chain боем

## Актуальные адреса (testnet)
- **StarForgeUnitNFT**: `0x9D00dB7fb6faF315C9c63971ae34380d5b831a56`
- **StarForgeGame**: `0x1cfB6c6fe1775cD9a324684f6C426f206368Eb59`
- **StarForgeRelic**: `0x83930224Ced8cEB6350fC9F41202B8fAA0033173`

**Все адреса берутся из DEPLOYMENT.md — это единственный источник правды.**

## 1. Обзор и Vision
Somnia StarForge — полностью on-chain auto-battler (TFT / Auto Chess lite) в сеттинге «Echo of Dreams» Somnia.  
Юниты, магазин, команда, бой и награды — всё детерминистично и выполняется на Somnia (высокий TPS позволяет fully on-chain resolution).

## 2. Core Gameplay Loop (v1.3)
1. **Prepare Phase** (PrepareScene)  
   - `buyUnit()` — покупка случайного юнита  
   - `rerollShop()` + `buyFromShop(slot)` — магазин артефактов  
   - Drag-and-drop + remove (клик по слоту / double-click) — формирование команды 4–8 юнитов  
   - Постоянный ИИ-противник (ленивая генерация в `startMatch`)

2. **Battle Phase**  
   - `startMatch(team)` → on-chain симуляция в StarForgeBattleLibrary  
   - 12 раундов, учёт скорости, урона, критов, реликвий  
   - Возврат полного лога `BattleEvent[]`

3. **Reward Phase**  
   - При победе — автоматический минт реликвии  
   - Обновление профиля (level / xp / wins / losses)

## 3. Системы
**Юниты** — ERC-721 StarForgeUnitNFT (Fighter / Cruiser / Dreadnought / Drone Swarm, 3 фракции).  
**Артефакты (Relics)** — ERC-1155 StarForgeRelic (6 типов: ATTACK_BOOST, DEFENSE_BOOST, SPEED_BOOST, HP_BOOST, CRIT_CHANCE, LAST_STAND). Применяются ко всей команде в `_applyRelics()`.  
**Бой** — библиотека StarForgeBattleLibrary (решён stack too deep).  
**Профиль игрока** — level, xp, wins, losses.

## 4. Техническая архитектура
**On-chain:** Solidity 0.8.27+, UUPS-ready паттерны, ReentrancyGuard, Pausable.  
**Frontend:** Phaser 3.90.0 + Vite/React + viem/wagmi + @somniaforge/sdk.  
Сцены: BootScene → PrepareScene → BattleScene.  
**Статус:** PrepareScene требует финальной полировки UI/UX (drag-and-drop + очистка временных текстов).

## 5. Roadmap
- **v1.2** — постоянный ИИ-противник и прогрессия — завершён  
- **v1.3** — система артефактов + полноценный пошаговый бой — завершён  
- **v1.3.4** — полировка PrepareScene (текущая задача)  
- **v1.4** — earn-only валюта, казна, баланс, Sequence gasless (подготовка)

**Сохрани файл.**