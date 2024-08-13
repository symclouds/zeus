import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
const dynamoClient = new DynamoDBClient();

const usersTable = "users";

// Insert entry into the sessions table with expiry!
async function updateUserUnconditional(email, password) {
  const updateParams = {
    TableName: usersTable,
    Key: {
      email : { S : email},
    },
    "UpdateExpression": "SET password = :value",
    "ExpressionAttributeValues": {
      ":value": {
        "S": password
      }
    },
    ReturnValues:"UPDATED_NEW"
  };
  
  try {
    await dynamoClient.send(new UpdateItemCommand(updateParams));
    console.log("Successfully updated the users password.");
    return true;
  }
  catch(error) {
    console.log("Something went wrong updating password for user: " + email + " Error: " + error);
  }
  return false;
}

function sendSuccess() {
  let res =  {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  };
  return res;
}

function sendServerError() {
  let res =  {
    statusCode: 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: 'Failed to update password'
  };
  return res;
}

export const handler = async (event) => {
  const authenticationUser = event.headers['Authorization'];
  
  // Structure of Authorization Basic is: 'Basic <base64 encoded string>'
  const authString = authenticationUser.split(' ');
  
  // Extract the username and password from the Authorization Header
  // Base64 Decode the Authorization Header to string
  var input = Buffer.from(authString[1], 'base64').toString();
  
  // Split out the email and password
  var authorization = input.split(":");
  const email = authorization[0];
  const password = authorization[1];
  
  // Write the password to the database
  const response = await updateUserUnconditional(email, password);
  if(response)
    return sendSuccess();
  else
    return sendServerError() ;
};

