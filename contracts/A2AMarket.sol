// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title A2AMarket
 * @notice Secure credential marketplace.
 *         - Seller uploads AES-encrypted credentials to IPFS and registers the CID on-chain.
 *         - Buyer pays into escrow; seller address is ALWAYS read from contract storage,
 *           never accepted from frontend input.
 *         - Backend agent releases escrow only after buyer confirms receipt of decryption key.
 */
contract A2AMarket {

    // ─── Structs ────────────────────────────────────────────────────────────────

    struct Product {
        address payable seller;   // set to msg.sender at listing time — never editable
        string  cid;              // IPFS CID of AES-encrypted credential blob
        uint256 price;            // in wei
        bool    exists;
    }

    struct EscrowEntry {
        address payable buyer;
        uint256 amount;
        bool    released;
        bool    refunded;
    }

    // ─── State ──────────────────────────────────────────────────────────────────

    // cid => Product
    mapping(string => Product)     public products;

    // cid => buyer => EscrowEntry
    mapping(string => mapping(address => EscrowEntry)) public escrows;

    // ─── Events ─────────────────────────────────────────────────────────────────

    event ProductAdded(string indexed cid, address indexed seller, uint256 price);
    event ProductPurchased(string indexed cid, address indexed buyer, uint256 amount);
    event FundsReleased(string indexed cid, address indexed seller, uint256 amount);
    event FundsRefunded(string indexed cid, address indexed buyer,  uint256 amount);

    // ─── Modifiers ──────────────────────────────────────────────────────────────

    modifier productExists(string memory _cid) {
        require(products[_cid].exists, "Product does not exist");
        _;
    }

    modifier onlySeller(string memory _cid) {
        require(msg.sender == products[_cid].seller, "Only the seller can do this");
        _;
    }

    // ─── Seller: List a product ──────────────────────────────────────────────────

    /**
     * @notice Register an IPFS CID (pointing to AES-encrypted credentials) on-chain.
     * @param _cid   Pinata/IPFS CID of the encrypted JSON blob.
     * @param _price Price in wei the buyer must pay.
     */
    function addProduct(string memory _cid, uint256 _price) external {
        require(bytes(_cid).length > 0,         "CID cannot be empty");
        require(_price > 0,                     "Price must be greater than zero");
        require(!products[_cid].exists,         "CID already registered");

        products[_cid] = Product({
            seller: payable(msg.sender),  // ← seller wallet LOCKED here, never from input
            cid:    _cid,
            price:  _price,
            exists: true
        });

        emit ProductAdded(_cid, msg.sender, _price);
    }

    // ─── Buyer: Purchase a product ───────────────────────────────────────────────

    /**
     * @notice Buyer locks ETH into escrow for a CID.
     *         Seller address is read from contract — buyer CANNOT spoof it.
     * @param _cid The IPFS CID of the product to purchase.
     */
    function buyProduct(string memory _cid) external payable productExists(_cid) {
        Product memory p = products[_cid];

        require(msg.sender != p.seller,                              "Seller cannot buy own product");
        require(msg.value >= p.price,                                "Insufficient payment");
        require(!escrows[_cid][msg.sender].released,                 "Already released");
        require(escrows[_cid][msg.sender].amount == 0,               "Already purchased; awaiting release");

        escrows[_cid][msg.sender] = EscrowEntry({
            buyer:    payable(msg.sender),
            amount:   msg.value,
            released: false,
            refunded: false
        });

        emit ProductPurchased(_cid, msg.sender, msg.value);
    }

    // ─── Release: Seller or backend agent confirms delivery ─────────────────────

    /**
     * @notice Transfers escrowed funds to the registered seller.
     *         Called by the BUYER after they receive and verify the decryption key.
     *         Seller address is pulled from storage — never from caller input.
     * @param _cid        The IPFS CID.
     * @param _buyerAddr  The buyer whose escrow to release.
     */
    function release(string memory _cid, address _buyerAddr) external productExists(_cid) {
        EscrowEntry storage entry = escrows[_cid][_buyerAddr];
        Product     storage p     = products[_cid];

        require(entry.amount > 0,   "No escrow found");
        require(!entry.released,    "Already released");
        require(!entry.refunded,    "Already refunded");

        // Allow either buyer (confirmed receipt) or seller to release
        require(
            msg.sender == entry.buyer || msg.sender == p.seller,
            "Only buyer or seller can release"
        );

        entry.released = true;
        uint256 payout = entry.amount;

        // ← funds go to the STORED seller address from contract — never from input
        (bool ok, ) = p.seller.call{value: payout}("");
        require(ok, "Transfer to seller failed");

        emit FundsReleased(_cid, p.seller, payout);
    }

    // ─── Refund: Revert if delivery never happened ───────────────────────────────

    /**
     * @notice Returns escrowed funds to buyer.
     *         Only the buyer can request a refund on their own escrow.
     */
    function refund(string memory _cid) external productExists(_cid) {
        EscrowEntry storage entry = escrows[_cid][msg.sender];

        require(entry.amount > 0,   "No escrow found");
        require(!entry.released,    "Already released to seller");
        require(!entry.refunded,    "Already refunded");

        entry.refunded = true;
        uint256 amt = entry.amount;

        (bool ok, ) = entry.buyer.call{value: amt}("");
        require(ok, "Refund failed");

        emit FundsRefunded(_cid, msg.sender, amt);
    }

    // ─── Views ───────────────────────────────────────────────────────────────────

    function getProduct(string memory _cid) external view returns (Product memory) {
        return products[_cid];
    }

    function getEscrow(string memory _cid, address _buyer) external view returns (EscrowEntry memory) {
        return escrows[_cid][_buyer];
    }

    receive() external payable {
        revert("Use buyProduct()");
    }
}
