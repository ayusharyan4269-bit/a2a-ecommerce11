// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract A2AEscrow {
    enum EscrowState { AWAITING_PAYMENT, AWAITING_DELIVERY, COMPLETE, REFUNDED }

    struct Escrow {
        string listingId;
        address payable seller;
        address payable buyer;
        uint256 amount;
        EscrowState state;
        bool isAgentVerified;
    }

    // Mapping from listingId to Escrow details
    mapping(string => Escrow) public escrows;

    event EscrowCreated(string indexed listingId, address indexed buyer, address indexed seller, uint256 amount);
    event EscrowReleased(string indexed listingId, address indexed seller, uint256 amount);
    event EscrowRefunded(string indexed listingId, address indexed buyer, uint256 amount);

    /**
     * @dev Buyer deposits ETH to initiate the escrow for a specific listing
     */
    function createEscrow(string memory _listingId, address payable _seller) external payable {
        require(msg.value > 0, "Must deposit ETH to create escrow");
        require(escrows[_listingId].buyer == address(0), "Escrow for this listing already exists");

        escrows[_listingId] = Escrow({
            listingId: _listingId,
            seller: _seller,
            buyer: payable(msg.sender),
            amount: msg.value,
            state: EscrowState.AWAITING_DELIVERY,
            isAgentVerified: false
        });

        emit EscrowCreated(_listingId, msg.sender, _seller, msg.value);
    }

    /**
     * @dev Buyer or system agent releases the funds to the seller after verifying credentials
     */
    function releaseFunds(string memory _listingId) external {
        Escrow storage escrow = escrows[_listingId];
        require(escrow.state == EscrowState.AWAITING_DELIVERY, "Invalid state for release");
        require(msg.sender == escrow.buyer, "Only the buyer can release funds");

        escrow.state = EscrowState.COMPLETE;
        
        // Transfer funds to the seller
        (bool success, ) = escrow.seller.call{value: escrow.amount}("");
        require(success, "Transfer to seller failed");

        emit EscrowReleased(_listingId, escrow.seller, escrow.amount);
    }

    /**
     * @dev Refund logic if the listing credentials are fake or agent rejects it
     */
    function refund(string memory _listingId) external {
        Escrow storage escrow = escrows[_listingId];
        require(escrow.state == EscrowState.AWAITING_DELIVERY, "Invalid state for refund");
        // For simplicity in this iteration, only the seller can refund or we can have an agent doing it. 
        // We'll allow the buyer to request a refund, but typically it requires seller approval.
        // For the demo, we'll allow either party to refund the buyer if something goes wrong.
        require(msg.sender == escrow.seller || msg.sender == escrow.buyer, "Unauthorized refund request");

        escrow.state = EscrowState.REFUNDED;

        // Refund the buyer
        (bool success, ) = escrow.buyer.call{value: escrow.amount}("");
        require(success, "Refund transfer failed");

        emit EscrowRefunded(_listingId, escrow.buyer, escrow.amount);
    }

    /**
     * @dev Fallback to reject accidental direct payments
     */
    receive() external payable {
        revert("Use createEscrow to deposit funds");
    }
}
