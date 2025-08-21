const { v4: uuidv4 } = require("uuid");
const AWS = require("aws-sdk");
const path = require("path");

exports.handler = async (event) => {
  console.log("Get upload URLs function started");
  
  try {
    const s3 = new AWS.S3();
    
    // Parse input
    const body = JSON.parse(event.body);
    
    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Files array is required" }),
      };
    }
    
    // Validate file count (optional limit)
    if (body.files.length > 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Maximum 10 files allowed" }),
      };
    }
    
    const uploadUrls = [];
    const fileKeys = [];
    
    // Generate pre-signed URLs for each file
    for (const filename of body.files) {
      if (!filename || typeof filename !== 'string') {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "Invalid filename provided" }),
        };
      }
      
      // Validate file extension (images only)
      const fileExtension = path.extname(filename).toLowerCase();
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      
      if (!allowedExtensions.includes(fileExtension)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ 
            error: `Invalid file type. Allowed: ${allowedExtensions.join(', ')}` 
          }),
        };
      }
      
      // Generate unique filename
      const uniqueFilename = `${uuidv4()}${fileExtension}`;
      const s3Key = `temp-uploads/${uniqueFilename}`;
      
      // Generate pre-signed URL for upload
      const uploadUrl = s3.getSignedUrl("putObject", {
        Bucket: process.env.ATTACHMENT_BUCKET,
        Key: s3Key,
        Expires: 300, // 5 minutes
        ContentType: `image/${fileExtension.slice(1)}`,
      });
      
      // Generate the final URL where file will be accessible
      const fileUrl = `https://${process.env.ATTACHMENT_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${s3Key}`;
      
      uploadUrls.push({
        originalFilename: filename,
        uploadUrl: uploadUrl,
        fileUrl: fileUrl,
        s3Key: s3Key
      });
      
      fileKeys.push(s3Key);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Upload URLs generated successfully",
        uploadUrls: uploadUrls,
        expiresIn: 300
      }),
    };
    
  } catch (error) {
    console.error("Error generating upload URLs:", error);
    
    let statusCode = 500;
    let errorMessage = "Failed to generate upload URLs";
    
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      statusCode = 400;
      errorMessage = "Invalid JSON in request body";
    }
    
    return {
      statusCode: statusCode,
      body: JSON.stringify({
        error: errorMessage,
        details: error.message,
      }),
    };
  }
};