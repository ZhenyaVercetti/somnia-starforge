// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./StarForgeUnitNFT.sol";

contract StarForgeGame is Ownable, ReentrancyGuard, Pausable {
    StarForgeUnitNFT public unitNFT;

    uint256 public constant BUY_PRICE = 0 ether;      // ← было 0.001 ether
    uint256 public constant REROLL_PRICE = 0 ether;   // ← было 0.0005 ether

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
    }

    mapping(address => PlayerProfile) public profiles;

    // === SHOP PREVIEW (Вариант B — красивый) ===
    struct ShopUnit {
        StarForgeUnitNFT.Faction faction;
        StarForgeUnitNFT.Rarity rarity;
        StarForgeUnitNFT.UnitClass unitClass;
        uint8 attack;
        uint8 defense;
        uint8 speed;
    }
    mapping(address => ShopUnit[5]) public playerShopPreview;

    // === V1.2: ПОСТОЯННЫЙ ИИ-ПРОТИВНИК ===
    // Фиксированная команда ИИ до победы игрока (один раз генерируется, потом хранится)
    mapping(address => ShopUnit[]) public playerCurrentAI;

    mapping(address => uint256[]) public playerUnits;

    event UnitBought(address player, uint256 tokenId);
    event MatchPlayed(address player, bool won, uint256 playerScore, uint256 aiScore, uint256[] rewards);
    event ShopRerolled(address player);
    event AIOpponentGenerated(address player, uint16 aiLevel);

    constructor(address _unitNFT) Ownable(msg.sender) {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setUnitNFT(address _unitNFT) external onlyOwner {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function _generateRandomRarity(uint256 seed, uint256 index) internal pure returns (StarForgeUnitNFT.Rarity) {
        uint256 rand = uint256(keccak256(abi.encodePacked(seed, index))) % 100;
        if (rand < 65) return StarForgeUnitNFT.Rarity.Common;
        if (rand < 90) return StarForgeUnitNFT.Rarity.Rare;
        return StarForgeUnitNFT.Rarity.Legendary;
    }

    function _generateShopPreview(address player) internal {
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            player,
            unitNFT.totalSupply(),
            block.prevrandao
        )));

        for (uint256 i = 0; i < 5; i++) {
            StarForgeUnitNFT.Faction faction = StarForgeUnitNFT.Faction(uint8((seed >> (i * 8)) % 3));
            StarForgeUnitNFT.Rarity rarity = _generateRandomRarity(seed, i);
            StarForgeUnitNFT.UnitClass unitClass = StarForgeUnitNFT.UnitClass(uint8((seed >> (i * 16 + 8)) % 4));

            uint8 baseAtk = 4 + uint8((seed >> (i * 24)) % 5);
            uint8 baseDef = 4 + uint8((seed >> (i * 32)) % 5);
            uint8 baseSpd = 4 + uint8((seed >> (i * 40)) % 5);

            if (rarity == StarForgeUnitNFT.Rarity.Rare) {
                baseAtk += 2; baseDef += 1; baseSpd += 1;
            } else if (rarity == StarForgeUnitNFT.Rarity.Legendary) {
                baseAtk += 3; baseDef += 3; baseSpd += 2;
            }

            playerShopPreview[player][i] = ShopUnit({
                faction: faction,
                rarity: rarity,
                unitClass: unitClass,
                attack: baseAtk,
                defense: baseDef,
                speed: baseSpd
            });
        }
    }

        // === V1.2: ГЕНЕРАЦИЯ ПОСТОЯННОГО ИИ ===
    function _generateAIOpponent(address player) internal {
        PlayerProfile memory profile = profiles[player];
        uint16 aiLevel = profile.level > 0 ? profile.level : 1;

        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            player,
            aiLevel,
            unitNFT.totalSupply(),
            block.prevrandao
        )));

        uint8 teamSize = 4; // Начальный противник — 4 слабых Common. Позже можно сделать scale с уровнем

        delete playerCurrentAI[player]; // очищаем предыдущего

        for (uint256 i = 0; i < teamSize; i++) {
            ShopUnit memory u;
            u.faction = StarForgeUnitNFT.Faction(uint8((seed >> (i * 8)) % 3));
            u.rarity = StarForgeUnitNFT.Rarity.Common; // начальные — слабые Common
            u.unitClass = StarForgeUnitNFT.UnitClass(uint8((seed >> (i * 16)) % 4));

            // Stats scale с уровнем ИИ + слабый base
            uint8 base = 3 + uint8(aiLevel / 4);   // <-- ИСПРАВЛЕНО: явный cast
            u.attack = base + uint8((seed >> (i * 32 + 8)) % 6);
            u.defense = base + uint8((seed >> (i * 40)) % 6);
            u.speed = base + uint8((seed >> (i * 48)) % 6);

            if (uint8((seed >> (i * 56)) % 100) < 15) {
                u.rarity = StarForgeUnitNFT.Rarity.Rare;
                u.attack += 2;
                u.defense += 1;
            }

            playerCurrentAI[player].push(u);
        }

        emit AIOpponentGenerated(player, aiLevel);
    }

    // V1.2: Генерация первого ИИ сразу при заходе в PrepareScene
    function generateAIOpponent() external whenNotPaused nonReentrant {
        if (playerCurrentAI[msg.sender].length == 0) {
            _generateAIOpponent(msg.sender);
        }
    }

    function getCurrentAI(address player) external view returns (ShopUnit[] memory) {
        return playerCurrentAI[player];
    }

        // V1.2: Бесплатная инициализация shop preview при первом заходе игрока
    function initializeShopPreview() external whenNotPaused nonReentrant {
        // Если preview ещё не инициализирован (первый слот пустой)
        if (playerShopPreview[msg.sender][0].attack == 0) {
            _generateShopPreview(msg.sender);
        }
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        require(msg.value == REROLL_PRICE, "Incorrect payment for reroll");
        _generateShopPreview(msg.sender);
        emit ShopRerolled(msg.sender);
    }

    function buyFromShop(uint256 slot) external payable whenNotPaused nonReentrant {
        require(msg.value == BUY_PRICE, "Incorrect payment");
        require(slot < 5, "Invalid slot");

        ShopUnit memory preview = playerShopPreview[msg.sender][slot];
        require(preview.attack > 0, "Slot empty");

        uint256 tokenId = unitNFT.mintUnit(
            msg.sender,
            preview.faction,
            preview.rarity,
            preview.unitClass,
            preview.attack,
            preview.defense,
            preview.speed
        );

        playerUnits[msg.sender].push(tokenId);
        delete playerShopPreview[msg.sender][slot];

        _updateProfileBuy(msg.sender);
        emit UnitBought(msg.sender, tokenId);
    }

    function buyUnit() external payable whenNotPaused nonReentrant {
        require(msg.value == BUY_PRICE, "Incorrect payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, unitNFT.totalSupply())));
        StarForgeUnitNFT.Faction faction = StarForgeUnitNFT.Faction(uint8(seed % 3));
        StarForgeUnitNFT.Rarity rarity = _generateRandomRarity(seed, 999);
        StarForgeUnitNFT.UnitClass unitClass = StarForgeUnitNFT.UnitClass(uint8((seed >> 8) % 4));

        uint8 atk = 5 + uint8((seed >> 16) % 6);
        uint8 def = 4 + uint8((seed >> 24) % 6);
        uint8 spd = 5 + uint8((seed >> 32) % 6);

        if (rarity == StarForgeUnitNFT.Rarity.Rare) {
            atk += 2; def += 2; spd += 1;
        } else if (rarity == StarForgeUnitNFT.Rarity.Legendary) {
            atk += 4; def += 3; spd += 3;
        }

        uint256 tokenId = unitNFT.mintUnit(msg.sender, faction, rarity, unitClass, atk, def, spd);
        playerUnits[msg.sender].push(tokenId);

        _updateProfileBuy(msg.sender);
        emit UnitBought(msg.sender, tokenId);
    }

    // === V1.2: БОЙ ПРОТИВ ПОСТОЯННОГО ИИ ===
    function _calculateTeamPower(uint256[] calldata team) internal view returns (uint256 power, uint8 synergyCount) {
        uint256 totalAtk = 0;
        uint256 totalDef = 0;
        uint256 totalSpd = 0;
        uint8[3] memory factionCount;

        for (uint256 i = 0; i < team.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnit(team[i]);
            totalAtk += u.attack;
            totalDef += u.defense;
            totalSpd += u.speed;
            factionCount[uint8(u.faction)]++;
        }

        synergyCount = 0;
        if (factionCount[uint8(StarForgeUnitNFT.Faction.Empire)] >= 3) { totalDef = totalDef * 130 / 100; synergyCount++; }
        if (factionCount[uint8(StarForgeUnitNFT.Faction.Voidborn)] >= 3) { totalAtk = totalAtk * 145 / 100; synergyCount++; }
        if (factionCount[uint8(StarForgeUnitNFT.Faction.Mechanoids)] >= 3) { totalAtk = totalAtk * 125 / 100; totalDef = totalDef * 125 / 100; synergyCount++; }

        power = totalAtk + totalDef + (totalSpd * 2);
        return (power, synergyCount);
    }

    function _calculateAIPower(ShopUnit[] memory aiTeam) internal pure returns (uint256 power, uint8 synergyCount) {
        uint256 totalAtk = 0;
        uint256 totalDef = 0;
        uint256 totalSpd = 0;
        uint8[3] memory factionCount;

        for (uint256 i = 0; i < aiTeam.length; i++) {
            ShopUnit memory u = aiTeam[i];
            totalAtk += u.attack;
            totalDef += u.defense;
            totalSpd += u.speed;
            factionCount[uint8(u.faction)]++;
        }

        synergyCount = 0;
        if (factionCount[uint8(StarForgeUnitNFT.Faction.Empire)] >= 3) { totalDef = totalDef * 130 / 100; synergyCount++; }
        if (factionCount[uint8(StarForgeUnitNFT.Faction.Voidborn)] >= 3) { totalAtk = totalAtk * 145 / 100; synergyCount++; }
        if (factionCount[uint8(StarForgeUnitNFT.Faction.Mechanoids)] >= 3) { totalAtk = totalAtk * 125 / 100; totalDef = totalDef * 125 / 100; synergyCount++; }

        power = totalAtk + totalDef + (totalSpd * 2);
        return (power, synergyCount);
    }

    function startMatch(uint256[] calldata team) external whenNotPaused nonReentrant {
        require(team.length >= 4 && team.length <= 8, "Team size 4-8 only");

        for (uint256 i = 0; i < team.length; i++) {
            require(unitNFT.ownerOf(team[i]) == msg.sender, "Not your unit");
        }

        // Получаем или генерируем постоянного ИИ
        ShopUnit[] memory aiTeam = playerCurrentAI[msg.sender];
        if (aiTeam.length == 0) {
            _generateAIOpponent(msg.sender);
            aiTeam = playerCurrentAI[msg.sender];
        }

        (uint256 playerPower, uint8 playerSynergy) = _calculateTeamPower(team);
        (uint256 aiPower, ) = _calculateAIPower(aiTeam);

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));
        uint256 playerScore = playerPower + (seed % 50) + (uint256(playerSynergy) * 25);
        uint256 aiScore = aiPower + ((seed >> 64) % 45);

        bool won = playerScore > aiScore;

        _updateProfileMatch(msg.sender, won);

        // Награды
        uint256 rewardCount = won ? 3 : 1;
        uint256[] memory rewards = new uint256[](rewardCount);
        uint256 idx = 0;

        // Всегда 1 Common
        rewards[idx++] = unitNFT.mintUnit(
            msg.sender,
            StarForgeUnitNFT.Faction(uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender))) % 3)),
            StarForgeUnitNFT.Rarity.Common,
            StarForgeUnitNFT.UnitClass.Fighter,
            5, 5, 6
        );

        if (won) {
            // Rare при победе
            rewards[idx++] = unitNFT.mintUnit(
                msg.sender,
                StarForgeUnitNFT.Faction(uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, uint256(1)))) % 3)),
                StarForgeUnitNFT.Rarity.Rare,
                StarForgeUnitNFT.UnitClass.Cruiser,
                7, 7, 7
            );
            if (playerSynergy >= 2) {
                // Legendary + бонус за синергии
                rewards[idx++] = unitNFT.mintUnit(
                    msg.sender,
                    StarForgeUnitNFT.Faction(uint8(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, uint256(2)))) % 3)),
                    StarForgeUnitNFT.Rarity.Legendary,
                    StarForgeUnitNFT.UnitClass.Dreadnought,
                    9, 9, 8
                );
            }
        }

        uint256[] memory finalRewards = new uint256[](rewardCount);
        for (uint256 i = 0; i < rewardCount; i++) {
            finalRewards[i] = rewards[i];
            playerUnits[msg.sender].push(rewards[i]);
        }

        // Если победа — генерируем нового ИИ для следующего боя
        if (won) {
            delete playerCurrentAI[msg.sender];
        }

        emit MatchPlayed(msg.sender, won, playerScore, aiScore, finalRewards);
    }

    function _updateProfileBuy(address player) internal {
        PlayerProfile storage p = profiles[player];
        if (p.level == 0) p.level = 1;
        p.xp += 10;
        if (p.xp >= uint32(p.level) * 100) { p.level++; p.xp = 0; }
    }

    function _updateProfileMatch(address player, bool won) internal {
        PlayerProfile storage p = profiles[player];
        if (won) { p.wins++; p.xp += 50; } else { p.losses++; p.xp += 25; }
        if (p.xp >= uint32(p.level) * 100) { p.level++; p.xp = 0; }
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        return playerUnits[player];
    }

    function getPlayerShop(address player) external view returns (ShopUnit[5] memory) {
        return playerShopPreview[player];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}