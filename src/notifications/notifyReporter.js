const AWS = require("aws-sdk");
const sns = new AWS.SNS();
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    console.log("NotifyReporter event:", JSON.stringify(event, null, 2));
    
    let statusUpdateData;
    
    // Handle different event sources
    if (event.Records && event.Records[0].Sns) {
      // Called from SNS trigger
      const snsMessage = JSON.parse(event.Records[0].Sns.Message);
      statusUpdateData = snsMessage;
    } else if (event.incidentId) {
      // Direct invocation with status update data
      statusUpdateData = event;
    } else {
      throw new Error("Invalid event format - missing status update data");
    }
    
    const { incidentId, newStatus, updatedBy, previousStatus, comments } = statusUpdateData;
    
    if (!incidentId || !newStatus) {
      throw new Error("Missing required fields: incidentId or newStatus");
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
    const reporterUserId = incidentItem.userId;
    
    // Create status-specific messages
    const statusMessages = {
      'in-progress': 'Your reported incident is now being actively worked on by our team.',
      'under-review': 'Your incident report is currently under review by the appropriate department.',
      'resolved': 'Great news! Your reported incident has been resolved.',
      'closed': 'Your incident has been closed. If you have any concerns, please contact us.',
      'rejected': 'After review, your incident report has been declined. Please see comments for details.',
      'pending': 'Your incident report is pending assignment to the appropriate team.'
    };
    
    const statusMessage = statusMessages[newStatus] || `Your incident status has been updated to: ${newStatus}`;
    
    // Create notification message for reporter
    const notificationMessage = {
      subject: `Incident Update: ${incidentItem.title} - Status: ${newStatus.toUpperCase()}`,
      message: `Hello,

There's an update on your incident report.

Incident Details:
- ID: ${incidentId}
- Title: ${incidentItem.title}
- Previous Status: ${previousStatus || 'N/A'}
- New Status: ${newStatus.toUpperCase()}
- Updated By: ${updatedBy || 'System'}
- Updated At: ${new Date().toLocaleString()}

Status Update:
${statusMessage}

${comments ? `Additional Comments:\n${comments}\n\n` : ''}Thank you for reporting this incident. We appreciate your contribution to improving our community.

Best regards,
City Management Team`,
      incidentId,
      reporterUserId,
      newStatus,
      previousStatus,
      timestamp: new Date().toISOString()
    };
    
    // Publish to SNS topic for status updates
    const snsParams = {
      TopicArn: process.env.STATUS_UPDATED_TOPIC,
      Subject: notificationMessage.subject,
      Message: JSON.stringify(notificationMessage),
      MessageAttributes: {
        'incident_id': {
          DataType: 'String',
          StringValue: incidentId
        },
        'reporter_user_id': {
          DataType: 'String',
          StringValue: reporterUserId
        },
        'new_status': {
          DataType: 'String',
          StringValue: newStatus
        },
        'notification_type': {
          DataType: 'String',
          StringValue: 'status_update'
        }
      }
    };
    
    const result = await sns.publish(snsParams).promise();
    
    console.log("Reporter notification sent:", result.MessageId);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Reporter notification sent successfully",
        messageId: result.MessageId,
        incidentId,
        reporterUserId,
        newStatus
      })
    };
    
  } catch (error) {
    console.error("Error notifying reporter:", error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Failed to notify reporter",
        details: error.message
      })
    };
  }
};
