const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");

// Test DynamoDB DocumentClient only
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log("Function started");
  
  try {
    console.log("Raw event:", JSON.stringify(event, null, 2));
    console.log("Event body (raw):", event.body);
    
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "No body provided"
        })
      };
    }
    
    const body = JSON.parse(event.body);
    console.log("Parsed body:", JSON.stringify(body, null, 2));
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Request received and logged",
        receivedData: body
      })
    };
  } catch (error) {
    console.error("Error:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Something went wrong",
        details: error.message
      })
    };
  }
};
