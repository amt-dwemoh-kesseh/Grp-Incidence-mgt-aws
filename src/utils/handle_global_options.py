import os

AMPLIFY_PROD_DOMAIN = os.environ["AMPLIFY_PROD_DOMAIN"]
AMPLIFY_DEV_DOMAIN = os.environ["AMPLIFY_DEV_DOMAIN"]
AMPLIFY_LOCAL_DOMAIN = os.environ["AMPLIFY_LOCAL_DOMAIN"]

ALLOWED_ORIGINS = [
	AMPLIFY_LOCAL_DOMAIN,
	AMPLIFY_DEV_DOMAIN,
	AMPLIFY_PROD_DOMAIN
] 

CORS_HEADERS = {		
	"Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date",
	"Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT,DELETE"
}

def handler(event, context):
	# Normalize headers to lowercase
	headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
	origin = headers.get("origin")
	
	print(f"HEADERS: {event.get('headers')}")
	print(f"Received OPTIONS request from origin: {origin}")


	if origin in ALLOWED_ORIGINS:
		CORS_HEADERS.update({"Access-Control-Allow-Origin": origin})			
		return {
			"statusCode": 200,
			"headers": CORS_HEADERS,
			"body": ""
		}
	else:
		# Still return CORS headers to prevent browser from blocking error visibility
		CORS_HEADERS.update({"Access-Control-Allow-Origin": "*"})			
		return {
			"statusCode": 403,
			"headers": CORS_HEADERS,
			"body": "Origin not allowed"
		}