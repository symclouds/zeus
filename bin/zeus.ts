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

// First read in zeus.json it will contain the runtime parameters needed by the
// MFA Lambda function of users identity emails will be sent through
// It will also contain Usage Plan information for API Gateway requests/second and burst
// ... Any other configurtion parameters that are warranted ...

// First it is necessary to Build the Lambda functions with esbuild
// Run the build instructions: npm run build && npm run package
// this will create the artifact zip files needed for Lambdas in the ./assets/


// Main Function
const app = new cdk.App();

// First it is necessary to Build the Lambda functions with esbuild
// Run the build instructions: npm run build && npm run package
// this will create the artifact zip files needed for Lambdas in the ./assets/
//const resp = exec('cd .. && npm run build && npm run package');

// Helper function Generate API Key of Length (keyLength)
function apiKeyGen(keyLength : any) {
    var i : any, key = "", characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (i = 0; i < keyLength; i++) {
        key += characters.substr(Math.floor((Math.random() * charactersLength) + 1), 1);
    }
    return key;
  }

// Zeus Deployment Stack
export class Zeus extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Get the email identity required by SES to send email messages
        const userEmail = this.node.tryGetContext('email');
        console.log("User email provided in context is: " + userEmail)

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
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: RemovalPolicy.DESTROY,
        });

        // Create SES identity to send emails for multi-factor authentication
        const identity = new ses.EmailIdentity(this, 'Identity', {
            identity: ses.Identity.email(userEmail)
        });

        // Create Lambda Functions
        const loginRoleName = "loginRole";
        const registerRoleName = "registerRole";
        const mfaRoleName = "mfaRole";
        const logoutRoleName = "logoutRole";
        const resetRoleName = "resetRole";
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
            actions: [ "dynamodb:PutItem","dynamodb:GetItem"],
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

        // Zeus
        zeusRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: [usersTable.tableArn]
        }));

        // Create Lambda Functions
        // Login
        const login = new lambda.Function(this, "loginLambda", {
            functionName: 'login',
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/login.zip"),
            logRetention: 1,
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: loginRole
        });

        // Register
        const register = new lambda.Function(this, "registerLambda", {
            functionName: 'register',
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/register.zip"),
            logRetention: 1,
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: registerRole
        });

        // MFA
        const mfa = new lambda.Function(this, "mfaLambda", {
            functionName: 'mfa',
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/mfa.zip"),
            logRetention: 1,
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: mfaRole
        });

        // Logout
        const logout = new lambda.Function(this, "logoutLambda", {
            functionName: 'logout',
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/logout.zip"),
            logRetention: 1,
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: logoutRole
        });

        // Reset
        const reset = new lambda.Function(this, "resetLambda", {
            functionName: 'reset',
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/reset.zip"),
            logRetention: 1,
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: resetRole
        });

        // Zeus
        const zeus = new lambda.Function(this, "zeusLambda", {
            functionName: 'zeus',
            runtime: lambda.Runtime.NODEJS_LATEST,
            code: lambda.Code.fromAsset("./assets/zeus.zip"),
            logRetention: 1,
            timeout: cdk.Duration.seconds(15),
            handler: "index.handler",
            memorySize: 128,
            role: mfaRole
        });

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
            authorizationType: apigw.AuthorizationType.NONE,
            apiKeyRequired: true
        });

        // Reset
        reset.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
        const resetLambdaIntegration = new apigw.LambdaIntegration(reset);
        api.root.addResource("reset").addMethod("POST", resetLambdaIntegration, {
            authorizationType: apigw.AuthorizationType.NONE,
            apiKeyRequired: true
        });

        // Zeus
        zeus.grantInvoke(new iam.ServicePrincipal('apigateway.amazonaws.com'));
        const zeusLambdaIntegration = new apigw.LambdaIntegration(zeus);
        api.root.addResource("zeus").addMethod("POST", zeusLambdaIntegration, {
            authorizationType: apigw.AuthorizationType.NONE,
            apiKeyRequired: true
        });

        // Print the Integration information for the user
        // The Stage URI will be displayed by the cdk upon completion
        // The API-Key which is needed by the users is also printed here
        new cdk.CfnOutput(this, 'API-Key', { value: keyValue, exportName: "Api-Key" });
    }
}

// Create the Stack
new Zeus(app, "ZeusStack", {});
//    env: {region: 'ca-central-1'},
//});

// This call generates the cloudFormation templates and thus issuing 'cdk synth' externally is not required
app.synth();