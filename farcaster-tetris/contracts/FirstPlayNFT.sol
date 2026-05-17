// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title FirstPlayNFT
/// @notice 初回プレイ記念NFTの署名付きclaimコントラクト
/// @dev
/// - 1アドレス1回のみclaim可能
/// - EIP-712署名必須
/// - deadlineで有効期限管理
/// - digest再利用防止(replay対策)
/// - owner/admin権限あり
contract FirstPlayNFT is ERC721, Ownable, Pausable, ReentrancyGuard, EIP712 {
    using Strings for uint256;

    // =============================================================
    // Constants
    // =============================================================

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address to,uint256 deadline,bytes32 campaignId,uint256 nonce)");

    // =============================================================
    // State
    // =============================================================

    /// @notice claim署名を発行する署名者アドレス
    address public signer;

    /// @notice キャンペーンID
    /// 例: keccak256("FIRST_PLAY_V1")
    bytes32 public immutable campaignId;

    /// @notice 次にmintされるtokenId
    uint256 public nextTokenId = 1;

    /// @notice 最大供給量。0なら無制限
    uint256 public maxSupply;

    /// @notice tokenURI = baseURI + tokenId + ".json"
    string private _baseTokenURI;

    /// @notice 1アドレス1回制限
    mapping(address => bool) public minted;

    /// @notice replay防止用
    mapping(bytes32 => bool) public usedDigests;

    /// @notice admin権限
    mapping(address => bool) public admins;

    // =============================================================
    // Errors
    // =============================================================

    error ZeroAddress();
    error InvalidSigner();
    error InvalidCampaignId();
    error Unauthorized();
    error AlreadyClaimed(address account);
    error SignatureExpired(uint256 deadline, uint256 currentTimestamp);
    error InvalidSignature(address recovered, address expected);
    error DigestAlreadyUsed(bytes32 digest);
    error MaxSupplyReached(uint256 maxSupply);
    error CallerMustBeRecipient(address caller, address recipient);

    // =============================================================
    // Events
    // =============================================================

    event Claimed(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed nonce,
        bytes32 digest,
        bytes32 campaignId
    );

    event SignerUpdated(address indexed previousSigner, address indexed newSigner);
    event AdminUpdated(address indexed account, bool enabled);
    event BaseURIUpdated(string newBaseURI);
    event MaxSupplyUpdated(uint256 newMaxSupply);

    // =============================================================
    // Modifiers
    // =============================================================

    modifier onlyOwnerOrAdmin() {
        if (msg.sender != owner() && !admins[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    // =============================================================
    // Constructor
    // =============================================================

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_,
        address initialSigner_,
        string memory baseTokenURI_,
        bytes32 campaignId_,
        uint256 maxSupply_
    ) ERC721(name_, symbol_) Ownable(initialOwner_) EIP712(name_, "1") {
        if (initialOwner_ == address(0)) revert ZeroAddress();
        if (initialSigner_ == address(0)) revert InvalidSigner();
        if (campaignId_ == bytes32(0)) revert InvalidCampaignId();

        signer = initialSigner_;
        _baseTokenURI = baseTokenURI_;
        campaignId = campaignId_;
        maxSupply = maxSupply_;
    }

    // =============================================================
    // Claim
    // =============================================================

    /// @notice 署名付きclaimでNFTをmint
    /// @param to 受取先
    /// @param deadline 署名の有効期限
    /// @param nonce サーバー側で発行するnonce
    /// @param signature EIP-712署名
    function claim(
        address to,
        uint256 deadline,
        uint256 nonce,
        bytes calldata signature
    ) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (msg.sender != to) revert CallerMustBeRecipient(msg.sender, to);
        if (minted[to]) revert AlreadyClaimed(to);

        if (block.timestamp > deadline) {
            revert SignatureExpired(deadline, block.timestamp);
        }

        if (maxSupply != 0 && nextTokenId > maxSupply) {
            revert MaxSupplyReached(maxSupply);
        }

        bytes32 digest = getClaimDigest(to, deadline, nonce);

        if (usedDigests[digest]) {
            revert DigestAlreadyUsed(digest);
        }

        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) {
            revert InvalidSignature(recovered, signer);
        }

        usedDigests[digest] = true;
        minted[to] = true;

        tokenId = nextTokenId;
        unchecked {
            nextTokenId = tokenId + 1;
        }

        _safeMint(to, tokenId);

        emit Claimed(to, tokenId, nonce, digest, campaignId);
    }

    // =============================================================
    // Views
    // =============================================================

    /// @notice claim用digestを返す
    function getClaimDigest(
        address to,
        uint256 deadline,
        uint256 nonce
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                to,
                deadline,
                campaignId,
                nonce
            )
        );

        return _hashTypedDataV4(structHash);
    }

    function hasClaimed(address account) external view returns (bool) {
        return minted[account];
    }

    function totalSupply() external view returns (uint256) {
        return nextTokenId - 1;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory base = _baseURI();
        if (bytes(base).length == 0) {
            return "";
        }

        return string.concat(base, tokenId.toString(), ".json");
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    // =============================================================
    // Admin / Owner
    // =============================================================

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidSigner();

        address oldSigner = signer;
        signer = newSigner;

        emit SignerUpdated(oldSigner, newSigner);
    }

    function setAdmin(address account, bool enabled) external onlyOwner {
        if (account == address(0)) revert ZeroAddress();

        admins[account] = enabled;
        emit AdminUpdated(account, enabled);
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwnerOrAdmin {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        uint256 currentSupply = nextTokenId - 1;

        // 既発行数より小さい値にはできない
        if (newMaxSupply != 0 && newMaxSupply < currentSupply) {
            revert MaxSupplyReached(currentSupply);
        }

        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    function pause() external onlyOwnerOrAdmin {
        _pause();
    }

    function unpause() external onlyOwnerOrAdmin {
        _unpause();
    }
}
