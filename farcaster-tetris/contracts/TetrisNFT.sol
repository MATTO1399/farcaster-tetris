// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TetrisNFT
 * @dev Tetrisハイスコア達成者に配布されるNFT
 */
contract TetrisNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard, Pausable {
    uint256 private _tokenIdCounter;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public minScoreRequired = 1000;
    
    // スコア記録
    mapping(uint256 => uint256) public tokenScore;
    mapping(address => uint256[]) public userTokens;
    mapping(address => uint256) public userBestScore;
    
    // イベント
    event NFTMinted(address indexed to, uint256 tokenId, uint256 score);
    event MinScoreUpdated(uint256 newMinScore);
    
    constructor() ERC721("Tetris Champion", "TETRIS") Ownable(msg.sender) {}
    
    /**
     * @dev NFTをミント（ハイスコア達成時）
     * @param to ミント先アドレス
     * @param score 達成スコア
     * @param tokenURI メタデータURI
     */
    function mint(
        address to,
        uint256 score,
        string memory tokenURI
    ) public onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Invalid address");
        require(score >= minScoreRequired, "Score too low");
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        
        _tokenIdCounter++;
        uint256 tokenId = _tokenIdCounter;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
        
        tokenScore[tokenId] = score;
        userTokens[to].push(tokenId);
        
        // ユーザーのベストスコア更新
        if (score > userBestScore[to]) {
            userBestScore[to] = score;
        }
        
        emit NFTMinted(to, tokenId, score);
    }
    
    /**
     * @dev 最小スコア要件を更新
     * @param newMinScore 新しい最小スコア
     */
    function setMinScoreRequired(uint256 newMinScore) public onlyOwner {
        minScoreRequired = newMinScore;
        emit MinScoreUpdated(newMinScore);
    }
    
    /**
     * @dev ユーザーが所有するトークンIDを取得
     * @param user ユーザーアドレス
     */
    function getUserTokens(address user) public view returns (uint256[] memory) {
        return userTokens[user];
    }
    
    /**
     * @dev トークンのスコアを取得
     * @param tokenId トークンID
     */
    function getTokenScore(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenScore[tokenId];
    }
    
    /**
     * @dev 現在のトークン供給数
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    /**
     * @dev 緊急停止
     */
    function pause() public onlyOwner {
        _pause();
    }
    
    /**
     * @dev 停止解除
     */
    function unpause() public onlyOwner {
        _unpause();
    }
    
    // Required overrides
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
