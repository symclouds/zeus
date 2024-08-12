import {SESClient,SendEmailCommand} from '@aws-sdk/client-ses'
const ses = new SESClient({ region: "ca-central-1" });

// Main Routine
export const handler = async (event) => {
    console.log(event)
    // Ensure that the request is valid
    if(event.headers !== null && event.headers !== undefined) {
      let userEmail = event.headers["x-user-email"];
      let mfaCode = event.headers["x-mfa-code"];
      let mfaMode = event.headers["x-mfa-mode"]; // 'register | reset'
      let platform = event.headers["x-platform"];
      let body = null;
      let subject = null;
      
      const registerSubject = "Cerberus: Registration Request";
      const registerBody = "\
      <html> \
      <body> \
      Dear Customer,\
      <br>\
      Thank you for registering with Cerberus. For your security, please verify your email address by entering the provided code into your " + platform + " application.\
      <br> <h3>" + mfaCode + "</h3> <br> \
      Thank You!\
      <br>\
      The Cerberus Security Team\
      </body>\
      </html>";
      
      const resetSubject = "Cerberus: Password Reset Request";
      const resetBody = "\
      <html> \
      <body> \
      Dear Customer,\
      <br>\
      We received a password reset request for your account. For your security, please verify your email address by entering the provided code into your " + platform + " application.\
      <br> <h3>" + mfaCode + "</h3> <br> \
      Thank You!\
      <br>\
      The Cerberus Security Team\
      </body>\
      </html>";
      
      if(mfaMode === 'register') {
        body = registerBody;
        subject = registerSubject;
      }
      else if(mfaMode === 'reset') {
        body = resetBody;
        subject = resetSubject;
      }
      else {
        return returnFailure(404);
      }


        // Configure SES Email Parameters
        var params =
            {
                Destination:
                    {
                        ToAddresses: [userEmail],
                    },
                Message:
                    {
                        Body: {
                            Html: {
                                Charset: "UTF-8",
                                Data: body
                            },
                        },
                        Subject: { Data: subject },
                    },
                Source: "iljazi@gmail.com",
            };

        // Attempt to send the email and log success
        try
        {
            //await ses.sendEmail(params).promise();
            const data = await ses.send(new SendEmailCommand(params));
            console.log("E-mail Sent Successfully!");
            const response =
                {
                    "statusCode": 200,
                    "isBase64Encoded": false,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                };
            return response;
        }
            // Catch and throw errors
        catch (e)
        {
            console.log("Failure In Sending E-Mail!", e);
        }
    }
    // Invalid Request from API Gateway
    else
    {
        console.log("Invalid Request from API Gateway");
        const response =
            {
                "statusCode": 404,
                "isBase64Encoded": false,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            };
        return response;
    }
};

function returnFailure(code) {
  const response = {
    "statusCode": code,
    "isBase64Encoded": false,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    Body: "Error: No mfa header specified"
  };
  return response;
}

