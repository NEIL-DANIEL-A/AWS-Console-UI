import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  ContentLayout,
  Header,
  Input,
  Select,
  SelectProps,
  SpaceBetween,
  StatusIndicator,
  Table,
} from '@cloudscape-design/components';
import { ConsoleLayout } from '../../components/ConsoleLayout';
import { useFlashbar } from '../../context/FlashbarContext';
import { ApiError } from '../../api/client';
import {
  authorizeInboundRules,
  getSecurityGroup,
  revokeInboundRules,
  SecurityGroupItem,
  SecurityGroupRule,
} from './ec2.api';

interface EditableRow {
  rowId: string;
  ruleType: string;
  protocol: string;
  portRange: string;
  source: string;
  description: string;
  originalRule?: SecurityGroupRule;
}

const RULE_TYPE_OPTIONS: SelectProps.Option[] = [
  { value: 'Custom TCP', label: 'Custom TCP' },
  { value: 'SSH', label: 'SSH (22)' },
  { value: 'HTTP', label: 'HTTP (80)' },
  { value: 'HTTPS', label: 'HTTPS (443)' },
  { value: 'Custom UDP', label: 'Custom UDP' },
  { value: 'All traffic', label: 'All traffic' },
  { value: 'All ICMP - IPv4', label: 'All ICMP - IPv4' },
  { value: 'RDP', label: 'RDP (3389)' },
  { value: 'MySQL/Aurora', label: 'MySQL/Aurora (3306)' },
  { value: 'PostgreSQL', label: 'PostgreSQL (5432)' },
];

function ruleTypeToPreset(type: string): { protocol: string; portRange: string } {
  switch (type) {
    case 'SSH':
      return { protocol: 'tcp', portRange: '22' };
    case 'HTTP':
      return { protocol: 'tcp', portRange: '80' };
    case 'HTTPS':
      return { protocol: 'tcp', portRange: '443' };
    case 'RDP':
      return { protocol: 'tcp', portRange: '3389' };
    case 'MySQL/Aurora':
      return { protocol: 'tcp', portRange: '3306' };
    case 'PostgreSQL':
      return { protocol: 'tcp', portRange: '5432' };
    case 'All traffic':
      return { protocol: '-1', portRange: 'All' };
    case 'All ICMP - IPv4':
      return { protocol: 'icmp', portRange: 'All' };
    case 'Custom UDP':
      return { protocol: 'udp', portRange: '' };
    case 'Custom TCP':
    default:
      return { protocol: 'tcp', portRange: '' };
  }
}

function normalizeSig(protocol: string, portRange: string, source: string): string {
  const normProto = protocol.toLowerCase() === 'all' ? '-1' : protocol.toLowerCase();
  const normPort = normProto === '-1' || normProto === 'icmp' ? 'all' : portRange.trim();
  const normSource = source.trim();
  return `${normProto}#${normPort}#${normSource}`;
}

export const EditInboundRulesPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const groupId = decodeURIComponent(id);
  const navigate = useNavigate();
  const { addFlash } = useFlashbar();

  const [securityGroup, setSecurityGroup] = useState<SecurityGroupItem | null>(null);
  const [initialRules, setInitialRules] = useState<SecurityGroupRule[]>([]);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSecurityGroup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSecurityGroup(groupId);
      setSecurityGroup(data);
      setInitialRules(data.inboundRules);
      setRows(
        data.inboundRules.map((r, index) => ({
          rowId: `initial-${index}-${Date.now()}`,
          ruleType: r.ruleType,
          protocol: r.protocol,
          portRange: r.portRange,
          source: r.source,
          description: r.description,
          originalRule: r,
        }))
      );
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to load security group',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, addFlash]);

  useEffect(() => {
    fetchSecurityGroup();
  }, [fetchSecurityGroup]);

  const handleAddRule = () => {
    const newRowId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setRows((prev) => [
      ...prev,
      {
        rowId: newRowId,
        ruleType: 'Custom TCP',
        protocol: 'tcp',
        portRange: '',
        source: '0.0.0.0/0',
        description: '',
      },
    ]);
  };

  const handleDeleteRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleTypeChange = (rowId: string, newType: string) => {
    const preset = ruleTypeToPreset(newType);
    setRows((prev) =>
      prev.map((r) =>
        r.rowId === rowId
          ? {
              ...r,
              ruleType: newType,
              protocol: preset.protocol,
              portRange: preset.portRange,
            }
          : r
      )
    );
  };

  const handleFieldChange = (rowId: string, field: keyof EditableRow, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowId === rowId ? { ...r, [field]: value } : r))
    );
  };

  const hasWideOpenRule = rows.some((r) => r.source.trim() === '0.0.0.0/0');

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Compute diff between initialRules and rows
      const currentSignatures = new Map<string, EditableRow>();
      for (const row of rows) {
        if (!row.source.trim()) continue;
        const sig = normalizeSig(row.protocol, row.portRange, row.source);
        currentSignatures.set(sig, row);
      }

      const initialSignatures = new Map<string, SecurityGroupRule>();
      for (const r of initialRules) {
        const sig = normalizeSig(r.protocol, r.portRange, r.source);
        initialSignatures.set(sig, r);
      }

      // Rules to revoke: in initial but not in current
      const toRevoke: any[] = [];
      for (const [sig, initialRule] of initialSignatures.entries()) {
        if (!currentSignatures.has(sig)) {
          toRevoke.push(
            initialRule.raw || {
              protocol: initialRule.protocol,
              portRange: initialRule.portRange,
              source: initialRule.source,
            }
          );
        }
      }

      // Rules to authorize: in current but not in initial
      const toAuthorize: any[] = [];
      for (const [sig, currentRow] of currentSignatures.entries()) {
        if (!initialSignatures.has(sig)) {
          toAuthorize.push({
            protocol: currentRow.protocol,
            portRange: currentRow.portRange,
            source: currentRow.source.trim(),
            description: currentRow.description.trim(),
          });
        }
      }

      // Execute revokes first
      if (toRevoke.length > 0) {
        await revokeInboundRules(groupId, toRevoke);
      }

      // Execute authorisations
      if (toAuthorize.length > 0) {
        await authorizeInboundRules(groupId, toAuthorize);
      }

      addFlash({
        type: 'success',
        header: 'Inbound rules updated successfully',
        content: `Applied changes for ${securityGroup?.groupName || groupId}: ${toAuthorize.length} added, ${toRevoke.length} revoked.`,
      });

      navigate(`/ec2/security-groups/${encodeURIComponent(groupId)}`);
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to save inbound rules',
        content: apiErr.message || String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'EC2', href: '/ec2/security-groups' },
        { text: 'Security Groups', href: '/ec2/security-groups' },
        { text: groupId, href: `/ec2/security-groups/${encodeURIComponent(groupId)}` },
        { text: 'Edit inbound rules', href: `/ec2/security-groups/${encodeURIComponent(groupId)}/edit-inbound` },
      ]}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description={`Edit inbound rules for ${securityGroup?.groupName || groupId}`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={() => navigate(`/ec2/security-groups/${encodeURIComponent(groupId)}`)}
                >
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} loading={saving}>
                  Save rules
                </Button>
              </SpaceBetween>
            }
          >
            Edit inbound rules
          </Header>
        }
      >
        <SpaceBetween size="l">
          {hasWideOpenRule && (
            <Alert
              type="warning"
              header="Rules with source 0.0.0.0/0 allow traffic from any IP address"
            >
              One or more rules allow traffic from <strong>0.0.0.0/0</strong> (all IP addresses).
              Ensure this is intended for public-facing services (e.g. HTTP/HTTPS) and avoid exposing administrative ports (like SSH) to the public internet.
            </Alert>
          )}

          <Container
            footer={
              <Box float="right">
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="link"
                    onClick={() => navigate(`/ec2/security-groups/${encodeURIComponent(groupId)}`)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={handleSave} loading={saving}>
                    Save rules
                  </Button>
                </SpaceBetween>
              </Box>
            }
          >
            <Table
              loading={loading}
              loadingText="Loading rules..."
              items={rows}
              trackBy="rowId"
              header={
                <Header
                  actions={
                    <Button onClick={handleAddRule} iconName="add-plus">
                      Add rule
                    </Button>
                  }
                >
                  Inbound rules ({rows.length})
                </Header>
              }
              columnDefinitions={[
                {
                  id: 'ruleType',
                  header: 'Type',
                  minWidth: 170,
                  cell: (row) => (
                    <Select
                      selectedOption={
                        RULE_TYPE_OPTIONS.find((o) => o.value === row.ruleType) || {
                          value: row.ruleType,
                          label: row.ruleType,
                        }
                      }
                      onChange={({ detail }) =>
                        handleTypeChange(row.rowId, detail.selectedOption.value as string)
                      }
                      options={RULE_TYPE_OPTIONS}
                    />
                  ),
                },
                {
                  id: 'protocol',
                  header: 'Protocol',
                  minWidth: 100,
                  cell: (row) => (
                    row.ruleType === 'Custom TCP' || row.ruleType === 'Custom UDP' ? (
                      <Input
                        value={row.protocol}
                        onChange={({ detail }) =>
                          handleFieldChange(row.rowId, 'protocol', detail.value)
                        }
                      />
                    ) : (
                      <code>{row.protocol === '-1' ? 'All' : row.protocol.toUpperCase()}</code>
                    )
                  ),
                },
                {
                  id: 'portRange',
                  header: 'Port range',
                  minWidth: 130,
                  cell: (row) => (
                    row.ruleType === 'Custom TCP' || row.ruleType === 'Custom UDP' ? (
                      <Input
                        value={row.portRange}
                        placeholder="e.g. 8080 or 1-65535"
                        onChange={({ detail }) =>
                          handleFieldChange(row.rowId, 'portRange', detail.value)
                        }
                      />
                    ) : (
                      <code>{row.portRange}</code>
                    )
                  ),
                },
                {
                  id: 'source',
                  header: 'Source (CIDR or SG)',
                  minWidth: 220,
                  cell: (row) => (
                    <SpaceBetween size="xxs">
                      <Input
                        value={row.source}
                        placeholder="0.0.0.0/0 or sg-..."
                        onChange={({ detail }) =>
                          handleFieldChange(row.rowId, 'source', detail.value)
                        }
                      />
                      {row.source.trim() === '0.0.0.0/0' && (
                        <StatusIndicator type="warning">Anywhere (0.0.0.0/0)</StatusIndicator>
                      )}
                    </SpaceBetween>
                  ),
                },
                {
                  id: 'description',
                  header: 'Description',
                  minWidth: 200,
                  cell: (row) => (
                    <Input
                      value={row.description}
                      placeholder="Optional description"
                      onChange={({ detail }) =>
                        handleFieldChange(row.rowId, 'description', detail.value)
                      }
                    />
                  ),
                },
                {
                  id: 'actions',
                  header: 'Action',
                  minWidth: 100,
                  cell: (row) => (
                    <Button
                      variant="normal"
                      iconName="remove"
                      onClick={() => handleDeleteRow(row.rowId)}
                    >
                      Delete
                    </Button>
                  ),
                },
              ]}
              empty={
                <Box textAlign="center" color="inherit" padding="l">
                  <SpaceBetween size="m">
                    <b>No inbound rules</b>
                    <Box variant="p" color="inherit">
                      No inbound rules defined. Add a rule to allow incoming traffic.
                    </Box>
                    <Button onClick={handleAddRule} iconName="add-plus">
                      Add rule
                    </Button>
                  </SpaceBetween>
                </Box>
              }
            />
          </Container>
        </SpaceBetween>
      </ContentLayout>
    </ConsoleLayout>
  );
};
