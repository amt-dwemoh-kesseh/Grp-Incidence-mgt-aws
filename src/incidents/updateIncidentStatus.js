const AWS = require("aws-sdk");
const dynamo = new AWS.DynamoDB.DocumentClient();
const sns = new AWS.SNS();

exports.handler = async (event) => {
  try {
    // Skip authorization check for testing

    // Parse path and body
    const incidentId = event.pathParameters.id;
    const body = JSON.parse(event.body);
    if (!body.status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing status" }),
      };
    }

    // Update incident status in DynamoDB
    const params = {
      TableName: process.env.INCIDENT_TABLE,
      Key: { id: incidentId },
      UpdateExpression: "set #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": body.status },
      ReturnValues: "ALL_NEW",
    };
    const result = await dynamo.update(params).promise();

    // Publish to SNS
    await sns
      .publish({
        TopicArn: process.env.STATUS_UPDATED_TOPIC,
        Message: JSON.stringify({ incidentId, status: body.status }),
      })
      .promise();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Incident status updated",
        incident: result.Attributes,
      }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Something went wrong!" }),
    };
  }
};
