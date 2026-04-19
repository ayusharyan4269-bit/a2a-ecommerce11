// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    struct Transaction {
        address buyer;
        address seller;
        uint256 amount;
        bool isCompleted;
    }

    mapping(bytes32 => Transaction) public transactions;

    event Deposited(bytes32 indexed txId, address indexed buyer, address indexed seller, uint256 amount);
    event Released(bytes32 indexed txId, address indexed seller, uint256 amount);

    function deposit(bytes32 txId, address seller) external payable {
        require(transactions[txId].amount == 0, "Transaction already exists");
        require(msg.value > 0, "Must send ETH");

        transactions[txId] = Transaction({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            isCompleted: false
        });

        emit Deposited(txId, msg.sender, seller, msg.value);
    }

    function release(bytes32 txId) external {
        Transaction storage txn = transactions[txId];
        require(!txn.isCompleted, "Already completed");
        require(msg.sender == txn.buyer, "Only buyer can release");

        txn.isCompleted = true;
        payable(txn.seller).transfer(txn.amount);

        emit Released(txId, txn.seller, txn.amount);
    }
}
