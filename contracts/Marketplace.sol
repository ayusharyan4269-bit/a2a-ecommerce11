// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Marketplace {
    event ServiceListed(
        address indexed seller,
        string serviceType,
        string serviceName,
        uint256 price,
        string description,
        bytes32 zkCommitment
    );

    function listService(
        string memory serviceType,
        string memory serviceName,
        uint256 price,
        string memory description,
        bytes32 zkCommitment
    ) external {
        emit ServiceListed(msg.sender, serviceType, serviceName, price, description, zkCommitment);
    }
}
