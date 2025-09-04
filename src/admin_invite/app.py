import os
import boto3
import json
from auth_utils import is_admin
import logging
import random
import string


cognito_client = boto3.client("cognito-idp")
USER_POOL_ID = os.environ["USER_POOL_ID"]

logger = logging.getLogger()
logger.setLevel(logging.INFO)


CORS_HEADERS = {
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    }

def lambda_handler(event, context):
    logger.info(f"Received event: {json.dumps(event)}")
    
    origin = event['headers'].get('origin')
    CORS_HEADERS.update({"Access-Control-Allow-Origin": origin})
        
    if not is_admin(event):
        logger.warning("Unauthorized access attempt by non-admin user")
        
        return {
            "statusCode": 403,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "Forbidden: Admins only"})
        }
 
    
    try:
        logger.info("Processing user creation request")
        
        body = json.loads(event.get("body", "{}"))
        email = body["email"]
        name = body["name"]
        region = body["region"]
        city = body["city"]
        telephone = body["telephone"]
        role = body["role"]

        if role not in ["Admin", "CityOfficial"]:
            return {"statusCode": 400, "body": json.dumps({"error": "Only Admin or CityOfficial allowed"})}

        response = cognito_client.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=generate_password(),
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "name", "Value": name},
                {"Name": "custom:region", "Value": region},
                {"Name": "custom:city", "Value": city},
                {"Name": "phone_number", "Value": telephone},
                {"Name": "email_verified", "Value": "true"}
            ]
        )

        cognito_client.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID,
            Username=email,
            GroupName=role
        )
        
        logger.info(f"User {name} with role {role} created successfully")
        
        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "message": f"{role} {name} invited successfully"
            })
        }

    except Exception as e:
        logger.error(f"Error creating user: {str(e)}")
        
        return {"statusCode": 500,"headers": CORS_HEADERS, "body": json.dumps({"error": str(e)})}


def generate_password():    
     # Required character sets
    uppercase = random.choice(string.ascii_uppercase)
    lowercase = random.choice(string.ascii_lowercase)
    digit = random.choice(string.digits)
    special = random.choice("!@#$%^&*()-_=+[]{}|;:,.<>?/")

    # Remaining random characters
    remaining_length = 4 
    all_chars = string.ascii_letters + string.digits + "!@#$%^&*()-_=+[]{}|;:,.<>?/"
    remaining = [random.choice(all_chars) for _ in range(max(0, remaining_length))]

    # Shuffle required + remaining
    random_part = list(uppercase + lowercase + digit + special + "".join(remaining))
    random.shuffle(random_part)
     
    logger.info("Generated temporary password")
     
    return "temp" + "".join(random_part)
    