import {
  AbstractCheqdSDKModule,
  CheqdNetwork,
  CheqdSDK,
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
  IKeyPair,
  DIDDocument,
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

  // define fee payer
  const feePayer = (await options.wallet.getAccounts())[0].address;

  // create keypair
  const keyPair_a = createKeyPairBase64();
  const keyPair_b = createKeyPairBase64();

  const did_document_a = await createDid(keyPair_a, feePayer, cheqdSDK);
  const did_document_b = await createDid(keyPair_b, feePayer, cheqdSDK);

  // update controller of did_document_b with did_document_a
  did_document_b.controller = [did_document_a.id]
  
  await updateDid(did_document_b, keyPair_a, keyPair_b, feePayer, cheqdSDK);
};

const createDid = async (keyPair: IKeyPair, feePayer: string, cheqdSDK: CheqdSDK) => {
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

  // define fee amount
  const fee = await DIDModule.generateCreateDidDocFees(feePayer);

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

  console.warn('did document:', JSON.stringify(didDocument, null, 2));

  console.warn('did tx:', JSON.stringify(createDidDocResponse, null, 2));

  return didDocument
}

const updateDid = async (did_document_b: DIDDocument, keyPair_a: IKeyPair, keyPair_b: IKeyPair, feePayer: string, cheqdSDK: CheqdSDK) => {
    // create sign inputs
    const signInputs = [
        {
            verificationMethodId: did_document_b.verificationMethod![0].id as string, // controller b
            privateKeyHex: toString(fromString(keyPair_b.privateKey, "base64"), "hex"), // signature b
        },
        {
            verificationMethodId: `${did_document_b.controller![0]}#key-1` as string, // controller a
            privateKeyHex: toString(fromString(keyPair_a.privateKey, "base64"), "hex"), // signature a
        },
    ] satisfies ISignInputs[];

    // define fee amount
    const fee = await DIDModule.generateCreateDidDocFees(feePayer);
  
    // update did
    const updateDidDocResponse = await cheqdSDK.updateDidDocTx(
      signInputs,
      did_document_b,
      feePayer,
      fee,
      undefined,
      undefined,
      { sdk: cheqdSDK }
    )

    console.warn('did document:', JSON.stringify(did_document_b, null, 2));

    console.warn('did tx:', JSON.stringify(updateDidDocResponse, null, 2));
  
    return did_document_b
}

run().catch(console.error);