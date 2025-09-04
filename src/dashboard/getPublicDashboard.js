exports.handler = async (event) => {
  try {
    console.log('Dashboard function started');
    console.log('Environment variables:', {
      AWS_SAM_LOCAL: process.env.AWS_SAM_LOCAL,
      AWS_REGION: process.env.AWS_REGION,
      QUICKSIGHT_DASHBOARD_ID: process.env.QUICKSIGHT_DASHBOARD_ID,
      INCIDENT_TABLE: process.env.INCIDENT_TABLE,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT SET',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET'
    });

    // Look into region (region of dashboard might be diff from region of lambda)
    const QuickSightAuthorizedResourceArns = [
      `arn:aws:quicksight:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:dashboard/${process.env.QUICKSIGHT_DASHBOARD_ID}`
    ]
    const AllowedDomains = [
      process.env.AMPLIFY_LOCAL_DOMAIN,
      process.env.AMPLIFY_DEV_DOMAIN,
      process.env.AMPLIFY_PROD_DOMAIN
    ]
    // Check if running locally (SAM local doesn't have AWS credentials)
    const isLocal = process.env.AWS_SAM_LOCAL === 'true' || !process.env.AWS_REGION || process.env._LAMBDA_SERVER_PORT;

    console.log('Is local environment:', isLocal);

    // Get database statistics
    let dbStats = {
      totalItems: 0,
      totalPending: 0,
      items: []
    };

    if (!isLocal) {
      try {
        const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
        const client = new DynamoDBClient({
          region: process.env.AWS_REGION || 'eu-central-1'
        });
        
        const params = { TableName: process.env.INCIDENT_TABLE };
        const result = await client.send(new ScanCommand(params));
        
        dbStats.totalItems = result.Items ? result.Items.length : 0;
        dbStats.totalPending = result.Items ? result.Items.filter(item => 
          item.status && item.status.S === 'pending'
        ).length : 0;
        dbStats.items = result.Items ? result.Items.slice(0, 10) : [];
        
      } catch (dbError) {
        console.error('Database query error:', dbError);
      }
    } else {
      // Mock data for local development
      dbStats = {
        totalItems: 42,
        totalPending: 15,
        items: [
          { incidentId: 'INC-001', title: 'Road Pothole on Main St', status: 'pending', category: 'infrastructure' },
          { incidentId: 'INC-002', title: 'Broken Streetlight', status: 'in-progress', category: 'utilities' },
          { incidentId: 'INC-003', title: 'Water Leak', status: 'resolved', category: 'utilities' }
        ]
      };
    }

    if (isLocal) {
      console.log('Returning local development response');
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          embedUrl: 'https://eu-west-1.quicksight.aws.amazon.com/sn/account/GroupOne/dashboards/9824a03f-fef9-4507-b432-bdd619b87d96',
          message: 'Local development mode - showing direct dashboard URL',
          environment: 'local',
          statistics: dbStats
        })
      };
    }
    
    https: console.log("Loading AWS SDK for production");
    const AWS = require('aws-sdk');
    const quicksight = new AWS.QuickSight({ region: process.env.AWS_REGION });

    const params = {
      AwsAccountId: process.env.AWS_ACCOUNT_ID,
      Namespace: "default",
      SessionLifetimeInMinutes: 60,
      AuthorizedResourceArns: QuickSightAuthorizedResourceArns,
      AllowedDomains: AllowedDomains,
      ExperienceConfiguration: {
        Dashboard: {
          InitialDashboardId: process.env.QUICKSIGHT_DASHBOARD_ID,
        },
      },
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
        environment: 'production',
        statistics: dbStats
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