// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ContributorRegistry {

    struct Project {
        address owner;
        string repoName;
        uint256 monthlyBudget;
        bool active;
    }

    struct ContributorStats {
        uint256 totalEarned;
        uint256 totalPayouts;
        uint256 reputationScore;
        uint256 lastPaidAt;
    }

    mapping(bytes32 => Project) public projects;
    mapping(address => ContributorStats) public contributors;
    mapping(address => string) public githubHandles;
    mapping(string => address) public walletByHandle;

    event ProjectRegistered(bytes32 indexed projectId, address indexed owner, string repoName);
    event PayoutLogged(address indexed contributor, uint256 amount, uint256 score, bytes32 txHash);
    event ContributorRegistered(address indexed wallet, string githubHandle);

    address public agentAddress;

    modifier onlyAgent() {
        require(msg.sender == agentAddress, "Only Pact agent");
        _;
    }

    constructor(address _agentAddress) {
        agentAddress = _agentAddress;
    }

    function registerProject(
        string calldata repoName,
        uint256 monthlyBudget
    ) external returns (bytes32) {
        bytes32 projectId = keccak256(abi.encodePacked(repoName, msg.sender));
        projects[projectId] = Project({
            owner: msg.sender,
            repoName: repoName,
            monthlyBudget: monthlyBudget,
            active: true
        });
        emit ProjectRegistered(projectId, msg.sender, repoName);
        return projectId;
    }

    function registerContributor(string calldata githubHandle) external {
        githubHandles[msg.sender] = githubHandle;
        walletByHandle[githubHandle] = msg.sender;
        emit ContributorRegistered(msg.sender, githubHandle);
    }

    function logPayout(
        address contributor,
        uint256 amountUsdc,
        uint256 aiScore,
        bytes32 txHash
    ) external onlyAgent {
        ContributorStats storage stats = contributors[contributor];
        stats.totalEarned += amountUsdc;
        stats.totalPayouts += 1;
        stats.reputationScore += aiScore;
        stats.lastPaidAt = block.timestamp;
        emit PayoutLogged(contributor, amountUsdc, aiScore, txHash);
    }

    function getReputation(address contributor) external view returns (
        uint256 totalEarned,
        uint256 totalPayouts,
        uint256 reputationScore,
        uint256 lastPaidAt
    ) {
        ContributorStats memory stats = contributors[contributor];
        return (stats.totalEarned, stats.totalPayouts, stats.reputationScore, stats.lastPaidAt);
    }

    function getWalletForHandle(string calldata handle) external view returns (address) {
        return walletByHandle[handle];
    }
}
