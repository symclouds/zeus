#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ses from 'aws-cdk-lib/aws-ses';
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { RemovalPolicy } from 'aws-cdk-lib'
import * as logs from 'aws-cdk-lib/aws-logs'

// Main Function
const app = new cdk.App();

// Helper function Generate API Key of Length (keyLength)
function apiKeyGen(keyLength : any) {
    var i : any, key = "", characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (i = 0; i < keyLength; i++) {
        key += characters.substr(Math.floor((Math.random() * charactersLength) + 1), 1);
    }
    return key;
  }

// Create log groups for all the Lambda functions
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

// Zeus Deployment Stack
export class Zeus extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Get the Stack Name of this deployment
        const stackName = cdk.Stack.of(this).stackName;

        // Get the user email and logretention period required by SES and Lambda Log Groups 
        const mfaEmail = this.node.tryGetContext('mfaEmail');
        const logRetentionPeriod = this.node.tryGetContext('logRetentionPeriod');
        const accessTokenDuration = this.node.tryGetContext('accessTokenDuration');
        const refreshTokenDuration = this.node.tryGetContext('refreshTokenDuration');
        const maxSessions = this.node.tryGetContext('maxSessions').toString();

        // Create DynamoDB Tables
        const usersTable = new dynamodb.Table(this, "usersTable", {
            tableName: "users",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        const sessionsTable = new dynamodb.Table(this, "sessionsTable", {
            tableName: "sessions",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
                name: "s_id",
                type: dynamodb.AttributeType.STRING
              },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
            timeToLiveAttribute: "expires"
        });

        // Create SES identity to send emails for multi-factor authentication
        const identity = new ses.EmailIdentity(this, 'Identity', {
            identity: ses.Identity.email(mfaEmail)
        });

        // Create Lambda Functions
        const loginRoleName = "loginRole";
        const registerRoleName = "registerRole";
        const mfaRoleName = "mfaRole";
        const logoutRoleName = "logoutRole";
        const resetRoleName = "resetRole";
        const refreshRoleName = "refreshRole";
        const zeusRoleName = "zeusRole";

        // Generate Roles ...

        // Login Role
        // Create New IAM Role with Lambda Basic Execution Role
        const loginRole = new iam.Role(this, loginRoleName, {
            roleName: loginRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Register Role
        // Create New IAM Role with Lambda Basic Execution Role
        const registerRole = new iam.Role(this, registerRoleName, {
            roleName: registerRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // MFA Role
        // Create New IAM Role with Lambda Basic Execution Role
        const mfaRole = new iam.Role(this, mfaRoleName, {
            roleName: mfaRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Logout Role
        // Create New IAM Role with Lambda Basic Execution Role
        const logoutRole = new iam.Role(this, logoutRoleName, {
            roleName: logoutRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Reset Role
        // Create New IAM Role with Lambda Basic Execution Role
        const resetRole = new iam.Role(this, resetRoleName, {
            roleName: resetRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Refresh Role
        // Create New IAM Role with Lambda Basic Execution Role
        const refreshRole = new iam.Role(this, refreshRoleName, {
            roleName: refreshRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Zeus Role
        // Create New IAM Role with Lambda Basic Execution Role
        const zeusRole = new iam.Role(this, zeusRoleName, {
            roleName: zeusRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Add additional policies to roles
        // Login
        loginRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem","dynamodb:Query","dynamodb:UpdateItem"],
            resources: [ usersTable.tableArn, sessionsTable.tableArn ]
        }));

        // Register
        registerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: [usersTable.tableArn]
        }));

        // MFA
        mfaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["ses:SendEmail"],
            resources: [identity.emailIdentityArn]
        }));

        // Logout
        logoutRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:DeleteItem"],
            resources: [sessionsTable.tableArn]
        }));

        // Reset
        resetRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem"],
            resources: [usersTable.tableArn]
        }));

        // Refresh
        refreshRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem","dynamodb:Query","dynamodb:UpdateItem"],
            resources: [ usersTable.tableArn, sessionsTable.tableArn ]
        }));

        // Zeus
        zeusRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [usersTable.tableArn]
        }));

        // Create Lambda Functions & Log Groups
        // Login
        const loginFxName = 'login';
        const login = new lambda.Function(this, "loginLambda", {
            functionName: loginFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/login.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            environment: {
                accessD: accessTokenDuration,
                refreshD: refreshTokenDuration,
                sessions: maxSessions
            },
            memorySize: 128,
            role: loginRole
        });
        createLogGroup(this, loginFxName, logRetentionPeriod, stackName);

        // Register
        const registerFxName = 'register';
        const register = new lambda.Function(this, "registerLambda", {
            functionName: registerFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/register.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: registerRole
        });
        createLogGroup(this, registerFxName, logRetentionPeriod, stackName);

        // MFA
        const mfaFxName = 'mfa';
        const mfa = new lambda.Function(this, "mfaLambda", {
            functionName: mfaFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/mfa.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            environment: {
                identity: mfaEmail
            },
            memorySize: 128,
            role: mfaRole
        });
        createLogGroup(this, mfaFxName, logRetentionPeriod, stackName);

        // Logout
        const logoutFxName = 'logout';
        const logout = new lambda.Function(this, "logoutLambda", {
            functionName: logoutFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/logout.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: logoutRole
        });
        createLogGroup(this, logoutFxName, logRetentionPeriod, stackName);

        // Reset
        const resetFxName = 'reset';
        const reset = new lambda.Function(this, "resetLambda", {
            functionName: resetFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/reset.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: resetRole
        });
        createLogGroup(this, resetFxName, logRetentionPeriod, stackName);

       // Refresh
       const refreshFxName = 'refresh';
       const refresh = new lambda.Function(this, "refreshLambda", {
            functionName: refreshFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/refresh.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            environment: {
                accessD: accessTokenDuration,
                refreshD: refreshTokenDuration,
                sessions: maxSessions
            },
           memorySize: 128,
           role: refreshRole
       });
       createLogGroup(this, refreshFxName, logRetentionPeriod, stackName);        

        // Zeus
        const zeusFxName = 'zeus';
        const zeus = new lambda.Function(this, "zeusLambda", {
            functionName: zeusFxName,
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/zeus.zip"),
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
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
        const usagePlan = api.addUsagePlan('flux', {
            name: 'flux',
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
        new cdk.CfnOutput(this, 'ZeusApiKey', { value: keyValue, exportName: "ZeusApiKey" });
        new cdk.CfnOutput(this, "ZeusEndpoint", { key: "ZeusEndpoint", value: api.url});
    }
}

// Create the Stack
new Zeus(app, "ZeusStack", {});

// If we wish to create the stack in another region for this account
// and not use the default region of the profile we can set it here.
// E.G.
// new Zeus(app, "ZeusStack", {})
//    env: {region: 'ca-central-1'},
//});

// This call generates the cloudFormation templates and thus issuing 'cdk synth' 
// externally is not required but it is considered good practice
app.synth();