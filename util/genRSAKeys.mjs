import { mnemonicToSeed, wordlists } from "bip39";
import { writeFile } from "fs/promises";
import SHA256 from 'crypto-js/sha256.js';
import pkg from 'node-forge';
const { pki, random } = pkg;

// Get the english bip39 wordlist!
const english = wordlists.english;
const MAGIC = "0a0bf5e9e7b3151db6a85451d471de72c8ea577b91d316d4ff33d37535c223b2";
const words = 12;

export async function generateRSA(email, product, account) {
    const shaSum = SHA256(`${email}:${product}:${account}:${MAGIC}`).toString();

    // These are the inputs to determistic key pairs
    //const email = "iljazi@gmail.com_agent"

    //console.log("Sha256 Sum is: " + shaSum);
    //console.log("");

    // Test repeating patterns in sha value
    //shaSum = "0a0bf0a0bf3151d0a0bf451d471de72c8ea577b91d316d4ff33d37535c223b2"

    // Split the sha256 sum into 12 strings of length 5, last string length is 9
    const arr = shaSum.match(/.{5}/g);
    arr[arr.length-1] = arr[arr.length-1].concat(shaSum.substr(-4));

    // Convert hex string values to integers then into indexes for wordlist (% 2048)
    for(let itr = 0; itr<words; itr++) {
        const temp = arr[itr];
        arr[itr] = Number("0x" + temp) % english.length;
    }

    // Lastly check to ensure that no two indexes are the same
    // If two or more are the same they are incremented by 1 for
    const uniqueElements = new Set();
    arr.forEach(item => {
        while(uniqueElements.has(item)) {
            item++;
            // Rotate item past last index if applicable
            if(item == english.length)
                item = 0;
        } 
        uniqueElements.add(item);
    });

    const indexArray = Array.from(uniqueElements);
    //console.log(indexArray);

    // Build the mnemonic phrase from indexArray
    let mnemonic = '';
    for(let itr = 0; itr < words; itr++) {
        mnemonic+=english[indexArray[itr]] + " ";
    }

    //const mnemonic = generateMnemonic() // 256 to be on the _really safe_ side. Default is 128 bit.
    // Generate a 128 bit seed phrase from the 12 word mnemonic 
    let seed = (await mnemonicToSeed(mnemonic)).toString('hex')
    //console.log("Seed in hex is: " + seed);
    //console.log("Seed as wordlist: " + mnemonic);

    // Create a pseudo-random-number-generator initiated by seed
    const prng = random.createInstance();
    prng.seedFileSync = () => seed;

    // Generate the Deterministic public private key pairs!
    const { privateKey, publicKey } = pki.rsa.generateKeyPair({ bits: 2048, prng, workers: 2 });

    // Write the keys to disk in the home directory
    await writeFile('./private.pem', pki.privateKeyToPem(privateKey), (error) => {
        if (error) {
            console.log("Error writing private key to filesystem: " + error); 
            return false;
        }
    });
    await writeFile('./public.pem', pki.publicKeyToRSAPublicKeyPem(publicKey), (error) => {
        if (error) {
            console.log("Error writing public key to filesystem: " + error); 
            return false;
        }
    });

    return true;
}

//console.log( pki.publicKeyToRSAPublicKeyPem(publicKey));
//console.log( pki.privateKeyToPem(privateKey));