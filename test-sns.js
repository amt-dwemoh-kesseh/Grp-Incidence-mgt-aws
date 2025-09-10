const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");

// Test SNS notification
async function testSNSNotification() {
  const sns = new SNSClient({ region: "eu-central-1" });
  
  // Test data for incident status update
  const testData = {
    incidentId: "test-incident-123",
    newStatus: "IN_PROGRESS",
    previousStatus: "PENDING",
    updatedBy: "Test User",
    comments: "Test notification",
    timestamp: new Date().toISOString(),
  };

  try {
    // Replace with your actual SNS topic ARN
    const topicArn = "arn:aws:sns:eu-central-1:YOUR_ACCOUNT_ID:status-updated";
    
    const result = await sns.send(
      new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(testData),
        Subject: `Test: Incident Status Updated: ${testData.incidentId}`,
        MessageAttributes: {
          incident_id: { DataType: "String", StringValue: testData.incidentId },
          new_status: { DataType: "String", StringValue: testData.newStatus },
        },
      })
    );
    
    console.log("SNS notification sent successfully:", result.MessageId);
  } catch (error) {
    console.error("SNS notification failed:", error);
  }
}

testSNSNotification();