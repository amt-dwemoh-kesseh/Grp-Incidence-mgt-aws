exports.handler = async (event) => {
  try {
    const isLocal = process.env.AWS_SAM_LOCAL === 'true' || !process.env.AWS_REGION || process.env._LAMBDA_SERVER_PORT;

    let dbStats = {
      totalItems: 0,
      totalPending: 0,
      totalInReview: 0,
      totalResolved: 0,
      items: []
    };

    if (!isLocal) {
      try {
        const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
        const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
        
        const dynamo = new DynamoDBClient({
          region: process.env.AWS_REGION || 'eu-central-1'
        });
        const docClient = DynamoDBDocumentClient.from(dynamo);
        
        const params = { TableName: process.env.INCIDENT_TABLE };
        const result = await docClient.send(new ScanCommand(params));
        
        dbStats.totalItems = result.Items ? result.Items.length : 0;
        dbStats.totalPending = result.Items ? result.Items.filter(item => 
          item.status === 'pending' || item.status === 'PENDING'
        ).length : 0;
        dbStats.totalInReview = result.Items ? result.Items.filter(item => 
          item.status === 'IN_PROGRESS'
        ).length : 0;
        dbStats.totalResolved = result.Items ? result.Items.filter(item => 
          item.status === 'RESOLVED'
        ).length : 0;
        dbStats.items = result.Items ? result.Items
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 6) : [];
        
      } catch (dbError) {
        console.error('Database query error:', dbError);
      }
    } else {
      dbStats = {
        totalItems: 42,
        totalPending: 15,
        totalInProgress: 8,
        totalResolved: 19,
        items: [
          { incidentId: 'INC-001', title: 'Road Pothole on Main St', status: 'PENDING', category: 'INFRASTRUCTURE' },
          { incidentId: 'INC-002', title: 'Broken Streetlight', status: 'IN_PROGRESS', category: 'UTILITIES' },
          { incidentId: 'INC-003', title: 'Water Leak', status: 'RESOLVED', category: 'UTILITIES' }
        ]
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Dashboard statistics',
        environment: isLocal ? 'local' : 'production',
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
        details: error.message
      })
    };
  }
};