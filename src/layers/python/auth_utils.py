import logging
import json
import base64

logger = logging.getLogger()

def base64url_decode(data: str) -> bytes:
    # Add padding if necessary
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def is_admin(event):
    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        auth_header = headers.get("authorization")

        if not auth_header:
            logger.warning("No Authorization header found")
            return False

        # Get the token from the header
        token = auth_header.split(" ")[-1]
        parts = token.split(".")

        # Decode the payload (second part of JWT)
        payload_bytes = base64url_decode(parts[1])
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        groups = payload.get("cognito:groups", "")
        logger.warning(f"User groups from token: {groups}")
        if isinstance(groups, str):
            groups = groups.split(",")
        return "Admin" in groups
    except Exception as e:
        logger.warning(f"is_admin error: {e}")
        return False
