// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./StarForgeBattleLibrary.sol";
import "./StarForgeUnitNFT.sol";
import "./StarForgeRelic.sol";
import "@openzeppelin/contracts@4.9.3/access/Ownable.sol";
import "@openzeppelin/contracts@4.9.3/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts@4.9.3/security/Pausable.sol";

contract StarForgeGame is Ownable, ReentrancyGuard, Pausable {
    using StarForgeBattleLibrary for *;

    // ==================== STORAGE ====================

    mapping(address => bool) public hasProfile;
    mapping(address => PlayerProfile) public profiles;
    mapping(address => uint256[]) public playerUnits;
    mapping(address => uint256[]) public playerRelics;
    mapping(address => uint256[3]) public equippedRelics;
    mapping(address => ShopItem[3]) public playerShop;
    mapping(address => ShopItem[8]) public lastAI;

    mapping(address => bool) public lastPlayerWon;
    mapping(address => uint16[]) public lastPlayerMaxHp;
    mapping(address => uint16[]) public lastAIMaxHp;
    bytes32 public lastBattleId;

    // RESTORED: full battle events storage for replay
    mapping(address => StarForgeBattleLibrary.BattleEvent[]) public lastBattleEvents;

    // ==================== CONFIGURABLE PRICES ====================

    uint256 public buyUnitPrice = 0.01 ether;
    uint256 public rerollPrice = 0.005 ether;
    uint256 public buyUnitShopPrice = 0.01 ether;
    uint256 public buyRelicShopPrice = 0.008 ether;

    event PricesUpdated(uint256 buyUnit, uint256 reroll, uint256 buyUnitShop, uint256 buyRelicShop);
    event ProfileCreated(address indexed player);

    // ==================== EVENTS ====================

    event BattleResolved(
        bytes32 indexed battleId,
        address indexed player,
        bool playerWon,
        uint16[] playerMaxHp,
        uint16[] aiMaxHp
    );

    event BattleEventEmitted(
        bytes32 indexed battleId,
        uint8 round,
        bool isPlayerSide,
        uint8 attackerIndex,
        uint8 targetIndex,
        uint16 damage,
        uint16 remainingHp,
        string specialEffect
    );

    event RelicsEquipped(address indexed player, uint256[3] relics);

    // ==================== STRUCTS ====================

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
        uint16 currentAITier;
    }

    struct ShopItem {
        bool isRelic;
        uint256 id;
        uint8 faction;
        uint8 rarity;
        uint8 unitClass;
        uint8 attack;
        uint8 defense;
        uint8 speed;
        uint8 relicType;
        uint8 relicValue;
    }

    // ==================== STATE VARIABLES ====================

    StarForgeUnitNFT public unitNFT;
    StarForgeRelic public relicContract;

    // ==================== CONSTRUCTOR ====================

    constructor(address _unitNFT, address _relic) Ownable() {
        unitNFT = StarForgeUnitNFT(_unitNFT);
        relicContract = StarForgeRelic(_relic);
    }

    // ==================== ADMIN ====================

    function setUnitNFT(address _unitNFT) external onlyOwner {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setRelicContract(address _relic) external onlyOwner {
        relicContract = StarForgeRelic(_relic);
    }

    function setPrices(
        uint256 _buyUnitPrice,
        uint256 _rerollPrice,
        uint256 _buyUnitShopPrice,
        uint256 _buyRelicShopPrice
    ) external onlyOwner {
        buyUnitPrice = _buyUnitPrice;
        rerollPrice = _rerollPrice;
        buyUnitShopPrice = _buyUnitShopPrice;
        buyRelicShopPrice = _buyRelicShopPrice;
        emit PricesUpdated(_buyUnitPrice, _rerollPrice, _buyUnitShopPrice, _buyRelicShopPrice);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        payable(owner()).transfer(balance);
    }

    // ==================== INTERNAL: AUTO PROFILE CREATION ====================

    function _ensureProfile() internal {
        if (!hasProfile[msg.sender]) {
            hasProfile[msg.sender] = true;
            profiles[msg.sender] = PlayerProfile(1, 0, 0, 0, 1);
            emit ProfileCreated(msg.sender);
        }
    }

    // ==================== ECONOMY ====================

    function buyUnit() external payable whenNotPaused nonReentrant {
        _ensureProfile();
        require(msg.value >= buyUnitPrice, "Insufficient payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));

        uint8 atk = uint8(10 + (seed % 11));
        uint8 def = uint8(8 + ((seed >> 8) % 11));
        uint8 spd = uint8(9 + ((seed >> 16) % 11));

        uint8 faction = uint8((seed >> 24) % 3);
        uint8 unitClass = uint8((seed >> 32) % 4);
        uint8 rarity = _getWeightedRarity(seed);

        uint256 tokenId = unitNFT.mintUnit(
            msg.sender,
            StarForgeUnitNFT.Faction(faction),
            StarForgeUnitNFT.Rarity(rarity),
            StarForgeUnitNFT.UnitClass(unitClass),
            atk,
            def,
            spd
        );

        playerUnits[msg.sender].push(tokenId);
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        _ensureProfile();
        require(msg.value >= rerollPrice, "Insufficient payment");

        for (uint256 i = 0; i < 3; i++) {
            playerShop[msg.sender][i] = _generateShopItem();
        }
    }

    function buyFromShop(uint256 slot) external payable whenNotPaused nonReentrant {
        _ensureProfile();
        require(slot < 3, "Invalid slot");

        ShopItem memory item = playerShop[msg.sender][slot];
        require(item.id != 0 || item.isRelic, "Empty slot");

        if (item.isRelic) {
            require(msg.value >= buyRelicShopPrice, "Insufficient payment for relic");
            uint256 realId = relicContract.mintRelic(
                msg.sender,
                StarForgeRelic.RelicType(item.relicType),
                item.relicValue
            );
            playerRelics[msg.sender].push(realId);
        } else {
            require(msg.value >= buyUnitShopPrice, "Insufficient payment for unit");

            uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, slot)));

            uint8 atk = uint8(10 + (seed % 11));
            uint8 def = uint8(8 + ((seed >> 8) % 11));
            uint8 spd = uint8(9 + ((seed >> 16) % 11));

            uint8 faction = uint8((seed >> 24) % 3);
            uint8 unitClass = uint8((seed >> 32) % 4);
            uint8 rarity = _getWeightedRarity(seed);

            uint256 tokenId = unitNFT.mintUnit(
                msg.sender,
                StarForgeUnitNFT.Faction(faction),
                StarForgeUnitNFT.Rarity(rarity),
                StarForgeUnitNFT.UnitClass(unitClass),
                atk,
                def,
                spd
            );

            playerUnits[msg.sender].push(tokenId);
        }

        playerShop[msg.sender][slot] = _generateShopItem();
    }

    // ==================== EQUIP ====================

    function equipRelics(uint256[3] calldata relics) external whenNotPaused {
        _ensureProfile();

        for (uint256 i = 0; i < 3; i++) {
            if (relics[i] != 0) {
                require(relicContract.balanceOf(msg.sender, relics[i]) > 0, "You do not own this relic");
            }
        }

        equippedRelics[msg.sender] = relics;
        emit RelicsEquipped(msg.sender, relics);
    }

    // ==================== BATTLE ====================

    function startMatch(uint256[] calldata team, uint256[] calldata equipped) external whenNotPaused nonReentrant {
        _ensureProfile();
        require(team.length >= 4 && team.length <= 8, "Invalid team size");

        for (uint256 i = 0; i < team.length; i++) {
            require(unitNFT.ownerOf(team[i]) == msg.sender, "You do not own this unit");
        }

        uint256[] memory activeEquipped = equipped.length > 0 ? equipped : new uint256[](3);
        if (equipped.length == 0) {
            for (uint256 i = 0; i < 3; i++) {
                activeEquipped[i] = equippedRelics[msg.sender][i];
            }
        } else {
            require(equipped.length <= 3, "Too many relics");
            for (uint256 i = 0; i < equipped.length; i++) {
                if (equipped[i] != 0) {
                    require(relicContract.balanceOf(msg.sender, equipped[i]) > 0, "You do not own this relic");
                }
            }
            activeEquipped = equipped;
        }

        // Generate 8 AI units
        StarForgeBattleLibrary.ShopItem[] memory aiTeam = new StarForgeBattleLibrary.ShopItem[](8);
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao, block.number)));

        for (uint8 i = 0; i < 8; i++) {
            uint256 aiSeed = uint256(keccak256(abi.encodePacked(seed, i, profiles[msg.sender].level)));
            uint8 atk = uint8(8 + (aiSeed % 13));
            uint8 def = uint8(7 + ((aiSeed >> 8) % 12));
            uint8 spd = uint8(8 + ((aiSeed >> 16) % 11));
            uint8 faction = uint8((aiSeed >> 24) % 3);
            uint8 unitClass = uint8((aiSeed >> 32) % 4);
            uint8 rarity = _getWeightedRarity(aiSeed);

            aiTeam[i] = StarForgeBattleLibrary.ShopItem({
                isRelic: false,
                id: 0,
                faction: StarForgeUnitNFT.Faction(faction),
                rarity: StarForgeUnitNFT.Rarity(rarity),
                unitClass: StarForgeUnitNFT.UnitClass(unitClass),
                attack: atk,
                defense: def,
                speed: spd,
                relicType: 0,
                relicValue: 0
            });
        }

        // Save last AI team
        for (uint8 i = 0; i < 8; i++) {
            lastAI[msg.sender][i].isRelic    = aiTeam[i].isRelic;
            lastAI[msg.sender][i].id         = aiTeam[i].id;
            lastAI[msg.sender][i].faction    = uint8(aiTeam[i].faction);
            lastAI[msg.sender][i].rarity     = uint8(aiTeam[i].rarity);
            lastAI[msg.sender][i].unitClass  = uint8(aiTeam[i].unitClass);
            lastAI[msg.sender][i].attack     = aiTeam[i].attack;
            lastAI[msg.sender][i].defense    = aiTeam[i].defense;
            lastAI[msg.sender][i].speed      = aiTeam[i].speed;
            lastAI[msg.sender][i].relicType  = aiTeam[i].relicType;
            lastAI[msg.sender][i].relicValue = aiTeam[i].relicValue;
        }

        StarForgeBattleLibrary.BattleResult memory result = StarForgeBattleLibrary._simulateBattle(
            team,
            aiTeam,
            seed,
            msg.sender,
            unitNFT,
            relicContract,
            activeEquipped,
            profiles[msg.sender].level
        );

        bytes32 battleId = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            block.prevrandao,
            result.playerWon
        ));

        lastBattleId = battleId;
        lastPlayerWon[msg.sender] = result.playerWon;

        delete lastPlayerMaxHp[msg.sender];
        for (uint256 i = 0; i < result.playerMaxHp.length; i++) {
            lastPlayerMaxHp[msg.sender].push(result.playerMaxHp[i]);
        }

        delete lastAIMaxHp[msg.sender];
        for (uint256 i = 0; i < result.aiMaxHp.length; i++) {
            lastAIMaxHp[msg.sender].push(result.aiMaxHp[i]);
        }

        // RESTORED: store full events for replay
        delete lastBattleEvents[msg.sender];
        for (uint256 i = 0; i < result.events.length; i++) {
            lastBattleEvents[msg.sender].push(result.events[i]);
        }

        emit BattleResolved(battleId, msg.sender, result.playerWon, result.playerMaxHp, result.aiMaxHp);

        for (uint256 i = 0; i < result.events.length; i++) {
            StarForgeBattleLibrary.BattleEvent memory e = result.events[i];
            emit BattleEventEmitted(
                battleId,
                e.round,
                e.isPlayerSide,
                e.attackerIndex,
                e.targetIndex,
                e.damage,
                e.remainingHp,
                e.specialEffect
            );
        }

        _updateProfileAfterBattle(result.playerWon);
    }

    // ==================== VIEW ====================

    function getLastBattleResult(address player) external view returns (
        bool,
        uint16[] memory,
        uint16[] memory,
        bytes32,
        StarForgeBattleLibrary.BattleEvent[] memory
    ) {
        return (
            lastPlayerWon[player],
            lastPlayerMaxHp[player],
            lastAIMaxHp[player],
            lastBattleId,
            lastBattleEvents[player]
        );
    }

    function getCurrentAI(address player) external view returns (ShopItem[8] memory) {
        return lastAI[player];
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        return playerUnits[player];
    }

    function getPlayerRelics(address player) external view returns (uint256[] memory) {
        return playerRelics[player];
    }

    function getPlayerShop(address player) external view returns (ShopItem[3] memory) {
        return playerShop[player];
    }

    function getEquippedRelics(address player) external view returns (uint256[3] memory) {
        return equippedRelics[player];
    }

    // ==================== INTERNAL ====================

    function _getWeightedRarity(uint256 seed) internal pure returns (uint8) {
        uint256 roll = seed % 100;
        if (roll < 60) return 0;
        if (roll < 90) return 1;
        return 2;
    }

    function _generateShopItem() internal view returns (ShopItem memory) {
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender)));
        bool isRelic = (seed % 100) < 40;

        if (isRelic) {
            uint8 relicType = uint8(seed % 6);
            uint8 value = uint8(8 + ((seed >> 8) % 13));
            return ShopItem(true, 0, 0, 0, 0, 0, 0, 0, relicType, value);
        } else {
            uint8 faction = uint8((seed >> 16) % 3);
            uint8 unitClass = uint8((seed >> 24) % 4);
            uint8 rarity = _getWeightedRarity(seed);

            uint8 atk = uint8(10 + ((seed >> 40) % 11));
            uint8 def = uint8(8 + ((seed >> 48) % 11));
            uint8 spd = uint8(9 + ((seed >> 56) % 11));

            return ShopItem(false, 0, faction, rarity, unitClass, atk, def, spd, 0, 0);
        }
    }

    function _updateProfileAfterBattle(bool won) internal {
        PlayerProfile storage profile = profiles[msg.sender];
        profile.xp += won ? 25 : 10;
        if (won) profile.wins++;
        else profile.losses++;
        if (profile.xp >= uint32(profile.level) * 55 + 90) {
            profile.level++;
        }
    }

    function clearPlayerData() external whenNotPaused {
        delete playerUnits[msg.sender];
        delete playerRelics[msg.sender];
        delete equippedRelics[msg.sender];
        delete lastPlayerMaxHp[msg.sender];
        delete lastAIMaxHp[msg.sender];
        delete lastBattleEvents[msg.sender];
    }
}