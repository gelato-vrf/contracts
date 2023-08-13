import hre from "hardhat";
import { assert, expect, should } from "chai";
import { Web3FunctionHardhat } from "@gelatonetwork/web3-functions-sdk/hardhat-plugin";
import { ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { VRFCoordinatorV2Adapter, MockVRFConsumer } from "../typechain";
import { Web3FunctionUserArgs } from "@gelatonetwork/automate-sdk";
import { Web3FunctionResultV2 } from "@gelatonetwork/web3-functions-sdk/*";
const { deployments, w3f, ethers } = hre;
import {
  ChainOptions,
  fetchBeacon,
  HttpCachingChain,
  HttpChainClient,
  roundAt,
} from "drand-client";
import { fastnet } from "../src/drand_info";

const DRAND_OPTIONS: ChainOptions = {
  disableBeaconVerification: false,
  noCache: false,
  chainVerificationParams: {
    chainHash: fastnet.hash,
    publicKey: fastnet.public_key,
  },
};

describe("Chainlink Adapter Test Suite", function () {
  // Signers
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;

  // Web 3 Functions
  let vrf: Web3FunctionHardhat;
  let userArgs: Web3FunctionUserArgs;

  // Factories
  let adapterFactory: ContractFactory;
  let mockConsumerFactory: ContractFactory;

  // Contracts
  let adapter: VRFCoordinatorV2Adapter;
  let mockConsumer: MockVRFConsumer;

  // Drand testing client
  let chain: HttpCachingChain;
  let client: HttpChainClient;

  before(async function () {
    await deployments.fixture();
    [deployer, user] = await ethers.getSigners();

    // Web 3 Functions
    vrf = w3f.get("vrf");

    // Solidity contracts
    adapterFactory = await ethers.getContractFactory("VRFCoordinatorV2Adapter");
    mockConsumerFactory = await ethers.getContractFactory(
      "contracts/chainlink_compatible/MockVRFConsumer.sol:MockVRFConsumer"
    );

    // Drand testing client
    chain = new HttpCachingChain(
      `https://api.drand.sh/${fastnet.hash}`,
      DRAND_OPTIONS
    );
    client = new HttpChainClient(chain, DRAND_OPTIONS);
  });

  this.beforeEach(async () => {
    const operator = deployer.address;
    adapter = (await adapterFactory
      .connect(deployer)
      .deploy(operator)) as VRFCoordinatorV2Adapter;
    mockConsumer = (await mockConsumerFactory
      .connect(deployer)
      .deploy(adapter.address)) as MockVRFConsumer;
    userArgs = { inbox: adapter.address, allowedSenders: [] };
  });

  it("Stores the latest round in the mock consumer", async () => {
    const numWords = 3;
    const numberOfConfirmations = 3;

    (userArgs.allowedSenders as string[]).push(mockConsumer.address);

    await mockConsumer.connect(user).requestRandomWords(numWords, numberOfConfirmations);
    const requestId = await mockConsumer.requestId();

    const exec = await vrf.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;
    const round = roundAt(Date.now(), fastnet);

    if (!res.canExec) assert.fail(res.message);

    expect(res.callData).to.have.lengthOf(1);
    const calldata = res.callData[0];
    await deployer.sendTransaction({ to: calldata.to, data: calldata.data });

    const { randomness } = await fetchBeacon(client, round);

    const abi = ethers.utils.defaultAbiCoder;
    const seed = ethers.utils.keccak256(
      abi.encode(["uint256", "uint32"], [`0x${randomness}`, requestId])
    );
    for (let i = 0; i < numWords; i++) {
      const expected = ethers.utils.keccak256(
        abi.encode(["bytes32", "uint32"], [seed, i])
      );
      const actual = await mockConsumer.randomWordsOf(requestId, i);
      expect(actual).to.equal(expected);
    }
  });

  it("Works when consumer and and (allowed) sender are not the same", async () => {
    const anotherConsumer = (await mockConsumerFactory
      .connect(deployer)
      .deploy(adapter.address)) as MockVRFConsumer;

    const numWords = 3;

    (userArgs.allowedSenders as string[]).push(mockConsumer.address);

    await mockConsumer
      .connect(user)
      .requestRandomWordsForConsumer(numWords, anotherConsumer.address);
    const requestId = await mockConsumer.requestId();

    const exec = await vrf.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;
    const round = roundAt(Date.now(), fastnet);

    if (!res.canExec) assert.fail(res.message);

    expect(res.callData).to.have.lengthOf(1);
    const calldata = res.callData[0];
    await deployer.sendTransaction({ to: calldata.to, data: calldata.data });

    const { randomness } = await fetchBeacon(client, round);

    const abi = ethers.utils.defaultAbiCoder;
    const seed = ethers.utils.keccak256(
      abi.encode(["uint256", "uint32"], [`0x${randomness}`, requestId])
    );
    for (let i = 0; i < numWords; i++) {
      const expected = ethers.utils.keccak256(
        abi.encode(["bytes32", "uint32"], [seed, i])
      );
      const actual = await anotherConsumer.randomWordsOf(requestId, i);
      // mockConsumer received the request
      expect(await mockConsumer.requestId()).to.eq(1);
      // anotherConsumer didn't receive any request
      expect(await anotherConsumer.requestId()).to.eq(0);
      // anotherConsumer got his randomness fullfilled
      expect(actual).to.equal(expected);
    }
  });

  it("Reverts when fullfiller is not dedicated msg.sender", async function() {
    const numWords = 3;
    const numberOfConfirmations = 3;

    (userArgs.allowedSenders as string[]).push(mockConsumer.address);

    await mockConsumer.connect(user).requestRandomWords(numWords, numberOfConfirmations);
    const requestId = await mockConsumer.requestId();

    const exec = await vrf.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;
    const round = roundAt(Date.now(), fastnet);

    if (!res.canExec) assert.fail(res.message);

    expect(res.callData).to.have.lengthOf(1);
    const calldata = res.callData[0];
    const tx = await user.sendTransaction({ to: calldata.to, data: calldata.data })
    const receipt = await tx.wait()
    expect(receipt).throw()
  

    const { randomness } = await fetchBeacon(client, round);

    const abi = ethers.utils.defaultAbiCoder;
    const seed = ethers.utils.keccak256(
      abi.encode(["uint256", "uint32"], [`0x${randomness}`, requestId])
    );
    for (let i = 0; i < numWords; i++) {
      const expected = ethers.utils.keccak256(
        abi.encode(["bytes32", "uint32"], [seed, i])
      );
      const actual = await mockConsumer.randomWordsOf(requestId, i);
      expect(actual).to.equal(expected);
    }  
  })

  it ("Reverts when 0 confirmations are requested", async function () {
    const numWords = 3;
    const invalidNumberOfConfirmations = 0;

    (userArgs.allowedSenders as string[]).push(mockConsumer.address);

    await expect(mockConsumer.connect(user).requestRandomWords(numWords, invalidNumberOfConfirmations)).reverted
  })

  it("Doesn't execute if no event was emitted", async () => {
    const exec = await vrf.run({ userArgs });
    const res = exec.result as Web3FunctionResultV2;

    if (!res.canExec) assert.fail(res.message);
    expect(res.callData).to.have.lengthOf(0);
  });
});
