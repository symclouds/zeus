import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const usersTable = "sessions";

function returnError() {
  let res =  {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: 'Session not found'
  };
  return res;
}

function sendSuccess() {
  let res =  {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
  };
  return res;
}

export const handler = async (event) => {
  console.log("Server side logout is being called");
  const email = event.headers['x-user-email'];
  
  const command = {
    TableName: usersTable,
    Key: {
      email: email,
    }
  };
  
  try {
    await docClient.send(new DeleteCommand(command));
    console.log("Successfuly deleted current active session.");
    return sendSuccess();
  }
  catch(e) {
    console.log("Error during session delete: " + e);
  }
  return returnError();
};
