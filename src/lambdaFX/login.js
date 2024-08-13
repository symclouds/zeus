import { DynamoDBClient, PutItemCommand, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
const dynamoClient = new DynamoDBClient();
import jwt from 'jsonwebtoken';

// DynamoDB Table Names
const usersTable = "users";
const sessionTable = "sessions";

// Get Entry from dynamoDB Table
async function  getItem(email, table) {
  const readParams = {
    TableName : table,
    Key: {
      email: { S: email},
    },
  };
  return await dynamoClient.send(new GetItemCommand(readParams));
}

// Insert entry into the sessions table with expiry!
async function insertDynamoSessionUnconditional(email, session, expires) {
  const writeParams = {
    TableName : "sessions",
    Item: {
      email : { S : email},
      session: { S : session},
      expires : { N : `${expires}`}
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

function isSessionActive(currTime, expiredTime) {
  if(currTime > expiredTime)
    return false;
  else
    return true;
}

function returnAuthenticationError() {
  let res =  {
    statusCode: 404,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: 'Check username or password'
  };
  return res;
}

function returnSessionActiveError() {
  let res =  {
    statusCode: 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: 'Another session active'
  };
  return res;
}

function sendSuccess(token) {
  let res =  {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: token
  };
  return res;
}

function generateAccessToken(email, currTime, password) {
  const payload = {
    iss: "Symmetry Cloud Solutions",
    iat: currTime,
    exp: currTime + 10800, // Expires every 3 hours
    aud: "symmetry.com",
    sub: "Subject: Cerberus|Hades",
    email: "iljazi@gmail.com"
  };
  // Generate signed Tokens with given claims
  var token = jwt.sign(payload, password, { algorithm: 'HS256' });
  return token;
  /* // Verify Token for Authorization Function!
  var decoded = jwt.verify(token, password, { algorithm: 'HS256' });
  console.log(decoded) // bar
  */
}

// Main Function
export const handler = async (event) => {
  const email = event.headers['x-user-email'];
  const sessionId = event.headers['x-session-id'];
  const authenticationUser = event.headers['Authorization'];
  let currTime = Math.floor(new Date().getTime() / 1000);
  let response = null;
  
  // Get the password from the DB:
  try {
    response = await getItem(email, usersTable);
  }
  catch(e) {
    // User not found of other error 403
    // Exit here ...
    console.log(e)
    return returnAuthenticationError();
  }

  // User Found in the DB
  if(response != null) {
    // Build Authorization String
    const password = unmarshall(response.Item).password;
    const plainCredential = `${email}:${password}`;
    const bearerToken = Buffer.from(plainCredential).toString('base64');
    const authenticationServer = 'Basic ' + bearerToken;
    response = null;
    
    // Authentication Failure
    if(authenticationUser !== authenticationServer) {
      // Return 403 right away dont check session
      return returnAuthenticationError();
    }
    // Authentication Success: Check the Session
    else {
      let response = null;
      // Session Exists
      try {
        response = await getItem(email, sessionTable);
        const session = unmarshall(response.Item).session;
        const expireTimer = unmarshall(response.Item).expires;
        
        // If session active but not this device return 403 (cant replace session even on successful auth, but dont refresh timer)
        if(isSessionActive(currTime, expireTimer) && (session !== sessionId)) {
            // Dont replace session
            // Return 403 another active session already live
            return returnSessionActiveError();
        }
      }
      // Session Doesn't Exist
      catch(e) {
        // No Session exists
        console.log("No session found: " + e);
      }
        
      // Replace or add new session here!
      const status = await insertDynamoSessionUnconditional(email, sessionId, currTime+3600);
      console.log("Successfully set session: " + status);
    }
    
    // Send back an authorization token: JWT
    const token = generateAccessToken(email, currTime, password);
    return sendSuccess(token);
      
  }
  else {
    return returnAuthenticationError();
  }
};


/*
2. SignIn User (GET, returns a body: token): x-login-action:(Token Refresh done trhough another function!) ‘login | refresh’ if refresh is selected they may send a JWT token, password never stored on disk
	-User sends Authorization: Barer Base64(email:SHA256(password)) to server. User also sends App ID UUID (Session id) to the server. Server first reads the 		“Sessions” table for this user email to determine if this user has and active session!
		-User has no active sessions (sign in)
		-User has an active session on this device ID (sign in)
		-User has an expired session on another device ID (sign in)
		-User has an active session on another device ID (reject)
	-Once the session is verified the user can sign in. Server reads the Users table to retrieve user password. 
		-Server calculates Base64(email:SHA256(password)) if matches Authorization Header (Success) else (Failure)
			-On Success (Generate JWT Access Token for the Client), Update the Session Table with this session till token expiry (3 hours), return token to client
			-On Failure send back a 403 Authentication Failure, Leave Session Table Alone. 
	-If new device or new app is detected consider generating pin code and sending user email with it. 
	-On success sign in client loads mfa screen for code, codes compared. 
*/
