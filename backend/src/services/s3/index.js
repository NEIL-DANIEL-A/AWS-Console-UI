"use strict";

const { createS3Client } = require("../../s3-client");
const {
  ListBucketsCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetBucketVersioningCommand,
  PutBucketVersioningCommand,
} = require("@aws-sdk/client-s3");

const PASS_THROUGH_ERROR_STATUS = 501;

/**
 * Extract a serializable error from an AWS SDK error so the frontend receives
 * the AWS error name and message unchanged.
 */
function sdkErrorToPayload(err) {
  return {
    name: err.name || "Error",
    message: err.message || String(err),
    statusCode: err.$metadata && err.$metadata.httpStatusCode
      ? err.$metadata.httpStatusCode
      : 500,
  };
}

function isNotImplemented(err) {
  return (
    err.$metadata && err.$metadata.httpStatusCode === PASS_THROUGH_ERROR_STATUS
  );
}

const s3Service = {
  async listBuckets() {
    const client = createS3Client();
    const { Buckets = [] } = await client.send(new ListBucketsCommand({}));
    return Buckets.map((b) => ({
      name: b.Name,
      creationDate: b.CreationDate,
    }));
  },

  async createBucket(name) {
    const client = createS3Client();
    // us-east-1: do not send CreateBucketConfiguration (LocationConstraint
    // for us-east-1 causes an error).
    await client.send(new CreateBucketCommand({ Bucket: name }));
    return { name };
  },

  async deleteBucket(name) {
    const client = createS3Client();
    await client.send(new DeleteBucketCommand({ Bucket: name }));
    return { name };
  },

  async listObjects(bucket, prefix) {
    const client = createS3Client();
    const input = { Bucket: bucket };
    if (prefix !== undefined && prefix !== "") {
      input.Prefix = prefix;
    }
    // Delimiter "/" groups objects under common prefixes (folders).
    input.Delimiter = "/";

    const output = await client.send(new ListObjectsV2Command(input));

    const folders = (output.CommonPrefixes || []).map((cp) => ({
      key: cp.Prefix,
      type: "folder",
      size: 0,
      lastModified: null,
    }));

    const objects = (output.Contents || [])
      .filter((o) => o.Key !== prefix) // exclude the "folder" object itself
      .map((o) => ({
        key: o.Key,
        type: o.Key.endsWith("/") ? "folder" : "object",
        size: o.Size,
        lastModified: o.LastModified,
        eTag: o.ETag,
      }));

    return { folders, objects, isTruncated: output.IsTruncated };
  },

  async uploadObject(bucket, key, filePath, contentType) {
    const fs = require("fs");
    const client = createS3Client();
    const body = fs.createReadStream(filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return { bucket, key };
  },

  async deleteObject(bucket, key) {
    const client = createS3Client();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { bucket, key };
  },

  async downloadObject(bucket, key) {
    const client = createS3Client();
    const output = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );
    return output;
  },

  async getVersioning(bucket) {
    const client = createS3Client();
    const output = await client.send(
      new GetBucketVersioningCommand({ Bucket: bucket })
    );
    const status = output.Status; // Enabled | Suspended | undefined
    return { enabled: status === "Enabled" };
  },

  async putVersioning(bucket, enabled) {
    const client = createS3Client();
    await client.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: enabled ? "Enabled" : "Suspended" },
      })
    );
    return { bucket, enabled };
  },
};

module.exports = {
  s3Service,
  sdkErrorToPayload,
  isNotImplemented,
};
