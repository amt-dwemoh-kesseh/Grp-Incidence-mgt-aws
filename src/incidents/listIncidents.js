const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand } = require("@aws-sdk/lib-dynamodb");

let CORS_HEADERS = {
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) => {
  // normalize headers first
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const client_origin = headers.origin || "*"; // fallback to '*' if missing

  const UPDATED_SET_HEADERS = {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": client_origin,
  };

  try {
    console.log("Client origin:", client_origin);

    const dynamo = new DynamoDBClient({
      region: process.env.AWS_REGION || "eu-central-1",
      requestHandler:
        new (require("@aws-sdk/node-http-handler").NodeHttpHandler)({
          connectionTimeout: 5000,
          socketTimeout: 5000,
        }),
    });

    const docClient = DynamoDBDocumentClient.from(dynamo);

    // Preflight request
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: UPDATED_SET_HEADERS,
        body: "",
      };
    }

    console.log("Incident table: ", process.env.INCIDENT_TABLE);
    if (!process.env.INCIDENT_TABLE) {
      throw new Error("INCIDENT_TABLE environment variable not set");
    }

    const result = await docClient.send(new ScanCommand({ TableName: process.env.INCIDENT_TABLE }));
    console.log("DynamoDB scan completed, found", result.Items.length, "items");

    return {
      statusCode: 200,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({ incidents: result.Items }),
    };
  } catch (err) {
    console.error("Error retrieving incidents:", err);
    return {
      statusCode: 500,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({ error: "Something went wrong!" }),
    };
  }
};
