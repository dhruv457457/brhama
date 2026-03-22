import { expect } from "chai";
import { ethers } from "hardhat";
import { ContributorRegistry } from "../typechain-types";

describe("ContributorRegistry", function () {
  let registry: ContributorRegistry;
  let agent: any;
  let owner: any;
  let contributor: any;

  beforeEach(async function () {
    [agent, owner, contributor] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ContributorRegistry");
    registry = await Factory.deploy(agent.address);
    await registry.waitForDeployment();
  });

  describe("registerProject", function () {
    it("should register a project", async function () {
      const tx = await registry.connect(owner).registerProject("owner/repo", 500_000_000n);
      await tx.wait();

      const projectId = ethers.keccak256(
        ethers.solidityPacked(["string", "address"], ["owner/repo", owner.address])
      );
      const project = await registry.projects(projectId);
      expect(project.owner).to.equal(owner.address);
      expect(project.repoName).to.equal("owner/repo");
      expect(project.monthlyBudget).to.equal(500_000_000n);
      expect(project.active).to.be.true;
    });
  });

  describe("registerContributor", function () {
    it("should register a contributor with github handle", async function () {
      await registry.connect(contributor).registerContributor("alice");

      expect(await registry.githubHandles(contributor.address)).to.equal("alice");
      expect(await registry.walletByHandle("alice")).to.equal(contributor.address);
    });
  });

  describe("logPayout", function () {
    it("should log a payout from agent", async function () {
      const txHash = ethers.encodeBytes32String("0xabc123");
      await registry.connect(agent).logPayout(contributor.address, 100_000_000n, 750n, txHash);

      const rep = await registry.getReputation(contributor.address);
      expect(rep.totalEarned).to.equal(100_000_000n);
      expect(rep.totalPayouts).to.equal(1n);
      expect(rep.reputationScore).to.equal(750n);
    });

    it("should reject payout from non-agent", async function () {
      const txHash = ethers.encodeBytes32String("0xabc123");
      await expect(
        registry.connect(owner).logPayout(contributor.address, 100_000_000n, 750n, txHash)
      ).to.be.revertedWith("Only Pact agent");
    });
  });

  describe("getWalletForHandle", function () {
    it("should return zero address for unregistered handle", async function () {
      expect(await registry.getWalletForHandle("unknown")).to.equal(ethers.ZeroAddress);
    });
  });
});
