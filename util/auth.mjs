import Utf8 from 'crypto-js/enc-utf8.js';
import SHA256 from 'crypto-js/sha256.js';
import Base64 from 'crypto-js/enc-base64.js';
import { v4 as uuidv4 } from 'uuid';

const APP         = 'themis';
const MAGIC       = "0a0bf5e9e7b3151db6a85451d471de72c8ea577b91d316d4ff33d37535c223b2";
const themis_URL  = 'https://iuuvobk4sh.execute-api.us-east-1.amazonaws.com/themis/';
const themis_KEY  = 'kvUvg2NTAs7nM6FV7Jhvs4QBAq0SxRY119huQRTy';
const zeus_URL    = 'https://9gjmljn9kl.execute-api.us-east-1.amazonaws.com/zeus/';
const zeus_KEY    = '2MfJT2veCsdEWETeHTcf6bDNQUZXNDWhoVidj2Ff';

// Register the agent user with Themis
export async function register (email)  {
    const grant = '["license", "product"]';
    // Get the user grants and base64 encode
    const grants = Base64.stringify(Utf8.parse(grant));
  
    // Generate random session id:
    const user = email + "_agent";
    const shaPassword = SHA256(user + ":" + MAGIC).toString();
  
    //const shaPassword = SHA256(password).toString();
    const plainCredential = `${user}:${shaPassword}`;
    const base64Credentials = Base64.stringify(Utf8.parse(plainCredential));
    const basicAuth = 'Basic ' + base64Credentials;
    try {
        const response = await fetch(zeus_URL + "register", {
            method: 'POST',
            headers: {
                'Accept': 'application/octet-stream',
                'Content-Type': 'application/json',
                'x-user-grants' : grants,
                'x-api-key': zeus_KEY,
                'Authorization': basicAuth
            },
        });
        return response;
    }
    catch(error) {
        throw error;
    }
}

// Login to Themis in order to obtain product license: <prod only>
export async function login (email, product) {
    // Generate random session id:
    const user = email + "_agent";
    const shaPassword = SHA256(user + ":" + MAGIC).toString();
    const sessionID = uuidv4();
    try {
        const plainCredential = `${user}:${shaPassword}`;
        const base64Credentials = Base64.stringify(Utf8.parse(plainCredential));
        const basicAuth = 'Basic ' + base64Credentials;
        const response = await fetch(zeus_URL + "login", {
            method: 'POST',
            headers: {
                'Accept': 'application/octet-stream',
                'Content-Type': 'application/json',
                'x-user-email': user,
                'x-app-name': product,
                'x-session-id': sessionID,
                'x-api-key': zeus_KEY,
                'Authorization': basicAuth
            },
        });
        // Response contains JSON: {accessToken, refreshToken}
        if(response.ok) {
            const base64Tokens = await response.text();
            const tokens = JSON.parse(Utf8.stringify(Base64.parse(base64Tokens)));
            return tokens.access;
        }
    }
    catch(error) {
        throw error;
    }
    return false;
};

// Login to Themis in order to obtain product license: <prod only>
export async function createProduct(email, product, account, systemID, tier, token) {
    const user = email; //+ "_agent";
    try {
        const response = await fetch(themis_URL + "product", {
            method: 'POST',
            headers: {
                'Accept': 'application/octet-stream',
                'Content-Type': 'application/json',
                'x-user-email': user,
                'x-product-name' : product,
                'x-account-id': account,
                'x-system-id': systemID,
                'x-product-tier': tier,
                'x-api-key': themis_KEY,
                'Authorization': token
            },
        });
        return response;
    }
    catch(error) {
        throw error;
    }
};

// Login to Themis in order to obtain product license: <prod only>
export async function getLicense(email, product, account, region, token) {
    const user = email; //+ "_agent";
    try {
        const response = await fetch(themis_URL + "license", {
            method: 'GET',
            headers: {
                'Accept': 'application/octet-stream',
                'Content-Type': 'application/json',
                'x-user-email': user,
                'x-product-name' : product,
                'x-account-id': account,
                'x-request-region': region,
                'x-api-key': themis_KEY,
                'Authorization': token
            },
        });
        if(response.ok) {
            const license = await response.text();
            return license;
        }
    }
    catch(error) {
        throw error
    }
    return false;
};

export async function addFreeTierProduct(email, product, account, sysID, tier) {
    let token = null;
    let err = null;
    let id = null;
    try {
        const ret = await register(email);
        const message = await ret.text();
        // Registration success, so log the user in
        if(ret.ok || message === 'User already exists') {
            try {
                token = await login(email, product);
                try {
                    const response = await createProduct(email, product, account, sysID, tier, token);
                    const message = await response.text();
                    if(response.ok || (!response.ok && message.includes("Product Already Exists"))) {
                        id = message.split(":")[1];
                    }
                    else
                        err = "Error Creating Product: Product (" + product + ") for user=" + email + " on account=" + account;
                }
                catch(error) {
                    err = "Error Loging in the user = " + email + " Error=" + error;
                }
            }
            catch(error) {
                err = "Error Loging in the user = " + email + " Error=" + error;
            }
        }
    }
    catch(error) {
        err = "Error Registering the user = " + email + " Error=" + error;
    }

    // Build the return json
    return {
        err: err,
        id: id
    }
}