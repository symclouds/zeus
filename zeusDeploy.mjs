import { readFile, writeFile } from "fs/promises";
import { execSync } from "node:child_process";
//import { v4 as uuidv4 } from 'uuid';
import qrcode from "qrcode-terminal";

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

//////////////////////////////////
//                              //
//    Checking Configuration    //
//                              //
//////////////////////////////////
if(!isRegionEnabled(defaultRegion, enabledRegions))
    cmd("--", "Region " + defaultRegion + " is not enabled on your aws account, please enable it on the console.")

//////////////////////////////////
//                              //
//     Generate CDK Context     //
//                              //
//////////////////////////////////
// Generate CDK Context Object
const context = {
    logRetentionPeriod: logRetentionPeriod,
    mfaEmail: mfaEmail
};

// Write CDK Context Object to filesystem
await writeFile('./' + cdkContextFilename, JSON.stringify(context, null, 2), (error) => {
    if (error) {
        cmd("--", "An error occured saving the CDK Context: " + error); 
    }
});

// Generate the bootstrap command
var bootstrapCMD = "cdk bootstrap " + "aws://" + account + "/" + defaultRegion + " ";
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
cmd(bootstrapCMD, "Something went wrong bootstrapping the environment, see: deploy.log");
cmd(deployCMD, "Something went wrong while deploying the zeus AuthN AuthZ system stacks, see: deploy.log");

//////////////////////////////////
//                              //
//  Outputs and Verification    //
//                              //
//////////////////////////////////
// Get Endpoint/s from Log File
cmdOutput = cmd("grep ZeusApiKey " + deployLogFile + " | awk  '{print $(NF)}'");
const zeusApiKey = cmdOutput.split("\n").filter(Boolean);

// Get the IAM Access Key ID 
cmdOutput = cmd("grep ZeusEndpoint  " + deployLogFile + " | awk  '{print $(NF)}'");
const zeusEndpoint = cmdOutput.replace(/\n|\r/g, "");

// Generate a storage id for the system, this will be something like 
// a unique signature of this deployment. 
const result = {
    email: "id@zeus.com",
    url: zeusEndpoint,
    zeusApiKey: zeusApiKey,
    zeusRegion: defaultRegion
}

// Base64 encode the returned information
let stringResult = new Buffer.from(JSON.stringify(result));
let base64data = stringResult.toString('base64');

console.log("cerberus integration QR Code:")
qrcode.generate(base64data, {small: true});

// Generate QR for integration with backend
  
console.log("[] zeus Endpoint:")
console.log("    [] " + zeusEndpoint);
console.log("\n" + "[] zeus Api Key:")
console.log("    [] keyId: " + zeusApiKey);
console.log("    [] Region: " + defaultRegion);
console.log("")