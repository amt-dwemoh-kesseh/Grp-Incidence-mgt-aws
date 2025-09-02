import boto3
import os
import json
import logging
from datetime import datetime, timezone
from botocore.exceptions import ClientError

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# AWS clients
cognito = boto3.client("cognito-idp")
sns = boto3.client("sns")

# Environment variables
USER_POOL_ID = os.environ["USER_POOL_ID"]
SNS_TOPIC_ARN = os.environ["ALERT_TOPIC_ARN"]

def lambda_handler(event, context):
    """Health check for Cognito User Pool."""
    logger.info(f"Health check started at {datetime.now(timezone.utc).isoformat()}")

    try:
        # Describe the user pool to verify it's operational
        response = cognito.describe_user_pool(UserPoolId=USER_POOL_ID)
        status = response.get("UserPool", {}).get("Status", "UNKNOWN")

        logger.info(f"User pool status: {status}")

        if status != "Active":
            message = f"⚠️ Cognito User Pool {USER_POOL_ID} is not active! Current status: {status}"
            publish_alert(message)
            return {"status": "ALERT", "details": message}

        logger.info("✅ Cognito User Pool is healthy")
        return {"status": "HEALTHY", "details": "User pool is active"}

    except ClientError as e:
        error_message = (
            f"❌ Health check failed for Cognito User Pool {USER_POOL_ID}. "
            f"Error: {str(e)}"
        )
        logger.error(error_message)
        publish_alert(error_message)
        return {"status": "ERROR", "details": error_message}

def publish_alert(message: str):
    """Publish alert to SNS topic."""
    try:
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f"[ALERT] Cognito User Pool {USER_POOL_ID} Health Issue",
            Message=message,
        )
        logger.info("SNS alert sent successfully")
    except Exception as e:
        logger.error(f"Failed to send SNS alert: {str(e)}")
