const { randomUUID } = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const {
  DynamoDBDocumentClient,
  PutCommand,
} = require("@aws-sdk/lib-dynamodb");

let CORS_HEADERS = {
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

// Initialize SDK clients inside handler to avoid cold-start timeout issues
exports.handler = async (event) => {
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const client_origin = headers.origin || "*"; // fallback to '*' if missing

  const UPDATED_SET_HEADERS = {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": client_origin,
  };

  try {
    // Handle preflight CORS
    if (event.httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: UPDATED_SET_HEADERS,
        body: "",
      };
    }

    const dynamo = new DynamoDBClient({
      region: process.env.AWS_REGION || "eu-central-1",
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5000,
        socketTimeout: 5000,
      }),
    });

    const docClient = DynamoDBDocumentClient.from(dynamo);

    const sns = new SNSClient({
      region: process.env.AWS_REGION || "eu-central-1",
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 5000,
        socketTimeout: 5000,
      }),
    });

    // Extract user ID (default for local testing)
    let cognitoUserId;
    let userEmail;

    if (event.requestContext?.authorizer?.claims) {
      cognitoUserId = event.requestContext.authorizer.claims.sub;
      userEmail = event.requestContext.authorizer.claims.email;
    } else if (event.headers?.Authorization || event.headers?.authorization) {
      const authHeader =
        event.headers.Authorization || event.headers.authorization;
      const token = authHeader.replace("Bearer ", "");
      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        cognitoUserId = payload.sub;
        userEmail = payload.email;
      } catch {
        return {
          statusCode: 401,
          headers: UPDATED_SET_HEADERS,
          body: JSON.stringify({ error: "Invalid JWT token" }),
        };
      }
    }

    if (!cognitoUserId) {
      return {
        statusCode: 401,
        headers: UPDATED_SET_HEADERS,
        body: JSON.stringify({ error: "Unauthorized - missing user context" }),
      };
    }

    const body = JSON.parse(event.body);

    if (!body.title || !body.description) {
      return {
        statusCode: 400,
        headers: UPDATED_SET_HEADERS,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    const userId = cognitoUserId;

    let imageUrls = [];
    if (body.imageUrls && Array.isArray(body.imageUrls)) {
      for (const imageUrl of body.imageUrls) {
        if (typeof imageUrl !== "string") {
          return {
            statusCode: 400,
            headers: UPDATED_SET_HEADERS,
            body: JSON.stringify({ error: "Invalid image URL provided" }),
          };
        }
        try {
          new URL(imageUrl);
          imageUrls.push(imageUrl);
        } catch {
          return {
            statusCode: 400,
            headers: UPDATED_SET_HEADERS,
            body: JSON.stringify({ error: "Invalid image URL format" }),
          };
        }
      }
    }

    // Create incident item using crypto.randomUUID()
    const incidentId = randomUUID();

    const incident = {
      incidentId,
      userId,
      title: body.title,
      description: body.description,
      status: "pending",
      severity: body.severity || "medium",
      category: body.category || "general",
      location: body.location || null,
      createdAt: new Date().toISOString(),
      imageUrls,
    };

    if (!process.env.INCIDENT_TABLE) {
      throw new Error("INCIDENT_TABLE environment variable not set");
    }
    await docClient.send(
      new PutCommand({
        TableName: process.env.INCIDENT_TABLE,
        Item: incident,
      })
    );

    if (process.env.INCIDENT_REPORTED_TOPIC) {
      const notificationData = {
        incidentId,
        userId,
        title: body.title,
        category: body.category || "general",
        severity: body.severity || "medium",
        timestamp: new Date().toISOString(),
      };

      try {
        await sns.send(
          new PublishCommand({
            TopicArn: process.env.INCIDENT_REPORTED_TOPIC,
            Message: JSON.stringify(notificationData),
            Subject: `New Incident Reported: ${body.title}`,
            MessageAttributes: {
              incident_id: { DataType: "String", StringValue: incidentId },
              category: {
                DataType: "String",
                StringValue: body.category || "general",
              },
            },
          })
        );
      } catch (snsError) {
        console.error("SNS error:", snsError);
      }
    } else {
      console.warn("INCIDENT_REPORTED_TOPIC not set, skipping SNS publish");
    }

    return {
      statusCode: 201,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({
        message: "Incident created",
        incidentId,
        imageUrls,
      }),
    };
  } catch (error) {
    console.error("Error creating incident:", error);

    let statusCode = 500;
    let errorMessage = error.message || "Something went wrong";

    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      statusCode = 400;
      errorMessage = "Invalid JSON in request body.";
    } else if (
      error.message.includes("TableName") ||
      error.message.includes("Bucket") ||
      error.message.includes("TopicArn")
    ) {
      errorMessage = `Configuration error: ${error.message}`;
    }

    return {
      statusCode,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({
        error: errorMessage,
        details: error.message,
      }),
    };
  }
};
