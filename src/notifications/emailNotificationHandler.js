const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: process.env.AWS_REGION });

exports.handler = async (event) => {
  try {
    console.log('Email notification triggered:', JSON.stringify(event, null, 2));
    
    for (const record of event.Records) {
      if (record.Sns) {
        const message = JSON.parse(record.Sns.Message);
        
        const emailParams = {
          Source: process.env.FROM_EMAIL,
          Destination: {
            ToAddresses: [message.recipientEmail || 'admin@monitoring-platform.com']
          },
          Message: {
            Subject: {
              Data: `Incident Status Update: ${message.incidentId}`
            },
            Body: {
              Text: {
                Data: `
Incident ID: ${message.incidentId}
Status: ${message.status}
Updated by: ${message.updatedBy}
Time: ${new Date().toISOString()}

Details: ${message.details || 'No additional details'}
                `
              }
            }
          }
        };
        
        await ses.sendEmail(emailParams).promise();
        console.log('Email sent successfully');
      }
    }
    
    return { statusCode: 200 };
  } catch (error) {
    console.error('Email notification error:', error);
    throw error;
  }
};