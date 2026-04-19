// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentReputation {
    struct Reputation {
        bool isRegistered;
        uint256 totalScore;
        uint256 feedbackCount;
    }

    mapping(address => Reputation) public agents;

    event AgentRegistered(address indexed agent);
    event FeedbackSubmitted(address indexed agent, address indexed reviewer, uint8 score);

    function registerAgent() external {
        require(!agents[msg.sender].isRegistered, "Already registered");
        agents[msg.sender] = Reputation({
            isRegistered: true,
            totalScore: 0,
            feedbackCount: 0
        });
        emit AgentRegistered(msg.sender);
    }

    function submitFeedback(address agent, uint8 score) external {
        require(agents[agent].isRegistered, "Agent not registered");
        require(score <= 100, "Score must be <= 100");

        agents[agent].totalScore += score;
        agents[agent].feedbackCount += 1;

        emit FeedbackSubmitted(agent, msg.sender, score);
    }

    function getReputation(address agent) external view returns (bool isRegistered, uint256 avgScore, uint256 feedbackCount) {
        Reputation memory rep = agents[agent];
        isRegistered = rep.isRegistered;
        feedbackCount = rep.feedbackCount;
        if (feedbackCount == 0) {
            avgScore = 0;
        } else {
            avgScore = rep.totalScore / feedbackCount;
        }
    }
}
