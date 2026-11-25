import path from 'node:path';
import {
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteBucketPolicyCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  DeletePublicAccessBlockCommand,
  GetBucketAclCommand,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetPublicAccessBlockCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  PutObjectCommand,
  PutPublicAccessBlockCommand,
} from '@aws-sdk/client-s3';
import { createS3Client } from '../../config/emulator.js';
import { handleAwsError } from '../../utils/errorHandler.js';

function isPublicPrincipal(principal) {
  if (principal === '*') return true;
  if (principal && typeof principal === 'object') {
    const aws = principal.AWS;
    if (aws === '*') return true;
    if (Array.isArray(aws) && aws.includes('*')) return true;
  }
  return false;
}

function hasPublicPolicyStatement(policyJson) {
  if (!policyJson) return false;
  try {
    const doc = typeof policyJson === 'string' ? JSON.parse(policyJson) : policyJson;
    const statements = Array.isArray(doc.Statement) ? doc.Statement : [];
    return statements.some((st) => st.Effect === 'Allow' && isPublicPrincipal(st.Principal));
  } catch {
    return false;
  }
}

async function checkBucketIsPublic(s3, bucketName) {
  let policy = null;
  let pab = null;

  try {
    const polRes = await s3.send(new GetBucketPolicyCommand({ Bucket: bucketName }));
    policy = polRes.Policy || null;
  } catch {
    policy = null;
  }

  if (!hasPublicPolicyStatement(policy)) {
    return false;
  }

  try {
    const pabRes = await s3.send(new GetPublicAccessBlockCommand({ Bucket: bucketName }));
    pab = pabRes.PublicAccessBlockConfiguration || null;
  } catch {
    pab = null;
  }

  // Public if policy allows Principal "*" and BlockPublicPolicy/RestrictPublicBuckets are not both enabled
  const blockedByPab = Boolean(pab && pab.BlockPublicPolicy && pab.RestrictPublicBuckets);
  return !blockedByPab;
}

export async function listBuckets(req, res) {
  try {
    const s3 = createS3Client(req);
    const data = await s3.send(new ListBucketsCommand({}));
    const rawBuckets = data.Buckets || [];
    const buckets = await Promise.all(
      rawBuckets.map(async (b) => ({
        name: b.Name,
        creationDate: b.CreationDate,
        isPublic: await checkBucketIsPublic(s3, b.Name),
      }))
    );
    res.json({ buckets });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function createBucket(req, res) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Bucket name is required' });
    }
    const s3 = createS3Client(req);
    await s3.send(new CreateBucketCommand({ Bucket: name.trim() }));
    res.status(201).json({ name: name.trim() });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function deleteBucket(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    await s3.send(new DeleteBucketCommand({ Bucket: name }));
    res.json({ deleted: name });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function listObjects(req, res) {
  try {
    const { name } = req.params;
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const s3 = createS3Client(req);
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: name,
        Prefix: prefix,
        Delimiter: '/',
      })
    );

    const folders = (data.CommonPrefixes || []).map((cp) => ({
      prefix: cp.Prefix,
      name: cp.Prefix.slice(prefix.length),
      type: 'folder',
    }));

    const objects = (data.Contents || [])
      .filter((obj) => obj.Key !== prefix)
      .map((obj) => ({
        key: obj.Key,
        name: obj.Key.slice(prefix.length),
        size: obj.Size,
        lastModified: obj.LastModified,
        etag: obj.ETag,
        type: 'object',
      }));

    res.json({
      bucket: name,
      prefix,
      folders,
      objects,
      isTruncated: Boolean(data.IsTruncated),
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function listObjectVersions(req, res) {
  try {
    const { name } = req.params;
    const prefix = typeof req.query.prefix === 'string' ? req.query.prefix : '';
    const s3 = createS3Client(req);
    const data = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: name,
        Prefix: prefix,
      })
    );

    const versions = (data.Versions || []).map((v) => ({
      key: v.Key,
      versionId: v.VersionId || 'null',
      isLatest: Boolean(v.IsLatest),
      lastModified: v.LastModified,
      size: v.Size ?? 0,
      isDeleteMarker: false,
      type: 'version',
    }));

    const deleteMarkers = (data.DeleteMarkers || []).map((dm) => ({
      key: dm.Key,
      versionId: dm.VersionId || 'null',
      isLatest: Boolean(dm.IsLatest),
      lastModified: dm.LastModified,
      size: 0,
      isDeleteMarker: true,
      type: 'deleteMarker',
    }));

    res.json({
      bucket: name,
      prefix,
      versions,
      deleteMarkers,
      all: [...versions, ...deleteMarkers],
      isTruncated: Boolean(data.IsTruncated),
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function uploadObject(req, res) {
  try {
    const { name } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: 'InvalidRequest', message: 'No file provided' });
    }

    const prefix = typeof req.body.prefix === 'string' ? req.body.prefix : '';
    const key = req.body.key || `${prefix}${req.file.originalname}`;

    const s3 = createS3Client(req);
    await s3.send(
      new PutObjectCommand({
        Bucket: name,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype || 'application/octet-stream',
      })
    );

    res.status(201).json({ bucket: name, key, size: req.file.size });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function deleteObject(req, res) {
  try {
    const { name } = req.params;
    const key = req.query.key || req.body?.key;
    const versionId = req.query.versionId || req.body?.versionId;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Object key is required' });
    }

    const s3 = createS3Client(req);
    const commandInput = {
      Bucket: name,
      Key: key,
    };
    if (versionId && typeof versionId === 'string') {
      commandInput.VersionId = versionId;
    }

    await s3.send(new DeleteObjectCommand(commandInput));
    res.json({
      bucket: name,
      deleted: key,
      ...(versionId ? { versionId } : {}),
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function downloadObject(req, res) {
  try {
    const { name } = req.params;
    const key = req.query.key;
    const versionId = req.query.versionId;

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Object key is required' });
    }

    const s3 = createS3Client(req);
    const commandInput = { Bucket: name, Key: key };
    if (versionId && typeof versionId === 'string') {
      commandInput.VersionId = versionId;
    }

    const data = await s3.send(new GetObjectCommand(commandInput));

    const filename = path.basename(key) || 'download';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    if (data.ContentType) {
      res.setHeader('Content-Type', data.ContentType);
    }
    if (data.ContentLength !== undefined) {
      res.setHeader('Content-Length', String(data.ContentLength));
    }

    if (data.Body && typeof data.Body.pipe === 'function') {
      data.Body.pipe(res);
    } else if (data.Body) {
      const bytes = await data.Body.transformToByteArray();
      res.send(Buffer.from(bytes));
    } else {
      res.end();
    }
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function emptyBucket(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    let totalDeleted = 0;
    const errors = [];

    // 1. Paginate and delete all versions and delete markers via ListObjectVersions
    let isTruncated = true;
    let keyMarker = undefined;
    let versionIdMarker = undefined;

    while (isTruncated) {
      const listCmd = new ListObjectVersionsCommand({
        Bucket: name,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      });
      const listRes = await s3.send(listCmd);
      const toDelete = [];

      for (const v of listRes.Versions || []) {
        if (v.Key) {
          toDelete.push({ Key: v.Key, VersionId: v.VersionId });
        }
      }
      for (const dm of listRes.DeleteMarkers || []) {
        if (dm.Key) {
          toDelete.push({ Key: dm.Key, VersionId: dm.VersionId });
        }
      }

      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 1000) {
          const chunk = toDelete.slice(i, i + 1000);
          const deleteRes = await s3.send(
            new DeleteObjectsCommand({
              Bucket: name,
              Delete: {
                Objects: chunk,
                Quiet: false,
              },
            })
          );
          totalDeleted += deleteRes.Deleted?.length || 0;
          if (deleteRes.Errors && deleteRes.Errors.length > 0) {
            errors.push(...deleteRes.Errors);
          }
        }
      }

      isTruncated = Boolean(listRes.IsTruncated);
      keyMarker = listRes.NextKeyMarker;
      versionIdMarker = listRes.NextVersionIdMarker;
    }

    // 2. Also ensure any remaining objects from ListObjectsV2 are cleaned up
    let listV2Truncated = true;
    let continuationToken = undefined;

    while (listV2Truncated) {
      const v2Res = await s3.send(
        new ListObjectsV2Command({
          Bucket: name,
          ContinuationToken: continuationToken,
        })
      );
      const toDelete = (v2Res.Contents || []).map((o) => ({ Key: o.Key }));

      if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 1000) {
          const chunk = toDelete.slice(i, i + 1000);
          const deleteRes = await s3.send(
            new DeleteObjectsCommand({
              Bucket: name,
              Delete: {
                Objects: chunk,
                Quiet: false,
              },
            })
          );
          totalDeleted += deleteRes.Deleted?.length || 0;
          if (deleteRes.Errors && deleteRes.Errors.length > 0) {
            errors.push(...deleteRes.Errors);
          }
        }
      }

      listV2Truncated = Boolean(v2Res.IsTruncated);
      continuationToken = v2Res.NextContinuationToken;
    }

    res.json({
      bucket: name,
      deletedCount: totalDeleted,
      errors,
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function getBucketVersioning(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    const data = await s3.send(new GetBucketVersioningCommand({ Bucket: name }));
    res.json({
      bucket: name,
      status: data.Status || 'Disabled',
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function putBucketVersioning(req, res) {
  try {
    const { name } = req.params;
    const { status } = req.body;
    if (status !== 'Enabled' && status !== 'Suspended') {
      return res.status(400).json({
        error: 'InvalidRequest',
        message: "Status must be 'Enabled' or 'Suspended'",
      });
    }

    const s3 = createS3Client(req);
    await s3.send(
      new PutBucketVersioningCommand({
        Bucket: name,
        VersioningConfiguration: { Status: status },
      })
    );
    res.json({ bucket: name, status });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function getBucketPolicy(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    const data = await s3.send(new GetBucketPolicyCommand({ Bucket: name }));
    res.json({
      bucket: name,
      policy: data.Policy ? JSON.parse(data.Policy) : null,
    });
  } catch (err) {
    if (err?.name === 'NoSuchBucketPolicy' || err?.$metadata?.httpStatusCode === 404) {
      return res.json({ bucket: req.params.name, policy: null });
    }
    handleAwsError(res, err);
  }
}

export async function putBucketPolicy(req, res) {
  try {
    const { name } = req.params;
    const rawPolicy = req.body?.policy;
    if (!rawPolicy) {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Policy is required' });
    }
    const policyStr = typeof rawPolicy === 'string' ? rawPolicy : JSON.stringify(rawPolicy);

    const s3 = createS3Client(req);
    await s3.send(new PutBucketPolicyCommand({ Bucket: name, Policy: policyStr }));
    res.json({ bucket: name, policy: JSON.parse(policyStr) });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function deleteBucketPolicy(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    await s3.send(new DeleteBucketPolicyCommand({ Bucket: name }));
    res.json({ bucket: name, deleted: true });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function getPublicAccessBlock(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    const data = await s3.send(new GetPublicAccessBlockCommand({ Bucket: name }));
    res.json({
      bucket: name,
      configuration: data.PublicAccessBlockConfiguration || null,
    });
  } catch (err) {
    if (
      err?.name === 'NoSuchPublicAccessBlockConfiguration' ||
      err?.$metadata?.httpStatusCode === 404
    ) {
      return res.json({ bucket: req.params.name, configuration: null });
    }
    handleAwsError(res, err);
  }
}

export async function putPublicAccessBlock(req, res) {
  try {
    const { name } = req.params;
    const cfg = req.body?.configuration || req.body;
    const s3 = createS3Client(req);
    await s3.send(
      new PutPublicAccessBlockCommand({
        Bucket: name,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: Boolean(cfg.BlockPublicAcls),
          IgnorePublicAcls: Boolean(cfg.IgnorePublicAcls),
          BlockPublicPolicy: Boolean(cfg.BlockPublicPolicy),
          RestrictPublicBuckets: Boolean(cfg.RestrictPublicBuckets),
        },
      })
    );
    res.json({
      bucket: name,
      configuration: {
        BlockPublicAcls: Boolean(cfg.BlockPublicAcls),
        IgnorePublicAcls: Boolean(cfg.IgnorePublicAcls),
        BlockPublicPolicy: Boolean(cfg.BlockPublicPolicy),
        RestrictPublicBuckets: Boolean(cfg.RestrictPublicBuckets),
      },
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function deletePublicAccessBlock(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    await s3.send(new DeletePublicAccessBlockCommand({ Bucket: name }));
    res.json({ bucket: name, deleted: true });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function getBucketAcl(req, res) {
  try {
    const { name } = req.params;
    const s3 = createS3Client(req);
    const data = await s3.send(new GetBucketAclCommand({ Bucket: name }));
    res.json({
      bucket: name,
      owner: data.Owner || null,
      grants: data.Grants || [],
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}
