import json
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    try:
        logger.info(f"Lambda triggered with event: {json.dumps(event, default=str)}")
        
        # Validate event structure
        if 'triggerSource' not in event:
            logger.error("Missing triggerSource in event")
            return event
            
        if 'request' not in event:
            logger.error("Missing request in event")
            return event
            
        if 'response' not in event:
            logger.error("Missing response in event - initializing")
            event['response'] = {}

        trigger = event["triggerSource"]
        user_attributes = event["request"].get("userAttributes", {})
        user_email = user_attributes.get("email", "Unknown email")
        name = user_attributes.get("name", user_attributes.get("given_name", "User"))
        
        logger.info(f"Processing trigger: {trigger} for user: {user_email}")

        brand_name = "CMRP"
        brand_color = "#1A1A1A"   # Bold minimal dark tone
        accent_color = "#D72638"  # Striking red accent

        def build_html_email(title, message, code=None):
            code_block = f"""
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
                    <p style="font-size: 24px; font-weight: bold; color: {accent_color}; margin: 0; letter-spacing: 2px;">
                        {code}
                    </p>
                </div>
            """ if code else ""

            return f"""
            <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; background-color: #F9F9F9; padding: 20px; margin: 0;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: {brand_color}; font-size: 32px; margin: 0; font-weight: 700;">{brand_name}</h1>
                        </div>
                        <h2 style="color: {brand_color}; font-size: 24px; margin-bottom: 20px; text-align: center;">{title}</h2>
                        <div style="color: #333; font-size: 16px; line-height: 1.6;">
                            {message}
                        </div>
                        {code_block}
                        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center;">
                            If you did not request this, please ignore this email.
                        </div>
                    </div>
                </body>
            </html>
            """

        def build_text_email(title, message, code=None):
            text = f"{brand_name}\n{'=' * len(brand_name)}\n\n{title}\n\n{message}"
            if code:
                text += f"\n\nCode: {code}"
            text += "\n\n" + "-" * 50 + "\nIf you did not request this, please ignore this email."
            return text

        # Initialize response fields
        subject = f"{brand_name} Notification"
        html_msg = ""
        text_msg = ""

        # Get code parameter safely
        code_parameter = event['request'].get('codeParameter', '')
        
        # -------- Trigger handlers -------- #
        if trigger == "CustomMessage_SignUp":
            logger.info(f"CustomMessage_SignUp triggered for {user_email}")
            
            subject = f"Welcome to {brand_name} - Verify Your Email"
            html_msg = build_html_email(
                "Welcome! Verify Your Email", 
                f"<p>Hi <strong>{name}</strong>,</p><p>Welcome to {brand_name}! We're excited to have you join us.</p><p>To get started, please verify your email address using the code below:</p>", 
                code_parameter
            )
            text_msg = build_text_email(
                "Welcome! Verify Your Email", 
                f"Hi {name},\n\nWelcome to {brand_name}! We're excited to have you join us.\n\nTo get started, please verify your email address using the code below:", 
                code_parameter
            )

        elif trigger == "CustomMessage_AdminCreateUser":
            logger.info(f"CustomMessage_AdminCreateUser triggered for {user_email}")

            username = user_attributes.get("preferred_username", name)
            temp_password = code_parameter

            subject = f"🎉 Welcome to {brand_name} – You've Been Invited!"
            html_msg = f"""
            <html>
                <head><meta charset="UTF-8"></head>
                <body style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px; margin: 0;">
                    <div style="max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                        <div style="text-align: center; margin-bottom: 30px;">
                            <h1 style="color: {brand_color}; font-size: 32px; margin: 0;">{brand_name}</h1>
                        </div>
                        <h2 style="color: {accent_color}; font-size: 24px;">Welcome to {brand_name}!</h2>
                        <p style="font-size: 16px; color: #333;">Hello <strong>{username}</strong>,</p>
                        <p style="font-size: 16px; color: #333;">You've been invited to join <strong>{brand_name}</strong>. Here are your login credentials:</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0;">
                            <p style="margin: 0; font-size: 16px;"><strong>Username:</strong> {username}</p>
                            <p style="margin: 10px 0 0 0; font-size: 16px;"><strong>Temporary Password:</strong> {temp_password}</p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666;">You'll be prompted to change your password on first login.</p>
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888; text-align: center;">
                            Thanks,<br>The {brand_name} Team
                        </div>
                    </div>
                </body>
            </html>
            """
            text_msg = (
                f"Welcome to {brand_name}!\n\n"
                f"Hello {username},\n\n"
                f"You've been invited to join {brand_name}.\n\n"
                f"Username: {username}\n"
                f"Temporary Password: {temp_password}\n\n"
                f"You'll be prompted to change your password on first login.\n\n"
                f"Thanks,\nThe {brand_name} Team"
            )

        elif trigger == "CustomMessage_ForgotPassword":
            logger.info(f"CustomMessage_ForgotPassword triggered for {user_email}")

            subject = f"{brand_name} - Password Reset Request"
            html_msg = build_html_email(
                "Password Reset Request", 
                f"<p>Hello,</p><p>We received a request to reset your password for your {brand_name} account.</p><p>Use the code below to reset your password:</p>", 
                code_parameter
            )
            text_msg = build_text_email(
                "Password Reset Request", 
                f"Hello,\n\nWe received a request to reset your password for your {brand_name} account.\n\nUse the code below to reset your password:", 
                code_parameter
            )

        elif trigger == "CustomMessage_VerifyUserAttribute":
            logger.info(f"CustomMessage_VerifyUserAttribute triggered for {user_email}")

            subject = f"{brand_name} - Verify Your Email"
            html_msg = build_html_email(
                "Verify Your Email", 
                f"<p>Hi,</p><p>Please use the code below to verify your email address:</p>", 
                code_parameter
            )
            text_msg = build_text_email(
                "Verify Your Email", 
                f"Hi,\n\nPlease use the code below to verify your email address:", 
                code_parameter
            )

        elif trigger == "CustomMessage_UpdateUserAttribute":
            logger.info(f"CustomMessage_UpdateUserAttribute triggered for {user_email}")

            subject = f"{brand_name} - Confirm Your Update"
            html_msg = build_html_email(
                "Confirm Your Update", 
                f"<p>Hi,</p><p>We received a request to update your account information.</p><p>Please use the code below to confirm the change:</p>", 
                code_parameter
            )
            text_msg = build_text_email(
                "Confirm Your Update", 
                f"Hi,\n\nWe received a request to update your account information.\n\nPlease use the code below to confirm the change:", 
                code_parameter
            )

        elif trigger == "CustomMessage_ResendCode":
            logger.info(f"CustomMessage_ResendCode triggered for {user_email}")

            subject = f"{brand_name} - Verification Code"
            html_msg = build_html_email(
                "Verification Code", 
                f"<p>Hi,</p><p>Here's your requested verification code:</p>", 
                code_parameter
            )
            text_msg = build_text_email(
                "Verification Code", 
                f"Hi,\n\nHere's your requested verification code:", 
                code_parameter
            )

        elif trigger == "CustomMessage_Authentication":
            logger.info(f"CustomMessage_Authentication triggered for {user_email}")

            subject = f"{brand_name} - Authentication Code"
            html_msg = build_html_email(
                "Authentication Required", 
                f"<p>Hi,</p><p>Please use the code below to complete your sign-in:</p>", 
                code_parameter
            )
            text_msg = build_text_email(
                "Authentication Required", 
                f"Hi,\n\nPlease use the code below to complete your sign-in:", 
                code_parameter
            )

        else:
            logger.warning(f"Unhandled trigger: {trigger}")
            subject = f"{brand_name} - Notification"
            html_msg = build_html_email("Notification", "<p>This is a notification from your account.</p>")
            text_msg = build_text_email("Notification", "This is a notification from your account.")

        # -------- CRITICAL: Set response fields correctly -------- #
        event["response"]["emailSubject"] = subject
        event["response"]["emailMessage"] = text_msg
        
        # Only set HTML if supported by the trigger
        if html_msg and html_msg.strip():
            event["response"]["emailMessage"] = html_msg
        
        logger.info(f"✅ Successfully processed {trigger} for {user_email}")
        logger.info(f"📧 Email Subject: {subject}")
        logger.info(f"📝 Message Length: {len(text_msg)} chars")
        logger.info(f"🔄 Full Response: {json.dumps(event['response'], default=str)}")
        
        # Validate response structure
        required_fields = ["emailSubject", "emailMessage"]
        for field in required_fields:
            if field not in event["response"] or not event["response"][field]:
                logger.error(f"❌ Missing or empty required field: {field}")
                
        return event
        
    except KeyError as e:
        logger.error(f"Missing required field in event: {str(e)}")
        logger.error(f"Event structure: {json.dumps(event, default=str)}")
        return event
        
    except Exception as e:
        logger.error(f"Unexpected error in lambda_handler: {str(e)}", exc_info=True)
        logger.error(f"Event that caused error: {json.dumps(event, default=str)}")
        
        # Return original event to prevent blocking user operations
        return event