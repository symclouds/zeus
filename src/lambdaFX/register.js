import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
const dynamoClient = new DynamoDBClient();

async function  readDynamoSession(email) {
    const readParams = {
        TableName : "Sessions",
        Key: {
            email: { S: email},
        },
    };
    return await dynamoClient.send(new GetItemCommand(readParams));
}

async function insertDynamoUsersConditional(email, password) {
    const writeParams = {
        TableName : "users",
        Item: {
            email: { S : email},
            password: { S : password}
        },
        ConditionExpression: 'attribute_not_exists(email)'
    };
    
    try {
        await dynamoClient.send(new PutItemCommand(writeParams));
        return true;
    }
    catch(error) {
        console.log("Got Exception: " + error.name + error);
    }
    return false;
}

async function insertDynamoUsersUnconditional(email, password) {
    const writeParams = {
        TableName : "users",
        Item: {
            email : { S : email},
            appId: { S : password}
        }
    };
    
    try {
        await dynamoClient.send(new PutItemCommand(writeParams));
        return true;
    }
    catch(error) {
        console.log("Something went wrong replacing session infromation for user: " + email + " Error: " + error);
    }
    return false;
}

function getSuccess() {
    let res =  {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    };
    return res;
}

function getError() {
    let res =  {
        statusCode: 404,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    };
    return res;
}

function getInternalError() {
        let res =  {
        statusCode: 500,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    };
    return res;
}

export const handler = async (event) => {
    const authenticationUser = event.headers['Authorization'];
    //const client = event.headers['x-zeus-client'];
    //const license = event.headers['x-zeus-license'];
  
    // Structure of Authorization Basic is: 'Basic <base64 encoded string>'
    const authString = authenticationUser.split(' ');
  
    // Extract the username and password from the Authorization Header
    // Base64 Decode the Authorization Header to string
    var input = Buffer.from(authString[1], 'base64').toString();
  
    // Split out the email and password
    var authorization = input.split(":");
    const email = authorization[0];
    const password = authorization[1];
    let status = null;
    
    // Check License and get the user count from the DB
    //if(client === 'web') {
    //    console.log("Checking user count in the DB");
    //}
    
    try {
        status = await insertDynamoUsersConditional(email, password);
        if(status) {
            console.log("Successfully registered user. ");
            return getSuccess();
        }
        else {
            console.log("User already exists.");
            return getError(); 
        }
    }
    catch(e) {
        console.log("Failed to register the user: Dynamo Update Failure: " + e);
    }
    
    return getInternalError();
};

