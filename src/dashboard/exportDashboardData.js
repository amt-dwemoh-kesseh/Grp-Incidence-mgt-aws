const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

exports.handler = async (event) => {
    try {
        // Scan incidents table
        const incidents = await dynamodb.scan({
            TableName: process.env.INCIDENT_TABLE
        }).promise();

        // Transform data for QuickSight
        const dashboardData = incidents.Items.map(incident => ({
            id: incident.id,
            userEmail: incident.userEmail,
            userFullName: incident.userFullName || 'N/A',
            description: incident.description,
            region: incident.region,
            district: incident.district,
            location: incident.location,
            category: incident.category,
            status: incident.status,
            createdAt: incident.createdAt,
            updatedAt: incident.updatedAt || incident.createdAt
        }));

        // Generate statistics by district
        const stats = generateStats(dashboardData);

        // Upload to S3
        const timestamp = new Date().toISOString();
        
        await Promise.all([
            // Raw incident data
            s3.putObject({
                Bucket: process.env.DASHBOARD_BUCKET,
                Key: `incidents/incidents_${timestamp.split('T')[0]}.json`,
                Body: JSON.stringify(dashboardData),
                ContentType: 'application/json'
            }).promise(),
            
            // Aggregated statistics
            s3.putObject({
                Bucket: process.env.DASHBOARD_BUCKET,
                Key: `stats/district_stats_${timestamp.split('T')[0]}.json`,
                Body: JSON.stringify(stats),
                ContentType: 'application/json'
            }).promise()
        ]);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Dashboard data exported successfully',
                recordsProcessed: dashboardData.length
            })
        };
    } catch (error) {
        console.error('Error exporting dashboard data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to export dashboard data' })
        };
    }
};

function generateStats(incidents) {
    const stats = {};
    
    incidents.forEach(incident => {
        const key = `${incident.region}_${incident.district}`;
        
        if (!stats[key]) {
            stats[key] = {
                region: incident.region,
                district: incident.district,
                total: 0,
                open: 0,
                inProgress: 0,
                closed: 0,
                categories: {}
            };
        }
        
        stats[key].total++;
        stats[key][incident.status.toLowerCase()]++;
        
        if (!stats[key].categories[incident.category]) {
            stats[key].categories[incident.category] = 0;
        }
        stats[key].categories[incident.category]++;
    });
    
    return Object.values(stats);
}