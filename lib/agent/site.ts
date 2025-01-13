import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from 'aws-cdk-lib/aws-logs'

function createLogGroup(scope: Construct, fx: string, 
  logRetention: any, stackName: string) {
  const construct = stackName + '_LogGroup_' + fx
  const logGroupName = "/aws/lambda/" + fx
  new logs.LogGroup(scope, construct, {
    logGroupName: logGroupName,
    retention: logRetention,
    removalPolicy: cdk.RemovalPolicy.DESTROY
  });
}

// Lambda Props Interface 
interface LambdaProps extends cdk.StackProps {
  logRetentionPeriod?: number,
  tier?: string,
  email?: string,
  product?: string,
  systemID?: string,
  functions?: string,
  chksums?: any;
}

// Hades Agent Site Class creates Agent Lambda, Lambda Role and Schedule in given region
export class AgentSite extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: LambdaProps) {
    super(scope, id, props);
    var logRetentionPeriod: number;
    var tier: string;
    var email: string;
    var product: string;
    var systemID: string;
    var functions: string;
    var chksums: any;

    // Bucket Names, ARNs and Regions Required to proceed
    if(props && props.logRetentionPeriod && props.tier && props.email && props.product && props.systemID && props.functions && props.chksums) {    
        logRetentionPeriod = props.logRetentionPeriod;
        tier = props.tier;
        email = props.email;
        product = props.product;
        systemID = props.systemID;
        functions = props.functions;
        chksums = props.chksums;

        // Policy will be created in X Regions so it must be unique in the Stack
        const stackName = cdk.Stack.of(this).stackName;

        // Get the Region Value to get the corresponding role for this region
        const region = cdk.Stack.of(this).region;
        
        // Create Agent Function Lambda (e.g. hades-agent)
        const agentRoleName = product + "-agent-role-";
        const scheduleRoleName = product + "-scheduler-role-";
        const agentFunctionName = product + "-agent";
        const agentAsset = "./assets/agent.zip";

        // Define the Agent Lambda Function and attach the previously configured role to it
        const agentRole = cdk.aws_iam.Role.fromRoleName(this, product + 'AgentRole', agentRoleName+region);
        const agentFunction = new lambda.Function(this, product + "AgentFunction", {
            functionName: agentFunctionName,
            runtime: lambda.Runtime.NODEJS_20_X,
            code: lambda.Code.fromAsset(agentAsset),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            description: chksums[agentAsset].toString(),
            environment: {
                product: product,
                email: email,
                functions: functions,
                systemID: systemID,
                tier: tier,
                license: ""
            },
            memorySize: 128,
            role: agentRole
        });  
        // Crete Log Group for Lambda Function
        createLogGroup(this, agentFunctionName, logRetentionPeriod, stackName);

        // Define the Agent Scheduler Cron Task (EventBridge) 
        const scheduleRole = cdk.aws_iam.Role.fromRoleName(this, 'AgentSchedulerRole', scheduleRoleName+region);
        const agentScheduler = new cdk.CfnResource(this, "agentSchedulerEvent", {
            type: "AWS::Scheduler::Schedule",
            properties: {
                Name: "agentCronSchedule",
                Description: "Runs the agent cron every ~ 8 hours, ~ 3 times a day.",
                // Flexible within 3 hours of every 8 hours, helps stagger the requests coming into Themis
                // Helps ensure that all agent calls dont come in all at once across the field into Themis
                FlexibleTimeWindow: { 
                    Mode: "FLEXIBLE", 
                    MaximumWindowInMinutes: Number(180)
                },
                ScheduleExpression: "cron(0 */8 ? * * *)",
                ScheduleExpressionTimezone: "UTC",
                Target: {
                    Arn: agentFunction.functionArn,
                    RoleArn: scheduleRole.roleArn,
                    Input: "{\"invokeType\":\"cron\"}"
                },
            }
        });
    }
}
}