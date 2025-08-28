const AWS = require("aws-sdk");



exports.handler = async (event) => {
  try {
    // Configure AWS SDK with region and timeout
    AWS.config.update({
      region: process.env.AWS_REGION || "us-east-1",
      httpOptions: {
        timeout: 5000,
        connectTimeout: 5000,
      },
    });
    

    const dynamo = new AWS.DynamoDB.DocumentClient();

    // Skip authorization check for testing

    // Scan DynamoDB for all incidents
    if (!process.env.INCIDENT_TABLE) {
      throw new Error("INCIDENT_TABLE environment variable not set");
    }

    const params = { TableName: process.env.INCIDENT_TABLE };

    const result = await dynamo.scan(params).promise();
    console.log("DynamoDB scan completed, found", result.Items.length, "items");

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS"
      },
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
