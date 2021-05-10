import * as ethers from 'ethers';
import EvmErc20 from '../node_modules/evm-erc20-token/artifacts/contracts/EvmErc20.sol/EvmErc20.json';

function loadContractJson() {
  return EvmErc20;
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(
    'https://ropsten.infura.io/v3/65b31266d0714c67850a9588de7321dc'
  );
  const signer = new ethers.Wallet(
    '0x766f37eba757c0b7cbe8a0a07f2a55c705952ab7d2f8b256e8c3fad979a8b64d',
    provider
  );
  const abi = loadContractJson();

  const contract = new ethers.ContractFactory(abi.abi, abi.bytecode, signer);
  const tx = contract.getDeployTransaction('TestToken', 'TT', 6);
  console.log(tx);

  //   const result = await contract.deploy('TestToken', 'TT', 6);
  //   console.log(result);
}

main()
  .then(() => {
    console.log('Finish');
  })
  .catch((e) => {
    console.error('Fail with', e);
  });
