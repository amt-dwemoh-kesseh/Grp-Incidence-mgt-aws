# QuickSight Dashboard Setup Guide

## Prerequisites
- AWS Account with QuickSight access (30-day free trial available)
- Deployed SAM application with dashboard data bucket

## Step 1: Enable QuickSight
1. Go to AWS QuickSight console
2. Sign up for QuickSight (choose Standard edition for free trial)
3. Select your region and configure access to S3

## Step 2: Create Data Source
1. In QuickSight, click "New analysis"
2. Click "New dataset"
3. Choose "S3" as data source
4. Configure S3 data source:
   - **Data source name**: `incident-reports`
   - **S3 bucket**: `dashboard-data-{your-account-id}`
   - **Manifest file**: Create manifest.json (see below)

## Step 3: Create Manifest File
Upload this manifest.json to your dashboard S3 bucket:

```json
{
  "fileLocations": [
    {
      "URIPrefixes": [
        "s3://dashboard-data-{your-account-id}/incidents/"
      ]
    }
  ],
  "globalUploadSettings": {
    "format": "JSON"
  }
}
```

## Step 4: Create Dashboard
1. Select your dataset and click "Create analysis"
2. Add visualizations:
   - **Bar chart**: Incidents by district
   - **Pie chart**: Status distribution
   - **Line chart**: Incidents over time
   - **Heat map**: Incidents by region/district

## Step 5: Publish Dashboard
1. Click "Share" → "Publish dashboard"
2. Name: "Incident Reports Dashboard"
3. Set permissions for public access if needed

## Data Updates
- Data refreshes automatically every hour via Lambda function
- Manual refresh available in QuickSight dataset settings

## Sample Visualizations
- **Total Incidents by District**: Horizontal bar chart
- **Status Distribution**: Donut chart (Open, In Progress, Closed)
- **Category Breakdown**: Stacked bar chart by district
- **Trend Analysis**: Time series line chart