#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as logs from 'aws-cdk-lib/aws-logs'
import { ZeusDatabase } from '../lib/zeus/storage';
import { ZeusSecurity } from '../lib/zeus/security';
import { ZeusSite } from '../lib/zeus/site';
import { AgentSite } from '../lib/agent/site';
import { AgentSecurity } from '../lib/agent/security';

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

// Get the user email and logretention period required by SES and Lambda Log Groups 
const mfaEmail = app.node.tryGetContext('mfaEmail');
const logRetentionPeriod = app.node.tryGetContext('logRetentionPeriod');
const accessTokenDuration = app.node.tryGetContext('accessTokenDuration');
const refreshTokenDuration = app.node.tryGetContext('refreshTokenDuration');
const maxSessions = app.node.tryGetContext('maxSessions').toString();
const account = app.node.tryGetContext('account').toString();
const defaultRegion = app.node.tryGetContext('defaultRegion').toString();
const totalSites = app.node.tryGetContext('totalSites').toString();
const siteRegions = app.node.tryGetContext('siteRegions');
const systemID = app.node.tryGetContext('systemID').toString();
const product = app.node.tryGetContext('product');
const email = app.node.tryGetContext('email');
const tier = app.node.tryGetContext('tier');
const functions = app.node.tryGetContext('functions');
const chksums = app.node.tryGetContext('chksums');


// Create the Databases for Zeus Authentication/Authorization System
const db = new ZeusDatabase(app, "ZeusDatabase", {});
db.createDatabase(totalSites, siteRegions);

// Create the Security Roles for Zeus Authentication/Authorization System
let security = new ZeusSecurity(app, "ZeusSecurity", {});
security.createSecurity(mfaEmail, account, siteRegions);

// Flatten out the regions list: e.g. [ "us-east-1", "us-east-2", "us-west-1" ]
const siteRegionsFlat = siteRegions.map((region:any) => region.region);

// Create Zeus Access Sites specified in the hades.json configuration 
// Creates copies to different regions
for(let itr = 0; itr < siteRegionsFlat.length; itr++) {
    const StackSuffix = itr+1;
    // Create a new Zeus Access Site at the specified region
    const site = new ZeusSite(app, "ZeusAccessSite" + StackSuffix, {
      env: {
        region: siteRegionsFlat[itr]
      },
      mfaEmail: mfaEmail,
      accessTokenDuration: accessTokenDuration,
      refreshTokenDuration: refreshTokenDuration,
      maxSessions: maxSessions,
      logRetentionPeriod: logRetentionPeriod,
      systemID: systemID,
      chksums: chksums,
      product: product,
      region: siteRegionsFlat[itr],
      account: account
    });
    site.addDependency(security);
}

// Create the Zeus Agent Lambda Role
let agentSecurity = new AgentSecurity(app, "AgentSecurity", {})
agentSecurity.createSecurity(product, functions, siteRegionsFlat);

// Create the Zeus Agent Site at each region
for(let itr = 0; itr < siteRegionsFlat.length; itr++) {
  const StackSuffix = itr+1;
  const agentSite = new AgentSite(app, "ZeusAgentSite" + StackSuffix, {
    env: {
      region: siteRegionsFlat[itr]
    },
    logRetentionPeriod: logRetentionPeriod,
    tier: tier,
    email: email,
    product: product,
    region: siteRegionsFlat[itr],
    account: account,
    systemID: systemID,
    functions: functions,
    chksums: chksums
  });
  agentSite.addDependency(agentSecurity);
}

app.synth();