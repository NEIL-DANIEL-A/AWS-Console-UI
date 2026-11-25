import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  ContentLayout,
  FormField,
  Header,
  Input,
  Link,
  Modal,
  Select,
  SelectProps,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { ConsoleLayout } from '../../components/ConsoleLayout';
import { useFlashbar } from '../../context/FlashbarContext';
import { ApiError } from '../../api/client';
import {
  createSecurityGroup,
  deleteSecurityGroup,
  listSecurityGroups,
  listVpcs,
  SecurityGroupItem,
  VpcItem,
} from './ec2.api';

export const SecurityGroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const { addFlash } = useFlashbar();

  const [securityGroups, setSecurityGroups] = useState<SecurityGroupItem[]>([]);
  const [vpcs, setVpcs] = useState<VpcItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<SecurityGroupItem[]>([]);

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedVpcOption, setSelectedVpcOption] = useState<SelectProps.Option | null>(null);
  const [creating, setCreating] = useState(false);

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [confirmGroupId, setConfirmGroupId] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchSecurityGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [sgs, vpcList] = await Promise.all([listSecurityGroups(), listVpcs()]);
      setSecurityGroups(sgs);
      setVpcs(vpcList);
      if (vpcList.length > 0 && !selectedVpcOption) {
        const defaultVpc = vpcList.find((v) => v.isDefault) || vpcList[0];
        setSelectedVpcOption({
          value: defaultVpc.vpcId,
          label: `${defaultVpc.vpcId} (${defaultVpc.cidrBlock})${defaultVpc.isDefault ? ' - Default' : ''}`,
        });
      }
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to load security groups',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [addFlash, selectedVpcOption]);

  useEffect(() => {
    fetchSecurityGroups();
  }, [fetchSecurityGroups]);

  const targetGroup = selectedGroups[0];

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !newGroupDescription.trim()) return;
    setCreating(true);
    try {
      const res = await createSecurityGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        vpcId: selectedVpcOption?.value,
      });
      addFlash({
        type: 'success',
        header: `Security group "${res.groupName}" created`,
        content: `Created with ID: ${res.groupId}`,
      });
      setCreateModalOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
      await fetchSecurityGroups();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to create security group',
        content: apiErr.message || String(err),
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!targetGroup || confirmGroupId !== targetGroup.groupId) return;
    setDeleting(true);
    try {
      await deleteSecurityGroup(targetGroup.groupId);
      addFlash({
        type: 'success',
        header: `Security group "${targetGroup.groupName}" (${targetGroup.groupId}) deleted`,
      });
      setDeleteModalOpen(false);
      setConfirmGroupId('');
      setSelectedGroups([]);
      await fetchSecurityGroups();
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to delete security group',
        content: apiErr.message || String(err),
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredGroups = securityGroups.filter(
    (sg) =>
      sg.groupName.toLowerCase().includes(filterText.toLowerCase()) ||
      sg.groupId.toLowerCase().includes(filterText.toLowerCase()) ||
      sg.vpcId.toLowerCase().includes(filterText.toLowerCase()) ||
      sg.description.toLowerCase().includes(filterText.toLowerCase())
  );

  const vpcOptions: SelectProps.Option[] = vpcs.map((v) => ({
    value: v.vpcId,
    label: `${v.vpcId} (${v.cidrBlock})${v.isDefault ? ' - Default' : ''}`,
  }));

  return (
    <ConsoleLayout breadcrumbs={[{ text: 'EC2', href: '/ec2/security-groups' }, { text: 'Security Groups', href: '/ec2/security-groups' }]}>
      <ContentLayout
        header={
          <Header
            variant="h1"
            description="A security group acts as a virtual firewall for your EC2 instances to control incoming and outgoing traffic."
          >
            Security Groups
          </Header>
        }
      >
        <Table
          loading={loading}
          loadingText="Loading security groups..."
          selectionType="single"
          selectedItems={selectedGroups}
          onSelectionChange={({ detail }) => setSelectedGroups(detail.selectedItems)}
          items={filteredGroups}
          trackBy="groupId"
          header={
            <Header
              counter={`(${filteredGroups.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button iconName="refresh" onClick={fetchSecurityGroups} loading={loading}>
                    Refresh
                  </Button>
                  <Button
                    disabled={!targetGroup || targetGroup.groupName === 'default'}
                    onClick={() => {
                      setConfirmGroupId('');
                      setDeleteModalOpen(true);
                    }}
                  >
                    Delete
                  </Button>
                  <Button variant="primary" onClick={() => setCreateModalOpen(true)}>
                    Create security group
                  </Button>
                </SpaceBetween>
              }
            >
              Security Groups
            </Header>
          }
          filter={
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Filter security groups"
              onChange={({ detail }) => setFilterText(detail.filteringText)}
            />
          }
          columnDefinitions={[
            {
              id: 'groupName',
              header: 'Security group name',
              cell: (item) => (
                <Link
                  href={`/ec2/security-groups/${encodeURIComponent(item.groupId)}`}
                  onFollow={(e) => {
                    e.preventDefault();
                    navigate(`/ec2/security-groups/${encodeURIComponent(item.groupId)}`);
                  }}
                >
                  {item.groupName}
                </Link>
              ),
              sortingField: 'groupName',
            },
            {
              id: 'groupId',
              header: 'Security group ID',
              cell: (item) => (
                <Link
                  href={`/ec2/security-groups/${encodeURIComponent(item.groupId)}`}
                  onFollow={(e) => {
                    e.preventDefault();
                    navigate(`/ec2/security-groups/${encodeURIComponent(item.groupId)}`);
                  }}
                >
                  {item.groupId}
                </Link>
              ),
              sortingField: 'groupId',
            },
            {
              id: 'vpcId',
              header: 'VPC ID',
              cell: (item) => item.vpcId || '—',
              sortingField: 'vpcId',
            },
            {
              id: 'description',
              header: 'Description',
              cell: (item) => item.description || '—',
            },
            {
              id: 'inboundCount',
              header: 'Inbound rules',
              cell: (item) => item.inboundRulesCount,
            },
            {
              id: 'outboundCount',
              header: 'Outbound rules',
              cell: (item) => item.outboundRulesCount,
            },
          ]}
          empty={
            <Box textAlign="center" color="inherit" padding="l">
              <SpaceBetween size="m">
                <b>No security groups</b>
                <Box variant="p" color="inherit">
                  You don&apos;t have any custom security groups in this region yet.
                </Box>
                <Button onClick={() => setCreateModalOpen(true)}>Create security group</Button>
              </SpaceBetween>
            </Box>
          }
        />
      </ContentLayout>

      {/* Create Security Group Modal */}
      <Modal
        visible={createModalOpen}
        onDismiss={() => setCreateModalOpen(false)}
        header="Create security group"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateGroup}
                loading={creating}
                disabled={!newGroupName.trim() || !newGroupDescription.trim()}
              >
                Create security group
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <FormField
            label="Security group name"
            description="The name can contain letters, numbers, and standard punctuation."
          >
            <Input
              value={newGroupName}
              onChange={({ detail }) => setNewGroupName(detail.value)}
              placeholder="e.g. my-web-secgroup"
            />
          </FormField>
          <FormField
            label="Description"
            description="Brief explanation of the security group's purpose."
          >
            <Input
              value={newGroupDescription}
              onChange={({ detail }) => setNewGroupDescription(detail.value)}
              placeholder="e.g. Allow HTTP/HTTPS and SSH traffic"
            />
          </FormField>
          <FormField
            label="VPC"
            description="The VPC where the security group will be created."
          >
            <Select
              selectedOption={selectedVpcOption}
              onChange={({ detail }) => setSelectedVpcOption(detail.selectedOption)}
              options={vpcOptions}
              placeholder="Select a VPC"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* Delete Security Group Modal */}
      <Modal
        visible={deleteModalOpen}
        onDismiss={() => setDeleteModalOpen(false)}
        header={`Delete security group "${targetGroup?.groupName}"`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteGroup}
                loading={deleting}
                disabled={confirmGroupId !== targetGroup?.groupId}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Box variant="p">
            Are you sure you want to delete security group <strong>{targetGroup?.groupName}</strong> (<code>{targetGroup?.groupId}</code>)?
            This action cannot be undone.
          </Box>
          <FormField label="To confirm deletion, type the Security Group ID below:">
            <Input
              value={confirmGroupId}
              onChange={({ detail }) => setConfirmGroupId(detail.value)}
              placeholder={targetGroup?.groupId}
            />
          </FormField>
        </SpaceBetween>
      </Modal>
    </ConsoleLayout>
  );
};
