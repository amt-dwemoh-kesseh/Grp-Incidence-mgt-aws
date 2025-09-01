import boto3, os, logging
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client("cognito-idp")
dynamodb = boto3.resource("dynamodb")

USER_POOL_ID = os.environ["USER_POOL_ID"]
BACKUP_TABLE = os.environ["BACKUP_TABLE"]
table = dynamodb.Table(BACKUP_TABLE)


def lambda_handler(event, context):
    """Backup all Cognito users (full details) into DynamoDB."""
    try:
        paginator = cognito.get_paginator("list_users")

        for page in paginator.paginate(UserPoolId=USER_POOL_ID):
            for user in page["Users"]:
                username = user["Username"]

                # groups
                groups_resp = cognito.admin_list_groups_for_user(
                    Username=username, UserPoolId=USER_POOL_ID
                )
                groups = [g["GroupName"] for g in groups_resp.get("Groups", [])]

                # MFA + all attributes from admin_get_user
                try:
                    user_details = cognito.admin_get_user(
                        UserPoolId=USER_POOL_ID, Username=username
                    )
                    mfa_settings = user_details.get("UserMFASettingList", [])
                    preferred_mfa = user_details.get("PreferredMfaSetting")
                    full_attributes = {
                        attr["Name"]: attr["Value"]
                        for attr in user_details.get("UserAttributes", [])
                    }
                except ClientError:
                    mfa_settings, preferred_mfa, full_attributes = [], None, {}

                item = {
                    "username": username,
                    "attributes": full_attributes,
                    "enabled": user["Enabled"],
                    "user_status": user["UserStatus"],
                    "groups": groups,
                    "mfa_settings": mfa_settings,
                    "preferred_mfa": preferred_mfa,
                }

                table.put_item(Item=item)
                logger.info(f"✅ Backed up user {username}")

        logger.info("🎉 Backup completed successfully")
        return {"status": "SUCCESS"}

    except ClientError as e:
        logger.error(f"❌ Backup failed: {str(e)}")
        return {"status": "ERROR", "details": str(e)}
