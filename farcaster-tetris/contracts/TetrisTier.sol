// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

contract TetrisTier is ERC721, Ownable, Pausable, ReentrancyGuard, EIP712 {
    using Strings for uint256;

    enum Tier { BRONZE, SILVER, GOLD, PLATINUM }
    uint256 public constant TIER_COUNT = 4;

    bytes32 public constant CLAIM_TYPEHASH =
        keccak256("Claim(address to,uint8 tier,uint256 deadline,bytes32 campaignId,uint256 nonce)");

    address public signer;
    bytes32 public immutable campaignId;
    uint256 public nextTokenId = 1;

    mapping(Tier => uint256) public minScore;
    mapping(Tier => string) public tierBaseURI;
    mapping(Tier => bool) public tierActive;
    mapping(address => mapping(Tier => bool)) public minted;
    mapping(bytes32 => bool) public usedDigests;
    mapping(uint256 => Tier) public tokenTier;

    event Claimed(address indexed to, Tier indexed tier, uint256 indexed tokenId, bytes32 digest);
    event TierConfigUpdated(Tier tier, uint256 minScore, string baseURI, bool active);
    event SignerUpdated(address prev, address curr);

    error ZeroAddress();
    error InvalidSigner();
    error InvalidCampaign();
    error Unauthorized();
    error AlreadyClaimed(address account, Tier tier);
    error SignatureExpired(uint256 deadline, uint256 now_);
    error InvalidSignature(address recovered, address expected);
    error DigestAlreadyUsed(bytes32 digest);
    error CallerMustBeRecipient(address caller, address recipient);
    error InvalidTier();
    error TierInactive(Tier tier);
    error ScoreTooLow(Tier tier, uint256 required);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_,
        address initialSigner_,
        bytes32 campaignId_
    ) ERC721(name_, symbol_) Ownable(initialOwner_) EIP712(name_, "1") {
        if (initialOwner_ == address(0)) revert ZeroAddress();
        if (initialSigner_ == address(0)) revert InvalidSigner();
        if (campaignId_ == bytes32(0)) revert InvalidCampaign();
        signer = initialSigner_;
        campaignId = campaignId_;
    }

    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidSigner();
        address prev = signer;
        signer = newSigner;
        emit SignerUpdated(prev, newSigner);
    }

    function setTierConfig(Tier t, uint256 score, string calldata uri, bool active) external onlyOwner {
        tierActive[t] = active;
        minScore[t] = score;
        tierBaseURI[t] = uri;
        emit TierConfigUpdated(t, score, uri, active);
    }

    function getClaimDigest(address to, uint8 tier, uint256 deadline, uint256 nonce) public view returns (bytes32) {
        if (tier > 3) revert InvalidTier();
        return _hashTypedDataV4(
            keccak256(abi.encode(CLAIM_TYPEHASH, to, tier, deadline, campaignId, nonce))
        );
    }

    /// @notice スコアから対象Tierを取得
    function tierForScore(uint256 score) public view returns (Tier) {
        if (tierActive[Tier.PLATINUM] && score >= minScore[Tier.PLATINUM]) return Tier.PLATINUM;
        if (tierActive[Tier.GOLD] && score >= minScore[Tier.GOLD]) return Tier.GOLD;
        if (tierActive[Tier.SILVER] && score >= minScore[Tier.SILVER]) return Tier.SILVER;
        if (tierActive[Tier.BRONZE] && score >= minScore[Tier.BRONZE]) return Tier.BRONZE;
        revert ScoreTooLow(Tier.BRONZE, minScore[Tier.BRONZE]);
    }

    function claim(
        address to,
        uint8 tierId,
        uint256 deadline,
        uint256 nonce,
        bytes calldata signature
    ) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        if (msg.sender != to) revert CallerMustBeRecipient(msg.sender, to);
        if (tierId > 3) revert InvalidTier();

        Tier t = Tier(tierId);
        if (!tierActive[t]) revert TierInactive(t);
        if (minted[to][t]) revert AlreadyClaimed(to, t);

        if (block.timestamp > deadline) revert SignatureExpired(deadline, block.timestamp);

        bytes32 digest = getClaimDigest(to, tierId, deadline, nonce);
        if (usedDigests[digest]) revert DigestAlreadyUsed(digest);

        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature(recovered, signer);

        usedDigests[digest] = true;
        minted[to][t] = true;

        tokenId = nextTokenId;
        unchecked { nextTokenId = tokenId + 1; }
        _safeMint(to, tokenId);
        tokenTier[tokenId] = t;

        emit Claimed(to, t, tokenId, digest);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Tier t = tokenTier[tokenId];
        string memory base = tierBaseURI[t];
        if (bytes(base).length == 0) return "";
        return string.concat(base, tokenId.toString(), ".json");
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
