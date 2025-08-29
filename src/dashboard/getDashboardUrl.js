const AWS = require('aws-sdk');

exports.handler = async (event) => {
  try {
    const quicksight = new AWS.QuickSight({ region: process.env.AWS_REGION });
    
    // Extract user info from Cognito
    let userGroups = [];
    if (event.requestContext?.authorizer?.claims) {
      userGroups = event.requestContext.authorizer.claims['cognito:groups'] || [];
    }
    
    // Check permissions - only admin/cityOfficial can view dashboard
    const canViewDashboard = userGroups.includes('Admin') || userGroups.includes('CityOfficial');
    if (!canViewDashboard) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Insufficient permissions to view dashboard" })
      };
    }

    const params = {
      AwsAccountId: process.env.AWS_ACCOUNT_ID,
      DashboardId: process.env.QUICKSIGHT_DASHBOARD_ID,
      IdentityType: 'ANONYMOUS',
      SessionLifetimeInMinutes: 60,
      UndoRedoDisabled: true,
      ResetDisabled: true
    };

    const result = await quicksight.getDashboardEmbedUrl(params).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization'
      },
      body: JSON.stringify({
        embedUrl: result.EmbedUrl,
        requestId: result.RequestId
      })
    };
    
  } catch (error) {
    console.error('Error generating dashboard URL:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate dashboard URL' })
    };
  }
};