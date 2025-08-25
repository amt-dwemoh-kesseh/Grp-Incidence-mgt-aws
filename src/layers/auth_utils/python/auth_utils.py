def is_admin(event):
   
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        groups = claims.get("cognito:groups", "")

        if isinstance(groups, str):
            groups = groups.split(",")

        return "Admin" in groups
    except KeyError:
        return False
