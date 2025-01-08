import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs'
import * as ses from 'aws-cdk-lib/aws-ses';

// Helper function Generate API Key of Length (keyLength)
function apiKeyGen(keyLength : any) {
  var i : any, key = "", characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (i = 0; i < keyLength; i++) {
      key += characters.substr(Math.floor((Math.random() * charactersLength) + 1), 1);
  }
  return key;
}

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

// Initially set to 0 size since we dont know it
let apigwMethodArns = new Array<cdk.Arn>(0);
interface LambdaProps extends cdk.StackProps {
  mfaEmail?: string;
  accessTokenDuration?: string;
  refreshTokenDuration?: string,
  maxSessions?: number,
  logRetentionPeriod?: number,
  systemID?: string,
}

// HadesSite Class creates Access Site in given region
export class ZeusSite extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: LambdaProps) {
        super(scope, id, props);
        var mfaEmail: string;
        var accessTokenDuration: string;
        var refreshTokenDuration: string;
        var maxSessions: number;
        var logRetentionPeriod: number;
        var systemID: string;

        // Bucket Names, ARNs and Regions Required to proceed
        if(props && props.mfaEmail && props.accessTokenDuration && props.refreshTokenDuration 
            && props.maxSessions && props.logRetentionPeriod && props.systemID)
        {    
            mfaEmail = props.mfaEmail;
            accessTokenDuration = props.accessTokenDuration;
            refreshTokenDuration = props.refreshTokenDuration;
            maxSessions = props.maxSessions;
            logRetentionPeriod = props.logRetentionPeriod;
            systemID = props.systemID;

            // Get this stacks Name
            const stackName = cdk.Stack.of(this).stackName;

            // Create SES identity to send emails for multi-factor authentication
            const identity = new ses.EmailIdentity(this, 'Identity', {
                identity: ses.Identity.email(mfaEmail)
            });

            // Create Lambda Functions & Log Groups
            // Login
            const loginFxName = 'login';
            const loginRole = cdk.aws_iam.Role.fromRoleName(this, 'loginRole', 'loginRole');
            const login = new lambda.Function(this, "loginLambda", {
                functionName: loginFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/login.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    accessD: accessTokenDuration,
                    refreshD: refreshTokenDuration,
                    sessions: maxSessions.toString(),
                    systemID: systemID
                },
                memorySize: 128,
                role: loginRole
            });
            createLogGroup(this, loginFxName, logRetentionPeriod, stackName);

            // Register
            const registerFxName = 'register';
            const registerRole = cdk.aws_iam.Role.fromRoleName(this, 'registerRole', 'registerRole');
            const register = new lambda.Function(this, "registerLambda", {
                functionName: registerFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/register.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    systemID: systemID
                },
                memorySize: 128,
                role: registerRole
            });
            createLogGroup(this, registerFxName, logRetentionPeriod, stackName);

            // MFA
            const mfaFxName = 'mfa';
            const mfaRole = cdk.aws_iam.Role.fromRoleName(this, 'mfaRole', 'mfaRole');
            const mfa = new lambda.Function(this, "mfaLambda", {
                functionName: mfaFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/mfa.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    identity: mfaEmail,
                    systemID: systemID
                },
                memorySize: 128,
                role: mfaRole
            });
            createLogGroup(this, mfaFxName, logRetentionPeriod, stackName);

            // Logout
            const logoutFxName = 'logout';
            const logoutRole = cdk.aws_iam.Role.fromRoleName(this, 'logoutRole', 'logoutRole');
            const logout = new lambda.Function(this, "logoutLambda", {
                functionName: logoutFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/logout.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    systemID: systemID
                },
                memorySize: 128,
                role: logoutRole
            });
            createLogGroup(this, logoutFxName, logRetentionPeriod, stackName);

            // Reset
            const resetFxName = 'reset';
            const resetRole = cdk.aws_iam.Role.fromRoleName(this, 'resetRole', 'resetRole');
            const reset = new lambda.Function(this, "resetLambda", {
                functionName: resetFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/reset.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    systemID: systemID
                },
                memorySize: 128,
                role: resetRole
            });
            createLogGroup(this, resetFxName, logRetentionPeriod, stackName);

            // Refresh
            const refreshFxName = 'refresh';
            const refreshRole = cdk.aws_iam.Role.fromRoleName(this, 'refreshRole', 'refreshRole');
            const refresh = new lambda.Function(this, "refreshLambda", {
                functionName: refreshFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/refresh.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    accessD: accessTokenDuration,
                    refreshD: refreshTokenDuration,
                    sessions: maxSessions.toString(),
                    systemID: systemID
                },
                memorySize: 128,
                role: refreshRole
            });
            createLogGroup(this, refreshFxName, logRetentionPeriod, stackName);        

            // Zeus
            const zeusFxName = 'zeus';
            const zeusRole = cdk.aws_iam.Role.fromRoleName(this, 'zeusRole', 'zeusRole');
            const zeus = new lambda.Function(this, "zeusLambda", {
                functionName: zeusFxName,
                runtime: lambda.Runtime.NODEJS_LATEST,
                code: lambda.Code.fromAsset("./assets/zeus.zip"),
                timeout: cdk.Duration.seconds(15),
                handler: "index.handler",
                environment: {
                    systemID: systemID
                },
                memorySize: 128,
                role: zeusRole
            });
            createLogGroup(this, zeusFxName, logRetentionPeriod, stackName);

            // Create API Gateway with api-key
            const api = new apigw.RestApi(this, "AuthApi", {
                restApiName: "zeus",
                deploy: true,
                deployOptions: {
                    stageName: "zeus"
                },
                cloudWatchRole: true,
            });

            // Define an API Key for this API
            const apiKeyName = 'zeus';
            // Generate an API Key Ourselves 
            const keyValue = apiKeyGen(40);
            // Create an API Key with the value we specify
            const apiKey = new apigw.ApiKey(this, 'api-key', {
                apiKeyName,
                value: keyValue,
                enabled: true
            });

            // Define API Usage Plan
            const usagePlan = api.addUsagePlan('storage', {
                name: 'zeus',
                throttle: {
                    rateLimit: 1000,
                    burstLimit: 500,
                },
            });

            // Add the API Key to the usage plan
            usagePlan.addApiKey(apiKey);

            // Add the usage plan to the API Stage
            usagePlan.addApiStage({ stage: api.deploymentStage });

            // Create the Zeus Authorizer
            const zeusAuthorizer = new apigw.TokenAuthorizer(this, 'zeus', {
                authorizerName: 'zeus',
                handler: zeus,
                resultsCacheTtl: cdk.Duration.minutes(0)
            });

            // Finally we add the resources to the Lambda Functions
            // Add triggers and Invoke Permissions to Lambda Functions from API GW Resources
            // Login
            login.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
            const loginLambdaIntegration = new apigw.LambdaIntegration(login);
            api.root.addResource("login").addMethod("POST", loginLambdaIntegration, {
                authorizationType: apigw.AuthorizationType.NONE,
                apiKeyRequired: true
            });

            // Register
            register.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
            const registerLambdaIntegration = new apigw.LambdaIntegration(register);
            api.root.addResource("register").addMethod("POST", registerLambdaIntegration, {
                authorizationType: apigw.AuthorizationType.NONE,
                apiKeyRequired: true
            });

            // MFA
            mfa.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
            const mfaLambdaIntegration = new apigw.LambdaIntegration(mfa);
            api.root.addResource("mfa").addMethod("POST", mfaLambdaIntegration, {
                authorizationType: apigw.AuthorizationType.NONE,
                apiKeyRequired: true
            });

            // Logout
            logout.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
            const logoutLambdaIntegration = new apigw.LambdaIntegration(logout);
            api.root.addResource("logout").addMethod("POST", logoutLambdaIntegration, {
                authorizationType: apigw.AuthorizationType.CUSTOM,
                authorizer: zeusAuthorizer,
                apiKeyRequired: true
            });

            // Reset
            reset.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
            const resetLambdaIntegration = new apigw.LambdaIntegration(reset);
            api.root.addResource("reset").addMethod("POST", resetLambdaIntegration, {
                authorizationType: apigw.AuthorizationType.NONE,
                apiKeyRequired: true
            });

            // Refresh
            refresh.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
            const refreshLambdaIntegration = new apigw.LambdaIntegration(refresh);
            api.root.addResource("refresh").addMethod("POST", refreshLambdaIntegration, {
                authorizationType: apigw.AuthorizationType.CUSTOM,
                authorizer: zeusAuthorizer,
                apiKeyRequired: true
            });

            // Print the Integration information for the user
            // The Stage URI will be displayed by the cdk upon completion
            // The API-Key which is needed by the users is also printed here
            new cdk.CfnOutput(this, "ZeusEndpoint", { key: "ZeusEndpoint", value: api.url});
            new cdk.CfnOutput(this, 'ZeusApiKey', { value: keyValue, exportName: "ZeusApiKey" });
        }
    }
}