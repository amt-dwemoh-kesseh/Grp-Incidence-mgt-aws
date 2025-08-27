import boto3
import os
import json
import logging
from auth_utils import is_admin

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client("cognito-idp")
USER_POOL_ID = os.environ["USER_POOL_ID"]

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "http://localhost:4200",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}


def get_users_in_group(group_name):
    users = set()
    paginator = cognito.get_paginator("list_users_in_group")
    for page in paginator.paginate(UserPoolId=USER_POOL_ID, GroupName=group_name):
        users.update(u["Username"] for u in page["Users"])
    return users


def lambda_handler(event, context):
    if event['httpMethod'] == 'OPTIONS':
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    if not is_admin(event):
        logger.warning("Unauthorized access attempt")
        return {"statusCode": 403, "headers": CORS_HEADERS, "body": json.dumps({"message": "Forbidden: Admins only"})}

    try:
        # Fetch all users once
        all_users = []
        paginator = cognito.get_paginator("list_users")
        for page in paginator.paginate(UserPoolId=USER_POOL_ID):
            all_users.extend(page["Users"])

        # Fetch group memberships in bulk
        admins = get_users_in_group("Admin")
        city_officials = get_users_in_group("CityOfficial")

        # Counters & data prep
        users_data, admin_count, city_official_count, citizens_count = [], 0, 0, 0

        for user in all_users:
            attributes = {a["Name"]: a["Value"] for a in user["Attributes"]}
            username = user["Username"]

            if username in admins:
                role = "Admin"
                admin_count += 1
            elif username in city_officials:
                role = "CityOfficial"
                city_official_count += 1
            else:
                role = "Citizen"
                citizens_count += 1

            users_data.append({
                "user_id": username,
                "name": attributes.get("name"),
                "email": attributes.get("email"),
                "telephone": attributes.get("custom:telephone"),
                "region": attributes.get("custom:region"),
                "city": attributes.get("custom:city"),
                "role": role,
            })

        response_body = {
            "counts": {
                "total_users": len(all_users),
                "admin": admin_count,
                "city_official": city_official_count,
                "citizens": citizens_count,
            },
            "users": users_data,
        }
        logger.info(("Successfully retrieved user data"))

        return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps(response_body)}

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        
        return {"statusCode": 500, "headers": CORS_HEADERS, "body": json.dumps({"error": str(e)})}
