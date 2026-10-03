# Handoff — исторический снимок 20.08.2026

Это не текущая задача. Курс с 2026-10-03: [StarForge_GDD_v1.7.md](StarForge_GDD_v1.7.md) и [BUILD_SEQUENCE.md](BUILD_SEQUENCE.md).

P0 «доработать карточки до 8/10» снят. Новый бой — [docs/build/01_CLIENT_V2.md](docs/build/01_CLIENT_V2.md), не этот слой.

Живые адреса на 2026-10-03 не менялись и лежат только в [DEPLOYMENT.md](DEPLOYMENT.md):

- Game `0x064fE7661b1eb52b727e562E652764b94c008383`
- UnitNFT `0x9c8784d47dA7fc4772EE617dC3A49c506A6481A1`
- Relic `0x619e19df1975A8D289545834aAff3FEEf1b84909`
- Profile `0x2C8976ECc9e9bDf939745ee61b1aD858607563d9`

Не передеплоить NFT и Profile без миграции. Game около 24 КБ. Foundry не подставлять в `setGameContract`.
