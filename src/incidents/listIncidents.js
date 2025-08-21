const AWS = require("aws-sdk");

exports.handler = async (event) => {
  try {
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const s3 = new AWS.S3();

    // Extract user info from Cognito JWT token
    let cognitoUserId = null;
    let userGroups = [];
    
    if (event.requestContext?.authorizer?.claims) {
      cognitoUserId = event.requestContext.authorizer.claims.sub;
      userGroups = event.requestContext.authorizer.claims['cognito:groups'] || [];
    } else if (event.headers?.Authorization || event.headers?.authorization) {
      const authHeader = event.headers.Authorization || event.headers.authorization;
      const token = authHeader.replace('Bearer ', '');
      
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        cognitoUserId = payload.sub;
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

    // Check if user has permission to view all incidents (cityAuth or admin)
    const canViewAll = userGroups.includes('cityAuth') || userGroups.includes('admin');
    
    if (!canViewAll) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Insufficient permissions to view all incidents" }),
      };
    }

    // Parse query parameters for filtering
    const queryParams = event.queryStringParameters || {};
    const { status, category, priority, limit, sortBy } = queryParams;

    // Build scan parameters
    let params = { TableName: process.env.INCIDENT_TABLE };
    let filterExpressions = [];
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};

    if (status) {
      filterExpressions.push("#status = :status");
      expressionAttributeValues[":status"] = status;
      expressionAttributeNames["#status"] = "status";
    }

    if (category) {
      filterExpressions.push("category = :category");
      expressionAttributeValues[":category"] = category;
    }

    if (priority) {
      filterExpressions.push("priority = :priority");
      expressionAttributeValues[":priority"] = priority;
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(" AND ");
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (limit) {
      params.Limit = parseInt(limit);
    }

    const result = await dynamo.scan(params).promise();

    // Generate download URLs for attachments
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

    // Sort incidents
    const sortField = sortBy || 'createdAt';
    incidentsWithDownloadUrls.sort((a, b) => {
      if (sortField === 'priority') {
        const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      }
      return new Date(b[sortField]) - new Date(a[sortField]);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        incidents: incidentsWithDownloadUrls,
        count: incidentsWithDownloadUrls.length,
        filters: { status, category, priority, limit, sortBy },
        userRole: userGroups,
        availableCategories: ['INFRASTRUCTURE', 'UTILITIES', 'SAFETY', 'ENVIRONMENT', 'TRANSPORTATION', 'PUBLIC_SERVICES', 'OTHER'],
        availableStatuses: ['QUEUED', 'REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] 
      }),
    };
  } catch (err) {
    console.error("Error retrieving incidents:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Something went wrong!",
        details: err.message
      }),
    };
  }
};
