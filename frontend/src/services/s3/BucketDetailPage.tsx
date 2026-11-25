import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Container,
  ContentLayout,
  FileUpload,
  FormField,
  Header,
  Input,
  Link,
  Modal,
  SpaceBetween,
  StatusIndicator,
  Table,
  Tabs,
  TextFilter,
  Toggle,
} from '@cloudscape-design/components';
import { ConsoleLayout } from '../../components/ConsoleLayout';
import { useFlashbar } from '../../context/FlashbarContext';
import { ApiError } from '../../api/client';
import {
  deleteObject,
  emptyBucket,
  getBucketPolicy,
  getBucketVersioning,
  getDownloadUrl,
  getPublicAccessBlock,
  listObjects,
  listObjectVersions,
  putBucketVersioning,
  S3Folder,
  S3ObjectItem,
  S3ObjectVersion,
  uploadObject,
} from './s3.api';
import { computeIsBucketPublic, PermissionsTab } from './PermissionsTab';

type TableEntry = S3Folder | S3ObjectItem;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const BucketDetailPage: React.FC = () => {
  const { name = '' } = useParams<{ name: string }>();
  const bucketName = decodeURIComponent(name);
  const { addFlash } = useFlashbar();

  const [prefix, setPrefix] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  // Standard Objects
  const [folders, setFolders] = useState<S3Folder[]>([]);
  const [objects, setObjects] = useState<S3ObjectItem[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(true);
  const [selectedItems, setSelectedItems] = useState<TableEntry[]>([]);

  // Versioned Objects
  const [versions, setVersions] = useState<S3ObjectVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [selectedVersions, setSelectedVersions] = useState<S3ObjectVersion[]>([]);

  const [filterText, setFilterText] = useState('');

  // Upload modal
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Standard Delete Object Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Permanent Delete Version Modal
  const [deleteVersionModalOpen, setDeleteVersionModalOpen] = useState(false);
  const [confirmDeleteVersionText, setConfirmDeleteVersionText] = useState('');
  const [deletingVersion, setDeletingVersion] = useState(false);

  // Empty Bucket Modal
  const [emptyModalOpen, setEmptyModalOpen] = useState(false);
  const [confirmEmptyText, setConfirmEmptyText] = useState('');
  const [emptying, setEmptying] = useState(false);

  // Versioning state
  const [versioningStatus, setVersioningStatus] = useState<'Enabled' | 'Suspended' | 'Disabled'>(
    'Disabled'
  );
  const [loadingVersioning, setLoadingVersioning] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  const fetchObjects = useCallback(async () => {
    setLoadingObjects(true);
    try {
      const data = await listObjects(bucketName, prefix);
      setFolders(data.folders);
      setObjects(data.objects);
      setSelectedItems([]);
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to list objects',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoadingObjects(false);
    }
  }, [bucketName, prefix, addFlash]);

  const fetchVersions = useCallback(async () => {
    setLoadingVersions(true);
    try {
      const data = await listObjectVersions(bucketName, prefix);
      setVersions(data.all);
      setSelectedVersions([]);
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to list object versions',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoadingVersions(false);
    }
  }, [bucketName, prefix, addFlash]);

  const fetchVersioning = useCallback(async () => {
    setLoadingVersioning(true);
    try {
      const data = await getBucketVersioning(bucketName);
      setVersioningStatus(data.status);
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to get bucket versioning',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoadingVersioning(false);
    }
  }, [bucketName, addFlash]);

  useEffect(() => {
    if (showVersions) {
      fetchVersions();
    } else {
      fetchObjects();
    }
  }, [showVersions, fetchObjects, fetchVersions]);

  useEffect(() => {
    fetchVersioning();
    Promise.all([getBucketPolicy(bucketName), getPublicAccessBlock(bucketName)])
      .then(([polRes, pabRes]) => {
        setIsPublic(computeIsBucketPublic(polRes.policy, pabRes.configuration));
      })
      .catch(() => {});
  }, [fetchVersioning, bucketName]);

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        await uploadObject(bucketName, file, prefix);
      }
      addFlash({
        type: 'success',
        header: `Uploaded ${uploadFiles.length} file(s) to "${bucketName}"`,
      });
      setUploadModalOpen(false);
      setUploadFiles([]);
      if (showVersions) {
        await fetchVersions();
      } else {
        await fetchObjects();
      }
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Upload failed',
        content: apiErr.message || String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  const selectedObject =
    selectedItems.length === 1 && selectedItems[0].type === 'object' ? selectedItems[0] : null;

  const selectedVersion =
    selectedVersions.length === 1 ? selectedVersions[0] : null;

  const handleDeleteObject = async () => {
    if (!selectedObject) return;
    setDeleting(true);
    try {
      await deleteObject(bucketName, selectedObject.key);
      const isVersioningActive = versioningStatus === 'Enabled' || versioningStatus === 'Suspended';
      addFlash({
        type: 'success',
        header: isVersioningActive
          ? `Added delete marker to "${selectedObject.key}"`
          : `Deleted "${selectedObject.key}"`,
        content: isVersioningActive
          ? 'A delete marker was created. To view or permanently remove versions, enable "List versions".'
          : undefined,
      });
      setDeleteModalOpen(false);
      await fetchObjects();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Delete failed',
        content: apiErr.message || String(err),
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteVersion = async () => {
    if (!selectedVersion || confirmDeleteVersionText !== 'permanently delete') return;
    setDeletingVersion(true);
    try {
      await deleteObject(bucketName, selectedVersion.key, selectedVersion.versionId);
      addFlash({
        type: 'success',
        header: `Permanently deleted ${selectedVersion.isDeleteMarker ? 'delete marker' : 'version'}`,
        content: `Version ID: ${selectedVersion.versionId} for key "${selectedVersion.key}" was removed.`,
      });
      setDeleteVersionModalOpen(false);
      setConfirmDeleteVersionText('');
      await fetchVersions();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Delete version failed',
        content: apiErr.message || String(err),
      });
    } finally {
      setDeletingVersion(false);
    }
  };

  const handleEmptyBucket = async () => {
    if (confirmEmptyText !== 'permanently delete') return;
    setEmptying(true);
    try {
      const res = await emptyBucket(bucketName);
      addFlash({
        type: 'success',
        header: `Bucket "${bucketName}" was emptied`,
        content: `Successfully deleted ${res.deletedCount} object(s)/version(s).`,
      });
      setEmptyModalOpen(false);
      setConfirmEmptyText('');
      if (showVersions) {
        await fetchVersions();
      } else {
        await fetchObjects();
      }
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to empty bucket',
        content: apiErr.message || String(err),
      });
    } finally {
      setEmptying(false);
    }
  };

  const handleToggleVersioning = async (checked: boolean) => {
    const nextStatus = checked ? 'Enabled' : 'Suspended';
    setLoadingVersioning(true);
    try {
      await putBucketVersioning(bucketName, nextStatus);
      setVersioningStatus(nextStatus);
      addFlash({
        type: 'success',
        header: `Bucket versioning ${nextStatus.toLowerCase()}`,
      });
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to update versioning',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoadingVersioning(false);
    }
  };

  const combinedEntries: TableEntry[] = [...folders, ...objects].filter((entry) =>
    entry.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const filteredVersions = versions.filter((v) =>
    v.key.toLowerCase().includes(filterText.toLowerCase())
  );

  const prefixParts = prefix.split('/').filter(Boolean);

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'S3', href: '/s3' },
        { text: bucketName, href: `/s3/buckets/${encodeURIComponent(bucketName)}` },
      ]}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            info={isPublic ? <Badge color="red">Publicly accessible</Badge> : undefined}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  onClick={() => {
                    setConfirmEmptyText('');
                    setEmptyModalOpen(true);
                  }}
                >
                  Empty
                </Button>
              </SpaceBetween>
            }
          >
            {bucketName}
          </Header>
        }
      >
        <Tabs
          tabs={[
            {
              id: 'objects',
              label: 'Objects',
              content: (
                <SpaceBetween size="m">
                  <SpaceBetween direction="horizontal" size="l">
                    <Box>
                      <SpaceBetween direction="horizontal" size="xs">
                        <Link
                          onFollow={(e) => {
                            e.preventDefault();
                            setPrefix('');
                          }}
                        >
                          {bucketName}/
                        </Link>
                        {prefixParts.map((part, idx) => {
                          const targetPrefix = prefixParts.slice(0, idx + 1).join('/') + '/';
                          return (
                            <React.Fragment key={targetPrefix}>
                              <Link
                                onFollow={(e) => {
                                  e.preventDefault();
                                  setPrefix(targetPrefix);
                                }}
                              >
                                {part}/
                              </Link>
                            </React.Fragment>
                          );
                        })}
                      </SpaceBetween>
                    </Box>
                    <Toggle
                      checked={showVersions}
                      onChange={({ detail }) => setShowVersions(detail.checked)}
                    >
                      List versions
                    </Toggle>
                  </SpaceBetween>

                  {!showVersions ? (
                    <Table
                      loading={loadingObjects}
                      loadingText="Loading objects..."
                      selectionType="single"
                      selectedItems={selectedItems}
                      onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
                      items={combinedEntries}
                      trackBy={(item) => (item.type === 'folder' ? item.prefix : item.key)}
                      header={
                        <Header
                          counter={`(${combinedEntries.length})`}
                          actions={
                            <SpaceBetween direction="horizontal" size="xs">
                              <Button
                                iconName="refresh"
                                onClick={fetchObjects}
                                loading={loadingObjects}
                              >
                                Refresh
                              </Button>
                              <Button
                                disabled={!selectedObject}
                                href={
                                  selectedObject
                                    ? getDownloadUrl(bucketName, selectedObject.key)
                                    : undefined
                                }
                              >
                                Download
                              </Button>
                              <Button
                                disabled={!selectedObject}
                                onClick={() => setDeleteModalOpen(true)}
                              >
                                Delete
                              </Button>
                              <Button variant="primary" onClick={() => setUploadModalOpen(true)}>
                                Upload
                              </Button>
                            </SpaceBetween>
                          }
                        >
                          Objects
                        </Header>
                      }
                      filter={
                        <TextFilter
                          filteringText={filterText}
                          filteringPlaceholder="Find objects by name"
                          onChange={({ detail }) => setFilterText(detail.filteringText)}
                        />
                      }
                      columnDefinitions={[
                        {
                          id: 'name',
                          header: 'Name',
                          cell: (item) =>
                            item.type === 'folder' ? (
                              <Link
                                onFollow={(e) => {
                                  e.preventDefault();
                                  setPrefix(item.prefix);
                                }}
                              >
                                {item.name}
                              </Link>
                            ) : (
                              item.name
                            ),
                        },
                        {
                          id: 'type',
                          header: 'Type',
                          cell: (item) => (item.type === 'folder' ? 'Folder' : 'Object'),
                        },
                        {
                          id: 'size',
                          header: 'Size',
                          cell: (item) => (item.type === 'object' ? formatBytes(item.size) : '—'),
                        },
                        {
                          id: 'lastModified',
                          header: 'Last modified',
                          cell: (item) =>
                            item.type === 'object' && item.lastModified
                              ? new Date(item.lastModified).toLocaleString()
                              : '—',
                        },
                      ]}
                      empty={
                        <Box textAlign="center" color="inherit" padding="l">
                          <SpaceBetween size="m">
                            <b>No objects</b>
                            <Box variant="p" color="inherit">
                              This {prefix ? 'folder' : 'bucket'} has no objects yet.
                            </Box>
                            <Button onClick={() => setUploadModalOpen(true)}>Upload</Button>
                          </SpaceBetween>
                        </Box>
                      }
                    />
                  ) : (
                    <Table
                      loading={loadingVersions}
                      loadingText="Loading versions..."
                      selectionType="single"
                      selectedItems={selectedVersions}
                      onSelectionChange={({ detail }) => setSelectedVersions(detail.selectedItems)}
                      items={filteredVersions}
                      trackBy={(item) => `${item.key}-${item.versionId}`}
                      header={
                        <Header
                          counter={`(${filteredVersions.length})`}
                          actions={
                            <SpaceBetween direction="horizontal" size="xs">
                              <Button
                                iconName="refresh"
                                onClick={fetchVersions}
                                loading={loadingVersions}
                              >
                                Refresh
                              </Button>
                              <Button
                                disabled={!selectedVersion || selectedVersion.isDeleteMarker}
                                href={
                                  selectedVersion && !selectedVersion.isDeleteMarker
                                    ? getDownloadUrl(
                                        bucketName,
                                        selectedVersion.key,
                                        selectedVersion.versionId
                                      )
                                    : undefined
                                }
                              >
                                Download
                              </Button>
                              <Button
                                disabled={!selectedVersion}
                                onClick={() => {
                                  setConfirmDeleteVersionText('');
                                  setDeleteVersionModalOpen(true);
                                }}
                              >
                                Delete
                              </Button>
                              <Button variant="primary" onClick={() => setUploadModalOpen(true)}>
                                Upload
                              </Button>
                            </SpaceBetween>
                          }
                        >
                          Versions &amp; Delete Markers
                        </Header>
                      }
                      filter={
                        <TextFilter
                          filteringText={filterText}
                          filteringPlaceholder="Find versions by key"
                          onChange={({ detail }) => setFilterText(detail.filteringText)}
                        />
                      }
                      columnDefinitions={[
                        {
                          id: 'key',
                          header: 'Name (Key)',
                          cell: (item) => item.key,
                        },
                        {
                          id: 'versionId',
                          header: 'Version ID',
                          cell: (item) => <code>{item.versionId}</code>,
                        },
                        {
                          id: 'type',
                          header: 'Type',
                          cell: (item) =>
                            item.isDeleteMarker ? (
                              <StatusIndicator type="warning">Delete marker</StatusIndicator>
                            ) : (
                              'Object version'
                            ),
                        },
                        {
                          id: 'isLatest',
                          header: 'Latest version?',
                          cell: (item) =>
                            item.isLatest ? (
                              <StatusIndicator type="success">Yes</StatusIndicator>
                            ) : (
                              'No'
                            ),
                        },
                        {
                          id: 'size',
                          header: 'Size',
                          cell: (item) => (item.isDeleteMarker ? '—' : formatBytes(item.size)),
                        },
                        {
                          id: 'lastModified',
                          header: 'Last modified',
                          cell: (item) =>
                            item.lastModified
                              ? new Date(item.lastModified).toLocaleString()
                              : '—',
                        },
                      ]}
                      empty={
                        <Box textAlign="center" color="inherit" padding="l">
                          <SpaceBetween size="m">
                            <b>No versions</b>
                            <Box variant="p" color="inherit">
                              This bucket has no object versions or delete markers.
                            </Box>
                          </SpaceBetween>
                        </Box>
                      }
                    />
                  )}
                </SpaceBetween>
              ),
            },
            {
              id: 'properties',
              label: 'Properties',
              content: (
                <Container header={<Header variant="h2">Bucket Versioning</Header>}>
                  <SpaceBetween size="m">
                    <Box variant="p">
                      Versioning keeps multiple variants of an object in the same bucket.
                    </Box>
                    <SpaceBetween direction="horizontal" size="m">
                      <Toggle
                        checked={versioningStatus === 'Enabled'}
                        disabled={loadingVersioning}
                        onChange={({ detail }) => handleToggleVersioning(detail.checked)}
                      >
                        Enable Bucket Versioning
                      </Toggle>
                      <StatusIndicator
                        type={
                          loadingVersioning
                            ? 'loading'
                            : versioningStatus === 'Enabled'
                            ? 'success'
                            : 'stopped'
                        }
                      >
                        {loadingVersioning ? 'Updating...' : versioningStatus}
                      </StatusIndicator>
                    </SpaceBetween>
                  </SpaceBetween>
                </Container>
              ),
            },
            {
              id: 'permissions',
              label: 'Permissions',
              content: (
                <PermissionsTab bucketName={bucketName} onPublicStatusChange={setIsPublic} />
              ),
            },
          ]}
        />
      </ContentLayout>

      {/* Upload Objects Modal */}
      <Modal
        visible={uploadModalOpen}
        onDismiss={() => setUploadModalOpen(false)}
        header="Upload objects"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                loading={uploading}
                disabled={uploadFiles.length === 0}
              >
                Upload
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField
          label="Files"
          description={prefix ? `Uploading to prefix: ${prefix}` : 'Uploading to bucket root'}
        >
          <FileUpload
            onChange={({ detail }) => setUploadFiles(detail.value)}
            value={uploadFiles}
            multiple
            i18nStrings={{
              uploadButtonText: (e) => (e ? 'Choose files' : 'Choose file'),
              dropzoneText: (e) => (e ? 'Drop files to upload' : 'Drop file to upload'),
              removeFileAriaLabel: (e) => `Remove file ${e + 1}`,
              limitShowFewer: 'Show fewer files',
              limitShowMore: 'Show more files',
              errorIconAriaLabel: 'Error',
            }}
          />
        </FormField>
      </Modal>

      {/* Standard Delete Object Modal */}
      <Modal
        visible={deleteModalOpen}
        onDismiss={() => setDeleteModalOpen(false)}
        header="Delete object"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleDeleteObject} loading={deleting}>
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          {versioningStatus === 'Enabled' || versioningStatus === 'Suspended' ? (
            <Alert type="info" header="Versioning is enabled on this bucket">
              Deleting this object will add a delete marker. The current version will become a
              previous version, and the delete marker will become the latest version. To permanently
              delete specific versions, enable &quot;List versions&quot;.
            </Alert>
          ) : null}
          <Box variant="p">
            Are you sure you want to delete <strong>{selectedObject?.key}</strong>?
          </Box>
        </SpaceBetween>
      </Modal>

      {/* Permanently Delete Version Modal */}
      <Modal
        visible={deleteVersionModalOpen}
        onDismiss={() => setDeleteVersionModalOpen(false)}
        header={`Permanently delete ${selectedVersion?.isDeleteMarker ? 'delete marker' : 'version'}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteVersionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteVersion}
                loading={deletingVersion}
                disabled={confirmDeleteVersionText !== 'permanently delete'}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="error" header="Permanent deletion">
            You are about to permanently delete this {selectedVersion?.isDeleteMarker ? 'delete marker' : 'object version'}.
            This action cannot be undone.
          </Alert>
          <Box variant="p">
            Object: <strong>{selectedVersion?.key}</strong>
            <br />
            Version ID: <code>{selectedVersion?.versionId}</code>
          </Box>
          <FormField label="To confirm deletion, type permanently delete below:">
            <Input
              value={confirmDeleteVersionText}
              onChange={({ detail }) => setConfirmDeleteVersionText(detail.value)}
              placeholder="permanently delete"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Empty Bucket Modal */}
      <Modal
        visible={emptyModalOpen}
        onDismiss={() => setEmptyModalOpen(false)}
        header={`Empty bucket "${bucketName}"`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setEmptyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleEmptyBucket}
                loading={emptying}
                disabled={confirmEmptyText !== 'permanently delete'}
              >
                Empty bucket
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning" header="Empty bucket action">
            Emptying the bucket will permanently delete all objects, all object versions, and all
            delete markers. This action cannot be undone.
          </Alert>
          <Box variant="p">
            To confirm emptying, type <strong>permanently delete</strong> in the field below:
          </Box>
          <FormField label="Confirm empty action">
            <Input
              value={confirmEmptyText}
              onChange={({ detail }) => setConfirmEmptyText(detail.value)}
              placeholder="permanently delete"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </ConsoleLayout>
  );
};
