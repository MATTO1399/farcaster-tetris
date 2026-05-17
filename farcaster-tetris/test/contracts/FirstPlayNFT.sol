// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin v5.x
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title FirstPlayNFT
 * @notice 初回プレイ完了者だけが 1 回だけ claim できる記念 NFT
 *
 * 設計ポイント:
 * - EIP-712 署名付き claim
 * - 1 address = 1 mint
 * - deadline で期限切れ無効
 * - digest 再利用防止で replay 対策
 * - owner / admin 権限分離
 * - backend signer をローテーション可能
 *
 * 想定フロー:
 * 1. backend が初回プレイ済みか確認
 * 2. backend が EIP-712 署名を発行
 * 3. user が claim() を呼ぶ
 * 4. contract が署名検証して mint
 *
 * 注意:
 * - このテンプレートは「claim 先 = msg.sender」にしています
 *   他人宛 mint を許したい場合は msg.sender == to チェックを外してください。
 * - chainId / verifyingContract は EIP-712 domain separator により保護されます。
 */
contract FirstPlayNFT is ERC721, Ownable, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;
    using Strings for uint256;

    // =============================================================
    //                          Errors
    // =============================================================

    error InvalidAddress();
    error InvalidSigner();
    error InvalidMaxSupply();
    error AlreadyClaimed();
    error SignatureExpired();
    error InvalidSignature();
    error DigestAlreadyUsed();
    error MaxSupplyReached();
    error Unauthorized();
    error CallerMustBeRecipient();

    // =============================================================
    //                          Events
    // =============================================================

    event Claimed(
        address indexed to,
        uint256 indexed tokenId,
        bytes32 indexed digest,
        uint256 nonce,
        bytes32 campaignId
    );

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event AdminUpdated(address indexed account, bool allowed);
    event BaseURIUpdated(string newBaseURI);
    event MaxSupplyUpdated(uint256 newMaxSupply);

    // =============================================================
    //                      EIP-712 Config
    // =============================================================

    /**
     * @dev domain(name, version, chainId, verifyingContract) は EIP712 が管理
     *
     * message 側には以下を含める:
     * Claim(address to,uint256 deadline,bytes32 campaignId,uint256 nonce)
     */
    bytes32 public constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(address to,uint256 deadline,bytes32 campaignId,uint256 nonce)"
        );

    // =============================================================
    //                        State
    // =============================================================

    /// @notice backend の署名検証に使う signer
    address public signer;

    /// @notice 例えば keccak256("FIRST_PLAY_V1")
    bytes32 public immutable campaignId;

    /// @notice 次に mint する tokenId
    uint256 public nextTokenId = 1;

    /// @notice 0 の場合は無制限
    uint256 public maxSupply;

    /// @notice 1 address = 1 mint 制限
    mapping(address => bool) public minted;

    /// @notice 署名 digest の再利用防止
    mapping(bytes32 => bool) public usedDigests;

    /// @notice owner 以外の運用管理者
    mapping(address => bool) public admins;

    /// @dev metadata base URI
    string private _baseTokenURI;

    // =============================================================
    //                       Constructor
    // =============================================================

    /**
     * @param name_ Collection name
     * @param symbol_ Collection symbol
     * @param initialOwner_ owner
     * @param initialSigner_ backend signer
     * @param baseTokenURI_ metadata base URI
     * @param campaignId_ campaign identifier
     * @param maxSupply_ 0 なら無制限
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner_,
        address initialSigner_,
        string memory baseTokenURI_,
        bytes32 campaignId_,
        uint256 maxSupply_
    ) ERC721(name_, symbol_) Ownable(initialOwner_) EIP712(name_, "1") {
        if (initialOwner_ == address(0)) revert InvalidAddress();
        if (initialSigner_ == address(0)) revert InvalidSigner();
        if (campaignId_ == bytes32(0)) revert InvalidAddress();

        signer = initialSigner_;
        _baseTokenURI = baseTokenURI_;
        campaignId = campaignId_;
        maxSupply = maxSupply_;
    }

    // =============================================================
    //                        Modifiers
    // =============================================================

    modifier onlyOwnerOrAdmin() {
        if (msg.sender != owner() && !admins[msg.sender]) {
            revert Unauthorized();
        }
        _;
    }

    // =============================================================
    //                        Claim Logic
    // =============================================================

    /**
     * @notice 署名付き claim により NFT を mint
     * @param to claim 対象アドレス
     * @param deadline 署名有効期限
     * @param nonce backend 発行の nonce
     * @param signature backend signer の EIP-712 署名
     *
     * message:
     * Claim({
     *   to,
     *   deadline,
     *   campaignId,
     *   nonce
     * })
     *
     * domain:
     * EIP712(name, "1", chainId, address(this))
     */
    function claim(
        address to,
        uint256 deadline,
        uint256 nonce,
        bytes calldata signature
    ) external whenNotPaused nonReentrant returns (uint256 tokenId) {
        if (to == address(0)) revert InvalidAddress();

        // 今回は本人 claim を前提
        if (msg.sender != to) revert CallerMustBeRecipient();

        if (signer == address(0)) revert InvalidSigner();
        if (minted[to]) revert AlreadyClaimed();
        if (block.timestamp > deadline) revert SignatureExpired();

        if (maxSupply != 0 && nextTokenId > maxSupply) {
            revert MaxSupplyReached();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                to,
                deadline,
                campaignId,
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);

        if (usedDigests[digest]) revert DigestAlreadyUsed();

        address recoveredSigner = ECDSA.recover(digest, signature);
        if (recoveredSigner != signer) revert InvalidSignature();

        // Effects first
        usedDigests[digest] = true;
        minted[to] = true;

        tokenId = nextTokenId;
        nextTokenId++;

        _safeMint(to, tokenId);

        emit Claimed(to, tokenId, digest, nonce, campaignId);
    }

    // =============================================================
    //                      Admin / Owner Ops
    // =============================================================

    /**
     * @notice signer を更新
     * @dev backend signer ローテーション用
     */
    function setSigner(address newSigner) external onlyOwner {
        if (newSigner == address(0)) revert InvalidSigner();

        address oldSigner = signer;
        signer = newSigner;

        emit SignerUpdated(oldSigner, newSigner);
    }

    /**
     * @notice admin を追加/削除
     * @dev pause, baseURI 更新などを owner 以外にも任せたい時に使う
     */
    function setAdmin(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();

        admins[account] = allowed;
        emit AdminUpdated(account, allowed);
    }

    /**
     * @notice claim 停止
     */
    function pause() external onlyOwnerOrAdmin {
        _pause();
    }

    /**
     * @notice claim 再開
     */
    function unpause() external onlyOwnerOrAdmin {
        _unpause();
    }

    /**
     * @notice baseURI 更新
     * @dev metadata 運用用
     */
    function setBaseURI(string calldata newBaseURI) external onlyOwnerOrAdmin {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }

    /**
     * @notice maxSupply 更新
     * @dev 0 は無制限。既存 mint 数より小さくはできない
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        uint256 mintedCount = totalMinted();

        if (newMaxSupply != 0 && newMaxSupply < mintedCount) {
            revert InvalidMaxSupply();
        }

        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }

    // =============================================================
    //                        View Helpers
    // =============================================================

    function hasClaimed(address user) external view returns (bool) {
        return minted[user];
    }

    function totalMinted() public view returns (uint256) {
        return nextTokenId - 1;
    }

    function isAdmin(address account) external view returns (bool) {
        return admins[account];
    }

    /**
     * @notice backend / frontend が署名検証用 digest を確認したい時に使える
     */
    function getClaimDigest(
        address to,
        uint256 deadline,
        uint256 nonce
    ) external view returns (bytes32) {
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

    // =============================================================
    //                        Metadata
    // =============================================================

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @dev 例:
     * https://example.com/metadata/1.json
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);

        string memory base = _baseURI();
        if (bytes(base).length == 0) {
            return "";
        }

        return string.concat(base, tokenId.toString(), ".json");
    }
}
