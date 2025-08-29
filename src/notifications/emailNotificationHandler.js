const AWS = require('aws-sdk');

exports.handler = async (event) => {
  const ses = new AWS.SES();
  
  try {
    // Parse SNS message
    const snsMessage = JSON.parse(event.Records[0].Sns.Message);
    const messageAttributes = event.Records[0].Sns.MessageAttributes;
    
    const incidentId = messageAttributes.incidentId?.Value;
    const newStatus = messageAttributes.newStatus?.Value;
    const userEmail = messageAttributes.userEmail?.Value;
    const notificationType = messageAttributes.notificationType?.Value || 'STATUS_UPDATE';
    
    if (!userEmail) {
      console.log('No user email found, skipping notification');
      return;
    }

    let subject, htmlBody, textBody;
    
    switch (notificationType) {
      case 'CLOSURE':
        subject = `Incident ${incidentId} - Resolved and Closed`;
        htmlBody = `
          <h2>Incident Resolved</h2>
          <p>Your incident <strong>${incidentId}</strong> has been successfully resolved and closed.</p>
          <p>Thank you for reporting this issue and helping improve our community services.</p>
          <p>If you have any questions, please contact our support team.</p>
        `;
        textBody = `Your incident ${incidentId} has been resolved and closed. Thank you for your report.`;
        break;
        
      default:
        subject = `Incident ${incidentId} - Status Updated to ${newStatus}`;
        htmlBody = `
          <h2>Incident Status Update</h2>
          <p>Your incident <strong>${incidentId}</strong> status has been updated to: <strong>${newStatus}</strong></p>
          <p>You will receive further notifications as the status changes throughout the resolution process.</p>
          <p>Thank you for your patience.</p>
        `;
        textBody = `Your incident ${incidentId} status has been updated to: ${newStatus}`;
    }

    const emailParams = {
      Source: process.env.FROM_EMAIL || 'noreply@monitoring-platform.com',
      Destination: {
        ToAddresses: [userEmail]
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8'
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8'
          }
        }
      }
    };

    await ses.sendEmail(emailParams).promise();
    console.log(`Email notification sent to ${userEmail} for incident ${incidentId}`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Email notification sent successfully' })
    };
    
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
};