const AWS = require('aws-sdk');

exports.handler = async (event) => {
  const stepfunctions = new AWS.StepFunctions();
  
  try {
    const { incidentId, newStatus, updatedBy } = JSON.parse(event.body);
    
    if (!incidentId || !newStatus || !updatedBy) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: incidentId, newStatus, updatedBy' })
      };
    }

    const params = {
      stateMachineArn: process.env.STATUS_WORKFLOW_ARN,
      input: JSON.stringify({
        incidentId,
        newStatus,
        updatedBy,
        timestamp: new Date().toISOString()
      })
    };

    const result = await stepfunctions.startExecution(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Status update workflow started',
        executionArn: result.executionArn
      })
    };
  } catch (error) {
    console.error('Error starting workflow:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};