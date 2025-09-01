const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const ALLOWED_ORIGINS = [
  "http://localhost:4200",
  "https://dev.d2zgxshg38rb8v.amplifyapp.com",
];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.join(", "),
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) => {
  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || "eu-central-1",
      requestHandler:
        new (require("@aws-sdk/node-http-handler").NodeHttpHandler)({
          connectionTimeout: 5000,
          socketTimeout: 5000,
        }),
    });

    // If preflight CORS request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: "",
      };
    }
    console.log("Incident table: ", process.env.INCIDENT_TABLE);
    // Ensure INCIDENT_TABLE is set
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
    console.error("Error retrieving incidents:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Something went wrong!" }),
    };
  }
};
