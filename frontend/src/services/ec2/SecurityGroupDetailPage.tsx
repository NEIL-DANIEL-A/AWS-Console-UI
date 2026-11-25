import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  SpaceBetween,
  StatusIndicator,
  Table,
  Tabs,
} from '@cloudscape-design/components';
import { ConsoleLayout } from '../../components/ConsoleLayout';
import { useFlashbar } from '../../context/FlashbarContext';
import { ApiError } from '../../api/client';
import { getSecurityGroup, SecurityGroupItem, SecurityGroupRule } from './ec2.api';

export const SecurityGroupDetailPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const groupId = decodeURIComponent(id);
  const navigate = useNavigate();
  const { addFlash } = useFlashbar();

  const [securityGroup, setSecurityGroup] = useState<SecurityGroupItem | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSecurityGroup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSecurityGroup(groupId);
      setSecurityGroup(data);
    } catch (err) {
      const apiErr = err as ApiError;
      addFlash({
        type: 'error',
        header: apiErr.errorName || 'Failed to load security group details',
        content: apiErr.message || String(err),
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, addFlash]);

  useEffect(() => {
    fetchSecurityGroup();
  }, [fetchSecurityGroup]);

  const hasWideOpenInbound = securityGroup?.inboundRules.some(
    (r) => r.source === '0.0.0.0/0'
  );

  return (
    <ConsoleLayout
      breadcrumbs={[
        { text: 'EC2', href: '/ec2/security-groups' },
        { text: 'Security Groups', href: '/ec2/security-groups' },
        { text: groupId, href: `/ec2/security-groups/${encodeURIComponent(groupId)}` },
      ]}
    >
      <ContentLayout
        header={
          <Header
            variant="h1"
            description={`Security Group: ${securityGroup?.groupName || groupId}`}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" onClick={fetchSecurityGroup} loading={loading}>
                  Refresh
                </Button>
                <Button
                  variant="primary"
                  onClick={() => navigate(`/ec2/security-groups/${encodeURIComponent(groupId)}/edit-inbound`)}
                >
                  Edit inbound rules
                </Button>
              </SpaceBetween>
            }
          >
            {securityGroup?.groupName || groupId}
          </Header>
        }
      >
        <SpaceBetween size="l">
          {hasWideOpenInbound && (
            <Alert
              type="warning"
              header="Rules with source 0.0.0.0/0 detected"
              statusIconAriaLabel="Warning"
            >
              One or more inbound rules allow traffic from <strong>0.0.0.0/0</strong> (any IP address in the world).
              We recommend limiting access to known IP addresses or specific security groups to protect your resources.
            </Alert>
          )}

          <Container header={<Header variant="h2">Security group details</Header>}>
            <ColumnLayout columns={4} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">Security group ID</Box>
                <div><code>{securityGroup?.groupId || '—'}</code></div>
              </div>
              <div>
                <Box variant="awsui-key-label">Security group name</Box>
                <div>{securityGroup?.groupName || '—'}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">VPC ID</Box>
                <div><code>{securityGroup?.vpcId || '—'}</code></div>
              </div>
              <div>
                <Box variant="awsui-key-label">Description</Box>
                <div>{securityGroup?.description || '—'}</div>
              </div>
            </ColumnLayout>
          </Container>

          <Tabs
            tabs={[
              {
                id: 'inbound',
                label: `Inbound rules (${securityGroup?.inboundRules.length || 0})`,
                content: (
                  <Table
                    loading={loading}
                    loadingText="Loading inbound rules..."
                    items={securityGroup?.inboundRules || []}
                    trackBy="id"
                    header={
                      <Header
                        actions={
                          <Button
                            onClick={() =>
                              navigate(`/ec2/security-groups/${encodeURIComponent(groupId)}/edit-inbound`)
                            }
                          >
                            Edit inbound rules
                          </Button>
                        }
                      >
                        Inbound rules
                      </Header>
                    }
                    columnDefinitions={[
                      {
                        id: 'ruleType',
                        header: 'Type',
                        cell: (item: SecurityGroupRule) => item.ruleType,
                      },
                      {
                        id: 'protocol',
                        header: 'Protocol',
                        cell: (item: SecurityGroupRule) =>
                          item.protocol === '-1' ? 'All' : item.protocol.toUpperCase(),
                      },
                      {
                        id: 'portRange',
                        header: 'Port range',
                        cell: (item: SecurityGroupRule) => item.portRange,
                      },
                      {
                        id: 'source',
                        header: 'Source',
                        cell: (item: SecurityGroupRule) => (
                          <SpaceBetween direction="horizontal" size="xs">
                            <code>{item.source}</code>
                            {item.source === '0.0.0.0/0' && (
                              <StatusIndicator type="warning">Public</StatusIndicator>
                            )}
                          </SpaceBetween>
                        ),
                      },
                      {
                        id: 'description',
                        header: 'Description',
                        cell: (item: SecurityGroupRule) => item.description || '—',
                      },
                    ]}
                    empty={
                      <Box textAlign="center" color="inherit" padding="l">
                        <SpaceBetween size="m">
                          <b>No inbound rules</b>
                          <Box variant="p" color="inherit">
                            No inbound rules are currently configured for this security group.
                          </Box>
                          <Button
                            onClick={() =>
                              navigate(`/ec2/security-groups/${encodeURIComponent(groupId)}/edit-inbound`)
                            }
                          >
                            Edit inbound rules
                          </Button>
                        </SpaceBetween>
                      </Box>
                    }
                  />
                ),
              },
              {
                id: 'outbound',
                label: `Outbound rules (${securityGroup?.outboundRules.length || 0})`,
                content: (
                  <Table
                    loading={loading}
                    loadingText="Loading outbound rules..."
                    items={securityGroup?.outboundRules || []}
                    trackBy="id"
                    header={<Header>Outbound rules</Header>}
                    columnDefinitions={[
                      {
                        id: 'ruleType',
                        header: 'Type',
                        cell: (item: SecurityGroupRule) => item.ruleType,
                      },
                      {
                        id: 'protocol',
                        header: 'Protocol',
                        cell: (item: SecurityGroupRule) =>
                          item.protocol === '-1' ? 'All' : item.protocol.toUpperCase(),
                      },
                      {
                        id: 'portRange',
                        header: 'Port range',
                        cell: (item: SecurityGroupRule) => item.portRange,
                      },
                      {
                        id: 'source',
                        header: 'Destination',
                        cell: (item: SecurityGroupRule) => <code>{item.source}</code>,
                      },
                      {
                        id: 'description',
                        header: 'Description',
                        cell: (item: SecurityGroupRule) => item.description || '—',
                      },
                    ]}
                    empty={
                      <Box textAlign="center" color="inherit" padding="l">
                        <b>No outbound rules</b>
                      </Box>
                    }
                  />
                ),
              },
            ]}
          />
        </SpaceBetween>
      </ContentLayout>
    </ConsoleLayout>
  );
};
