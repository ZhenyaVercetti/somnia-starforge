// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./StarForgeUnitNFT.sol";
import "./StarForgeRelic.sol";
import "./StarForgeBattleLibrary.sol";

contract StarForgeGame is Ownable, ReentrancyGuard, Pausable {
    StarForgeUnitNFT public unitNFT;
    StarForgeRelic public relicContract;

    uint256 public constant BUY_PRICE = 0 ether;
    uint256 public constant REROLL_PRICE = 0 ether;
    uint8 public constant SHOP_SLOTS = 3;

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
        uint16 currentAITier;
        uint8 winStreak;
    }

    mapping(address => PlayerProfile) public profiles;

    mapping(address => StarForgeBattleLibrary.ShopItem[3]) public playerShopPreview;
    mapping(address => StarForgeBattleLibrary.ShopItem[]) public playerCurrentAI;

    mapping(address => uint256[]) public playerUnits;
    mapping(address => uint256[]) public playerRelics;

    mapping(address => uint256[3]) public equippedRelics;

    mapping(address => uint16[]) public lastPlayerMaxHp;
    mapping(address => uint16[]) public lastAIMaxHp;

    mapping(address => bool) public lastPlayerWon;
    mapping(address => StarForgeBattleLibrary.BattleEvent[]) public lastBattleEvents;

    event MatchResolved(
        address indexed player,
        bool playerWon,
        StarForgeBattleLibrary.BattleEvent[] events
    );

    event UnitBought(address player, uint256 tokenId);
    event ShopRerolled(address player);
    event AIOpponentGenerated(address player, uint16 aiLevel, uint16 tier);
    event RelicBought(address player, uint256 relicId);

    constructor(address _unitNFT) Ownable(msg.sender) {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setUnitNFT(address _unitNFT) external onlyOwner {
        unitNFT = StarForgeUnitNFT(_unitNFT);
    }

    function setRelicContract(address _relicContract) external onlyOwner {
        relicContract = StarForgeRelic(_relicContract);
    }

    function getPlayerUnits(address player) external view returns (uint256[] memory) {
        return playerUnits[player];
    }

    function getPlayerRelics(address player) external view returns (uint256[] memory) {
        return playerRelics[player];
    }

    function getPlayerShop(address player) external view returns (StarForgeBattleLibrary.ShopItem[3] memory) {
        return playerShopPreview[player];
    }

    function getCurrentAI(address player) external view returns (StarForgeBattleLibrary.ShopItem[] memory) {
        return playerCurrentAI[player];
    }

    function getEquippedRelics(address player) external view returns (uint256[3] memory) {
        return equippedRelics[player];
    }

    function getLastBattleResult(address player) external view 
        returns (
            bool playerWon,
            StarForgeBattleLibrary.BattleEvent[] memory events,
            uint16[] memory playerMaxHp,
            uint16[] memory aiMaxHp
        ) 
    {
        return (
            lastPlayerWon[player],
            lastBattleEvents[player],
            lastPlayerMaxHp[player],
            lastAIMaxHp[player]
        );
    }

    function startMatch(uint256[] calldata team, uint256[] calldata equipped) external whenNotPaused nonReentrant {
        require(team.length >= 4 && team.length <= 8, "Team size 4-8 only");
        require(equipped.length == 3, "Must equip exactly 3 relics (or 0,0,0)");

        for (uint256 i = 0; i < team.length; i++) {
            require(unitNFT.ownerOf(team[i]) == msg.sender, "Not your unit");
        }

        equippedRelics[msg.sender] = [equipped[0], equipped[1], equipped[2]];

        StarForgeBattleLibrary.ShopItem[] memory aiTeam = playerCurrentAI[msg.sender];
        if (aiTeam.length == 0) {
            _generateAIOpponent(msg.sender);
            aiTeam = playerCurrentAI[msg.sender];
        }

        uint256 battleSeed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));

        uint16 playerLevel = profiles[msg.sender].level;

        StarForgeBattleLibrary.BattleResult memory result = StarForgeBattleLibrary._simulateBattle(
            team,
            aiTeam,
            battleSeed,
            msg.sender,
            unitNFT,
            relicContract,
            equipped,
            playerLevel
        );

        _updateProfileMatch(msg.sender, result.playerWon);

        lastPlayerWon[msg.sender] = result.playerWon;

        delete lastBattleEvents[msg.sender];
        for (uint256 i = 0; i < result.events.length; i++) {
            lastBattleEvents[msg.sender].push(result.events[i]);
        }

        delete lastPlayerMaxHp[msg.sender];
        for (uint256 i = 0; i < result.playerMaxHp.length; i++) {
            lastPlayerMaxHp[msg.sender].push(result.playerMaxHp[i]);
        }

        delete lastAIMaxHp[msg.sender];
        for (uint256 i = 0; i < result.aiMaxHp.length; i++) {
            lastAIMaxHp[msg.sender].push(result.aiMaxHp[i]);
        }

        if (result.playerWon && address(relicContract) != address(0)) {
            uint256 relicId = relicContract.mintRelic(msg.sender, StarForgeRelic.RelicType.ATTACK_BOOST, 5);
            playerRelics[msg.sender].push(relicId);
        }

        emit MatchResolved(msg.sender, result.playerWon, result.events);

        if (result.playerWon) {
            _generateAIOpponent(msg.sender);
        }
    }

    function _generateAIOpponent(address player) internal {
        PlayerProfile storage profile = profiles[player];
        if (profile.level == 0) profile.level = 1;

        uint16 aiLevel = profile.level;
        uint16 tier = profile.currentAITier;
        uint8 streak = profile.winStreak;

        uint8 teamSize = 4 + uint8(aiLevel / 3);
        if (teamSize > 8) teamSize = 8;

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, player, aiLevel, tier, unitNFT.totalSupply(), block.prevrandao)));

        delete playerCurrentAI[player];

        StarForgeUnitNFT.Rarity maxPlayerRarity = StarForgeUnitNFT.Rarity.Common;
        uint256[] memory playerUnitsList = playerUnits[player];
        for (uint256 i = 0; i < playerUnitsList.length; i++) {
            StarForgeUnitNFT.Unit memory u = unitNFT.getUnit(playerUnitsList[i]);
            if (uint8(u.rarity) > uint8(maxPlayerRarity)) {
                maxPlayerRarity = u.rarity;
            }
        }

        StarForgeUnitNFT.Rarity aiRarity;
        uint256 r = seed % 100;
        if (maxPlayerRarity == StarForgeUnitNFT.Rarity.Common) {
            aiRarity = StarForgeUnitNFT.Rarity.Common;
        } else if (maxPlayerRarity == StarForgeUnitNFT.Rarity.Rare) {
            aiRarity = (r < 68) ? StarForgeUnitNFT.Rarity.Rare : StarForgeUnitNFT.Rarity.Common;
        } else {
            aiRarity = (r < 52) ? StarForgeUnitNFT.Rarity.Legendary : StarForgeUnitNFT.Rarity.Rare;
        }

        uint256 scaling = 100 + uint256(tier) * 7 + uint256(streak) * 4;

        for (uint256 i = 0; i < teamSize; i++) {
            StarForgeBattleLibrary.ShopItem memory u;
            u.isRelic = false;
            u.faction = StarForgeUnitNFT.Faction(uint8((seed >> (i * 8)) % 3));
            u.rarity = aiRarity;
            u.unitClass = StarForgeUnitNFT.UnitClass(uint8((seed >> (i * 24)) % 4));

            uint8 base = 4 + uint8(aiLevel / 4);
            u.attack = uint8((base + uint8((seed >> (i * 32)) % 7)) * scaling / 100);
            u.defense = uint8((base + uint8((seed >> (i * 40)) % 7)) * scaling / 100);
            u.speed  = uint8((base + uint8((seed >> (i * 48)) % 7)) * scaling / 100);

            playerCurrentAI[player].push(u);
        }
        emit AIOpponentGenerated(player, aiLevel, tier);
    }

    function buyUnit() external payable whenNotPaused nonReentrant {
        require(msg.value == BUY_PRICE, "Incorrect payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            unitNFT.totalSupply(),
            block.prevrandao,
            block.number
        )));

        (
            StarForgeUnitNFT.Faction faction,
            StarForgeUnitNFT.Rarity rarity,
            StarForgeUnitNFT.UnitClass unitClass,
            uint8 atk,
            uint8 def,
            uint8 spd
        ) = _generateRandomUnit(seed);

        uint256 tokenId = unitNFT.mintUnit(
            msg.sender,
            faction,
            rarity,
            unitClass,
            atk,
            def,
            spd
        );

        playerUnits[msg.sender].push(tokenId);
        _updateProfileBuy(msg.sender);

        emit UnitBought(msg.sender, tokenId);
    }

    function _generateRandomUnit(uint256 seed) internal pure returns (
        StarForgeUnitNFT.Faction faction,
        StarForgeUnitNFT.Rarity rarity,
        StarForgeUnitNFT.UnitClass unitClass,
        uint8 atk,
        uint8 def,
        uint8 spd
    ) {
        uint256 r = seed % 100;
        if (r < 70) rarity = StarForgeUnitNFT.Rarity.Common;
        else if (r < 95) rarity = StarForgeUnitNFT.Rarity.Rare;
        else rarity = StarForgeUnitNFT.Rarity.Legendary;

        faction = StarForgeUnitNFT.Faction((seed >> 8) % 3);
        unitClass = StarForgeUnitNFT.UnitClass((seed >> 16) % 4);

        if (rarity == StarForgeUnitNFT.Rarity.Common) {
            atk = 4 + uint8((seed >> 24) % 4);
            def = 3 + uint8((seed >> 32) % 4);
            spd = 5 + uint8((seed >> 40) % 3);
        } else if (rarity == StarForgeUnitNFT.Rarity.Rare) {
            atk = 7 + uint8((seed >> 24) % 5);
            def = 6 + uint8((seed >> 32) % 4);
            spd = 7 + uint8((seed >> 40) % 4);
        } else {
            atk = 11 + uint8((seed >> 24) % 5);
            def = 9 + uint8((seed >> 32) % 5);
            spd = 10 + uint8((seed >> 40) % 5);
        }
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        require(msg.value == REROLL_PRICE, "Incorrect payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            block.prevrandao
        )));

        for (uint256 i = 0; i < SHOP_SLOTS; i++) {
            StarForgeBattleLibrary.ShopItem memory item;
            item.isRelic = true;
            item.id = 0;
            item.relicType = uint8((seed >> (i * 8)) % 6);
            item.relicValue = 3 + uint8((seed >> (i * 16)) % 18);
            playerShopPreview[msg.sender][i] = item;
        }

        emit ShopRerolled(msg.sender);
    }

    function buyFromShop(uint256 slot) external payable whenNotPaused nonReentrant {
        require(msg.value == BUY_PRICE, "Incorrect payment");
        require(slot < SHOP_SLOTS, "Invalid slot");

        StarForgeBattleLibrary.ShopItem memory item = playerShopPreview[msg.sender][slot];
        require(item.isRelic, "Not a relic");

        uint256 relicId = relicContract.mintRelic(
            msg.sender,
            StarForgeRelic.RelicType(item.relicType),
            item.relicValue
        );

        playerRelics[msg.sender].push(relicId);
        delete playerShopPreview[msg.sender][slot];

        emit RelicBought(msg.sender, relicId);
    }

    function _updateProfileBuy(address player) internal {
        PlayerProfile storage p = profiles[player];
        if (p.level == 0) p.level = 1;
        p.xp += 20;
        _levelUpIfNeeded(p);
    }

    function _updateProfileMatch(address player, bool won) internal {
        PlayerProfile storage p = profiles[player];
        if (won) {
            p.wins++;
            p.winStreak++;
            p.currentAITier = uint16(p.wins / 3);
            p.xp += 160 + uint32(p.level) * 6;   // ← новая награда
        } else {
            p.losses++;
            p.winStreak = 0;
            p.xp += 85 + uint32(p.level) * 3;    // ← новая награда
        }
        _levelUpIfNeeded(p);
    }

    function _levelUpIfNeeded(PlayerProfile storage p) internal {
        uint32 required = uint32(p.level) * 55 + 90;   // ← новая формула
        if (p.xp >= required) {
            p.level++;
            p.xp = 0;
        }
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function withdraw() external onlyOwner { payable(owner()).transfer(address(this).balance); }
}