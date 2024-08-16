#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Zeus = void 0;
require("source-map-support/register");
const cdk = require("aws-cdk-lib");
const iam = require("aws-cdk-lib/aws-iam");
const dynamodb = require("aws-cdk-lib/aws-dynamodb");
const ses = require("aws-cdk-lib/aws-ses");
const lambda = require("aws-cdk-lib/aws-lambda");
const apigw = require("aws-cdk-lib/aws-apigateway");
const aws_cdk_lib_1 = require("aws-cdk-lib");
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
function apiKeyGen(keyLength) {
    var i, key = "", characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for (i = 0; i < keyLength; i++) {
        key += characters.substr(Math.floor((Math.random() * charactersLength) + 1), 1);
    }
    return key;
}
// Zeus Deployment Stack
class Zeus extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        // Get the email identity required by SES to send email messages
        const userEmail = this.node.tryGetContext('email');
        console.log("User email provided in context is: " + userEmail);
        // Create DynamoDB Tables
        const usersTable = new dynamodb.Table(this, "usersTable", {
            tableName: "users",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        const sessionsTable = new dynamodb.Table(this, "sessionsTable", {
            tableName: "sessions",
            partitionKey: {
                name: "email",
                type: dynamodb.AttributeType.STRING,
            },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
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
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });
        // Register Role
        // Create New IAM Role with Lambda Basic Execution Role
        const registerRole = new iam.Role(this, registerRoleName, {
            roleName: registerRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });
        // MFA Role
        // Create New IAM Role with Lambda Basic Execution Role
        const mfaRole = new iam.Role(this, mfaRoleName, {
            roleName: mfaRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });
        // Logout Role
        // Create New IAM Role with Lambda Basic Execution Role
        const logoutRole = new iam.Role(this, logoutRoleName, {
            roleName: logoutRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });
        // Reset Role
        // Create New IAM Role with Lambda Basic Execution Role
        const resetRole = new iam.Role(this, resetRoleName, {
            roleName: resetRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });
        // Zeus Role
        // Create New IAM Role with Lambda Basic Execution Role
        const zeusRole = new iam.Role(this, zeusRoleName, {
            roleName: zeusRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'), // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });
        // Add additional policies to roles
        // Login
        loginRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem", "dynamodb:GetItem"],
            resources: [usersTable.tableArn, sessionsTable.tableArn]
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
            code: lambda.Code.fromAsset("../assets/login.zip"),
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
            code: lambda.Code.fromAsset("../assets/register.zip"),
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
            code: lambda.Code.fromAsset("../assets/mfa.zip"),
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
            code: lambda.Code.fromAsset("../assets/logout.zip"),
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
            code: lambda.Code.fromAsset("../assets/reset.zip"),
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
            code: lambda.Code.fromAsset("../assets/zeus.zip"),
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
exports.Zeus = Zeus;
// Create the Stack
new Zeus(app, "ZeusStack", {});
//    env: {region: 'ca-central-1'},
//});
// This call generates the cloudFormation templates and thus issuing 'cdk synth' externally is not required
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiemV1cy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInpldXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUNBLHVDQUFxQztBQUNyQyxtQ0FBbUM7QUFDbkMsMkNBQTJDO0FBQzNDLHFEQUFxRDtBQUNyRCwyQ0FBMkM7QUFDM0MsaURBQWlEO0FBQ2pELG9EQUFvRDtBQUVwRCw2Q0FBMkM7QUFFM0MsK0VBQStFO0FBQy9FLG9FQUFvRTtBQUNwRSx3RkFBd0Y7QUFDeEYsK0RBQStEO0FBRS9ELG1FQUFtRTtBQUNuRSwrREFBK0Q7QUFDL0QsOEVBQThFO0FBRzlFLGdCQUFnQjtBQUNoQixNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUUxQixtRUFBbUU7QUFDbkUsK0RBQStEO0FBQy9ELDhFQUE4RTtBQUM5RSxpRUFBaUU7QUFFakUseURBQXlEO0FBQ3pELFNBQVMsU0FBUyxDQUFDLFNBQWU7SUFDOUIsSUFBSSxDQUFPLEVBQUUsR0FBRyxHQUFHLEVBQUUsRUFBRSxVQUFVLEdBQUcsZ0VBQWdFLENBQUM7SUFDckcsSUFBSSxnQkFBZ0IsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDO0lBQ3pDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsU0FBUyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDN0IsR0FBRyxJQUFJLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3BGLENBQUM7SUFDRCxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFFSCx3QkFBd0I7QUFDeEIsTUFBYSxJQUFLLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDL0IsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUM1RCxLQUFLLENBQUMsS0FB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SSxLQUFLLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbEUsR0FBRyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sRUFBRSxzQkFBc0IsRUFBRTtZQUNwRSxpQkFBaUIsRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsSUFBSTtZQUMvQyxjQUFjLEVBQUUsSUFBSTtTQUN2QixDQUFDLENBQUM7UUFFSCxPQUFPO1FBQ1AsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUM7UUFDdkUsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoRSxHQUFHLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFLHFCQUFxQixFQUFFO1lBQ2xFLGlCQUFpQixFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJO1lBQy9DLGNBQWMsRUFBRSxJQUFJO1NBQ3ZCLENBQUMsQ0FBQztRQUVILGlEQUFpRDtRQUNqRCw2REFBNkQ7UUFDN0QsZ0VBQWdFO1FBQ2hFLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLENBQUMsQ0FBQztJQUNuRixDQUFDO0NBQ0o7QUF4VEQsb0JBd1RDO0FBRUQsbUJBQW1CO0FBQ25CLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDL0Isb0NBQW9DO0FBQ3BDLEtBQUs7QUFFTCwyR0FBMkc7QUFDM0csR0FBRyxDQUFDLEtBQUssRUFBRSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiIyEvdXNyL2Jpbi9lbnYgbm9kZVxuaW1wb3J0ICdzb3VyY2UtbWFwLXN1cHBvcnQvcmVnaXN0ZXInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGlhbSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtaWFtJztcbmltcG9ydCAqIGFzIGR5bmFtb2RiIGZyb20gXCJhd3MtY2RrLWxpYi9hd3MtZHluYW1vZGJcIjtcbmltcG9ydCAqIGFzIHNlcyBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VzJztcbmltcG9ydCAqIGFzIGxhbWJkYSBmcm9tIFwiYXdzLWNkay1saWIvYXdzLWxhbWJkYVwiO1xuaW1wb3J0ICogYXMgYXBpZ3cgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXknO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBSZW1vdmFsUG9saWN5IH0gZnJvbSAnYXdzLWNkay1saWInXG5cbi8vIEZpcnN0IHJlYWQgaW4gemV1cy5qc29uIGl0IHdpbGwgY29udGFpbiB0aGUgcnVudGltZSBwYXJhbWV0ZXJzIG5lZWRlZCBieSB0aGVcbi8vIE1GQSBMYW1iZGEgZnVuY3Rpb24gb2YgdXNlcnMgaWRlbnRpdHkgZW1haWxzIHdpbGwgYmUgc2VudCB0aHJvdWdoXG4vLyBJdCB3aWxsIGFsc28gY29udGFpbiBVc2FnZSBQbGFuIGluZm9ybWF0aW9uIGZvciBBUEkgR2F0ZXdheSByZXF1ZXN0cy9zZWNvbmQgYW5kIGJ1cnN0XG4vLyAuLi4gQW55IG90aGVyIGNvbmZpZ3VydGlvbiBwYXJhbWV0ZXJzIHRoYXQgYXJlIHdhcnJhbnRlZCAuLi5cblxuLy8gRmlyc3QgaXQgaXMgbmVjZXNzYXJ5IHRvIEJ1aWxkIHRoZSBMYW1iZGEgZnVuY3Rpb25zIHdpdGggZXNidWlsZFxuLy8gUnVuIHRoZSBidWlsZCBpbnN0cnVjdGlvbnM6IG5wbSBydW4gYnVpbGQgJiYgbnBtIHJ1biBwYWNrYWdlXG4vLyB0aGlzIHdpbGwgY3JlYXRlIHRoZSBhcnRpZmFjdCB6aXAgZmlsZXMgbmVlZGVkIGZvciBMYW1iZGFzIGluIHRoZSAuL2Fzc2V0cy9cblxuXG4vLyBNYWluIEZ1bmN0aW9uXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBGaXJzdCBpdCBpcyBuZWNlc3NhcnkgdG8gQnVpbGQgdGhlIExhbWJkYSBmdW5jdGlvbnMgd2l0aCBlc2J1aWxkXG4vLyBSdW4gdGhlIGJ1aWxkIGluc3RydWN0aW9uczogbnBtIHJ1biBidWlsZCAmJiBucG0gcnVuIHBhY2thZ2Vcbi8vIHRoaXMgd2lsbCBjcmVhdGUgdGhlIGFydGlmYWN0IHppcCBmaWxlcyBuZWVkZWQgZm9yIExhbWJkYXMgaW4gdGhlIC4vYXNzZXRzL1xuLy9jb25zdCByZXNwID0gZXhlYygnY2QgLi4gJiYgbnBtIHJ1biBidWlsZCAmJiBucG0gcnVuIHBhY2thZ2UnKTtcblxuLy8gSGVscGVyIGZ1bmN0aW9uIEdlbmVyYXRlIEFQSSBLZXkgb2YgTGVuZ3RoIChrZXlMZW5ndGgpXG5mdW5jdGlvbiBhcGlLZXlHZW4oa2V5TGVuZ3RoIDogYW55KSB7XG4gICAgdmFyIGkgOiBhbnksIGtleSA9IFwiXCIsIGNoYXJhY3RlcnMgPSBcIkFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5XCI7XG4gICAgdmFyIGNoYXJhY3RlcnNMZW5ndGggPSBjaGFyYWN0ZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwga2V5TGVuZ3RoOyBpKyspIHtcbiAgICAgICAga2V5ICs9IGNoYXJhY3RlcnMuc3Vic3RyKE1hdGguZmxvb3IoKE1hdGgucmFuZG9tKCkgKiBjaGFyYWN0ZXJzTGVuZ3RoKSArIDEpLCAxKTtcbiAgICB9XG4gICAgcmV0dXJuIGtleTtcbiAgfVxuXG4vLyBaZXVzIERlcGxveW1lbnQgU3RhY2tcbmV4cG9ydCBjbGFzcyBaZXVzIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IGNkay5TdGFja1Byb3BzKSB7XG4gICAgICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgICAgIC8vIEdldCB0aGUgZW1haWwgaWRlbnRpdHkgcmVxdWlyZWQgYnkgU0VTIHRvIHNlbmQgZW1haWwgbWVzc2FnZXNcbiAgICAgICAgY29uc3QgdXNlckVtYWlsID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ2VtYWlsJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKFwiVXNlciBlbWFpbCBwcm92aWRlZCBpbiBjb250ZXh0IGlzOiBcIiArIHVzZXJFbWFpbClcblxuICAgICAgICAvLyBDcmVhdGUgRHluYW1vREIgVGFibGVzXG4gICAgICAgIGNvbnN0IHVzZXJzVGFibGUgPSBuZXcgZHluYW1vZGIuVGFibGUodGhpcywgXCJ1c2Vyc1RhYmxlXCIsIHtcbiAgICAgICAgICAgIHRhYmxlTmFtZTogXCJ1c2Vyc1wiLFxuICAgICAgICAgICAgcGFydGl0aW9uS2V5OiB7XG4gICAgICAgICAgICAgICAgbmFtZTogXCJlbWFpbFwiLFxuICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3Qgc2Vzc2lvbnNUYWJsZSA9IG5ldyBkeW5hbW9kYi5UYWJsZSh0aGlzLCBcInNlc3Npb25zVGFibGVcIiwge1xuICAgICAgICAgICAgdGFibGVOYW1lOiBcInNlc3Npb25zXCIsXG4gICAgICAgICAgICBwYXJ0aXRpb25LZXk6IHtcbiAgICAgICAgICAgICAgICBuYW1lOiBcImVtYWlsXCIsXG4gICAgICAgICAgICAgICAgdHlwZTogZHluYW1vZGIuQXR0cmlidXRlVHlwZS5TVFJJTkcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYmlsbGluZ01vZGU6IGR5bmFtb2RiLkJpbGxpbmdNb2RlLlBBWV9QRVJfUkVRVUVTVCxcbiAgICAgICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gQ3JlYXRlIFNFUyBpZGVudGl0eSB0byBzZW5kIGVtYWlscyBmb3IgbXVsdGktZmFjdG9yIGF1dGhlbnRpY2F0aW9uXG4gICAgICAgIGNvbnN0IGlkZW50aXR5ID0gbmV3IHNlcy5FbWFpbElkZW50aXR5KHRoaXMsICdJZGVudGl0eScsIHtcbiAgICAgICAgICAgIGlkZW50aXR5OiBzZXMuSWRlbnRpdHkuZW1haWwodXNlckVtYWlsKVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBDcmVhdGUgTGFtYmRhIEZ1bmN0aW9uc1xuICAgICAgICBjb25zdCBsb2dpblJvbGVOYW1lID0gXCJsb2dpblJvbGVcIjtcbiAgICAgICAgY29uc3QgcmVnaXN0ZXJSb2xlTmFtZSA9IFwicmVnaXN0ZXJSb2xlXCI7XG4gICAgICAgIGNvbnN0IG1mYVJvbGVOYW1lID0gXCJtZmFSb2xlXCI7XG4gICAgICAgIGNvbnN0IGxvZ291dFJvbGVOYW1lID0gXCJsb2dvdXRSb2xlXCI7XG4gICAgICAgIGNvbnN0IHJlc2V0Um9sZU5hbWUgPSBcInJlc2V0Um9sZVwiO1xuICAgICAgICBjb25zdCB6ZXVzUm9sZU5hbWUgPSBcInpldXNSb2xlXCI7XG5cbiAgICAgICAgLy8gR2VuZXJhdGUgUm9sZXMgLi4uXG5cbiAgICAgICAgLy8gTG9naW4gUm9sZVxuICAgICAgICAvLyBDcmVhdGUgTmV3IElBTSBSb2xlIHdpdGggTGFtYmRhIEJhc2ljIEV4ZWN1dGlvbiBSb2xlXG4gICAgICAgIGNvbnN0IGxvZ2luUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBsb2dpblJvbGVOYW1lLCB7XG4gICAgICAgICAgICByb2xlTmFtZTogbG9naW5Sb2xlTmFtZSxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLCAgIC8vIHJlcXVpcmVkXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIFJvbGVcbiAgICAgICAgLy8gQ3JlYXRlIE5ldyBJQU0gUm9sZSB3aXRoIExhbWJkYSBCYXNpYyBFeGVjdXRpb24gUm9sZVxuICAgICAgICBjb25zdCByZWdpc3RlclJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgcmVnaXN0ZXJSb2xlTmFtZSwge1xuICAgICAgICAgICAgcm9sZU5hbWU6IHJlZ2lzdGVyUm9sZU5hbWUsXG4gICAgICAgICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSwgICAvLyByZXF1aXJlZFxuICAgICAgICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgICAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFwic2VydmljZS1yb2xlL0FXU0xhbWJkYUJhc2ljRXhlY3V0aW9uUm9sZVwiKVxuICAgICAgICAgICAgXVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBNRkEgUm9sZVxuICAgICAgICAvLyBDcmVhdGUgTmV3IElBTSBSb2xlIHdpdGggTGFtYmRhIEJhc2ljIEV4ZWN1dGlvbiBSb2xlXG4gICAgICAgIGNvbnN0IG1mYVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgbWZhUm9sZU5hbWUsIHtcbiAgICAgICAgICAgIHJvbGVOYW1lOiBtZmFSb2xlTmFtZSxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLCAgIC8vIHJlcXVpcmVkXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIExvZ291dCBSb2xlXG4gICAgICAgIC8vIENyZWF0ZSBOZXcgSUFNIFJvbGUgd2l0aCBMYW1iZGEgQmFzaWMgRXhlY3V0aW9uIFJvbGVcbiAgICAgICAgY29uc3QgbG9nb3V0Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBsb2dvdXRSb2xlTmFtZSwge1xuICAgICAgICAgICAgcm9sZU5hbWU6IGxvZ291dFJvbGVOYW1lLFxuICAgICAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2xhbWJkYS5hbWF6b25hd3MuY29tJyksICAgLy8gcmVxdWlyZWRcbiAgICAgICAgICAgIG1hbmFnZWRQb2xpY2llczogW1xuICAgICAgICAgICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcInNlcnZpY2Utcm9sZS9BV1NMYW1iZGFCYXNpY0V4ZWN1dGlvblJvbGVcIilcbiAgICAgICAgICAgIF1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUmVzZXQgUm9sZVxuICAgICAgICAvLyBDcmVhdGUgTmV3IElBTSBSb2xlIHdpdGggTGFtYmRhIEJhc2ljIEV4ZWN1dGlvbiBSb2xlXG4gICAgICAgIGNvbnN0IHJlc2V0Um9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCByZXNldFJvbGVOYW1lLCB7XG4gICAgICAgICAgICByb2xlTmFtZTogcmVzZXRSb2xlTmFtZSxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLCAgIC8vIHJlcXVpcmVkXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFpldXMgUm9sZVxuICAgICAgICAvLyBDcmVhdGUgTmV3IElBTSBSb2xlIHdpdGggTGFtYmRhIEJhc2ljIEV4ZWN1dGlvbiBSb2xlXG4gICAgICAgIGNvbnN0IHpldXNSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIHpldXNSb2xlTmFtZSwge1xuICAgICAgICAgICAgcm9sZU5hbWU6IHpldXNSb2xlTmFtZSxcbiAgICAgICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdsYW1iZGEuYW1hem9uYXdzLmNvbScpLCAgIC8vIHJlcXVpcmVkXG4gICAgICAgICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJzZXJ2aWNlLXJvbGUvQVdTTGFtYmRhQmFzaWNFeGVjdXRpb25Sb2xlXCIpXG4gICAgICAgICAgICBdXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCBhZGRpdGlvbmFsIHBvbGljaWVzIHRvIHJvbGVzXG4gICAgICAgIC8vIExvZ2luXG4gICAgICAgIGxvZ2luUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbIFwiZHluYW1vZGI6UHV0SXRlbVwiLFwiZHluYW1vZGI6R2V0SXRlbVwiXSxcbiAgICAgICAgICAgIHJlc291cmNlczogWyB1c2Vyc1RhYmxlLnRhYmxlQXJuLCBzZXNzaW9uc1RhYmxlLnRhYmxlQXJuIF1cbiAgICAgICAgfSkpO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyXG4gICAgICAgIHJlZ2lzdGVyUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJkeW5hbW9kYjpQdXRJdGVtXCJdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbdXNlcnNUYWJsZS50YWJsZUFybl1cbiAgICAgICAgfSkpO1xuXG4gICAgICAgIC8vIE1GQVxuICAgICAgICBtZmFSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcInNlczpTZW5kRW1haWxcIl0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtpZGVudGl0eS5lbWFpbElkZW50aXR5QXJuXVxufSkpO1xuXG4gICAgICAgIC8vIExvZ291dFxuICAgICAgICBsb2dvdXRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcImR5bmFtb2RiOkRlbGV0ZUl0ZW1cIl0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFtzZXNzaW9uc1RhYmxlLnRhYmxlQXJuXVxuICAgICAgICB9KSk7XG5cbiAgICAgICAgLy8gUmVzZXRcbiAgICAgICAgcmVzZXRSb2xlLmFkZFRvUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgIGFjdGlvbnM6IFtcImR5bmFtb2RiOlVwZGF0ZUl0ZW1cIl0sXG4gICAgICAgICAgICByZXNvdXJjZXM6IFt1c2Vyc1RhYmxlLnRhYmxlQXJuXVxuICAgICAgICB9KSk7XG5cbiAgICAgICAgLy8gWmV1c1xuICAgICAgICB6ZXVzUm9sZS5hZGRUb1BvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICBhY3Rpb25zOiBbXCJkeW5hbW9kYjpHZXRJdGVtXCJdLFxuICAgICAgICAgICAgcmVzb3VyY2VzOiBbdXNlcnNUYWJsZS50YWJsZUFybl1cbiAgICAgICAgfSkpO1xuXG4gICAgICAgIC8vIENyZWF0ZSBMYW1iZGEgRnVuY3Rpb25zXG4gICAgICAgIC8vIExvZ2luXG4gICAgICAgIGNvbnN0IGxvZ2luID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcImxvZ2luTGFtYmRhXCIsIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uTmFtZTogJ2xvZ2luJyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU19MQVRFU1QsXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9kaXN0L2xvZ2luLnppcFwiKSxcbiAgICAgICAgICAgIGxvZ1JldGVudGlvbjogMSxcbiAgICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgICAgcm9sZTogbG9naW5Sb2xlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyXG4gICAgICAgIGNvbnN0IHJlZ2lzdGVyID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcInJlZ2lzdGVyTGFtYmRhXCIsIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uTmFtZTogJ3JlZ2lzdGVyJyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU19MQVRFU1QsXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9hc3NldHMvcmVnaXN0ZXIuemlwXCIpLFxuICAgICAgICAgICAgbG9nUmV0ZW50aW9uOiAxLFxuICAgICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgICAgICByb2xlOiByZWdpc3RlclJvbGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gTUZBXG4gICAgICAgIGNvbnN0IG1mYSA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgXCJtZmFMYW1iZGFcIiwge1xuICAgICAgICAgICAgZnVuY3Rpb25OYW1lOiAnbWZhJyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU19MQVRFU1QsXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9hc3NldHMvbWZhLnppcFwiKSxcbiAgICAgICAgICAgIGxvZ1JldGVudGlvbjogMSxcbiAgICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE1KSxcbiAgICAgICAgICAgIGhhbmRsZXI6IFwiaW5kZXguaGFuZGxlclwiLFxuICAgICAgICAgICAgbWVtb3J5U2l6ZTogMTI4LFxuICAgICAgICAgICAgcm9sZTogbWZhUm9sZVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBMb2dvdXRcbiAgICAgICAgY29uc3QgbG9nb3V0ID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcImxvZ291dExhbWJkYVwiLCB7XG4gICAgICAgICAgICBmdW5jdGlvbk5hbWU6ICdsb2dvdXQnLFxuICAgICAgICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTX0xBVEVTVCxcbiAgICAgICAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChcIi4uL2Fzc2V0cy9sb2dvdXQuemlwXCIpLFxuICAgICAgICAgICAgbG9nUmV0ZW50aW9uOiAxLFxuICAgICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgICAgICByb2xlOiBsb2dvdXRSb2xlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFJlc2V0XG4gICAgICAgIGNvbnN0IHJlc2V0ID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcInJlc2V0TGFtYmRhXCIsIHtcbiAgICAgICAgICAgIGZ1bmN0aW9uTmFtZTogJ3Jlc2V0JyxcbiAgICAgICAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLk5PREVKU19MQVRFU1QsXG4gICAgICAgICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQoXCIuLi9hc3NldHMvcmVzZXQuemlwXCIpLFxuICAgICAgICAgICAgbG9nUmV0ZW50aW9uOiAxLFxuICAgICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgICAgICByb2xlOiByZXNldFJvbGVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gWmV1c1xuICAgICAgICBjb25zdCB6ZXVzID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCBcInpldXNMYW1iZGFcIiwge1xuICAgICAgICAgICAgZnVuY3Rpb25OYW1lOiAnemV1cycsXG4gICAgICAgICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5OT0RFSlNfTEFURVNULFxuICAgICAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KFwiLi4vYXNzZXRzL3pldXMuemlwXCIpLFxuICAgICAgICAgICAgbG9nUmV0ZW50aW9uOiAxLFxuICAgICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTUpLFxuICAgICAgICAgICAgaGFuZGxlcjogXCJpbmRleC5oYW5kbGVyXCIsXG4gICAgICAgICAgICBtZW1vcnlTaXplOiAxMjgsXG4gICAgICAgICAgICByb2xlOiBtZmFSb2xlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheSB3aXRoIGFwaS1rZXlcbiAgICAgICAgY29uc3QgYXBpID0gbmV3IGFwaWd3LlJlc3RBcGkodGhpcywgXCJBdXRoQXBpXCIsIHtcbiAgICAgICAgICAgIHJlc3RBcGlOYW1lOiBcInpldXNcIixcbiAgICAgICAgICAgIGRlcGxveTogdHJ1ZSxcbiAgICAgICAgICAgIGRlcGxveU9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgICBzdGFnZU5hbWU6IFwiemV1c1wiXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY2xvdWRXYXRjaFJvbGU6IHRydWUsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIERlZmluZSBhbiBBUEkgS2V5IGZvciB0aGlzIEFQSVxuICAgICAgICBjb25zdCBhcGlLZXlOYW1lID0gJ3pldXMnO1xuICAgICAgICAvLyBHZW5lcmF0ZSBhbiBBUEkgS2V5IE91cnNlbHZlcyBcbiAgICAgICAgY29uc3Qga2V5VmFsdWUgPSBhcGlLZXlHZW4oNDApO1xuICAgICAgICAvLyBDcmVhdGUgYW4gQVBJIEtleSB3aXRoIHRoZSB2YWx1ZSB3ZSBzcGVjaWZ5XG4gICAgICAgIGNvbnN0IGFwaUtleSA9IG5ldyBhcGlndy5BcGlLZXkodGhpcywgJ2FwaS1rZXknLCB7XG4gICAgICAgICAgICBhcGlLZXlOYW1lLFxuICAgICAgICAgICAgdmFsdWU6IGtleVZhbHVlLFxuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBEZWZpbmUgQVBJIFVzYWdlIFBsYW5cbiAgICAgICAgY29uc3QgdXNhZ2VQbGFuID0gYXBpLmFkZFVzYWdlUGxhbignZmx1eCcsIHtcbiAgICAgICAgICAgIG5hbWU6ICdmbHV4JyxcbiAgICAgICAgICAgIHRocm90dGxlOiB7XG4gICAgICAgICAgICAgICAgcmF0ZUxpbWl0OiAxMDAwLFxuICAgICAgICAgICAgICAgIGJ1cnN0TGltaXQ6IDUwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIEFkZCB0aGUgQVBJIEtleSB0byB0aGUgdXNhZ2UgcGxhblxuICAgICAgICB1c2FnZVBsYW4uYWRkQXBpS2V5KGFwaUtleSk7XG5cbiAgICAgICAgLy8gQWRkIHRoZSB1c2FnZSBwbGFuIHRvIHRoZSBBUEkgU3RhZ2VcbiAgICAgICAgdXNhZ2VQbGFuLmFkZEFwaVN0YWdlKHsgc3RhZ2U6IGFwaS5kZXBsb3ltZW50U3RhZ2UgfSk7XG5cbiAgICAgICAgLy8gRmluYWxseSB3ZSBhZGQgdGhlIHJlc291cmNlcyB0byB0aGUgTGFtYmRhIEZ1bmN0aW9uc1xuICAgICAgICAvLyBBZGQgdHJpZ2dlcnMgYW5kIEludm9rZSBQZXJtaXNzaW9ucyB0byBMYW1iZGEgRnVuY3Rpb25zIGZyb20gQVBJIEdXIFJlc291cmNlc1xuXG4gICAgICAgIC8vIExvZ2luXG4gICAgICAgIGxvZ2luLmdyYW50SW52b2tlKG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJykpO1xuICAgICAgICBjb25zdCBsb2dpbkxhbWJkYUludGVncmF0aW9uID0gbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGxvZ2luKTtcbiAgICAgICAgYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJsb2dpblwiKS5hZGRNZXRob2QoXCJQT1NUXCIsIGxvZ2luTGFtYmRhSW50ZWdyYXRpb24sIHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgICAgICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUmVnaXN0ZXJcbiAgICAgICAgcmVnaXN0ZXIuZ3JhbnRJbnZva2UobmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSk7XG4gICAgICAgIGNvbnN0IHJlZ2lzdGVyTGFtYmRhSW50ZWdyYXRpb24gPSBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24ocmVnaXN0ZXIpO1xuICAgICAgICBhcGkucm9vdC5hZGRSZXNvdXJjZShcInJlZ2lzdGVyXCIpLmFkZE1ldGhvZChcIlBPU1RcIiwgcmVnaXN0ZXJMYW1iZGFJbnRlZ3JhdGlvbiwge1xuICAgICAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXG4gICAgICAgICAgICBhcGlLZXlSZXF1aXJlZDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBNRkFcbiAgICAgICAgbWZhLmdyYW50SW52b2tlKG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnYXBpZ2F0ZXdheS5hbWF6b25hd3MuY29tJykpO1xuICAgICAgICBjb25zdCBtZmFMYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbihtZmEpO1xuICAgICAgICBhcGkucm9vdC5hZGRSZXNvdXJjZShcIm1mYVwiKS5hZGRNZXRob2QoXCJQT1NUXCIsIG1mYUxhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcbiAgICAgICAgICAgIGFwaUtleVJlcXVpcmVkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIExvZ291dFxuICAgICAgICBsb2dvdXQuZ3JhbnRJbnZva2UobmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSk7XG4gICAgICAgIGNvbnN0IGxvZ291dExhbWJkYUludGVncmF0aW9uID0gbmV3IGFwaWd3LkxhbWJkYUludGVncmF0aW9uKGxvZ291dCk7XG4gICAgICAgIGFwaS5yb290LmFkZFJlc291cmNlKFwibG9nb3V0XCIpLmFkZE1ldGhvZChcIlBPU1RcIiwgbG9nb3V0TGFtYmRhSW50ZWdyYXRpb24sIHtcbiAgICAgICAgICAgIGF1dGhvcml6YXRpb25UeXBlOiBhcGlndy5BdXRob3JpemF0aW9uVHlwZS5OT05FLFxuICAgICAgICAgICAgYXBpS2V5UmVxdWlyZWQ6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gUmVzZXRcbiAgICAgICAgcmVzZXQuZ3JhbnRJbnZva2UobmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSk7XG4gICAgICAgIGNvbnN0IHJlc2V0TGFtYmRhSW50ZWdyYXRpb24gPSBuZXcgYXBpZ3cuTGFtYmRhSW50ZWdyYXRpb24ocmVzZXQpO1xuICAgICAgICBhcGkucm9vdC5hZGRSZXNvdXJjZShcInJlc2V0XCIpLmFkZE1ldGhvZChcIlBPU1RcIiwgcmVzZXRMYW1iZGFJbnRlZ3JhdGlvbiwge1xuICAgICAgICAgICAgYXV0aG9yaXphdGlvblR5cGU6IGFwaWd3LkF1dGhvcml6YXRpb25UeXBlLk5PTkUsXG4gICAgICAgICAgICBhcGlLZXlSZXF1aXJlZDogdHJ1ZVxuICAgICAgICB9KTtcblxuICAgICAgICAvLyBaZXVzXG4gICAgICAgIHpldXMuZ3JhbnRJbnZva2UobmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKCdhcGlnYXRld2F5LmFtYXpvbmF3cy5jb20nKSk7XG4gICAgICAgIGNvbnN0IHpldXNMYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBhcGlndy5MYW1iZGFJbnRlZ3JhdGlvbih6ZXVzKTtcbiAgICAgICAgYXBpLnJvb3QuYWRkUmVzb3VyY2UoXCJ6ZXVzXCIpLmFkZE1ldGhvZChcIlBPU1RcIiwgemV1c0xhbWJkYUludGVncmF0aW9uLCB7XG4gICAgICAgICAgICBhdXRob3JpemF0aW9uVHlwZTogYXBpZ3cuQXV0aG9yaXphdGlvblR5cGUuTk9ORSxcbiAgICAgICAgICAgIGFwaUtleVJlcXVpcmVkOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFByaW50IHRoZSBJbnRlZ3JhdGlvbiBpbmZvcm1hdGlvbiBmb3IgdGhlIHVzZXJcbiAgICAgICAgLy8gVGhlIFN0YWdlIFVSSSB3aWxsIGJlIGRpc3BsYXllZCBieSB0aGUgY2RrIHVwb24gY29tcGxldGlvblxuICAgICAgICAvLyBUaGUgQVBJLUtleSB3aGljaCBpcyBuZWVkZWQgYnkgdGhlIHVzZXJzIGlzIGFsc28gcHJpbnRlZCBoZXJlXG4gICAgICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBUEktS2V5JywgeyB2YWx1ZToga2V5VmFsdWUsIGV4cG9ydE5hbWU6IFwiQXBpLUtleVwiIH0pO1xuICAgIH1cbn1cblxuLy8gQ3JlYXRlIHRoZSBTdGFja1xubmV3IFpldXMoYXBwLCBcIlpldXNTdGFja1wiLCB7fSk7XG4vLyAgICBlbnY6IHtyZWdpb246ICdjYS1jZW50cmFsLTEnfSxcbi8vfSk7XG5cbi8vIFRoaXMgY2FsbCBnZW5lcmF0ZXMgdGhlIGNsb3VkRm9ybWF0aW9uIHRlbXBsYXRlcyBhbmQgdGh1cyBpc3N1aW5nICdjZGsgc3ludGgnIGV4dGVybmFsbHkgaXMgbm90IHJlcXVpcmVkXG5hcHAuc3ludGgoKTsiXX0=