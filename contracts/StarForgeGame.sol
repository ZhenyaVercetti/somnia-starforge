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

    struct PlayerProfile {
        uint16 level;
        uint32 xp;
        uint256 wins;
        uint256 losses;
    }

    mapping(address => PlayerProfile) public profiles;

    // ShopItem теперь из библиотеки
    mapping(address => StarForgeBattleLibrary.ShopItem[5]) public playerShopPreview;
    mapping(address => StarForgeBattleLibrary.ShopItem[]) public playerCurrentAI;

    mapping(address => uint256[]) public playerUnits;
    mapping(address => uint256[]) public playerRelics;

    mapping(address => bool) public lastPlayerWon;
    mapping(address => StarForgeBattleLibrary.BattleEvent[]) public lastBattleEvents;

    event MatchResolved(
        address indexed player,
        bool playerWon,
        StarForgeBattleLibrary.BattleEvent[] events,
        uint256[] rewards
    );

    event UnitBought(address player, uint256 tokenId);
    event ShopRerolled(address player);
    event AIOpponentGenerated(address player, uint16 aiLevel);
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

    function getPlayerShop(address player) external view returns (StarForgeBattleLibrary.ShopItem[5] memory) {
        return playerShopPreview[player];
    }

    function getCurrentAI(address player) external view returns (StarForgeBattleLibrary.ShopItem[] memory) {
        return playerCurrentAI[player];
    }

    function getLastBattleResult(address player) external view returns (bool, StarForgeBattleLibrary.BattleEvent[] memory) {
        return (lastPlayerWon[player], lastBattleEvents[player]);
    }

    function startMatch(uint256[] calldata team) external whenNotPaused nonReentrant {
        require(team.length >= 4 && team.length <= 8, "Team size 4-8 only");

        for (uint256 i = 0; i < team.length; i++) {
            require(unitNFT.ownerOf(team[i]) == msg.sender, "Not your unit");
        }

        StarForgeBattleLibrary.ShopItem[] memory aiTeam = playerCurrentAI[msg.sender];
        if (aiTeam.length == 0) {
            _generateAIOpponent(msg.sender);
            aiTeam = playerCurrentAI[msg.sender];
        }

        uint256 battleSeed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));
        (bool playerWon, StarForgeBattleLibrary.BattleEvent[] memory events) = StarForgeBattleLibrary._simulateBattle(
            team,
            aiTeam,
            battleSeed,
            msg.sender,
            unitNFT,
            relicContract,
            playerRelics[msg.sender]
        );

        _updateProfileMatch(msg.sender, playerWon);

        lastPlayerWon[msg.sender] = playerWon;
        delete lastBattleEvents[msg.sender];
        for (uint256 i = 0; i < events.length; i++) {
            lastBattleEvents[msg.sender].push(events[i]);
        }

        if (playerWon && address(relicContract) != address(0)) {
            uint256 relicId = relicContract.mintRelic(msg.sender, StarForgeRelic.RelicType.ATTACK_BOOST, 5);
            playerRelics[msg.sender].push(relicId);
        }

        uint256[] memory rewards = new uint256[](playerWon ? 3 : 1);
        emit MatchResolved(msg.sender, playerWon, events, rewards);

        if (playerWon) {
            delete playerCurrentAI[msg.sender];
        }
    }

    function _generateAIOpponent(address player) internal {
        PlayerProfile memory profile = profiles[player];
        uint16 aiLevel = profile.level > 0 ? profile.level : 1;

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, player, aiLevel, unitNFT.totalSupply(), block.prevrandao)));

        delete playerCurrentAI[player];

        for (uint256 i = 0; i < 4; i++) {
            StarForgeBattleLibrary.ShopItem memory u;
            u.isRelic = false;
            u.faction = StarForgeUnitNFT.Faction(uint8((seed >> (i * 8)) % 3));
            u.rarity = StarForgeUnitNFT.Rarity.Common;
            u.unitClass = StarForgeUnitNFT.UnitClass(uint8((seed >> (i * 16)) % 4));
            uint8 base = 3 + uint8(aiLevel / 4);
            u.attack = base + uint8((seed >> (i * 32 + 8)) % 6);
            u.defense = base + uint8((seed >> (i * 40)) % 6);
            u.speed = base + uint8((seed >> (i * 48)) % 6);
            playerCurrentAI[player].push(u);
        }
        emit AIOpponentGenerated(player, aiLevel);
    }

    function buyUnit() external payable whenNotPaused nonReentrant {
        require(msg.value == BUY_PRICE, "Incorrect payment");
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, unitNFT.totalSupply())));
        uint256 tokenId = unitNFT.mintUnit(msg.sender, StarForgeUnitNFT.Faction(uint8(seed % 3)), StarForgeUnitNFT.Rarity.Common, StarForgeUnitNFT.UnitClass.Fighter, 5, 5, 6);
        playerUnits[msg.sender].push(tokenId);
        _updateProfileBuy(msg.sender);
        emit UnitBought(msg.sender, tokenId);
    }

    function rerollShop() external payable whenNotPaused nonReentrant {
        require(msg.value == REROLL_PRICE, "Incorrect payment");

        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));

        for (uint256 i = 0; i < 5; i++) {
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
        require(slot < 5, "Invalid slot");

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
        p.xp += 10;
        if (p.xp >= uint32(p.level) * 100) { p.level++; p.xp = 0; }
    }

    function _updateProfileMatch(address player, bool won) internal {
        PlayerProfile storage p = profiles[player];
        if (won) { p.wins++; p.xp += 50; } else { p.losses++; p.xp += 25; }
        if (p.xp >= uint32(p.level) * 100) { p.level++; p.xp = 0; }
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
    function withdraw() external onlyOwner { payable(owner()).transfer(address(this).balance); }
}