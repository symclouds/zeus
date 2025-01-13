import { readFile, writeFile } from "fs/promises";
import { execSync } from "node:child_process";
import { v4 as uuidv4 } from 'uuid';
import qrcode from "qrcode-terminal";
import { InvokeCommand, LambdaClient, LogType } from "@aws-sdk/client-lambda";
import { addFreeTierProduct } from "./util/auth.mjs";
import { generateRSA } from "./util/genRSAKeys.mjs";

//////////////////////////////////
//                              //
//          Zeus Deploy         //
//                              //
//////////////////////////////////
// Functions
function cmd(command, errReason) {
    // Throw Error Case
    if(command == '--') {
        console.error("[Error] zeus deployment exited abnormally due to an error: " + 1);
        console.error("[Cause] " + errReason + "\n");
        process.exit(1);
    }
    else {
        try {
            const output = execSync(command, {encoding: "utf8"});
            return output;
        } 
        catch (err) {
            console.error("[Error] zeus deployment exited abnormally due to an error: " + err.status);
            console.error("[Cause] " + errReason + "\n");
            process.exit(1);
        } 
    }
}

// Determine if a region is enabled
function isRegionEnabled(region, enabledRegions) {
    for(let itr = 0; itr < enabledRegions.length; itr++) {
        if(enabledRegions[itr] == region)
            return true;
    }
    return false;
}

// Determine if a region is already bootstrapped
function isRegionDuplicate(region, siteRegions) {
    for(let itr = 0; itr < siteRegions.length; itr++) {
        if(siteRegions[itr] == region)
            return true;
    }
    return false;
}

function regionExists(defaultRegion, siteRegions) {
    for(let itr = 0; itr < siteRegions.length; itr++) {
        if(defaultRegion === siteRegions[itr].region)
            return true;
    }
    return false;
}

// Remove duplicated regions from array
function removeDuplicates(arr) {
    var finalArr = [];
    for(let itr = 0; itr<arr.length; itr++) {
        const entry = arr[itr];
        var isFound = false;
        for(let its = 0; its < finalArr.length; its++) {
            if(finalArr[its] === entry) {
                isFound = true; 
                break;  
            }
        }
        if(!isFound)
            finalArr.push(entry)
    }  
    return finalArr;
}

// Forward decleration of module: ES6 imports 
export default function deploy () {}

// Configuration Filenames and Lognames
const cdkContextFilename = 'cdk.context.json';
const zeusConfigFilename = 'zeus.json';
const deployLogFile = "deploy.log";

// Re-Initialize Log File for this deployment
cmd("echo > " + deployLogFile, "Problem initializing logfile ... exiting");

// Shell Command Outputs
var cmdOutput;

//////////////////////////////////
//                              //
//  CDK/CLI Environment Checks  //
//                              //
//////////////////////////////////
cmd('which aws', "aws cli is not installed on this host but required, exiting");
cmd('which cdk', "aws cdk is not installed on this host but required, exiting");

// Read in and Parse the Hades deployment configuration file
const zeusConfigFile = await readFile(new URL('./' + zeusConfigFilename, import.meta.url));
const zeusConfigObj = JSON.parse(zeusConfigFile);

// Configuration Parameters of JSON Config
const profile = zeusConfigObj.profile;
const mfaEmail = zeusConfigObj.mfaEmail;
const logRetentionPeriod = zeusConfigObj.logRetentionPeriod;
const accessTokenDuration = zeusConfigObj.accessTokenDuration;
const refreshTokenDuration = zeusConfigObj.refreshTokenDuration;
const maxSessions = zeusConfigObj.maxSessions;
const totalSites = zeusConfigObj.totalSites;
const siteRegions = zeusConfigObj.siteRegions;

// Configuration Parameters for Hades Agent
const product = zeusConfigObj.agent.product;
const email = zeusConfigObj.agent.email;
const tier = zeusConfigObj.agent.tier;
const functions = zeusConfigObj.agent.functions;

// Get the account number and default region of the aws cli profile deploying zeus
// Also get the list of enabled regions on AWS for this account number
cmdOutput = cmd("aws sts get-caller-identity --profile " + profile,
    "Unable to retrie account id for this profile: [" + profile + " ] ... exiting"
);
const account = JSON.parse(cmdOutput).Account;

cmdOutput = cmd("aws configure get region --profile " + profile,
    "Unable to retrie default region for this profile: [" + profile + " ] ... exiting"
);
const defaultRegion = cmdOutput.replace(/\n|\r/g, "")

cmdOutput = cmd("aws ec2 describe-regions --query 'Regions[].{Name:RegionName}' --output text --profile " + profile,
    "Unable to retrie enabled regions for this profile: [" + profile + " ] ... exiting"
);
const enabledRegions = cmdOutput.split("\n").filter(Boolean);

// Generate Deterministic public/private key pairs for this deployment
const keys = await generateRSA(email, product, account);
if(keys) {
    // Include pub/priv keys into necessary archives
    cmd("touch -d '1981-07-27 10:00:00' private.pem public.pem", "Failed to set file access time ... exiting");
    cmd("zip ./assets/login.zip private.pem", "Failed to include private key into login archive ... exiting");
    cmd("zip ./assets/refresh.zip private.pem", "Failed to include private key into refresh archive ... exiting");
    cmd("zip ./assets/zeus.zip public.pem", "Failed to include public key into zeus archive ... exiting");
    cmd("zip ./assets/zeus.zip public.pem", "Failed to include public key into zeus archive ... exiting");
    // Generate Checksums of archive zip files
    cmdOutput = cmd("openssl sha256 ./assets/*", "Failed to generate chksum file for assets ... exiting");
}

// Read in the checksum files from assets
const fileContent = cmdOutput.toString();
const ChksumEntries = fileContent.split("\n").filter(Boolean);
var chksumObject = {}
ChksumEntries.forEach(chksumEntry => {
    const entry = chksumEntry.split(')= ');
    const fileName = entry[0].replace('SHA2-256(', '');
    const sha256 = entry[1];
    chksumObject[fileName] = sha256;
});
//console.log(chksumObject);

//////////////////////////////////
//                              //
//    Checking Configuration    //
//                              //
//////////////////////////////////
// Make sure the default region exists in the site regions
if(!regionExists(defaultRegion, siteRegions)) {
    cmd("--", "The default region: " + defaultRegion + " must be included in the siteRegions configured, please correct it.");
}

// Make sure number of sites matches configuration
if(totalSites != siteRegions.length)
    cmd("--", "Total number of sites set: " + totalSites + " doesn't match the number of entries in siteRegions: " 
    + siteRegions.length + ", plese correct it.");   

// Make sure all site regions user has configured are enabled
siteRegions.forEach(region => {
    let candidateRegion = region.region;
    if(isRegionEnabled(candidateRegion, enabledRegions)) {
        if(isRegionDuplicate(candidateRegion, siteRegions)) {
            cmd("--", "Found duplicate sites for region: " + candidateRegion + ". Only one site per region is permitted.")
        }
    }
    else
        cmd("--", "Region " + candidateRegion + " is not enabled on your aws account, please enable it on the console.")
});

if(!isRegionEnabled(defaultRegion, enabledRegions))
    cmd("--", "Region " + defaultRegion + " is not enabled on your aws account, please enable it on the console.")

// Generate a systemID
let systemID = uuidv4();

//////////////////////////////////
//                              //
//  Create a FreeTier Product   //
//                              //
//////////////////////////////////
// Register/Login the user on Themis (obtain token)
const ret = await addFreeTierProduct(email, product, account, systemID, tier);
if(ret.err) {
    // Exit the execution with error!
    cmd("--", ret.err + " ... Exiting");
}
// If this is an existing deployment make sure to use same systemID (uuid)
if(ret.id) {
    systemID = ret.id;
    cmd("echo Found Existing Install, Reusing system ID: " + systemID + " >> " + deployLogFile);
}

//////////////////////////////////
//                              //
//     Generate CDK Context     //
//                              //
//////////////////////////////////
// Generate CDK Context Object
const context = {
    logRetentionPeriod: logRetentionPeriod,
    mfaEmail: mfaEmail,
    accessTokenDuration : accessTokenDuration,
    refreshTokenDuration : refreshTokenDuration,
    maxSessions : maxSessions,
    account: account,
    defaultRegion: defaultRegion,
    totalSites: totalSites,
    siteRegions: siteRegions,
    systemID: systemID,
    product: product, 
    email: email, 
    tier: tier, 
    functions: functions,
    chksums: chksumObject
};

// Write CDK Context Object to filesystem
await writeFile('./' + cdkContextFilename, JSON.stringify(context, null, 2), (error) => {
    if (error) {
        cmd("--", "An error occured saving the CDK Context: " + error); 
    }
});

// Flatten out the siteRegions List
const siteRegionsFlat = siteRegions.map(region => region.region);
const unionRegions = removeDuplicates(siteRegionsFlat);

// Bootstrap CMD contains every region where we are deploying sites and db's
// Generate the bootstrap command
var bootstrapCMD = "cdk bootstrap ";
unionRegions.forEach(region => { 
    var str = "aws://" + account + "/" + region + " ";
    bootstrapCMD += str;
})
bootstrapCMD += "--profile " + profile + " >> " + deployLogFile + " 2>&1";

// console.log(bootstrapCMD);
cmd("echo Bootstrap Command:  >> " + deployLogFile)
cmd("echo " + bootstrapCMD + " >> " + deployLogFile);

// Generate the deploy command
const deployCMD = "cdk deploy --all --require-approval never --profile " + profile + " >> " + deployLogFile + " 2>&1";
cmd("echo Deploy Command:  >> " + deployLogFile);
cmd("echo " + deployCMD + " >> " + deployLogFile);

//////////////////////////////////
//                              //
//          Deployment          //
//                              //
//////////////////////////////////
//cmd(bootstrapCMD, "Something went wrong bootstrapping the environment, see: deploy.log");
//cmd(deployCMD, "Something went wrong while deploying the zeus AuthN AuthZ system stacks, see: deploy.log");

//////////////////////////////////
//                              //
//         InvokeAgent          //
//                              //
//////////////////////////////////
// For every site invoke the agent Lambda so it can pull the license from Themis
for(let itr = 0; itr < siteRegionsFlat.length; itr++) {
    const region = siteRegionsFlat[itr];
    const lambdaClient = new LambdaClient({region: region});
    const payload = {
        invokeType: "init"
    }
    const command = new InvokeCommand({
        FunctionName: product+"-agent",
        Payload: Buffer.from(JSON.stringify(payload)),
        InvocationType: 'RequestResponse',
        LogType: LogType.Tail,
    });
    const { Payload } = await lambdaClient.send(command);
    const result = JSON.parse(Buffer.from(Payload).toString());
    if(result.statusCode !== 200 )
        console.log("Failed to initialize themis agent on region: " + region);
};

//////////////////////////////////
//                              //
//  Outputs and Verification    //
//                              //
//////////////////////////////////
// Get the Zeus API Endpoints
cmdOutput = cmd("grep ZeusEndpoint  " + deployLogFile + " | awk  '{print $(NF)}'");
const zeusEndpoint = cmdOutput.split("\n").filter(Boolean);

// Get the Zeus API Keys 
cmdOutput = cmd("grep ZeusApiKey " + deployLogFile + " | awk  '{print $(NF)}'");
const zeusApiKey = cmdOutput.split("\n").filter(Boolean);

// Generate a storage id for the system, this will be something like 
// a unique signature of this deployment. 
const result = {
    email: "id@zeus.com",
    url: zeusEndpoint[0],
    zeusApiKey: zeusApiKey[0],
    zeusRegion: defaultRegion,
    systemID: systemID
}

// Base64 encode the returned information
let stringResult = new Buffer.from(JSON.stringify(result));
let base64data = stringResult.toString('base64');

// Print the QR Code to console
console.log("[] Integration QR Code ...")
qrcode.generate(base64data, {small: true});

// Generate QR for integration with backend
// Print the Integration Outputs to console
console.log("[] zeus Integration Output ...\n")
for(let itr = 0; itr < siteRegionsFlat.length; itr++) {
    const siteNr = itr + 1;
    console.log("   [Site " + siteNr + "]: ");
    console.log("       [Endpoint]:   " + zeusEndpoint[itr]);
    console.log("       [ApiKey  ]:   " + zeusApiKey[itr]);
    console.log("");
}