import boto3
import json
import os
from datetime import datetime, timezone

s3 = boto3.client("s3")
cognito = boto3.client("cognito-idp")

USER_POOL_ID = os.environ["USER_POOL_ID"]
BUCKET = os.environ["BUCKET"]

def lambda_handler(event, context):
    paginator = cognito.get_paginator("list_users")
    users = []
    for page in paginator.paginate(UserPoolId=USER_POOL_ID):
        users.extend(page["Users"])

    # Use timezone-aware UTC datetime
    now = datetime.now(timezone.utc)
    filename = f"{USER_POOL_ID}_backup_{now.isoformat()}.json"

    s3.put_object(
        Bucket=BUCKET,
        Key=filename,
        Body=json.dumps(users, default=str).encode("utf-8")
    )

    return {
        "status": "success",
        "file": filename,
        "backup_time": now.isoformat()
    }
