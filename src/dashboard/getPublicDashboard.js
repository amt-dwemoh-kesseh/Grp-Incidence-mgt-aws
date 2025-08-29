exports.handler = async (event) => {
  try {
    console.log('Dashboard function started');
    console.log('Environment variables:', {
      AWS_SAM_LOCAL: process.env.AWS_SAM_LOCAL,
      AWS_REGION: process.env.AWS_REGION,
      QUICKSIGHT_DASHBOARD_ID: process.env.QUICKSIGHT_DASHBOARD_ID
    });

    // Check if running locally (SAM local doesn't have AWS credentials)
    const isLocal = process.env.AWS_SAM_LOCAL === 'true' || !process.env.AWS_REGION || process.env._LAMBDA_SERVER_PORT;

    console.log('Is local environment:', isLocal);

    if (isLocal) {
      console.log('Returning local development response');
      // Return mock data for local development
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embedUrl: 'https://eu-west-1.quicksight.aws.amazon.com/sn/account/GroupOne/dashboards/9824a03f-fef9-4507-b432-bdd619b87d96',
          message: 'Local development mode - showing direct dashboard URL',
          environment: 'local'
        })
      };
    }

    console.log('Loading AWS SDK for production');
    const AWS = require('aws-sdk');
    const quicksight = new AWS.QuickSight({ region: process.env.AWS_REGION });

    const params = {
      AwsAccountId: process.env.AWS_ACCOUNT_ID,
      Namespace: 'default',
      SessionLifetimeInMinutes: 60,
      ExperienceConfiguration: {
        Dashboard: {
          InitialDashboardId: process.env.QUICKSIGHT_DASHBOARD_ID
        }
      }
    };

    console.log('Calling QuickSight API');
    const result = await quicksight.generateEmbedUrlForAnonymousUser(params).promise();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embedUrl: result.EmbedUrl,
        environment: 'production'
      })
    };

  } catch (error) {
    console.error('Dashboard error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        error: 'Dashboard unavailable',
        details: error.message,
        stack: error.stack
      })
    };
  }
};