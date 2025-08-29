const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
  try {
    // Extract user info for authorization
    let updatedBy = "system";
    let userGroups = [];
    
    // For local testing, skip auth
    if (event.requestContext?.authorizer?.claims) {
      updatedBy = event.requestContext.authorizer.claims.sub;
      userGroups = event.requestContext.authorizer.claims['cognito:groups'] || [];
      
      // Check permissions - only cityAuth and admin can update status
      const canUpdate = userGroups.includes('cityAuth') || userGroups.includes('admin');
      if (!canUpdate) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Insufficient permissions to update incident status" }),
        };
      }
    }

    const incidentId = event.pathParameters.id;
    const body = JSON.parse(event.body);
    
    const validStatuses = ['pending', 'in-progress', 'under-review', 'resolved', 'closed', 'rejected'];
    
    if (!body.status || !validStatuses.includes(body.status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: "Invalid status", 
          validStatuses 
        }),
      };
    }

    // Get current incident to capture previous status
    const currentIncident = await dynamo.get({
      TableName: process.env.INCIDENT_TABLE,
      Key: { incidentId: incidentId }
    }).promise();
    
    if (!currentIncident.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Incident not found" }),
      };
    }
    
    const previousStatus = currentIncident.Item.status;
    
    // Update incident status in DynamoDB
    const updateParams = {
      TableName: process.env.INCIDENT_TABLE,
      Key: { incidentId: incidentId },
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt, updatedBy = :updatedBy",
      ExpressionAttributeNames: {
        "#status": "status"
      },
      ExpressionAttributeValues: {
        ":status": body.status,
        ":updatedAt": new Date().toISOString(),
        ":updatedBy": updatedBy
      },
      ReturnValues: "ALL_NEW"
    };
    
    if (body.comments) {
      updateParams.UpdateExpression += ", comments = :comments";
      updateParams.ExpressionAttributeValues[":comments"] = body.comments;
    }
    
    const updateResult = await dynamo.update(updateParams).promise();
    
    // Publish status update notification to SNS
    const notificationData = {
      incidentId,
      newStatus: body.status,
      previousStatus,
      updatedBy,
      comments: body.comments || null,
      timestamp: new Date().toISOString()
    };
    
    await sns.publish({
      TopicArn: process.env.STATUS_UPDATED_TOPIC,
      Message: JSON.stringify(notificationData),
      Subject: `Incident Status Updated: ${incidentId}`
    }).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Incident status updated successfully",
        incident: updateResult.Attributes,
        previousStatus,
        newStatus: body.status
      }),
    };
  } catch (err) {
    console.error("Error updating incident status:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Something went wrong!",
        details: err.message 
      }),
    };
  }
};
