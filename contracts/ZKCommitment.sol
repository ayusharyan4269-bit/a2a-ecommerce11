// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ZKCommitment {
    // Mapping of hash to status: 0 = not found, 1 = committed, 2 = verified
    mapping(bytes32 => uint8) public commitments;

    event Committed(address indexed seller, bytes32 indexed commitmentHash);
    event Verified(address indexed seller, bytes32 indexed commitmentHash);

    function commit(bytes32 hash) external {
        require(commitments[hash] == 0, "Already committed");
        commitments[hash] = 1;
        emit Committed(msg.sender, hash);
    }

    function revealAndVerify(bytes32 hash, bytes calldata preimage) external {
        require(commitments[hash] >= 1, "Not committed");
        require(sha256(preimage) == hash, "Preimage hash mismatch");
        commitments[hash] = 2;
        emit Verified(msg.sender, hash);
    }

    function getStatus(bytes32 hash) external view returns (uint8) {
        return commitments[hash];
    }
}
