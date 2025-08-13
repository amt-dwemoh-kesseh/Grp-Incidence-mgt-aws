const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    // Skip authorization check for testing

    // Scan DynamoDB for all incidents
    const params = { TableName: process.env.INCIDENT_TABLE };
    const result = await dynamo.scan(params).promise();

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
