// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract StarForgeUnitNFT is ERC721, Ownable {
    using Strings for uint256;
    using Base64 for bytes;

    uint256 private _nextTokenId;

    enum Faction { Empire, Voidborn, Mechanoids }
    enum Rarity { Common, Rare, Legendary }
    enum UnitClass { Fighter, Cruiser, Dreadnought, DroneSwarm }

    struct Unit {
        Faction faction;
        Rarity rarity;
        UnitClass unitClass;
        uint8 attack;
        uint8 defense;
        uint8 speed;
    }

    mapping(uint256 => Unit) public units;

    address public gameContract;

    event UnitMinted(address to, uint256 tokenId, Faction faction, Rarity rarity, UnitClass unitClass);

    modifier onlyGameContract() {
        require(msg.sender == gameContract, "Only Game contract can mint");
        _;
    }

    constructor() ERC721("Somnia StarForge Unit", "SFUNIT") Ownable(msg.sender) {}

    function setGameContract(address _gameContract) external onlyOwner {
        gameContract = _gameContract;
    }

    function mintUnit(
        address to,
        Faction faction,
        Rarity rarity,
        UnitClass unitClass,
        uint8 atk,
        uint8 def,
        uint8 spd
    ) external onlyGameContract returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        units[tokenId] = Unit({
            faction: faction,
            rarity: rarity,
            unitClass: unitClass,
            attack: atk,
            defense: def,
            speed: spd
        });

        emit UnitMinted(to, tokenId, faction, rarity, unitClass);
        return tokenId;
    }

    function getUnit(uint256 tokenId) external view returns (Unit memory) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return units[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        Unit memory u = units[tokenId];

        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">',
            '<rect width="300" height="300" fill="#0a0a2a"/>',
            '<circle cx="150" cy="150" r="100" fill="none" stroke="#00ffff" stroke-width="30"/>',
            '<text x="150" y="160" font-size="40" fill="#ff00ff" text-anchor="middle">', _getClassName(u.unitClass), '</text>',
            '</svg>'
        ));

        string memory json = Base64.encode(bytes(string(abi.encodePacked(
            '{"name":"StarForge Unit #', tokenId.toString(), '",',
            '"description":"On-chain unit from Somnia StarForge - Echo of Dreams",',
            '"image":"data:image/svg+xml;base64,', Base64.encode(bytes(svg)), '",',
            '"attributes":[',
            '{"trait_type":"Faction","value":"', _getFactionName(u.faction), '"},',
            '{"trait_type":"Rarity","value":"', _getRarityName(u.rarity), '"},',
            '{"trait_type":"Attack","value":', uint256(u.attack).toString(), '},',
            '{"trait_type":"Defense","value":', uint256(u.defense).toString(), '},',
            '{"trait_type":"Speed","value":', uint256(u.speed).toString(), '}',
            ']}'
        ))));

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _getFactionName(Faction f) internal pure returns (string memory) {
        if (f == Faction.Empire) return "Empire";
        if (f == Faction.Voidborn) return "Voidborn";
        return "Mechanoids";
    }

    function _getRarityName(Rarity r) internal pure returns (string memory) {
        if (r == Rarity.Common) return "Common";
        if (r == Rarity.Rare) return "Rare";
        return "Legendary";
    }

    function _getClassName(UnitClass c) internal pure returns (string memory) {
        if (c == UnitClass.Fighter) return "Fighter";
        if (c == UnitClass.Cruiser) return "Cruiser";
        if (c == UnitClass.Dreadnought) return "Dreadnought";
        return "Drone Swarm";
    }

    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }

    function ownerMint(address to, Faction faction, Rarity rarity, UnitClass unitClass, uint8 atk, uint8 def, uint8 spd) external onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        units[tokenId] = Unit(faction, rarity, unitClass, atk, def, spd);
    }
}
