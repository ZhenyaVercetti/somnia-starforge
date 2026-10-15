# StarForge

Ончейн автобаттлер на Somnia. Кузница — ядро, бой — проверка корпуса и остаётся внутри `startMatch`. Mainnet не следующий шаг.

## С чего читать

| Файл | Зачем |
|---|---|
| [STATUS.md](STATUS.md) | Что на main, что принято, блокер image-to-3D |
| [ROADMAP.md](ROADMAP.md) | Фазы и критерии приёмки |
| [docs/GDD.md](docs/GDD.md) | Текущий дизайн |
| [docs/decisions.md](docs/decisions.md) | Журнал решений |
| [TODO.md](TODO.md) | Текущий спринт |
| [AGENTS.md](AGENTS.md) | Правила для агента, который пишет код |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Единственный источник адресов |
| [FRONTEND_ARCH.md](FRONTEND_ARCH.md) | Как устроен клиент |
| [MAINNET_LAUNCH_CHECKLIST.md](MAINNET_LAUNCH_CHECKLIST.md) | Чеклист мейннета, не текущая задача |
| [changelog.md](changelog.md) | История |

Старые постановки лежат в [docs/archive/](docs/archive/README.md). Их не кормить как задачу.

## Запуск

Testnet chain id **50312**. Адреса только в [DEPLOYMENT.md](DEPLOYMENT.md).

```
cd frontend
npm run dev
```

Превью боя без кошелька: `http://localhost:5173/?previewBattle=1`.

Контракты:

```
npx hardhat test
npx hardhat run scripts/deploy.js --network somniaTestnet
```
