import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

// ZeusSite Class creates Access Site in given region
export class ZeusSecurity extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }

    // Create Security Role Based Access on the Database Resources
    createSecurity(mfaEmail : string, account : string, siteRegions : Array<any>) {
        const userTableArns = new Array<string>();
        const sessionTableArns = new Array<string>();
        const identityArns = new Array<string>();
        
        // Build the table arns and identity user arns from region, account and mfaEmail information
        for(let itr = 0; itr < siteRegions.length; itr++) {
            const region = siteRegions[itr].region;
            const userTableArn = "arn:aws:dynamodb:" + region + ":" + account + ":table/users";
            const sessionTableArn = "arn:aws:dynamodb:" + region + ":" + account + ":table/sessions";
            const identityArn = "arn:aws:ses:" + region + ":" + account + ":identity/" + mfaEmail;
            userTableArns.push(userTableArn);
            sessionTableArns.push(sessionTableArn);
            identityArns.push(identityArn);
        }

        // Combine Database Arns into a single array
        const tableArns = userTableArns.concat(sessionTableArns);

        // Login Role
        // Create New IAM Role with Lambda Basic Execution Role
        const loginRoleName = "loginRole";
        const loginRole = new iam.Role(this, loginRoleName, {
            roleName: loginRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Register Role
        // Create New IAM Role with Lambda Basic Execution Role
        const registerRoleName = "registerRole";
        const registerRole = new iam.Role(this, registerRoleName, {
            roleName: registerRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // MFA Role
        // Create New IAM Role with Lambda Basic Execution Role
        const mfaRoleName = "mfaRole";
        const mfaRole = new iam.Role(this, mfaRoleName, {
            roleName: mfaRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Logout Role
        // Create New IAM Role with Lambda Basic Execution Role
        const logoutRoleName = "logoutRole";
        const logoutRole = new iam.Role(this, logoutRoleName, {
            roleName: logoutRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Reset Role
        // Create New IAM Role with Lambda Basic Execution Role
        const resetRoleName = "resetRole";
        const resetRole = new iam.Role(this, resetRoleName, {
            roleName: resetRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Refresh Role
        // Create New IAM Role with Lambda Basic Execution Role       
        const refreshRoleName = "refreshRole";
        const refreshRole = new iam.Role(this, refreshRoleName, {
            roleName: refreshRoleName,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),   // required
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole")
            ]
        });

        // Zeus Role
        // Create New IAM Role with Lambda Basic Execution Role
        const zeusRoleName = "zeusRole";
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
            resources: tableArns
        }));

        // Register
        registerRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:PutItem"],
            resources: userTableArns
        }));

        // MFA (Move to site)
        mfaRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["ses:SendEmail"],
            resources: identityArns
        }));

        // Logout
        logoutRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:DeleteItem"],
            resources: sessionTableArns
        }));

        // Reset
        resetRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:UpdateItem"],
            resources: userTableArns
        }));

        // Refresh
        refreshRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem","dynamodb:Query","dynamodb:UpdateItem"],
            resources: tableArns
        }));

        // Zeus
        zeusRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ["dynamodb:GetItem"],
            resources: userTableArns
        }));
    }
}