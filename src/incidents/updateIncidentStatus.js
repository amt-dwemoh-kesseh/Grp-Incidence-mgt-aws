const AWS = require("aws-sdk");

exports.handler = async (event) => {
  const stepfunctions = new AWS.StepFunctions();
  
  try {
    // Extract user info for authorization
    let updatedBy = "system";
    let userGroups = [];
    
    if (event.requestContext?.authorizer?.claims) {
      updatedBy = event.requestContext.authorizer.claims.sub;
      userGroups = event.requestContext.authorizer.claims['cognito:groups'] || [];
    }

    // Check permissions - only cityAuth and admin can update status
    const canUpdate = userGroups.includes('cityAuth') || userGroups.includes('admin');
    if (!canUpdate) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Insufficient permissions to update incident status" }),
      };
    }

    const incidentId = event.pathParameters.id;
    const body = JSON.parse(event.body);
    
    const validStatuses = ['REPORTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    
    if (!body.status || !validStatuses.includes(body.status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: "Invalid status", 
          validStatuses 
        }),
      };
    }

    // Start Step Functions workflow for status update and notifications
    const params = {
      stateMachineArn: process.env.STATUS_WORKFLOW_ARN,
      input: JSON.stringify({
        incidentId,
        newStatus: body.status,
        updatedBy,
        timestamp: new Date().toISOString(),
        comments: body.comments || null
      })
    };

    const result = await stepfunctions.startExecution(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Status update workflow started",
        executionArn: result.executionArn,
        incidentId,
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
