import os


AMPLIFY_DOMAIN = os.environ["AMPLIFY_DOMAIN"]

ALLOWED_ORIGINS = [
	"http://localhost:4200",
	"https://your-production-domain.com",
	AMPLIFY_DOMAIN
] 

def handler(event, context):
	
	origin = event['headers'].get('Origin')
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
