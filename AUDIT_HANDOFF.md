# Handoff — 17 августа 2026 (v1.6.4)

Документ для следующего агента Grok. Читать **до** любых правок.

## Роль и правила
- Пользователь — проджект, код не пишет. Пара: только он и ты.
- Ответы пользователю: **русский**, коротко, без воды.
- Комментарии в коде: **английский**.
- `DEPLOYMENT.md` — единственный источник адресов.
- Документы не трогать, пока пользователь явно не попросит.
- Не предлагать других людей/команды.

Правила проекта: `AGENTS.md`.

## Live testnet (актуально 17.08.2026)

| Контракт | Адрес |
|---|---|
| **StarForgeGame** | `0x064fE7661b1eb52b727e562E652764b94c008383` |
| StarForgeUnitNFT | `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1` |
| StarForgeRelic | `0x619e19df1975A8D289545834aAff3FEEf1b84909` |
| StarForgePlayerProfile | `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9` |
| previousGame | `0x6DE0834950Ed5f4d13E90A5EA049d43a3Ade9118` (GAME_ROLE снят) |

- Chain ID **50312**, RPC `https://dream-rpc.somnia.network`
- Те же адреса в `frontend/src/lib/contractAddresses.ts`
- Цены: buy 0.01 / reroll 0.005 / relic 0.008. `msg.value` ровно цена.
- Тесты: **41 passing**. verify-live OK. Smoke startMatch `0x9b1758bf…`

## Что закрыто 17.08
- Аудит 15 пунктов: token 0, EOA grind, tutorial/collection/drag/skip, persist relics
- Profile Ownable на live снят (`owner = 0`)
- NFT/Profile **не** передеплоили (сожгли бы флот и прогресс)
- Game у потолка 24 КБ. Автосид магазина в контракт не влез

## Известные ограничения
1. Live NFT tokenURI всё ещё `your-cdn.com`. SVG только в исходнике. Новый NFT = новые id.
2. Live Profile bytecode старый (Ownable+AccessControl), но Ownable уже renounce.
3. Пустой магазин заполняется только reroll (клик по EMPTY = reroll).
4. Магазин / daily 10 / AI — не ретюнить без запроса.
5. Браузер e2e с кошельком в этой сессии не гонялся целиком (smoke с деплоера — да).

## Чего не делать без явного «да»
- Передеплой NFT или Profile без плана миграции
- Перерисовка UI с нуля
- Возврат `outer_frame` / полноэкранная коллекция
- Ретюн цен / daily 10 / баланса AI
- Раздувать Game за 24 КБ
