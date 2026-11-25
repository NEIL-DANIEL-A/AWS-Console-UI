import { Router } from 'express';
import multer from 'multer';
import {
  createBucket,
  deleteBucket,
  deleteBucketPolicy,
  deleteObject,
  deletePublicAccessBlock,
  downloadObject,
  emptyBucket,
  getBucketAcl,
  getBucketPolicy,
  getBucketVersioning,
  getPublicAccessBlock,
  listBuckets,
  listObjects,
  listObjectVersions,
  putBucketPolicy,
  putBucketVersioning,
  putPublicAccessBlock,
  uploadObject,
} from './s3.controller.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

router.get('/buckets', listBuckets);
router.post('/buckets', createBucket);
router.delete('/buckets/:name', deleteBucket);
router.post('/buckets/:name/empty', emptyBucket);

router.get('/buckets/:name/objects', listObjects);
router.post('/buckets/:name/objects', upload.single('file'), uploadObject);
router.delete('/buckets/:name/objects', deleteObject);
router.get('/buckets/:name/objects/download', downloadObject);

router.get('/buckets/:name/versions', listObjectVersions);

router.get('/buckets/:name/versioning', getBucketVersioning);
router.put('/buckets/:name/versioning', putBucketVersioning);

router.get('/buckets/:name/policy', getBucketPolicy);
router.put('/buckets/:name/policy', putBucketPolicy);
router.delete('/buckets/:name/policy', deleteBucketPolicy);

router.get('/buckets/:name/public-access-block', getPublicAccessBlock);
router.put('/buckets/:name/public-access-block', putPublicAccessBlock);
router.delete('/buckets/:name/public-access-block', deletePublicAccessBlock);

router.get('/buckets/:name/acl', getBucketAcl);

export default router;
