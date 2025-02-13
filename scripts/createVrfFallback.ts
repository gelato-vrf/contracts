import { AutomateSDK, TriggerType } from "@gelatonetwork/automate-sdk";
import { ethers, w3f } from "hardhat";

const main = async () => {
  let consumerAddress: string | undefined; // Define consumer address here
  let fromBlock: number | undefined; // Define from block here

  if (!consumerAddress || !fromBlock) {
    throw new Error("Consumer address or from block is not set");
  }

  const vrfFallbackW3f = w3f.get("vrf-fallback");

  const [signer] = await ethers.getSigners();
  console.log(`Signer: ${signer.address}`);

  const chainId = (await ethers.provider.getNetwork()).chainId;

  const automate = new AutomateSDK(chainId, signer);

  const vrfFallbackW3fCID = await vrfFallbackW3f.deploy();
  console.log(`✅ VRF Fallback W3F CID: ${vrfFallbackW3fCID}`);

  console.log("Creating automate task...");
  const { taskId, tx } = await automate.createBatchExecTask({
    name: "vrf-fallback",
    web3FunctionHash: vrfFallbackW3fCID,
    trigger: { type: TriggerType.TIME, interval: 30 * 60 * 1000 }, // 30 minutes
    web3FunctionArgs: {
      consumerAddress,
      fromBlock,
    },
  });

  await tx.wait();
  console.log(`✅ Task created with taskId: ${taskId} (tx hash: ${tx.hash})`);
};

main();
