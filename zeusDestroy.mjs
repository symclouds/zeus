import { readFile, writeFile } from "fs/promises";
import { execSync } from "node:child_process";

//////////////////////////////////
//                              //
//     Hades Destroy Sites      //
//                              //
//////////////////////////////////
// Declare destruction script as module
export default function siteDestroy () {}

// Configuration Filenames and Lognames
const cdkContextFilename = 'cdk.context.json';
const zeusConfigFilename = 'zeus.json';
const destroyLogFile = "destroy.log";
cmd("echo > " + destroyLogFile);

// Read in and Parse the Hades destroy configuration file
const zeusConfigFile = await readFile(new URL('./' + zeusConfigFilename, import.meta.url));
const zeusConfigObj = JSON.parse(zeusConfigFile);
var cmdOutput;  // Shell Command Outputs

// Shell commands required to deploy Hades via the CDK
function cmd(command, errReason) {
    // Throw Error Case
    if(command == '--') {
        console.error("[Error] hades destroy exited abnormally due to an error: " + 1);
        console.error("[Cause] " + errReason + "\n");
        process.exit(1);
    }
    else {
        try {
            const output = execSync(command, {encoding: "utf8"});
            return output;
        } 
        catch (err) {
            console.error("[Error] hades destroy exited abnormally due to an error: " + err.status);
            console.error("[Cause] " + errReason + "\n");
            process.exit(1);
        } 
    }
}

// Check System dependencies, there may be others that are required
cmd('which aws', "aws cli is not installed on this host but required, exiting");
cmd('which cdk', "aws cdk is not installed on this host but required, exiting");

// Write CDK Context Object to filesystem
//await writeFile('./' + cdkContextFilename, JSON.stringify(context, null, 2), (error) => {
//    if (error) {
//        cmd("--", "An error occured saving the CDK Context: " + error); 
//    }
//});

// Start the destruction process
console.log("Update:");
console.log("    [] Destroying Zeus System ... Please be patient");
console.log("    [] Real Time View:> tail -f destroy.log \n")

const profile = zeusConfigObj.profile;
const destroyCMD = "yes | cdk destroy --all --require-approval never --profile " + profile + " >> " + destroyLogFile + " 2>&1";

// Rund Destroy Command
cmd(destroyCMD, "Something went wrong while destorying the Zeus Stacks, see: destroy.log");

// Deleted all sites, datastores remain in tact!
console.log("Status:");
console.log("    [] Success ...\n");
console.log("Clean Env:");
console.log("    [] Run:> npm run clean\n");