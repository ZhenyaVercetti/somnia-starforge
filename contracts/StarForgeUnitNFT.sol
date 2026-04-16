// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract StarForgeUnitNFT is ERC721, Ownable {
    uint256 public nextTokenId = 1;
    string private baseURI = "https://metadata.somnia.starforge/";

    struct Unit {
        string name;
        string faction;
        uint8 rarity;
        uint8 attack;
        uint8 defense;
        uint8 speed;
    }

    mapping(uint256 => Unit) public units;

    constructor() ERC721("Somnia StarForge Unit", "STARUNIT") Ownable(msg.sender) {}

    function mintUnit(address to, string memory name, string memory faction, uint8 rarity, uint8 atk, uint8 def, uint8 spd) external onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _safeMint(to, tokenId);
        units[tokenId] = Unit(name, faction, rarity, atk, def, spd);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(baseURI, Strings.toString(tokenId), ".json"));
    }

    function getUnitData(uint256 tokenId) external view returns (Unit memory) {
        return units[tokenId];
    }
}
