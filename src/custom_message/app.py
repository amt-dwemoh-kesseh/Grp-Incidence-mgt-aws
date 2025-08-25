import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    trigger = event["triggerSource"]
    user_email = event["request"]["userAttributes"].get("email", "Unknown email")
    name = event["request"]["userAttributes"].get("name", "User")

    brand_name = "CMRP"
    brand_color = "#1A1A1A"   # Bold minimal dark tone
    accent_color = "#D72638"  # Striking red accent

    def build_html_email(title, message, code=None):
        code_block = f"""
            <p style="font-size: 18px; font-weight: bold; color: {accent_color};">
                {code}
            </p>
        """ if code else ""

        return f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #F9F9F9; padding: 20px;">
                <div style="max-width: 500px; margin: auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <h1 style="color: {brand_color}; font-size: 28px; margin-bottom: 10px;">{brand_name}</h1>
                    <h2 style="color: {brand_color}; font-size: 20px; margin-bottom: 20px;">{title}</h2>
                    <p style="color: #333; font-size: 16px; line-height: 1.5;">{message}</p>
                    {code_block}
                    <p style="margin-top: 30px; font-size: 12px; color: #888;">If you did not request this, please ignore this email.</p>
                </div>
            </body>
        </html>
        """

    def build_text_email(title, message, code=None):
        text = f"{title}\n\n{message}"
        if code:
            text += f"\n\nCode: {code}"
        text += "\n\nIf you did not request this, please ignore this email."
        return text

    # -------- Trigger handlers -------- #

    if trigger == "CustomMessage_SignUp":
        logger.info(f"CustomMessage_SignUp triggered for {user_email}")

        subject = f"Welcome to {brand_name}!"
        code = event['request']['codeParameter']
        html_msg = build_html_email("Verify Your Email", f"Hi {name},<br><br>Thanks for signing up. Please use this code to verify your account:", code)
        text_msg = build_text_email("Verify Your Email", f"Hi {name}, Thanks for signing up. Please use this code to verify your account:", code)

    elif trigger == "CustomMessage_AdminCreateUser":
        logger.info(f"CustomMessage_AdminCreateUser triggered for {user_email}")

        username = name
        temp_password = event["request"]["codeParameter"]

        subject = "🎉 Welcome to CMRP – You’ve Been Invited!"
        html_msg = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333;">
            <h2 style="color:#2d89ef;">Welcome to CMRP</h2>
            <p>Hello <b>{username}</b>,</p>
            <p>You’ve been invited to <b>CMRP</b>. Please use the following details to log in:</p>
            <p><b>Username:</b> {username}<br/>
            <b>Temporary Password:</b> {temp_password}</p>
            <p>
              Click <a href="https://your-frontend-app-url/login" 
                     style="color:#2d89ef; text-decoration:none;">
                     here to log in
              </a> and reset your password.
            </p>
            <br/>
            <p>Thanks,<br/>The CMRP Team</p>
        </body>
        </html>
        """
        text_msg = (
            f"Welcome to CMRP!\n\n"
            f"Hello {username},\n\n"
            f"Username: {username}\n"
            f"Temporary Password: {temp_password}\n\n"
            f"Log in at https://your-frontend-app-url/login\n\n"
            f"Thanks,\nThe CMRP Team"
        )

    elif trigger == "CustomMessage_ForgotPassword":
        logger.info(f"CustomMessage_ForgotPassword triggered for {user_email}")

        subject = f"{brand_name} - Password Reset"
        code = event['request']['codeParameter']
        html_msg = build_html_email("Password Reset Request", "Hello,<br><br>Use this code to reset your password:", code)
        text_msg = build_text_email("Password Reset Request", "Hello, Use this code to reset your password:", code)

    elif trigger == "CustomMessage_VerifyUserAttribute":
        logger.info(f"CustomMessage_VerifyUserAttribute triggered for {user_email}")

        subject = f"{brand_name} - Verify Your Email"
        code = event['request']['codeParameter']
        html_msg = build_html_email("Verify Your Email", f"Hi {user_email},<br><br>Please use this code to verify your email address:", code)
        text_msg = build_text_email("Verify Your Email", f"Hi {user_email}, Please use this code to verify your email address:", code)

    elif trigger == "CustomMessage_UpdateUserAttribute":
        logger.info(f"CustomMessage_UpdateUserAttribute triggered for {user_email}")

        subject = f"{brand_name} - Confirm Your Update"
        code = event['request']['codeParameter']
        html_msg = build_html_email("Confirm Your Update", f"Hi {user_email},<br><br>We received a request to update your account information. Please use this code to confirm the change:", code)
        text_msg = build_text_email("Confirm Your Update", f"Hi {user_email}, We received a request to update your account information. Please use this code to confirm the change:", code)

    elif trigger == "CustomMessage_ResendCode":
        logger.info(f"CustomMessage_ResendCode triggered for {user_email}")

        subject = f"{brand_name} - Verification Code"
        code = event['request']['codeParameter']
        html_msg = build_html_email("Verification Code", f"Hi {user_email},<br><br>Here’s your requested verification code:", code)
        text_msg = build_text_email("Verification Code", f"Hi {user_email}, Here’s your requested verification code:", code)

    elif trigger == "CustomMessage_Authentication":
        logger.info(f"CustomMessage_Authentication triggered for {user_email}")

        subject = f"{brand_name} - Authentication Code"
        code = event['request']['codeParameter']
        html_msg = build_html_email("Authentication Required", f"Hi {user_email},<br><br>Please use this code to complete your sign-in:", code)
        text_msg = build_text_email("Authentication Required", f"Hi {user_email}, Please use this code to complete your sign-in:", code)

    else:
        subject = f"{brand_name} Notification"
        html_msg = build_html_email("Notification", "This is a default message.")
        text_msg = build_text_email("Notification", "This is a default message.")

    # -------- Apply to response -------- #
    event["response"]["emailSubject"] = subject
    event["response"]["emailMessage"] = text_msg
    event["response"]["emailMessageHtml"] = html_msg

    return event
