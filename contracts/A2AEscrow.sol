// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract A2AEscrow {
    enum EscrowState { AWAITING_DELIVERY, COMPLETE, REFUNDED }

    struct Escrow {
        string  listingId;   // DB listing UUID
        string  ipfsHash;    // Pinata CID — permanent seller-wallet-to-item link
        address payable seller;
        address payable buyer;
        uint256 amount;
        EscrowState state;
    }

    mapping(string => Escrow) public escrows;

    event EscrowCreated(
        string  indexed listingId,
        string          ipfsHash,
        address indexed buyer,
        address indexed seller,
        uint256         amount
    );
    event EscrowReleased(string indexed listingId, address indexed seller, uint256 amount);
    event EscrowRefunded(string indexed listingId, address indexed buyer,  uint256 amount);

    // ── Buyer locks ETH against a specific IPFS-pinned listing ──────────────────
    function createEscrow(
        string  memory _listingId,
        string  memory _ipfsHash,
        address payable _seller
    ) external payable {
        require(msg.value > 0,                                    "Must send ETH");
        require(_seller != address(0),                            "Invalid seller");
        require(_seller != msg.sender,                            "Seller cannot be buyer");
        require(escrows[_listingId].buyer == address(0),          "Escrow already exists for this listing");

        escrows[_listingId] = Escrow({
            listingId: _listingId,
            ipfsHash:  _ipfsHash,
            seller:    _seller,
            buyer:     payable(msg.sender),
            amount:    msg.value,
            state:     EscrowState.AWAITING_DELIVERY
        });

        emit EscrowCreated(_listingId, _ipfsHash, msg.sender, _seller, msg.value);
    }

    // ── Buyer confirms delivery → funds released to the REAL seller ──────────────
    function releaseFunds(string memory _listingId) external {
        Escrow storage e = escrows[_listingId];
        require(e.state == EscrowState.AWAITING_DELIVERY, "Not awaiting delivery");
        require(msg.sender == e.buyer,                     "Only buyer can release");

        e.state = EscrowState.COMPLETE;

        (bool ok, ) = e.seller.call{value: e.amount}("");
        require(ok, "Transfer to seller failed");

        emit EscrowReleased(_listingId, e.seller, e.amount);
    }

    // ── Buyer requests refund (seller/buyer can both trigger) ────────────────────
    function refund(string memory _listingId) external {
        Escrow storage e = escrows[_listingId];
        require(e.state == EscrowState.AWAITING_DELIVERY,              "Not refundable");
        require(msg.sender == e.seller || msg.sender == e.buyer,       "Unauthorized");

        e.state = EscrowState.REFUNDED;

        (bool ok, ) = e.buyer.call{value: e.amount}("");
        require(ok, "Refund failed");

        emit EscrowRefunded(_listingId, e.buyer, e.amount);
    }

    // ── View helper ──────────────────────────────────────────────────────────────
    function getEscrow(string memory _listingId) external view returns (Escrow memory) {
        return escrows[_listingId];
    }

    receive() external payable {
        revert("Use createEscrow()");
    }
}
