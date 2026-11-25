import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  ColumnLayout,
  Container,
  FormField,
  Header,
  Input,
  Modal,
  SpaceBetween,
  StatusIndicator,
  Table,
  Textarea,
} from '@cloudscape-design/components';
import { useFlashbar } from '../../context/FlashbarContext';
import { ApiError } from '../../api/client';
import {
  BucketAclResponse,
  deleteBucketPolicy,
  getBucketAcl,
  getBucketPolicy,
  getPublicAccessBlock,
  PublicAccessBlockConfig,
  putBucketPolicy,
  putPublicAccessBlock,
} from './s3.api';

interface PermissionsTabProps {
  bucketName: string;
  onPublicStatusChange?: (isPublic: boolean) => void;
}

const DEFAULT_PAB: PublicAccessBlockConfig = {
  BlockPublicAcls: true,
  IgnorePublicAcls: true,
  BlockPublicPolicy: true,
  RestrictPublicBuckets: true,
};

function isPublicPrincipal(principal: unknown): boolean {
  if (principal === '*') return true;
  if (principal && typeof principal === 'object') {
    const aws = (principal as Record<string, unknown>).AWS;
    if (aws === '*') return true;
    if (Array.isArray(aws) && aws.includes('*')) return true;
  }
  return false;
}

export function computeIsBucketPublic(
  policy: Record<string, unknown> | null,
  pab: PublicAccessBlockConfig | null
): boolean {
  if (!policy) return false;
  const statements = Array.isArray(policy.Statement) ? policy.Statement : [];
  const hasPublicPolicy = statements.some(
    (st: Record<string, unknown>) => st.Effect === 'Allow' && isPublicPrincipal(st.Principal)
  );
  if (!hasPublicPolicy) return false;
  const blockedByPab = Boolean(pab && pab.BlockPublicPolicy && pab.RestrictPublicBuckets);
  return !blockedByPab;
}

export const PermissionsTab: React.FC<PermissionsTabProps> = ({
  bucketName,
  onPublicStatusChange,
}) => {
  const { addFlash } = useFlashbar();

  const [loading, setLoading] = useState(true);
  const [pab, setPab] = useState<PublicAccessBlockConfig | null>(null);
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null);
  const [acl, setAcl] = useState<BucketAclResponse | null>(null);

  // Edit Public Access Block state
  const [editingPab, setEditingPab] = useState(false);
  const [draftPab, setDraftPab] = useState<PublicAccessBlockConfig>(DEFAULT_PAB);
  const [confirmUnblockModalOpen, setConfirmUnblockModalOpen] = useState(false);
  const [confirmUnblockText, setConfirmUnblockText] = useState('');
  const [savingPab, setSavingPab] = useState(false);

  // Edit Bucket Policy state
  const [editingPolicy, setEditingPolicy] = useState(false);
  const [draftPolicyText, setDraftPolicyText] = useState('');
  const [policyValidationError, setPolicyValidationError] = useState<string | undefined>(undefined);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Delete Bucket Policy Modal
  const [deletePolicyModalOpen, setDeletePolicyModalOpen] = useState(false);
  const [confirmDeletePolicyText, setConfirmDeletePolicyText] = useState('');
  const [deletingPolicy, setDeletingPolicy] = useState(false);

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const [pabRes, polRes, aclRes] = await Promise.all([
        getPublicAccessBlock(bucketName),
        getBucketPolicy(bucketName),
        getBucketAcl(bucketName),
      ]);
      setPab(pabRes.configuration);
      setPolicy(polRes.policy);
      setAcl(aclRes);
      onPublicStatusChange?.(computeIsBucketPublic(polRes.policy, pabRes.configuration));
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to load bucket permissions',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [bucketName, addFlash, onPublicStatusChange]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const effectivePab = pab || DEFAULT_PAB;
  const allDraftBlocked =
    draftPab.BlockPublicAcls &&
    draftPab.IgnorePublicAcls &&
    draftPab.BlockPublicPolicy &&
    draftPab.RestrictPublicBuckets;
  const someDraftBlocked =
    draftPab.BlockPublicAcls ||
    draftPab.IgnorePublicAcls ||
    draftPab.BlockPublicPolicy ||
    draftPab.RestrictPublicBuckets;

  const isUnblocking =
    !draftPab.BlockPublicAcls ||
    !draftPab.IgnorePublicAcls ||
    !draftPab.BlockPublicPolicy ||
    !draftPab.RestrictPublicBuckets;

  const handleSavePabClick = () => {
    if (isUnblocking) {
      setConfirmUnblockText('');
      setConfirmUnblockModalOpen(true);
    } else {
      executeSavePab();
    }
  };

  const executeSavePab = async () => {
    setSavingPab(true);
    try {
      await putPublicAccessBlock(bucketName, draftPab);
      addFlash({
        type: 'success',
        header: 'Block Public Access settings updated',
      });
      setConfirmUnblockModalOpen(false);
      setEditingPab(false);
      await fetchPermissions();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to update Block Public Access',
        content: apiErr.message || String(err),
      });
    } finally {
      setSavingPab(false);
    }
  };

  const handlePolicyTextChange = (val: string) => {
    setDraftPolicyText(val);
    if (!val.trim()) {
      setPolicyValidationError('Policy JSON cannot be empty. Use Delete to remove a policy.');
      return;
    }
    try {
      const parsed = JSON.parse(val);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setPolicyValidationError('Policy must be a valid JSON object.');
      } else {
        setPolicyValidationError(undefined);
      }
    } catch (e) {
      setPolicyValidationError(`Invalid JSON: ${(e as Error).message}`);
    }
  };

  const handleSavePolicy = async () => {
    if (policyValidationError || !draftPolicyText.trim()) return;
    setSavingPolicy(true);
    try {
      await putBucketPolicy(bucketName, draftPolicyText);
      addFlash({
        type: 'success',
        header: 'Bucket policy saved',
      });
      setEditingPolicy(false);
      await fetchPermissions();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to save bucket policy',
        content: apiErr.message || String(err),
      });
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (confirmDeletePolicyText !== 'delete') return;
    setDeletingPolicy(true);
    try {
      await deleteBucketPolicy(bucketName);
      addFlash({
        type: 'success',
        header: 'Bucket policy deleted',
      });
      setDeletePolicyModalOpen(false);
      setConfirmDeletePolicyText('');
      await fetchPermissions();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to delete bucket policy',
        content: apiErr.message || String(err),
      });
    } finally {
      setDeletingPolicy(false);
    }
  };

  const isPublic = computeIsBucketPublic(policy, pab);

  return (
    <SpaceBetween size="l">
      {isPublic && (
        <Alert type="warning" header="This bucket is publicly accessible">
          A bucket policy grants access to <code>Principal: &quot;*&quot;</code> and Block Public
          Access is not blocking public policies. Remove the public policy or enable Block Public
          Access to make this bucket private.
        </Alert>
      )}

      {/* 1. Block public access (bucket settings) */}
      <Container
        header={
          <Header
            variant="h2"
            info={isPublic ? <Badge color="red">Publicly accessible</Badge> : undefined}
            actions={
              !editingPab ? (
                <Button
                  disabled={loading}
                  onClick={() => {
                    setDraftPab({ ...effectivePab });
                    setEditingPab(true);
                  }}
                >
                  Edit
                </Button>
              ) : (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => setEditingPab(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSavePabClick} loading={savingPab}>
                    Save changes
                  </Button>
                </SpaceBetween>
              )
            }
          >
            Block public access (bucket settings)
          </Header>
        }
      >
        {!editingPab ? (
          <ColumnLayout columns={2} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Block all public access</Box>
              <StatusIndicator
                type={
                  effectivePab.BlockPublicAcls &&
                  effectivePab.IgnorePublicAcls &&
                  effectivePab.BlockPublicPolicy &&
                  effectivePab.RestrictPublicBuckets
                    ? 'success'
                    : 'warning'
                }
              >
                {effectivePab.BlockPublicAcls &&
                effectivePab.IgnorePublicAcls &&
                effectivePab.BlockPublicPolicy &&
                effectivePab.RestrictPublicBuckets
                  ? 'On'
                  : 'Off'}
              </StatusIndicator>
            </div>
            <div>
              <Box variant="awsui-key-label">BlockPublicAcls</Box>
              <StatusIndicator type={effectivePab.BlockPublicAcls ? 'success' : 'stopped'}>
                {effectivePab.BlockPublicAcls ? 'On' : 'Off'}
              </StatusIndicator>
            </div>
            <div>
              <Box variant="awsui-key-label">IgnorePublicAcls</Box>
              <StatusIndicator type={effectivePab.IgnorePublicAcls ? 'success' : 'stopped'}>
                {effectivePab.IgnorePublicAcls ? 'On' : 'Off'}
              </StatusIndicator>
            </div>
            <div>
              <Box variant="awsui-key-label">BlockPublicPolicy</Box>
              <StatusIndicator type={effectivePab.BlockPublicPolicy ? 'success' : 'stopped'}>
                {effectivePab.BlockPublicPolicy ? 'On' : 'Off'}
              </StatusIndicator>
            </div>
            <div>
              <Box variant="awsui-key-label">RestrictPublicBuckets</Box>
              <StatusIndicator type={effectivePab.RestrictPublicBuckets ? 'success' : 'stopped'}>
                {effectivePab.RestrictPublicBuckets ? 'On' : 'Off'}
              </StatusIndicator>
            </div>
          </ColumnLayout>
        ) : (
          <SpaceBetween size="m">
            <Checkbox
              checked={allDraftBlocked}
              indeterminate={!allDraftBlocked && someDraftBlocked}
              onChange={({ detail }) =>
                setDraftPab({
                  BlockPublicAcls: detail.checked,
                  IgnorePublicAcls: detail.checked,
                  BlockPublicPolicy: detail.checked,
                  RestrictPublicBuckets: detail.checked,
                })
              }
            >
              <strong>Block all public access</strong>
            </Checkbox>
            <Box margin={{ left: 'l' }}>
              <SpaceBetween size="xs">
                <Checkbox
                  checked={draftPab.BlockPublicAcls}
                  onChange={({ detail }) =>
                    setDraftPab((p) => ({ ...p, BlockPublicAcls: detail.checked }))
                  }
                >
                  Block public access to buckets and objects granted through <i>new</i> access
                  control lists (ACLs)
                </Checkbox>
                <Checkbox
                  checked={draftPab.IgnorePublicAcls}
                  onChange={({ detail }) =>
                    setDraftPab((p) => ({ ...p, IgnorePublicAcls: detail.checked }))
                  }
                >
                  Block public access to buckets and objects granted through <i>any</i> access
                  control lists (ACLs)
                </Checkbox>
                <Checkbox
                  checked={draftPab.BlockPublicPolicy}
                  onChange={({ detail }) =>
                    setDraftPab((p) => ({ ...p, BlockPublicPolicy: detail.checked }))
                  }
                >
                  Block public access to buckets and objects granted through <i>new</i> public
                  bucket or access point policies
                </Checkbox>
                <Checkbox
                  checked={draftPab.RestrictPublicBuckets}
                  onChange={({ detail }) =>
                    setDraftPab((p) => ({ ...p, RestrictPublicBuckets: detail.checked }))
                  }
                >
                  Block public and cross-account access to buckets and objects through <i>any</i>{' '}
                  public bucket or access point policies
                </Checkbox>
              </SpaceBetween>
            </Box>
          </SpaceBetween>
        )}
      </Container>

      {/* 2. Bucket policy */}
      <Container
        header={
          <Header
            variant="h2"
            actions={
              !editingPolicy ? (
                <SpaceBetween direction="horizontal" size="xs">
                  {policy && (
                    <Button
                      onClick={() => {
                        setConfirmDeletePolicyText('');
                        setDeletePolicyModalOpen(true);
                      }}
                    >
                      Delete
                    </Button>
                  )}
                  <Button
                    disabled={loading}
                    onClick={() => {
                      const initial = policy
                        ? JSON.stringify(policy, null, 2)
                        : JSON.stringify(
                            {
                              Version: '2012-10-17',
                              Statement: [
                                {
                                  Sid: 'PublicReadGetObject',
                                  Effect: 'Allow',
                                  Principal: '*',
                                  Action: 's3:GetObject',
                                  Resource: `arn:aws:s3:::${bucketName}/*`,
                                },
                              ],
                            },
                            null,
                            2
                          );
                      setDraftPolicyText(initial);
                      setPolicyValidationError(undefined);
                      setEditingPolicy(true);
                    }}
                  >
                    Edit
                  </Button>
                </SpaceBetween>
              ) : (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => setEditingPolicy(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSavePolicy}
                    loading={savingPolicy}
                    disabled={Boolean(policyValidationError) || !draftPolicyText.trim()}
                  >
                    Save changes
                  </Button>
                </SpaceBetween>
              )
            }
          >
            Bucket policy
          </Header>
        }
      >
        {!editingPolicy ? (
          policy ? (
            <pre
              style={{
                background: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                overflowX: 'auto',
                margin: 0,
                fontSize: '13px',
              }}
            >
              <code>{JSON.stringify(policy, null, 2)}</code>
            </pre>
          ) : (
            <Box color="text-body-secondary">No bucket policy</Box>
          )
        ) : (
          <FormField label="Policy" errorText={policyValidationError}>
            <Textarea
              rows={12}
              value={draftPolicyText}
              onChange={({ detail }) => handlePolicyTextChange(detail.value)}
            />
          </FormField>
        )}
      </Container>

      {/* 3. Access control list (ACL) */}
      <Container header={<Header variant="h2">Access control list (ACL)</Header>}>
        <SpaceBetween size="m">
          <Alert type="info" header="Bucket owner enforced (ACLs disabled)">
            Object Ownership is set to <strong>Bucket owner enforced</strong>. ACLs are disabled
            and read-only; all objects in this bucket are owned by the bucket owner and access is
            controlled exclusively by policies.
          </Alert>
          <Table
            loading={loading}
            items={acl?.grants || []}
            columnDefinitions={[
              {
                id: 'grantee',
                header: 'Grantee',
                cell: (g) =>
                  g.Grantee?.DisplayName || g.Grantee?.URI || g.Grantee?.ID || 'Bucket owner',
              },
              {
                id: 'type',
                header: 'Type',
                cell: (g) => g.Grantee?.Type || '—',
              },
              {
                id: 'permission',
                header: 'Permission',
                cell: (g) => g.Permission || '—',
              },
            ]}
            empty={<Box color="text-body-secondary">No ACL grants</Box>}
          />
        </SpaceBetween>
      </Container>

      {/* Confirm Unblocking Public Access Modal */}
      <Modal
        visible={confirmUnblockModalOpen}
        onDismiss={() => setConfirmUnblockModalOpen(false)}
        header="Confirm Block Public Access settings"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setConfirmUnblockModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={executeSavePab}
                loading={savingPab}
                disabled={confirmUnblockText !== 'confirm'}
              >
                Confirm
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning" header="Turning off Block Public Access">
            Turning off Block Public Access settings might result in this bucket and its objects
            becoming public.
          </Alert>
          <FormField label="To confirm, type confirm below:">
            <Input
              value={confirmUnblockText}
              onChange={({ detail }) => setConfirmUnblockText(detail.value)}
              placeholder="confirm"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Confirm Delete Bucket Policy Modal */}
      <Modal
        visible={deletePolicyModalOpen}
        onDismiss={() => setDeletePolicyModalOpen(false)}
        header="Delete bucket policy"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeletePolicyModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeletePolicy}
                loading={deletingPolicy}
                disabled={confirmDeletePolicyText !== 'delete'}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box variant="p">
            Are you sure you want to delete the bucket policy for <strong>{bucketName}</strong>?
          </Box>
          <FormField label="To confirm deletion, type delete below:">
            <Input
              value={confirmDeletePolicyText}
              onChange={({ detail }) => setConfirmDeletePolicyText(detail.value)}
              placeholder="delete"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </SpaceBetween>
  );
};
