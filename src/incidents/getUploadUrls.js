const { randomUUID } = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const path = require("path");

// Configure S3 client to avoid automatic checksums
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  // Disable automatic request checksums
  requestChecksumCalculation: "WHEN_REQUIRED"
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
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

    for (const file of body.files) {
      if (!file || typeof file.name !== "string" || typeof file.type !== "string") {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: "Each file must include { name, type }",
          }),
        };
      }

      // Validate file extension
      const fileExtension = path.extname(file.name).toLowerCase();
      const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      if (!allowedExtensions.includes(fileExtension)) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            error: `Invalid file type. Allowed: ${allowedExtensions.join(", ")}`,
          }),
        };
      }

      // Generate unique filename
      const uniqueFilename = `${randomUUID()}${fileExtension}`;
      const s3Key = `temp-uploads/${uniqueFilename}`;

      // Create PutObjectCommand without checksum parameters
      const command = new PutObjectCommand({
        Bucket: process.env.ATTACHMENT_BUCKET,
        Key: s3Key,
        ContentType: file.type,
        // Explicitly avoid checksum parameters
      });

      // Generate presigned URL with minimal parameters
      const uploadUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 300, // 5 minutes
        // Only sign the host header to avoid extra parameters
        signableHeaders: new Set(['host', 'content-type']),
        // Disable any additional signing parameters
        unhoistableHeaders: new Set()
      });

      // Construct the file URL for later access
      const fileUrl = `https://${process.env.ATTACHMENT_BUCKET}.s3.${
        process.env.AWS_REGION || "us-east-1"
      }.amazonaws.com/${s3Key}`;

      uploadUrls.push({
        originalFilename: file.name,
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
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Failed to generate upload URLs",
        details: error.message,
      }),
    };
  }
};