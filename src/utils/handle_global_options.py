import os

AMPLIFY_PROD_DOMAIN = os.environ["AMPLIFY_PROD_DOMAIN"]
AMPLIFY_DEV_DOMAIN = os.environ["AMPLIFY_DEV_DOMAIN"]
AMPLIFY_LOCAL_DOMAIN = os.environ["AMPLIFY_LOCAL_DOMAIN"]

ALLOWED_ORIGINS = [
    AMPLIFY_LOCAL_DOMAIN
    AMPLIFY_DEV_DOMAIN,
    AMPLIFY_PROD_DOMAIN
] 

def handler(event, context):
    # Normalize headers to lowercase
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = headers.get("origin")
    
    print(f"HEADERS: {event.get('headers')}")
    print(f"Received OPTIONS request from origin: {origin}")

    if origin in ALLOWED_ORIGINS:
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT"
            },
            "body": ""
        }
    else:
        # Still return CORS headers to prevent browser from blocking error visibility
        return {
            "statusCode": 403,
            "headers": {
                "Access-Control-Allow-Origin": "*",  # fallback for debugging
                "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date",
                "Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT"
            },
            "body": "Origin not allowed"
        }