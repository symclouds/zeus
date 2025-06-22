
                import {createRequire} from 'module'
                const require = createRequire(import.meta.url)
            
import{readFile as n}from"fs/promises";import{execSync as l}from"node:child_process";function i(){}var c="zeus.json",r="destroy.log";e("echo > "+r);var a=await n(new URL("./"+c,import.meta.url)),u=JSON.parse(a);function e(o,t){if(o=="--")console.error("[Error] hades destroy exited abnormally due to an error: 1"),console.error("[Cause] "+t+`
`),process.exit(1);else try{return l(o,{encoding:"utf8"})}catch(s){console.error("[Error] hades destroy exited abnormally due to an error: "+s.status),console.error("[Cause] "+t+`
`),process.exit(1)}}e("which aws","aws cli is not installed on this host but required, exiting");e("which cdk","aws cdk is not installed on this host but required, exiting");console.log("Update:");console.log("    [] Destroying Zeus System ... Please be patient");console.log(`    [] Real Time View:> tail -f destroy.log 
`);var d=u.profile,g="yes | cdk destroy --all --require-approval never --profile "+d+" >> "+r+" 2>&1";e(g,"Something went wrong while destorying the Zeus Stacks, see: destroy.log");console.log("Status:");console.log(`    [] Success ...
`);console.log("Clean Env:");console.log(`    [] Run:> npm run clean
`);export{i as default};
