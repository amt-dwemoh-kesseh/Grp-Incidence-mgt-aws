import boto3, os, logging, secrets, string
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client("cognito-idp")
dynamodb = boto3.resource("dynamodb")

USER_POOL_ID = os.environ["USER_POOL_ID"]
BACKUP_TABLE = os.environ["BACKUP_TABLE"]
table = dynamodb.Table(BACKUP_TABLE)


def generate_temp_password(length=16):
    """Generate a strong random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def lambda_handler(event, context):
    """Restore Cognito users from DynamoDB backup."""
    try:
        response = table.scan()
        for item in response.get("Items", []):
            username = item["username"]
            attributes = [
                {"Name": k, "Value": v} for k, v in item.get("attributes", {}).items()
            ]
            groups = item.get("groups", [])
            enabled = item.get("enabled", True)

            try:
                # create user
                cognito.admin_create_user(
                    UserPoolId=USER_POOL_ID,
                    Username=username,
                    UserAttributes=attributes,
                    TemporaryPassword=generate_temp_password(),
                    MessageAction="SUPPRESS",  # don't send invitation email
                )

                # reset password to force user update on login
                cognito.admin_set_user_password(
                    UserPoolId=USER_POOL_ID,
                    Username=username,
                    Password=generate_temp_password(),
                    Permanent=False  # force reset on next login
                )

                # restore enabled/disabled state
                if not enabled:
                    cognito.admin_disable_user(
                        UserPoolId=USER_POOL_ID, Username=username
                    )

                # restore groups
                for group in groups:
                    cognito.admin_add_user_to_group(
                        UserPoolId=USER_POOL_ID,
                        Username=username,
                        GroupName=group,
                    )

                logger.info(f"✅ Restored user {username}")

            except cognito.exceptions.UsernameExistsException:
                logger.info(f"ℹ️ User already exists: {username}")
                continue

        logger.info("🎉 Restore completed successfully")
        return {"status": "SUCCESS"}

    except ClientError as e:
        logger.error(f"❌ Restore failed: {str(e)}")
        return {"status": "ERROR", "details": str(e)}
