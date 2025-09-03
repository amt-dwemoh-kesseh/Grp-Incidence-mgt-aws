import boto3
import os
import logging
import json
from auth_utils import is_admin


logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client("cognito-idp")
USER_POOL_ID = os.environ.get("USER_POOL_ID")

CORS_HEADERS = {
    "Access-Control-Allow-Methods": "OPTIONS,POST,DELETE,GET",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}

def lambda_handler(event, context):
    
    origin = event['headers'].get('origin')
    CORS_HEADERS.update({"Access-Control-Allow-Origin": origin})
    logger.info(f"Received origin: {origin}")

    if not is_admin(event):
        logger.warning("Unauthorized access attempt by non-admin user")
        
        return {
            "statusCode": 403,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Forbidden: Admins only"})
        }

    username = event.get("username")
    if not username:
        return {
            "statusCode": 400,
            "body": "Error: 'username' must be provided"
        }

    try:
        logger.info(f"Deleting user {username} from user pool {USER_POOL_ID}")

        response = cognito.admin_delete_user(
            UserPoolId=USER_POOL_ID,
            Username=username
        )

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": f"User {username} deleted successfully"
        }

    except cognito.exceptions.UserNotFoundException:
        logger.warning(f"User {username} not found in pool {USER_POOL_ID}")
        return {
            "statusCode": 404,
            "headers": CORS_HEADERS,
            "body": f"User {username} not found"
        }

    except Exception as e:
        logger.error(f"Error deleting user {username}: {str(e)}")
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": f"Error deleting user: {str(e)}"
        }
