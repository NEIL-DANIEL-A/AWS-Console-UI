import { apiFetch } from '../../api/client';

export interface S3Bucket {
  name: string;
  creationDate?: string;
  isPublic?: boolean;
}

export interface PublicAccessBlockConfig {
  BlockPublicAcls: boolean;
  IgnorePublicAcls: boolean;
  BlockPublicPolicy: boolean;
  RestrictPublicBuckets: boolean;
}

export interface BucketAclResponse {
  bucket: string;
  owner: { ID?: string; DisplayName?: string } | null;
  grants: Array<{
    Grantee?: { Type?: string; ID?: string; DisplayName?: string; URI?: string };
    Permission?: string;
  }>;
}

export interface S3Folder {
  prefix: string;
  name: string;
  type: 'folder';
}

export interface S3ObjectItem {
  key: string;
  name: string;
  size: number;
  lastModified?: string;
  etag?: string;
  type: 'object';
}

export interface S3ObjectVersion {
  key: string;
  versionId: string;
  isLatest: boolean;
  lastModified?: string;
  size: number;
  isDeleteMarker: boolean;
  type: 'version' | 'deleteMarker';
}

export interface ListObjectsResponse {
  bucket: string;
  prefix: string;
  folders: S3Folder[];
  objects: S3ObjectItem[];
  isTruncated: boolean;
}

export interface ListObjectVersionsResponse {
  bucket: string;
  prefix: string;
  versions: S3ObjectVersion[];
  deleteMarkers: S3ObjectVersion[];
  all: S3ObjectVersion[];
  isTruncated: boolean;
}

export interface EmptyBucketResponse {
  bucket: string;
  deletedCount: number;
  errors: Array<{ Key?: string; VersionId?: string; Code?: string; Message?: string }>;
}

export async function listBuckets(): Promise<S3Bucket[]> {
  const data = await apiFetch<{ buckets: S3Bucket[] }>('/api/s3/buckets');
  return data.buckets;
}

export async function createBucket(name: string): Promise<{ name: string }> {
  return apiFetch('/api/s3/buckets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function deleteBucket(name: string): Promise<{ deleted: string }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}

export async function emptyBucket(name: string): Promise<EmptyBucketResponse> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(name)}/empty`, {
    method: 'POST',
  });
}

export async function listObjects(bucket: string, prefix = ''): Promise<ListObjectsResponse> {
  const params = new URLSearchParams();
  if (prefix) params.set('prefix', prefix);
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects?${params.toString()}`);
}

export async function listObjectVersions(
  bucket: string,
  prefix = ''
): Promise<ListObjectVersionsResponse> {
  const params = new URLSearchParams();
  if (prefix) params.set('prefix', prefix);
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/versions?${params.toString()}`);
}

export async function uploadObject(
  bucket: string,
  file: File,
  prefix = ''
): Promise<{ bucket: string; key: string; size: number }> {
  const formData = new FormData();
  formData.append('file', file);
  if (prefix) {
    formData.append('prefix', prefix);
  }
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects`, {
    method: 'POST',
    body: formData,
  });
}

export async function deleteObject(
  bucket: string,
  key: string,
  versionId?: string
): Promise<{ deleted: string; versionId?: string }> {
  const params = new URLSearchParams({ key });
  if (versionId) {
    params.set('versionId', versionId);
  }
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/objects?${params.toString()}`, {
    method: 'DELETE',
  });
}

export function getDownloadUrl(bucket: string, key: string, versionId?: string): string {
  const params = new URLSearchParams({ key });
  if (versionId) {
    params.set('versionId', versionId);
  }
  return `/api/s3/buckets/${encodeURIComponent(bucket)}/objects/download?${params.toString()}`;
}

export async function getBucketVersioning(
  bucket: string
): Promise<{ bucket: string; status: 'Enabled' | 'Suspended' | 'Disabled' }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/versioning`);
}

export async function putBucketVersioning(
  bucket: string,
  status: 'Enabled' | 'Suspended'
): Promise<{ bucket: string; status: string }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/versioning`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function getBucketPolicy(
  bucket: string
): Promise<{ bucket: string; policy: Record<string, unknown> | null }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/policy`);
}

export async function putBucketPolicy(
  bucket: string,
  policy: string | Record<string, unknown>
): Promise<{ bucket: string; policy: Record<string, unknown> }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/policy`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy }),
  });
}

export async function deleteBucketPolicy(
  bucket: string
): Promise<{ bucket: string; deleted: boolean }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/policy`, {
    method: 'DELETE',
  });
}

export async function getPublicAccessBlock(
  bucket: string
): Promise<{ bucket: string; configuration: PublicAccessBlockConfig | null }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/public-access-block`);
}

export async function putPublicAccessBlock(
  bucket: string,
  configuration: PublicAccessBlockConfig
): Promise<{ bucket: string; configuration: PublicAccessBlockConfig }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/public-access-block`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configuration }),
  });
}

export async function deletePublicAccessBlock(
  bucket: string
): Promise<{ bucket: string; deleted: boolean }> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/public-access-block`, {
    method: 'DELETE',
  });
}

export async function getBucketAcl(bucket: string): Promise<BucketAclResponse> {
  return apiFetch(`/api/s3/buckets/${encodeURIComponent(bucket)}/acl`);
}
