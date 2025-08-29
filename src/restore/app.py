import boto3
import json
import os
import logging
from datetime import datetime, timezone

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")
cognito = boto3.client("cognito-idp")

USER_POOL_ID = os.environ["USER_POOL_ID"]
BUCKET = os.environ["BUCKET"]

def lambda_handler(event, context):
    # File key should be passed in event (e.g. {"file": "POOLID_backup_2025-08-28T12:34:56+00:00.json"})
    key = event.get("file")
    if not key:
        logger.error("❌ No backup file specified in event")
        return {"status": "error", "message": "No backup file specified"}

    logger.info(f"📂 Fetching backup file '{key}' from bucket '{BUCKET}'")

    # Fetch the backup file from S3
    obj = s3.get_object(Bucket=BUCKET, Key=key)
    users = json.loads(obj["Body"].read())

    restored = []
    errors = []

    for user in users:
        username = user.get("Username")
        try:
            # Extract attributes into Cognito API format
            attributes = [
                {"Name": attr["Name"], "Value": attr["Value"]}
                for attr in user.get("Attributes", [])
                if "Value" in attr
            ]

            logger.info(f"🔄 Restoring user: {username}")

            cognito.admin_create_user(
                UserPoolId=USER_POOL_ID,
                Username=username,
                UserAttributes=attributes,
                MessageAction="SUPPRESS"  # No email triggered
            )

            logger.info(f"✅ Successfully restored user: {username}")
            restored.append(username)

        except Exception as e:
            logger.error(f"❌ Failed to restore user {username}: {str(e)}")
            errors.append({"username": username, "error": str(e)})

    now = datetime.now(timezone.utc)

    summary = {
        "status": "completed",
        "restored_count": len(restored),
        "failed_count": len(errors),
        "restore_time": now.isoformat()
    }

    logger.info(f"📊 Restore summary: {json.dumps(summary)}")
    return {**summary, "errors": errors}
