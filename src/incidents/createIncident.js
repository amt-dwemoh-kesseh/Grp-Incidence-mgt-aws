const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const path = require("path");

exports.handler = async (event) => {
  console.log("Function started");
  
  try {
    // Initialize AWS services inside the handler (lazy initialization)
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const s3 = new AWS.S3();
    const sns = new AWS.SNS();
        
    // Extract user ID from Cognito JWT token
    
    let cognitoUserId = "98999993-UUID-4d3c-8b2f-123456789012"; // Default for local testing
    let userEmail = "3samkus@gmail.com";
    
    // Try to get from authorizer context (production)
    // if (event.requestContext?.authorizer?.claims) {
    //   cognitoUserId = event.requestContext.authorizer.claims.sub;
    //   userEmail = event.requestContext.authorizer.claims.email;
      
    // } 
    // // Fallback: decode JWT from Authorization header (local development)
    // else if (event.headers?.Authorization || event.headers?.authorization) {
    //   const authHeader = event.headers.Authorization || event.headers.authorization;
    //   const token = authHeader.replace('Bearer ', '');
      
    //   try {
    //     // Decode JWT payload (base64 decode the middle part)
    //     const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
       
    //     cognitoUserId = payload.sub;
    //     userEmail = payload.email;
        
    //   } catch (error) {
        
    //     return {
    //       statusCode: 401,
    //       body: JSON.stringify({ error: "Invalid JWT token" }),
    //     };
    //   }
    // }
    
    // if (!cognitoUserId) {
    //   return {
    //     statusCode: 401,
    //     body: JSON.stringify({ error: "Unauthorized - missing user context" }),
    //   };
    // }
    
    

    // Parse and validate input
    const body = JSON.parse(event.body);
    
    if (!body.title || !body.description) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Use authenticated user ID
    const userId = cognitoUserId;

    // Create incident item
    const incidentId = uuidv4();
    const incident = {
      id: incidentId,
      userId,
      title: body.title,
      description: body.description,
      status: "REPORTED",
      createdAt: new Date().toISOString(),
    };
    

    // Save to DynamoDB
    try {
      await dynamo
        .put({
          TableName: process.env.INCIDENT_TABLE,
          Item: incident,
        })
        .promise();
    } catch (dbError) {
      throw dbError;
    }

    // Generate S3 pre-signed URL for attachment (optional)
    let uploadUrl;
    if (body.attachmentFilename) {
      uploadUrl = s3.getSignedUrl("putObject", {
        Bucket: process.env.ATTACHMENT_BUCKET,
        Key: `incidents/${incidentId}/${body.attachmentFilename}`,
        Expires: 300,
      });
    }

    // Publish to SNS
    try {
      await sns
        .publish({
          TopicArn: process.env.INCIDENT_REPORTED_TOPIC,
          Message: JSON.stringify({ incidentId, userId }),
        })
        .promise();
    } catch (snsError) {
      console.error("SNS error:", snsError);

    }

    // Return response
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: "Incident created",
        incidentId,
        uploadUrl,
      }),
    };
  } catch (error) {
    console.error("Error creating incident:", error);

    let statusCode = 500;
    let errorMessage = error.message || "Something went wrong";

    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      statusCode = 400;
      errorMessage = "Invalid JSON in request body.";
    } else if (error.message.includes("TableName") || error.message.includes("Bucket") || error.message.includes("TopicArn")) {
      // This is a generic check, more specific checks could be added if needed
      errorMessage = `Configuration error: ${error.message}`;
    }

    return {
      statusCode: statusCode,
      body: JSON.stringify({
        error: errorMessage,
        details: error.message, // Include error message for debugging
      }),
    };
  }
};
