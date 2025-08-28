const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const ALLOWED_ORIGINS = [
  "http://localhost:4200",
  "https://dev.d2zgxshg38rb8v.amplifyapp.com",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "http://localhost:4200",
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-central-1",
});


exports.handler = async (event) => {
  try {
    // Configure AWS SDK with region and timeout
    // AWS.config.update({
    //   region: process.env.AWS_REGION || "eu-central-1",
    //   httpOptions: {
    //     timeout: 5000,
    //     connectTimeout: 5000,
    //   },
    // });

    if (event["httpMethod"] == "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: "",
      };
    }

    // const dynamo = new AWS.DynamoDB.DocumentClient();

    // Skip authorization check for testing

    // Scan DynamoDB for all incidents
    if (!process.env.INCIDENT_TABLE) {
      throw new Error("INCIDENT_TABLE environment variable not set");
    }
    
    const params = { TableName: process.env.INCIDENT_TABLE };
    
    const result = await client.send(new ScanCommand(params));
    console.log("DynamoDB scan completed, found", result.Items.length, "items");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ incidents: result.Items }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Something went wrong!" }),
    };
  }
};
