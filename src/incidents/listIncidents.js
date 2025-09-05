const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
} = require("@aws-sdk/lib-dynamodb");

let CORS_HEADERS = {
  "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) => {
  const headers = Object.fromEntries(
    Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
  );
  const client_origin = headers.origin || "*";

  const UPDATED_SET_HEADERS = {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": client_origin,
  };

  try {
    const dynamo = new DynamoDBClient({
      region: process.env.AWS_REGION || "eu-central-1",
    });
    const docClient = DynamoDBDocumentClient.from(dynamo);

    if (event.httpMethod === "OPTIONS") {
      return { statusCode: 200, headers: UPDATED_SET_HEADERS, body: "" };
    }

    if (!process.env.INCIDENT_TABLE) {
      throw new Error("INCIDENT_TABLE environment variable not set");
    }

    // --- Extract Cognito claims ---
    let cognitoUserId,
      userGroups = [],
      userRegion,
      userCity,
      username;

    if (event.requestContext?.authorizer?.claims) {
      const claims = event.requestContext.authorizer.claims;
      cognitoUserId = claims.sub;
      userGroups = claims["cognito:groups"] || [];
      userRegion = claims["custom:region"];
      userCity = claims["custom:city"];
      username = claims["cognito:username"];
    } else if (event.headers?.Authorization || event.headers?.authorization) {
      const authHeader =
        event.headers.Authorization || event.headers.authorization;
      const token = authHeader.replace("Bearer ", "");

      try {
        const payload = JSON.parse(
          Buffer.from(token.split(".")[1], "base64").toString()
        );
        cognitoUserId = payload.sub;
        userGroups = payload["cognito:groups"] || [];
        userRegion = payload["custom:region"];
        userCity = payload["custom:city"];
        username = payload["cognito:username"];
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

    // --- Determine role ---
    const isAdmin = userGroups.includes("Admin");
    const isCityOfficial = userGroups.includes("CityOfficial");

    // --- Filters ---
    const queryParams = event.queryStringParameters || {};
    const statusFilter = queryParams.status?.toUpperCase();
    const severityFilter = queryParams.severity?.toLowerCase();
    const categoryFilter = queryParams.category?.toUpperCase();

    const ALLOWED_STATUS = [
      "QUEUED",
      "REPORTED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
      "PENDING",
    ];
    const ALLOWED_CATEGORY = [
      "INFRASTRUCTURE",
      "UTILITIES",
      "SAFETY",
      "ENVIRONMENT",
      "TRANSPORTATION",
      "PUBLIC_SERVICES",
      "OTHER",
    ];
    const ALLOWED_SEVERITY = ["low", "medium", "high"];

    let params = { TableName: process.env.INCIDENT_TABLE };
    let filterExprs = [];
    let exprAttrNames = {};
    let exprAttrValues = {};

    // Role-specific base filter
    if (isAdmin) {
      // no base restriction
    } else if (isCityOfficial) {
      if (!userRegion) {
        return {
          statusCode: 400,
          headers: UPDATED_SET_HEADERS,
          body: JSON.stringify({ error: "Region not found in user profile" }),
        };
      }
      filterExprs.push("#reporter_region = :reporter_region");
      exprAttrNames["#reporter_region"] = "reporter_region";
      exprAttrValues[":reporter_region"] = userRegion;
    } else {
      // regular user → only own incidents
      filterExprs.push("#userId = :userId");
      exprAttrNames["#userId"] = "userId";
      exprAttrValues[":userId"] = cognitoUserId;
    }

    // --- Apply additional filters if valid ---
    if (statusFilter && ALLOWED_STATUS.includes(statusFilter)) {
      filterExprs.push("#status = :status");
      exprAttrNames["#status"] = "status";
      exprAttrValues[":status"] = statusFilter;
    }
    if (severityFilter && ALLOWED_SEVERITY.includes(severityFilter)) {
      filterExprs.push("#severity = :severity");
      exprAttrNames["#severity"] = "severity";
      exprAttrValues[":severity"] = severityFilter;
    }
    if (categoryFilter && ALLOWED_CATEGORY.includes(categoryFilter)) {
      filterExprs.push("#category = :category");
      exprAttrNames["#category"] = "category";
      exprAttrValues[":category"] = categoryFilter;
    }

    if (filterExprs.length > 0) {
      params.FilterExpression = filterExprs.join(" AND ");
      params.ExpressionAttributeNames = exprAttrNames;
      params.ExpressionAttributeValues = exprAttrValues;
    }

    const result = await docClient.send(new ScanCommand(params));

    return {
      statusCode: 200,
      headers: UPDATED_SET_HEADERS,
      body: JSON.stringify({ incidents: result.Items || [] }),
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
