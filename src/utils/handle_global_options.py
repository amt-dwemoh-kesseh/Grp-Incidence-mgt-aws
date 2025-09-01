import os

AMPLIFY_PROD_DOMAIN = os.environ["AMPLIFY_PROD_DOMAIN"]
AMPLIFY_DEV_DOMAIN = os.environ["AMPLIFY_DEV_DOMAIN"]

ALLOWED_ORIGINS = [
	"http://localhost:4200/",
	AMPLIFY_DEV_DOMAIN,
	AMPLIFY_PROD_DOMAIN
] 

def handler(event, context):

	origin = event['headers'].get('origin')
	print(f"HEADERS: {event['headers']}")
	print(f"Received OPTIONS request from origin: {origin}")
	if origin in ALLOWED_ORIGINS:
		return {
			"statusCode": 200,
			"headers": {
				"Access-Control-Allow-Origin": origin,
				"Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date",
				"Access-Control-Allow-Methods": "OPTIONS,GET,POST,PUT"
			}
		}
	else:
		return {
			"statusCode": 403,
			"body": "Origin not allowed"
		}
