const AWS = require("aws-sdk");

exports.handler = async (event) => {
  try {
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const s3 = new AWS.S3();

    // Extract user info from Cognito JWT token
    let cognitoUserId = null;
    let userEmail = null;
    let userGroups = [];
    
    if (event.requestContext?.authorizer?.claims) {
      cognitoUserId = event.requestContext.authorizer.claims.sub;
      userEmail = event.requestContext.authorizer.claims.email;
      userGroups = event.requestContext.authorizer.claims['cognito:groups'] || [];
    } else if (event.headers?.Authorization || event.headers?.authorization) {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        cognitoUserId = payload.sub;
        userEmail = payload.email;
        userGroups = payload['cognito:groups'] || [];
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

    // Parse query parameters for filtering user's incidents
    const queryParams = event.queryStringParameters || {};
    const { status, category, limit } = queryParams;

    // Query incidents for authenticated user
    let params = {
      TableName: process.env.INCIDENT_TABLE,
      FilterExpression: "userId = :uid",
      ExpressionAttributeValues: { ":uid": cognitoUserId },
    };

    // Add additional filters
    let filterExpressions = ["userId = :uid"];
    
    if (status) {
      filterExpressions.push("#status = :status");
      params.ExpressionAttributeValues[":status"] = status;
      params.ExpressionAttributeNames = { "#status": "status" };
    }

    if (category) {
      filterExpressions.push("category = :category");
      params.ExpressionAttributeValues[":category"] = category;
    }

    params.FilterExpression = filterExpressions.join(" AND ");

    if (limit) {
      params.Limit = parseInt(limit);
    }
    
    const result = await dynamo.scan(params).promise();

    // Generate download URLs for attachments if they exist
    const incidentsWithDownloadUrls = result.Items.map(incident => {
      if (incident.attachments && incident.attachments.length > 0) {
        incident.attachments = incident.attachments.map(attachment => ({
          ...attachment,
          downloadUrl: s3.getSignedUrl("getObject", {
            Bucket: process.env.ATTACHMENT_BUCKET,
            Key: attachment.key,
            Expires: 3600,
          })
        }));
      }
      return incident;
    });

    // Sort by creation date (newest first)
    incidentsWithDownloadUrls.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      statusCode: 200,
      body: JSON.stringify({
        incidents: incidentsWithDownloadUrls,
        count: incidentsWithDownloadUrls.length,
        user: {
          userId: cognitoUserId,
          email: userEmail,
          groups: userGroups
        },
        filters: { status, category, limit },
        summary: {
          total: incidentsWithDownloadUrls.length,
          byStatus: incidentsWithDownloadUrls.reduce((acc, incident) => {
            acc[incident.status] = (acc[incident.status] || 0) + 1;
            return acc;
          }, {}),
          byCategory: incidentsWithDownloadUrls.reduce((acc, incident) => {
            acc[incident.category] = (acc[incident.category] || 0) + 1;
            return acc;
          }, {})
        }
      }),
    };
  } catch (err) {
    console.error("Error retrieving user incidents:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Something went wrong!",
        details: err.message
      }),
    };
  }
};
