const { randomUUID } = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) =>{
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: "",
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Files array is required" }),
      };
    }

    if (body.files.length > 10) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Maximum 10 files allowed" }),
      };
    }

    const uploadUrls = [];

    for (const filename of body.files) {
      if (!filename || typeof filename !== "string") {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Invalid filename provided" }),
        };
      }

      // Validate file extension (images only)
      const fileExtension = path.extname(filename).toLowerCase();
      const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

      if (!allowedExtensions.includes(fileExtension)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: `Invalid file type. Allowed: ${allowedExtensions.join(
              ", "
            )}`,
          }),
        };
      }

      // Generate unique filename
      const uniqueFilename = `${randomUUID()}${fileExtension}`;
      const s3Key = `temp-uploads/${uniqueFilename}`;

      // Generate signed URL
      const command = new PutObjectCommand({
        Bucket: process.env.ATTACHMENT_BUCKET,
        Key: s3Key,
        ContentType: `image/${fileExtension.slice(1)}`,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 300,
      });

      const fileUrl = `https://${process.env.ATTACHMENT_BUCKET}.s3.${
        process.env.AWS_REGION || "us-east-1"
      }.amazonaws.com/${s3Key}`;

      uploadUrls.push({
        originalFilename: filename,
        uploadUrl,
        fileUrl,
        s3Key,
      });
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        message: "Upload URLs generated successfully",
        uploadUrls,
        expiresIn: 300,
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
      statusCode,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: errorMessage,
        details: error.message,
      }),
    };
  }
};
