// A simple token-based authorizer example to demonstrate how to use an authorization token 
// to allow or deny a request. In this example, the caller named 'user' is allowed to invoke 
// a request if the client-supplied token value is 'allow'. The caller is not allowed to invoke 
// the request if the token value is 'deny'. If the token value is 'unauthorized' or an empty
// string, the authorizer function returns an HTTP 401 status code. For any other token value, 
// the authorizer returns an HTTP 500 status code. 
// Note that token values are case-sensitive.
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
const dynamoClient = new DynamoDBClient();
import { decomposeUnverifiedJwt } from "aws-jwt-verify/jwt";
import jwt from "jsonwebtoken";

const usersTable = "users";

// Get Entry from dynamoDB Table
async function getItem(email, table) {
  const readParams = {
    TableName : table,
    Key: {
      email: { S: email},
    },
  };
  return await dynamoClient.send(new GetItemCommand(readParams));
}

export const handler = async function(event, context, callback) {
    console.log("Zeus authorizer being invoked");
    var token = event.authorizationToken;
    let decision = null;
    let response = null;
    
    // Get Email Address from the Header
    const { payload } = decomposeUnverifiedJwt(token);
    const jwtEmailAddress = payload.email;
    console.log("The email address in token is: " + jwtEmailAddress);
    
    // Get password hash from DynamoDB Table using the jwtEmailAddress
    // If the user is not found then we simply 'deny'
    // Otherwise we validate the token 
    try {
        response = await getItem(jwtEmailAddress, usersTable);
        const password = unmarshall(response.Item).password;
        try {
            const decode = jwt.verify(token, password);
            decision = 'allow';
        }
        catch(error) {
            console.log("Error in jwt verification: " + error);
            decision = 'deny';
        }
    }
    catch(error) {
        console.log("Failed to retrieve the users credentials: " + error);
        decision = 'deny';
    }
    
    console.log("Decision is: " + decision);
    
    switch (decision) {
        case 'allow':
            callback(null, generatePolicy('user', 'Allow', event.methodArn));
            break;
        case 'deny':
            callback(null, generatePolicy('user', 'Deny', event.methodArn));
            break;
        case 'unauthorized':
            callback("Unauthorized");   // Return a 401 Unauthorized response
            break;
        default:
            callback("Error: Invalid token"); // Return a 500 Invalid token response
    }
};

// Help function to generate an IAM policy
var generatePolicy = function(principalId, effect, resource) {
    var authResponse = {};
    
    authResponse.principalId = principalId;
    if (effect && resource) {
        var policyDocument = {};
        policyDocument.Version = '2012-10-17'; 
        policyDocument.Statement = [];
        var statementOne = {};
        statementOne.Action = 'execute-api:Invoke'; 
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    // Optional output with custom properties of the String, Number or Boolean type
    // This context is sent to the target function from API gateway!
    authResponse.context = {
        "stringKey": "stringval",
        "numberKey": 123,
        "booleanKey": true
    };
    return authResponse;
};
