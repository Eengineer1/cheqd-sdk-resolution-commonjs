import {
  AbstractCheqdSDKModule,
  CheqdNetwork,
  createCheqdSDK,
  createDidPayload,
  createDidVerificationMethod,
  createKeyPairBase64,
  createVerificationKeys,
  DIDModule,
  FeemarketModule,
  ICheqdSDKOptions,
  ISignInputs,
  MethodSpecificIdAlgo,
  VerificationMethods,
} from "@cheqd/sdk";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { fromString, toString } from "uint8arrays";

const run = async () => {
  // define options
  const options = {
    modules: [FeemarketModule as unknown as AbstractCheqdSDKModule, DIDModule as unknown as AbstractCheqdSDKModule],
    rpcUrl: "https://rpc.cheqd.network:443",
    network: CheqdNetwork.Testnet,
    wallet: await DirectSecp256k1HdWallet.fromMnemonic(
      "sketch mountain erode window enact net enrich smoke claim kangaroo another visual write meat latin bacon pulp similar forum guilt father state erase bright",
    { prefix: "cheqd" }),
  } satisfies ICheqdSDKOptions;

  // create cheqd sdk
  const cheqdSDK = await createCheqdSDK(options);

  // create keypair
  const keyPair = createKeyPairBase64();

  // create verification keys
  const verificationKeys = createVerificationKeys(
    keyPair.publicKey,
    MethodSpecificIdAlgo.Uuid,
    "key-1"
  );

  // create verification methods
  const verificationMethods = createDidVerificationMethod(
    [VerificationMethods.Ed255192020],
    [verificationKeys]
  );

  // create did document
  const didDocument = createDidPayload(verificationMethods, [verificationKeys]);

  // create sign inputs
  const signInputs = [
    {
      verificationMethodId: didDocument.verificationMethod![0].id as string,
      privateKeyHex: toString(fromString(keyPair.privateKey, "base64"), "hex"),
    },
  ] satisfies ISignInputs[];

  // define fee payer
  const feePayer = (await options.wallet.getAccounts())[0].address;

  // define fee amount
  const fee = await DIDModule.generateCreateDidDocFees(feePayer);

  console.warn('cheqdSDK:', cheqdSDK);

  // create did
  const createDidDocResponse = await cheqdSDK.createDidDocTx(
    signInputs,
    didDocument,
    feePayer,
    fee,
    undefined,
    undefined,
    { sdk: cheqdSDK }
  )

  // add bigint to string serialiser replacer
  function bigIntToString(key: string, value: any) {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  }

  console.warn('did document:', JSON.stringify(didDocument, bigIntToString, 2));

  console.warn('did tx:', JSON.stringify(createDidDocResponse, bigIntToString, 2));

  // query did
  const queryDidDocResponse = await cheqdSDK.queryDidDoc(didDocument.id);

  console.warn('query did tx:', JSON.stringify(queryDidDocResponse, bigIntToString, 2));
};

run().catch(console.error);