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
    logger.info(f"Health check started at {datetime.now(timezone.utc).isoformat()}")

    try:
        response = cognito.describe_user_pool(UserPoolId=USER_POOL_ID)
        user_pool = response.get("UserPool")

        if not user_pool:
            message = f"⚠️ Cognito User Pool {USER_POOL_ID} not found or inaccessible."
            publish_alert(message)
            return {"status": "ALERT", "details": message}

        logger.info("✅ Cognito User Pool is healthy")
        return {"status": "HEALTHY", "details": f"User pool {USER_POOL_ID} is accessible"}

    except ClientError as e:
        error_message = (
            f"❌ Health check failed for Cognito User Pool {USER_POOL_ID}. "
            f"Error: {str(e)}"
        )
        logger.error(error_message)
        publish_alert(error_message)
        return {"status": "ERROR", "details": error_message}

def publish_alert(message: str):
    try:
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f"[ALERT] Cognito User Pool {USER_POOL_ID} Health Issue",
            Message=message,
        )
        logger.info("SNS alert sent successfully")
    except Exception as e:
        logger.error(f"Failed to send SNS alert: {str(e)}")
