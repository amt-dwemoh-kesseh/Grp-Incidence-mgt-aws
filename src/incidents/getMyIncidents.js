const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) => {
  try {
     let client_origin = event.headers.Origin || event.headers.origin;

    const UPDATED_SET_HEADERS = {
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": client_origin,
    };
    // DynamoDB DocumentClient (auto-marshals JS <-> DynamoDB)
    const dynamo = DynamoDBDocumentClient.from(
      new DynamoDBClient({
        region: process.env.AWS_REGION || "eu-central-1",
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 5000,
          socketTimeout: 5000,
        }),
      })
    );

    const s3 = new S3Client({
      region: process.env.AWS_REGION || "eu-central-1",
    });

    // Handle preflight CORS
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: CORS_HEADERS, body: "" };
    }

    // --- Extract Cognito user ---
    let cognitoUserId = null;
    let userEmail = null;
    let userGroups = [];

    if (event.requestContext?.authorizer?.claims) {
      cognitoUserId = event.requestContext.authorizer.claims.sub;
      userEmail = event.requestContext.authorizer.claims.email;
      userGroups =
        event.requestContext.authorizer.claims["cognito:groups"] || [];
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
        userGroups = payload["cognito:groups"] || [];
      } catch {
        return {
          statusCode: 401,
          body: JSON.stringify({ error: "Invalid JWT token" }),
        };
      }
    }

    if (!cognitoUserId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized - missing user context" }),
      };
    }

    // --- Build scan params ---
    const queryParams = event.queryStringParameters || {};
    const { status, category, limit } = queryParams;

    let filterExpressions = ["userId = :uid"];
    let expressionValues = { ":uid": cognitoUserId };
    let expressionNames = undefined;

    if (status) {
      filterExpressions.push("#status = :status");
      expressionValues[":status"] = status;
      expressionNames = { "#status": "status" };
    }
    if (category) {
      filterExpressions.push("category = :category");
      expressionValues[":category"] = category;
    }
    console.log("Incident table: ", process.env.INCIDENT_TABLE);
    const scanParams = {
      TableName: process.env.INCIDENT_TABLE,
      FilterExpression: filterExpressions.join(" AND "),
      ExpressionAttributeValues: expressionValues,
      ...(expressionNames && { ExpressionAttributeNames: expressionNames }),
      ...(limit && { Limit: parseInt(limit) }),
    };

    // --- Execute scan ---
    const result = await dynamo.send(new ScanCommand(scanParams));
    const incidents = result.Items || [];

    // --- Add signed URLs for attachments ---
    for (const incident of incidents) {
      if (incident.attachments && Array.isArray(incident.attachments)) {
        incident.attachments = await Promise.all(
          incident.attachments.map(async (att) => {
            const url = await getSignedUrl(
              s3,
              new GetObjectCommand({
                Bucket: process.env.ATTACHMENT_BUCKET,
                Key: att.key,
              }),
              { expiresIn: 3600 }
            );
            return { ...att, downloadUrl: url };
          })
        );
      }
    }

    // --- Sort newest first ---
    incidents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // --- Build summary ---
    const summary = {
      total: incidents.length,
      byStatus: incidents.reduce((acc, i) => {
        acc[i.status] = (acc[i.status] || 0) + 1;
        return acc;
      }, {}),
      byCategory: incidents.reduce((acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + 1;
        return acc;
      }, {}),
    };

    return {
      statusCode: 200,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({
        incidents,
        count: incidents.length,
        user: { userId: cognitoUserId, email: userEmail, groups: userGroups },
        filters: { status, category, limit },
        summary,
      }),
    };
  } catch (err) {
    console.error("Error retrieving user incidents:", err);
    return {
      statusCode: 500,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({
        error: "Something went wrong!",
        details: err.message,
      }),
    };
  }
};
