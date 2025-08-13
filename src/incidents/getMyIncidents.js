const AWS = require("aws-sdk");

exports.handler = async (event) => {
  try {
    // Initialize AWS services (lazy initialization)
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const s3 = new AWS.S3();

    // Extract user ID from Cognito JWT token (same logic as createIncident)
    let cognitoUserId = null;
    
    if (event.requestContext?.authorizer?.claims) {
      cognitoUserId = event.requestContext.authorizer.claims.sub;
    } else if (event.headers?.Authorization || event.headers?.authorization) {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        cognitoUserId = payload.sub;
      } catch (error) {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid JWT token" }),
        };
      }
    }
    
    if (!cognitoUserId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized - missing user context" }),
      };
    }

    // Query incidents for authenticated user
    const params = {
      TableName: process.env.INCIDENT_TABLE,
      FilterExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": cognitoUserId },
    };
    
    const result = await dynamo.scan(params).promise();

    // Generate download URLs for attachments
    const incidentsWithDownloadUrls = result.Items.map(incident => {
      if (incident.attachments && incident.attachments.length > 0) {
        incident.attachments = incident.attachments.map(attachment => ({
          ...attachment,
          downloadUrl: s3.getSignedUrl("getObject", {
            Bucket: process.env.ATTACHMENT_BUCKET,
            Key: attachment.key,
            Expires: 3600, // 1 hour expiry for download URLs
          })
        }));
      }
      return incident;
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        incidents: incidentsWithDownloadUrls,
        count: incidentsWithDownloadUrls.length
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong!" }),
    };
  }
};
