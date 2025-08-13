const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    // Get userId from query parameters or return all incidents for testing
    const userId = event.queryStringParameters?.userId;
    
    let params;
    if (userId) {
      // Query by specific user
      params = {
        TableName: process.env.INCIDENT_TABLE,
        IndexName: "userId-index", // You need to create this GSI in DynamoDB
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      };
    } else {
      // Scan all incidents for testing
      params = {
        TableName: process.env.INCIDENT_TABLE,
      };
    }
    const result = userId 
      ? await dynamo.query(params).promise()
      : await dynamo.scan(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify({ incidents: result.Items }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong!" }),
    };
  }
};
