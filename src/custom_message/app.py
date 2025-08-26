import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    trigger = event["triggerSource"]
    user_email = event["request"]["userAttributes"].get("email", "Unknown email")
    name = event["request"]["userAttributes"].get("name", "User")

    brand_name = "CMRP"
    brand_color = "#1A1A1A"  # Bold minimal dark tone
    accent_color = "#D72638" # A striking red accent for buttons or highlights

    def build_html_email(title, message, code=None):
        code_block = f"""
            <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 22px; font-weight: bold; color: #4CAF50; margin: 0;">
                  {code}
                </p>
            </div>
        """ if code else ""

        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #F9F9F9; padding: 20px;">
                <div style="max-width: 500px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h1 style="color: {brand_color}; font-size: 28px; margin-bottom: 10px;">{brand_name}</h1>
                    <h2 style="color: {brand_color}; font-size: 20px; margin-bottom: 20px;">{title}</h2>
                    <p style="color: #333; font-size: 18px; line-height: 1.5;">{message}</p>
                    {code_block}
                    <p style="margin-top: 30px; font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                </div>
            </body>
        </html>
        """

    if trigger == "CustomMessage_SignUp":
        logger.info(f"CustomMessage_SignUp triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"Welcome to {brand_name}!"
        
        verify_link = f"http://localhost:4200/verify-otp?otp={event['request']['codeParameter']}"
        
        event["response"]["emailMessage"] = build_html_email(
            title="Verify Your Email",
            message=(
                f"Hi {name},<br><br>"
                f"Thanks for signing up. Please use this code to verify your account.<br><br>"
                f"<a href='{verify_link}' "
                f"style='display:inline-block; margin-top:20px; padding:12px 20px; background-color:{accent_color}; "
                f"color:white; text-decoration:none; border-radius:6px; font-size:16px;'>"
                f"Verify Email</a><br>"
            ),
            code=event['request']['codeParameter']
        )

    elif trigger == "CustomMessage_AdminCreateUser":
        logger.info(f"CustomMessage_AdminCreateUser triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"You’ve been invited to {brand_name}"
        event["response"]["emailMessage"] = build_html_email(
            title="Your Account Invitation",
            message="Hello,<br><br>You have been invited to our Incident Reporting system. "
                    "Use the temporary password below to log in and set a new password:",
            code=event['request']['codeParameter']
        )

    elif trigger == "CustomMessage_ForgotPassword":
        logger.info(f"CustomMessage_ForgotPassword triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"{brand_name} - Password Reset"
        event["response"]["emailMessage"] = build_html_email(
            title="Password Reset Request",
            message="Hello,<br><br>Use this code to reset your password:",
            code=event['request']['codeParameter']
        )

    elif trigger == "CustomMessage_VerifyUserAttribute":
        logger.info(f"CustomMessage_VerifyUserAttribute triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"{brand_name} - Verify Your Email"
        event["response"]["emailMessage"] = build_html_email(
            title="Verify Your Email",
            message=f"Hi {name},<br><br>Please use this code to verify your email address:",
            code=event['request']['codeParameter']
        )

    elif trigger == "CustomMessage_UpdateUserAttribute":
        logger.info(f"CustomMessage_UpdateUserAttribute triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"{brand_name} - Confirm Your Update"
        event["response"]["emailMessage"] = build_html_email(
            title="Confirm Your Update",
            message=f"Hi {name},<br><br>We received a request to update your account information. "
                    "Please use this code to confirm the change:",
            code=event['request']['codeParameter']
        )

    elif trigger == "CustomMessage_ResendCode":
        logger.info(f"CustomMessage_ResendCode triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"{brand_name} - Verification Code"
        event["response"]["emailMessage"] = build_html_email(
            title="Verification Code",
            message=f"Hi {name},<br><br>Here’s your requested verification code:",
            code=event['request']['codeParameter']
        )

    elif trigger == "CustomMessage_Authentication":
        logger.info(f"CustomMessage_Authentication triggered for {user_email}")
        
        event["response"]["emailSubject"] = f"{brand_name} - Authentication Code"
        event["response"]["emailMessage"] = build_html_email(
            title="Authentication Required",
            message=f"Hi {name},<br><br>Please use this code to complete your sign-in:",
            code=event['request']['codeParameter']
        )

    else:
        event["response"]["emailSubject"] = f"{brand_name} Notification"
        event["response"]["emailMessage"] = build_html_email(
            title="Notification",
            message="This is a default message."
        )

    return event
