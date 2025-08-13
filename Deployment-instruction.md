# Simplified Deployment Instructions

This guide provides a simplified set of instructions to deploy the Monitoring & Reporting Platform Backend using AWS SAM CLI.

## Prerequisites

Before you begin, ensure you have the following installed:

-   **AWS CLI**: For configuring your AWS credentials.
-   **AWS SAM CLI**: The Serverless Application Model CLI for building and deploying serverless applications.
-   **Node.js 18.x**: The runtime for the Lambda functions.
-   **Python 3.x**: Required by the SAM CLI.
-   **Git**: For cloning the repository.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo>
    ```

2.  **Configure AWS credentials:**
    Ensure your AWS CLI is configured with appropriate credentials.
    ```bash
    aws configure
    # Follow the prompts to enter your AWS Access Key ID, Secret Access Key, default region, and output format.
    ```

3.  **Install Lambda dependencies:**
    Navigate into the `src` directory and install the Node.js dependencies.
    ```bash
    cd src
    npm install
    cd ..
    ```

## Deployment

Once the setup is complete, you can deploy the application to your AWS account.

### Deploy to DEV Environment

Use the following commands to deploy to your development environment:

```bash
sam build
sam deploy --config-file samconfig.toml --config-env dev --no-confirm-changeset --no-fail-on-empty-changeset
```

### Deploy to PROD Environment

Use the following commands to deploy to your production environment:

```bash
sam build
sam deploy --config-file samconfig.toml --config-env prod --no-confirm-changeset --no-fail-on-empty-changeset
```

**Note:** The first deployment will create all the necessary AWS resources (Cognito User Pool, DynamoDB Tables, S3 Bucket, SNS Topics, Lambda Functions, and API Gateway). After deployment, the outputs (like API URL, Cognito Pool IDs, etc.) will be displayed in your terminal.