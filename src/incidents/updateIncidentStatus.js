const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const dynamo = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: process.env.AWS_REGION || "eu-central-1",
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5000,
      socketTimeout: 5000,
    }),
  })
);

const sns = new SNSClient({ region: process.env.AWS_REGION || "eu-central-1" });

exports.handler = async (event) => {
  console.log("Function Started");
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const client_origin = headers.origin || "*";

  const UPDATED_SET_HEADERS = {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": client_origin,
  };

  try {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: UPDATED_SET_HEADERS, body: "" };
    }

    // --- Authorization ---
    let updatedBy = "system";
    let userGroups = [];

    if (event.requestContext?.authorizer?.claims) {
      updatedBy = event.requestContext.authorizer.claims.name;

      userGroups =
        event.requestContext.authorizer.claims["cognito:groups"] || [];

      const canUpdate =
        userGroups.includes("CityOfficial") || userGroups.includes("Admin");
      if (!canUpdate) {
        return {
          statusCode: 403,
          headers: UPDATED_SET_HEADERS,
          body: JSON.stringify({
            error: "Insufficient permissions to update incident status",
          }),
        };
      }
    } else if (event.headers?.Authorization || event.headers?.authorization) {
      const authHeader =
        event.headers.Authorization || event.headers.authorization;
      const token = authHeader.replace("Bearer ", "");

      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        updatedBy = payload.name || payload["cognito:username"];
        userGroups = payload["cognito:groups"] || [];
        const canUpdate =
          userGroups.includes("CityOfficial") || userGroups.includes("Admin");
        if (!canUpdate) {
          return {
            statusCode: 403,
            headers: UPDATED_SET_HEADERS,
            body: JSON.stringify({
              error: "Insufficient permissions to update incident status",
            }),
          };
        }
      } catch {
        return {
          statusCode: 401,
          headers: UPDATED_SET_HEADERS,
          body: JSON.stringify({ error: "Invalid JWT token" }),
        };
      }
    }

    const incidentId = event.pathParameters.id;

    const body = JSON.parse(event.body);

    const validStatuses = [
      "QUEUED",
      "PENDING",
      "REPORTED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
      "CANCELLED",
    ];

    if (!body.status || !validStatuses.includes(body.status)) {
      return {
        statusCode: 400,
        headers: UPDATED_SET_HEADERS,
        body: JSON.stringify({ error: "Invalid status", validStatuses }),
      };
    }

    // --- Fetch current incident ---
    const currentIncident = await dynamo.send(
      new GetCommand({
        TableName: process.env.INCIDENT_TABLE,
        Key: { incidentId },
      })
    );

    if (!currentIncident.Item) {
      return {
        statusCode: 404,
        headers: UPDATED_SET_HEADERS,
        body: JSON.stringify({ error: "Incident not found" }),
      };
    }

    const previousStatus = currentIncident.Item.status;

    // --- Update incident ---
    let updateExpression = "SET #status = :status, updatedAt = :updatedAt, updatedBy = :updatedBy";
    const expressionAttributeNames = { "#status": "status" };
    const expressionAttributeValues = {
      ":status": body.status,
      ":updatedAt": new Date().toISOString(),
      ":updatedBy": updatedBy,
    };

    if (body.comments) {
      updateExpression += ", comments = :comments";
      expressionAttributeValues[":comments"] = body.comments;
    }

    if (body.assignedTo) {
      updateExpression += ", assignedTo = :assignedTo";
      expressionAttributeNames["#assignedTo"] = "assignedTo";
      expressionAttributeValues[":assignedTo"] = body.assignedTo;
    }

    const updateParams = {
      TableName: process.env.INCIDENT_TABLE,
      Key: { incidentId },
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    };

    const updateResult = await dynamo.send(new UpdateCommand(updateParams));

    // --- Notify via SNS ---
    if (process.env.STATUS_UPDATED_TOPIC) {
      const notificationData = {
        incidentId,
        newStatus: body.status,
        previousStatus,
        updatedBy,
        comments: body.comments || null,
        timestamp: new Date().toISOString(),
      };
      
      try {
        await sns.send(
          new PublishCommand({
            TopicArn: process.env.STATUS_UPDATED_TOPIC,
            Message: JSON.stringify(notificationData),
            Subject: `Incident Status Updated: ${incidentId}`,
            MessageAttributes: {
              incident_id: { DataType: "String", StringValue: incidentId },
              new_status: { DataType: "String", StringValue: body.status },
            },
          })
        );
        console.log("Status update notification sent successfully");
      } catch (snsError) {
        console.error("SNS notification error:", snsError);
      }
    }

    return {
      statusCode: 200,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({
        message: "Incident status updated successfully",
        incident: updateResult.Attributes,
        previousStatus,
        newStatus: body.status,
      }),
    };
  } catch (err) {
    console.error("Error updating incident status:", err);
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
