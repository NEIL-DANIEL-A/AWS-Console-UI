import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  ContentLayout,
  FormField,
  Header,
  Input,
  Link,
  Modal,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { ConsoleLayout } from '../../components/ConsoleLayout';
import { useFlashbar } from '../../context/FlashbarContext';
import { ApiError } from '../../api/client';
import { createBucket, deleteBucket, emptyBucket, listBuckets, S3Bucket } from './s3.api';

export const BucketsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addFlash } = useFlashbar();

  const [buckets, setBuckets] = useState<S3Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedBuckets, setSelectedBuckets] = useState<S3Bucket[]>([]);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState('');
  const [creating, setCreating] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmBucketName, setConfirmBucketName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [emptyModalOpen, setEmptyModalOpen] = useState(false);
  const [emptyTargetName, setEmptyTargetName] = useState('');
  const [confirmEmptyText, setConfirmEmptyText] = useState('');
  const [emptying, setEmptying] = useState(false);

  const fetchBuckets = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listBuckets();
      setBuckets(data);
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to load buckets',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [addFlash]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;
    setCreating(true);
    try {
      await createBucket(newBucketName.trim());
      addFlash({
        type: 'success',
        header: `Bucket "${newBucketName.trim()}" created`,
      });
      setCreateModalOpen(false);
      setNewBucketName('');
      await fetchBuckets();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to create bucket',
        content: apiErr.message || String(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const targetBucket = selectedBuckets[0];

  const handleDeleteBucket = async () => {
    if (!targetBucket || confirmBucketName !== targetBucket.name) return;
    setDeleting(true);
    try {
      await deleteBucket(targetBucket.name);
      addFlash({
        type: 'success',
        header: `Bucket "${targetBucket.name}" deleted`,
      });
      setDeleteModalOpen(false);
      setConfirmBucketName('');
      setSelectedBuckets([]);
      await fetchBuckets();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errorName === 'BucketNotEmpty' || (apiErr.message && apiErr.message.includes('not empty'))) {
        setDeleteModalOpen(false);
        addFlash({
          type: 'error',
          header: 'BucketNotEmpty: The bucket is not empty',
          content: `The bucket "${targetBucket.name}" you tried to delete is not empty. You must delete all objects and versions in the bucket before you can delete it.`,
          buttonText: 'Empty bucket',
          onButtonClick: () => {
            setEmptyTargetName(targetBucket.name);
            setConfirmEmptyText('');
            setEmptyModalOpen(true);
          },
        });
      } else {
        addFlash({
          type: 'error',
          header: apiErr.errorName || 'Failed to delete bucket',
          content: apiErr.message || String(err),
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleEmptyBucket = async () => {
    if (!emptyTargetName || confirmEmptyText !== 'permanently delete') return;
    setEmptying(true);
    try {
      const res = await emptyBucket(emptyTargetName);
      addFlash({
        type: 'success',
        header: `Bucket "${emptyTargetName}" was emptied`,
        content: `Successfully deleted ${res.deletedCount} object(s)/version(s).`,
      });
      setEmptyModalOpen(false);
      setConfirmEmptyText('');
      await fetchBuckets();
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

  const filteredBuckets = buckets.filter((b) =>
    b.name.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <ConsoleLayout breadcrumbs={[{ text: 'S3', href: '/s3' }]}>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="Manage Amazon S3 buckets in your local AWS Emulator."
          >
            Amazon S3
          </Header>
        }
      >
        <Table
          loading={loading}
          loadingText="Loading buckets..."
          selectionType="single"
          selectedItems={selectedBuckets}
          onSelectionChange={({ detail }) => setSelectedBuckets(detail.selectedItems)}
          items={filteredBuckets}
          trackBy="name"
          header={
            <Header
              counter={`(${filteredBuckets.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button iconName="refresh" onClick={fetchBuckets} loading={loading}>
                    Refresh
                  </Button>
                  <Button
                    disabled={!targetBucket}
                    onClick={() => {
                      if (targetBucket) {
                        setEmptyTargetName(targetBucket.name);
                        setConfirmEmptyText('');
                        setEmptyModalOpen(true);
                      }
                    }}
                  >
                    Empty
                  </Button>
                  <Button
                    disabled={!targetBucket}
                    onClick={() => {
                      setConfirmBucketName('');
                      setDeleteModalOpen(true);
                    }}
                  >
                    Delete
                  </Button>
                  <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                    Create bucket
                  </Button>
                </SpaceBetween>
              }
            >
              Buckets
            </Header>
          }
          filter={
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Find buckets by name"
              onChange={({ detail }) => setFilterText(detail.filteringText)}
            />
          }
          columnDefinitions={[
            {
              id: 'name',
              header: 'Name',
              cell: (item) => (
                <Link
                  href={`/s3/buckets/${encodeURIComponent(item.name)}`}
                  onFollow={(e) => {
                    e.preventDefault();
                    navigate(`/s3/buckets/${encodeURIComponent(item.name)}`);
                  }}
                >
                  {item.name}
                </Link>
              ),
              sortingField: 'name',
            },
            {
              id: 'region',
              header: 'AWS Region',
              cell: () => 'US East (N. Virginia) us-east-1',
            },
            {
              id: 'access',
              header: 'Access',
              cell: (item) =>
                item.isPublic ? (
                  <Badge color="red">Publicly accessible</Badge>
                ) : (
                  'Bucket and objects not public'
                ),
            },
            {
              id: 'creationDate',
              header: 'Creation date',
              cell: (item) =>
                item.creationDate ? new Date(item.creationDate).toLocaleString() : '—',
            },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding="l">
              <SpaceBetween size="m">
                <b>No buckets</b>
                <Box variant="p" color="inherit">
                  You don&apos;t have any buckets in this account yet.
                </Box>
                <Button onClick={() => setCreateModalOpen(true)}>Create bucket</Button>
              </SpaceBetween>
            </Box>
          }
        />
      </ContentLayout>

      {/* Create Bucket Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create bucket"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateBucket}
                loading={creating}
                disabled={!newBucketName.trim()}
              >
                Create bucket
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <FormField
          label="Bucket name"
          description="Bucket name must be globally unique and follow DNS naming conventions."
        >
          <Input
            value={newBucketName}
            onChange={({ detail }) => setNewBucketName(detail.value)}
            placeholder="my-local-bucket"
          />
        </FormField>
      </Modal>

      {/* Delete Bucket Modal */}
      <Modal
        visible={deleteModalOpen}
        onDismiss={() => setDeleteModalOpen(false)}
        header={`Delete bucket "${targetBucket?.name}"`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteBucket}
                loading={deleting}
                disabled={confirmBucketName !== targetBucket?.name}
              >
                Delete bucket
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box variant="p">
            Deleting a bucket cannot be undone. To confirm deletion, type the name of the bucket
            below: <strong>{targetBucket?.name}</strong>
          </Box>
          <FormField label="Confirm bucket name">
            <Input
              value={confirmBucketName}
              onChange={({ detail }) => setConfirmBucketName(detail.value)}
              placeholder={targetBucket?.name}
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Empty Bucket Modal */}
      <Modal
        visible={emptyModalOpen}
        onDismiss={() => setEmptyModalOpen(false)}
        header={`Empty bucket "${emptyTargetName}"`}
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
