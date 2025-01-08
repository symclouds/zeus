import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

// HadesSite Class creates Access Site in given region
export class AgentSecurity extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }

    createSecurity(product : any, functions : any, regions : Array<string>) {
        // Get the AccountID and the Region for this stack
        const accountID = cdk.Stack.of(this).account;

        // All the agents in every site will get their own role
        const roleName = product + "-agent-role-";
        const scheduleRoleName = product + "-scheduler-role-";

        // Create an agent lambda function role for each region
        // Create an scheduler lambda invocation role for each region
        let suffix = 0;

        regions.forEach(region => {
            const agentRole = new iam.Role(this, 'HadesAgentRole'+suffix, {
                roleName: roleName + region,
                assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
                managedPolicies: [ 
                    iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
                ]
            });
            
            // Add the arns of each lambda function in this region
            const functionArns = new Array<string>();
            const functionNames = functions.split(',');
            functionNames.forEach((functionName : any) => {
                const arn = "arn:aws:lambda:" + region + ":" + accountID + ":function:" + functionName;
                functionArns.push(arn);
            });
            const agentFunctionArn = "arn:aws:lambda:" + region + ":" + accountID + ":function:" + product + "-agent";
            // Finally add the arn of the agent lambda function
            functionArns.push(agentFunctionArn);
            
            //+ Add Policy: Agent Updates Function Env Variables
            agentRole.addToPolicy(new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: ["lambda:GetFunctionConfiguration","lambda:UpdateFunctionConfiguration"],
                resources: functionArns
            }));

            // Scheduler Role
            const agentSchedulerRole = new iam.Role(this, "AgentSchedulerRole"+suffix, {
                roleName: scheduleRoleName + region,
                assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
            });

            agentSchedulerRole.addToPolicy(new iam.PolicyStatement({
                actions: ["lambda:InvokeFunction"],
                resources: [agentFunctionArn],
                effect: iam.Effect.ALLOW,
            }));
            
            suffix++;
        });
    }
}