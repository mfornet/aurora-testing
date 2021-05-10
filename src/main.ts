#!/usr/bin/env node

/*
Plan:
1. Deploy a token to the evm and interact with it.

- [x] (Rust Test) Can deploy ERC20 tokens from the EVM
- [X] (Rust Test) ft_on_transfer from ERC20
- [X] (Rust Test) Register relayer (and check fee from ft_on_transfer)
- [?] (Rust Test) Can mint some tokens from admin access function
- [?] (Rust Test) Can transfer tokens between accounts

- [ ] (Rust Test) withdraw to near
- [ ] (Rust Test) withdraw to ethereum

- [ ] (Integration Test) Send tokens from Near -> EVM
- [ ] (Integration Test) Send tokens from EVM -> Near
- [ ] (Integration Test) Send tokens from Ethereum -> EVM
- [ ] (Integration Test) Send tokens from EVM -> Ethereum

- [ ] (Rust) Admin only functions works as expected

- Check admin function from evm-erc20-tokens works as expected
- Check deploy-erc20-token function
- Check ft_on_transfer function

Workflows

- NEAR -> EVM
    - Think and test few things that can go wrong
- EVM -> NEAR
    - Think and test few things that can go wrong
*/

import NEAR, { Near } from 'near-api-js';
import { readFileSync } from 'fs';
import { Address, ConnectEnv, Engine } from '@aurora-is-near/engine';
import * as ethers from 'ethers';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface ProcessEnv extends ConnectEnv {}
  }
}

async function loadEngine(): Promise<Engine> {
  return await Engine.connect(
    {
      network: 'local',
      endpoint: 'http://127.0.0.1:3030/',
      contract: 'evm.node0',
      signer: 'evm.node0',
    },
    process.env
  );
}

function loadErc20TokenContractFactory(): ethers.ContractFactory {
  const description = JSON.parse(
    readFileSync(
      'node_modules/evm-erc20-token/artifacts/contracts/EvmErc20.sol/EvmErc20.json'
    ).toString()
  );

  return new ethers.ContractFactory(description.abi, description.bytecode);
}

function loadEvmBytecode(): Buffer {
  return readFileSync(
    '/Users/marcelo/Documents/near/aurora-engine/release.wasm'
  );
}

async function initEvm(initialize = true) {
  const bytecode = loadEvmBytecode();
  const engine = await loadEngine();

  const resInstall = await engine.install(bytecode);

  if (initialize) {
    const resInit = await engine.initialize({});
  }
}

async function deployErc20() {
  const contract = loadErc20TokenContractFactory();

  const data =
    contract
      .getDeployTransaction('TestToken', 'TT', 18, Address.zero().toString())
      .data?.toString() || '';

  const engine = await loadEngine();

  return (await engine.deployCode(data)).unwrap();
}

function Erc20Address() {
  return '0x8E353699E7B51bD8168BA4a8047d23a3a5A67648';
}

class SubmitResult {
  status: boolean;
  gas_used: string;
  result: Buffer;

  constructor(status: boolean, gas_used: string, result: Buffer) {
    this.status = status;
    this.gas_used = gas_used;
    this.result = result;
  }
}

function parseResult(data: Buffer): SubmitResult {
  const status = data.readInt8();
  const gas_used = data.readBigInt64LE(1);
  const size = data.readInt32LE(9);
  const result = data.subarray(9 + 4, 9 + 4 + size);
  return new SubmitResult(status !== 0, gas_used.toString(), result);
}

async function makeTransaction(
  buildTx: (
    contract: ethers.Contract
  ) => Promise<ethers.ethers.PopulatedTransaction>,
  onFinish: (result: SubmitResult) => Promise<void>,
  target: Address | undefined = undefined
) {
  if (target === undefined) {
    target = Address.parse(Erc20Address()).unwrap();
  }

  const engine = await loadEngine();
  const factory = loadErc20TokenContractFactory();
  const contract = new ethers.Contract(target.toString(), factory.interface);

  const rawTransaction = await buildTx(contract);
  console.log('raw', rawTransaction);

  const result = (
    await engine.call(
      Address.parse(rawTransaction.to).unwrap(),
      rawTransaction.data || ''
    )
  ).unwrap();

  const value = parseResult(result as Buffer);
  await onFinish(value);
}

async function onFinish(result: SubmitResult) {
  console.log('Status:', result.status);
  console.log('Result:', result.result.toString('hex'));
}

async function getDecimals() {
  return await contract.populateTransaction.decimals();
}

function mint(address: Address, amount: number) {
  console.log(address.toString());
  return async (contract: ethers.Contract) =>
    await contract.populateTransaction.mint(
      address.toString(),
      ethers.BigNumber.from(amount)
    );
}

function withdrawToNear(recipient: Address, amount: number) {
  return async (contract: ethers.Contract) =>
    await contract.populateTransaction.withdrawToNear(
      recipient.toString(),
      ethers.BigNumber.from(amount)
    );
}

function test() {
  return async (contract: ethers.Contract) =>
    await contract.populateTransaction.test();
}

function value() {
  return async (contract: ethers.Contract) =>
    await contract.populateTransaction.value();
}

function balanceOf(address: Address) {
  return async (contract: ethers.Contract) =>
    await contract.populateTransaction.balanceOf(address.toString());
}

async function deployTokenEVM() {
  const nep141 = 'token.node0';
  const engine = await loadEngine();
  const result = (await engine.deploy_erc20_token(nep141)).unwrap();
  return Address.parse(result.subarray(4).toString('hex')).unwrap();
}

async function get_near() {
  const networkID = 'local';
  const network = {
    id: 'local',
    label: 'LocalNet',
    chainID: 1313161556,
    contractID: 'aurora.test.near',
    nearEndpoint: 'http://127.0.0.1:3030',
    web3Endpoint: undefined, // TODO
    walletLink: 'http://127.0.0.1:4000',
    explorerLink: 'http://127.0.0.1:3019',
  };

  const contractID = 'evm.node0';
  const signerID = 'evm.node0';

  const keyStore = new NEAR.keyStores.UnencryptedFileSystemKeyStore(
    '/Users/marcelo/.near-credentials'
  );
  const near = new NEAR.Near({
    deps: { keyStore },
    networkId: networkID,
    nodeUrl: network.nearEndpoint,
  });

  return near;
}

async function deploy(account_id: string, bytecode_path: string) {
  const near = await get_near();
  const account = await near.account(account_id);
  await account.deployContract(readFileSync(bytecode_path));
}

async function main() {
  // await deploy('token.node0', 'bridge_token.wasm');
  console.log('Deploying EVM');
  await initEvm();
  console.log('Deploying ERC20 Token');
  const address = await deployTokenEVM();
  console.log(address);
  // const address = Address.parse(
  //   '3a0b970f2ab76c554eaef7e153d89f243d3491ee'
  // ).unwrap();
  await makeTransaction(
    withdrawToNear(
      Address.parse('6161616161616161616161616161616161616162').unwrap(),
      201
    ),
    onFinish,
    address
  );
  // console.log('Deploying new code');
  // await initEvm();
  // console.log('Deployed');
  // const address = await deployErc20();
  // await makeTransaction(value(), onFinish, address);
  // await makeTransaction(test(), onFinish, address);
  // await makeTransaction(value(), onFinish, address);
  //
  // Test minting
  //
  // const address = Address.parse(
  //   '0x6da8dc5D9Ef5C245AC08CE8bf8e79649007502b7'
  // ).unwrap();
  // console.log('ERC20 address:', address);
  // await makeTransaction(balanceOf(address), onFinish, address);
  // await makeTransaction(mint(address, 16 * 16), onFinish, address);
  // await makeTransaction(balanceOf(address), onFinish, address);
  //
  //
  // await getDecimals();
  // console.log('Deploying new code');
  // await initEvm();
  // console.log('Deployed');
  // console.log('Call Deploy token');
  // await deployTokenEVM();
}

main();
