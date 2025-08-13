# AWS Resource Setup Guide

This guide explains how to create all required AWS resources for your application, either using Infrastructure as Code (AWS SAM/CloudFormation) or manually via the AWS Console. It also shows how to find the values you need to fill in your `.env` or `local-env.json` files for local development and deployment.

---

## 1. DynamoDB Tables

### a. **Incident Table**

- **Name:** `IncidentTable` (or your custom name)
- **Primary Key:** `id` (String)
- **GSI:**
  - **Name:** `userId-index`
  - **Partition Key:** `userId` (String)
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** Go to DynamoDB > Create table > Add GSI after table creation.
- **Value for .env/local-env.json:**
  - `INCIDENT_TABLE`: Table name (e.g., `IncidentTable`)

### b. **Feedback Table**

- **Name:** `FeedbackTable`
- **Primary Key:** `id` (String)
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** Go to DynamoDB > Create table.
- **Value:**
  - `FEEDBACK_TABLE`: Table name (e.g., `FeedbackTable`)

---

## 2. S3 Bucket (for Attachments)

- **Name:** e.g., `incident-attachments-<account-id>`
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** Go to S3 > Create bucket. Enable all public access blocks.
- **Value:**
  - `ATTACHMENT_BUCKET`: Bucket name

---

## 3. SNS Topics

### a. **Incident Reported Topic**

- **Name:** `incident-reported`
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** Go to SNS > Create topic > Name: `incident-reported`
- **Value:**
  - `INCIDENT_REPORTED_TOPIC`: Topic ARN (e.g., `arn:aws:sns:us-east-1:123456789012:incident-reported`)

### b. **Status Updated Topic**

- **Name:** `status-updated`
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** Go to SNS > Create topic > Name: `status-updated`
- **Value:**
  - `STATUS_UPDATED_TOPIC`: Topic ARN

---

## 4. Cognito User Pool

- **Name:** `MonitoringUserPool` (or your custom name)
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** Go to Cognito > Create user pool > Add email as required attribute.
- **Value:**
  - `USER_POOL_ID`: Pool ID (e.g., `us-east-1_Abc123456`)

### User Pool Client

- **Name:** `MonitoringUserPoolClient`
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** In Cognito > User Pools > [Your Pool] > App clients > Add app client.
- **Value:**
  - `USER_POOL_CLIENT_ID`: App client ID

### User Pool Groups

- **Groups:** `citizen`, `cityAuth`, `admin`
- **How to create:**
  - **SAM/CloudFormation:** Already defined in `template.yaml`.
  - **Console:** In Cognito > User Pools > [Your Pool] > Groups > Create group.

---

## 5. Region

- **Value:**
  - `REGION`: Your AWS region (e.g., `eu-central-1`)

---

## 6. How to Find Resource Values

- **DynamoDB Table Name:** In DynamoDB console, under Tables.
- **S3 Bucket Name:** In S3 console, under Buckets.
- **SNS Topic ARN:** In SNS console, select topic, copy ARN from details.
- **Cognito User Pool ID:** In Cognito console, select pool, copy Pool Id.
- **Cognito App Client ID:** In Cognito console, select pool > App clients, copy ID.

---

## 7. Tips

- Deploying with `sam deploy` will create all resources as defined in `template.yaml` and output their names/ARNs.
- For local development, copy these values into `.env` or `local-env.json`.
- If you create resources manually, use the exact names/ARNs you set in the AWS Console.

---

## 8. Example local-env.json

```json
{
  "CreateIncidentFunction": {
    "INCIDENT_TABLE": "IncidentTable",
    "FEEDBACK_TABLE": "FeedbackTable",
    "ATTACHMENT_BUCKET": "incident-attachments-123456789012",
    "INCIDENT_REPORTED_TOPIC": "arn:aws:sns:us-east-1:123456789012:incident-reported",
    "STATUS_UPDATED_TOPIC": "arn:aws:sns:us-east-1:123456789012:status-updated"
  },
  "GetMyIncidentsFunction": {
    "INCIDENT_TABLE": "IncidentTable"
  },
  "ListIncidentsFunction": {
    "INCIDENT_TABLE": "IncidentTable"
  },
  "UpdateIncidentStatusFunction": {
    "INCIDENT_TABLE": "IncidentTable",
    "STATUS_UPDATED_TOPIC": "arn:aws:sns:us-east-1:123456789012:status-updated"
  }
}
```

---

## 9. Further Reading

- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/)
- [AWS Console](https://console.aws.amazon.com/)
- [CloudFormation Resource Reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html)
