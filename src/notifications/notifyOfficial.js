const AWS = require("aws-sdk");
const sns = new AWS.SNS();
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    console.log("NotifyOfficial event:", JSON.stringify(event, null, 2));
    
    let incidentData;
    
    // Handle different event sources
    if (event.Records && event.Records[0].Sns) {
      // Called from SNS trigger
      const snsMessage = JSON.parse(event.Records[0].Sns.Message);
      incidentData = snsMessage;
    } else if (event.incidentId) {
      // Direct invocation with incident data
      incidentData = event;
    } else {
      throw new Error("Invalid event format - missing incident data");
    }
    
    const { incidentId, userId } = incidentData;
    
    if (!incidentId) {
      throw new Error("Missing incidentId in event data");
    }
    
    // Fetch full incident details from DynamoDB
    const incident = await dynamo.get({
      TableName: process.env.INCIDENT_TABLE,
      Key: { incidentId: incidentId }
    }).promise();
    
    if (!incident.Item) {
      throw new Error(`Incident not found: ${incidentId}`);
    }
    
    const incidentItem = incident.Item;
    
    // Determine notification category based on incident severity/type
    const category = incidentItem.category || 'general';
    const severity = incidentItem.severity || 'medium';
    
    // Create notification message for officials
    const notificationMessage = {
      subject: `New ${severity.toUpperCase()} Priority Incident Reported - ${incidentItem.title}`,
      message: `A new incident has been reported and requires attention.

Incident Details:
- ID: ${incidentId}
- Title: ${incidentItem.title}
- Description: ${incidentItem.description}
- Category: ${category}
- Severity: ${severity}
- Location: ${incidentItem.location || 'Not specified'}
- Reported At: ${new Date(incidentItem.createdAt).toLocaleString()}
- Reporter ID: ${userId}

Please review and assign appropriate personnel to handle this incident.

Access the incident management system to view full details and take action.`,
      incidentId,
      category,
      severity,
      timestamp: new Date().toISOString()
    };
    
    // Publish to SNS topic for officials
    const snsParams = {
      TopicArn: process.env.INCIDENT_REPORTED_TOPIC,
      Subject: notificationMessage.subject,
      Message: JSON.stringify(notificationMessage),
      MessageAttributes: {
        'incident_id': {
          DataType: 'String',
          StringValue: incidentId
        },
        'category': {
          DataType: 'String',
          StringValue: category
        },
        'severity': {
          DataType: 'String',
          StringValue: severity
        }
      }
    };
    
    const result = await sns.publish(snsParams).promise();
    
    console.log("Official notification sent:", result.MessageId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Official notification sent successfully",
        messageId: result.MessageId,
        incidentId
      })
    };
    
  } catch (error) {
    console.error("Error notifying official:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to notify official",
        details: error.message
      })
    };
  }
};
