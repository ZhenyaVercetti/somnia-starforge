# FRONTEND_ARCH.md — Архитектура фронтенда

**Стек:** Phaser 3.90.0 + Vite + TypeScript + viem/wagmi + @somniaforge/sdk

## Актуальная структура сцен (v1.1)
1. **BootScene** — preload ассетов, подключение wallet, инициализация контрактов
2. **PrepareScene** — owned units + shop + drag-and-drop + TEAM grid + профиль
3. **BattleScene** — визуальный бой + on-chain результат (запускается из PrepareScene)
4. **RewardScene** — (будет позже)
5. **LobbyScene** — (будет позже)


## Как работаем вдвоём
- Я пишу всю логику контрактов + хуки
- Ты/фронт — только Phaser-сцены и UI
- При отсутствии фронт-девов — я правлю сцены полностью

**Статус:** main.ts полностью разбит на сцены (BootScene + PrepareScene + BattleScene).  
Hover tooltip и подсветка team-slots реализованы.

**Следующий шаг:** Автообновление Player Profile после buy/reroll/battle + мелкие UX-улучшения.