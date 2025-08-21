# Dashboard Deployment Instructions

## 1. Deploy Infrastructure
```bash
sam build
sam deploy --config-env dev
```

## 2. Initial Data Export
Trigger the export function manually to populate initial data:
```bash
aws lambda invoke --function-name ExportDashboardDataFunction response.json
```

## 3. Create QuickSight Manifest
Replace `{your-account-id}` with your AWS account ID and upload to S3:
```bash
aws s3 cp manifest.json s3://dashboard-data-{your-account-id}/manifest.json
```

## 4. QuickSight Setup
1. Go to QuickSight console
2. Create new dataset from S3
3. Use manifest file: `s3://dashboard-data-{your-account-id}/manifest.json`
4. Create analysis with visualizations:
   - Incidents by District (Bar Chart)
   - Status Distribution (Pie Chart)
   - Category Breakdown (Stacked Bar)
   - Regional Overview (Heat Map)

## 5. Make Dashboard Public
1. Publish dashboard
2. Share with public access
3. Get shareable URL

## Data Schema
```json
{
  "id": "string",
  "userEmail": "string", 
  "userFullName": "string",
  "description": "string",
  "region": "string",
  "district": "string", 
  "location": "string",
  "category": "string",
  "status": "string",
  "createdAt": "ISO date",
  "updatedAt": "ISO date"
}
```

## Automatic Updates
- Data exports every hour via EventBridge
- QuickSight refreshes dataset automatically
- Real-time dashboard updates