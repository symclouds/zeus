import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { RemovalPolicy } from 'aws-cdk-lib'
import { Hash } from 'crypto';

export class ZeusDatabase extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }
  
    createDatabase(totalSites : any, siteRegions : Array<any>) {
        if(totalSites > 1) {
            // Create DynamoDB Tables
            const users = new dynamodb.CfnGlobalTable(this, "usersTable", {
                tableName: "users",
                attributeDefinitions: [{
                    attributeName: 'email',
                    attributeType: dynamodb.AttributeType.STRING,
                }],
                keySchema: [{
                    attributeName: 'email',
                    keyType: 'HASH',
                }],
                replicas: siteRegions,
                billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                streamSpecification: {
                    streamViewType: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
                },
            });

            const sessions = new dynamodb.CfnGlobalTable(this, "sessionsTable", {
                tableName: "sessions",
                attributeDefinitions: [{
                    attributeName: 'email',
                    attributeType: dynamodb.AttributeType.STRING,
                },
                {
                    attributeName: 's_id',
                    attributeType: dynamodb.AttributeType.STRING,
                }],
                keySchema: [{
                    attributeName: 'email',
                    keyType: 'HASH',
                },
                {
                    attributeName: 's_id',
                    keyType: 'RANGE',
                }],
                replicas: siteRegions, //[{ region: 'us-east-1'}, {region: 'us-east-2'}],
                billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
                streamSpecification: {
                    streamViewType: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES
                },
                timeToLiveSpecification: {
                    enabled: true,
                    attributeName: "expires"
                }
            });
        }
        else {
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
        }
    }
}