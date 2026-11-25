import { apiFetch } from '../../api/client';

export interface VpcItem {
  vpcId: string;
  cidrBlock: string;
  isDefault: boolean;
  state: string;
  tags?: Array<{ Key: string; Value: string }>;
}

export interface SecurityGroupRule {
  id: string;
  ruleType: string;
  protocol: string;
  fromPort?: number;
  toPort?: number;
  portRange: string;
  source: string;
  sourceType: 'IPv4 CIDR' | 'IPv6 CIDR' | 'Security Group';
  description: string;
  direction: 'inbound' | 'outbound';
  raw?: any;
}

export interface SecurityGroupItem {
  groupId: string;
  groupName: string;
  description: string;
  vpcId: string;
  ownerId?: string;
  ipPermissions?: any[];
  ipPermissionsEgress?: any[];
  inboundRules: SecurityGroupRule[];
  outboundRules: SecurityGroupRule[];
  inboundRulesCount: number;
  outboundRulesCount: number;
}

export interface CreateSecurityGroupInput {
  name: string;
  description: string;
  vpcId?: string;
}

export interface SecurityGroupRuleInput {
  protocol: string;
  portRange?: string | number;
  fromPort?: number;
  toPort?: number;
  source: string;
  description?: string;
}

export async function listVpcs(): Promise<VpcItem[]> {
  const data = await apiFetch<{ vpcs: VpcItem[] }>('/api/ec2/vpcs');
  return data.vpcs;
}

export async function listSecurityGroups(): Promise<SecurityGroupItem[]> {
  const data = await apiFetch<{ securityGroups: SecurityGroupItem[] }>('/api/ec2/security-groups');
  return data.securityGroups;
}

export async function getSecurityGroup(id: string): Promise<SecurityGroupItem> {
  return apiFetch<SecurityGroupItem>(`/api/ec2/security-groups/${encodeURIComponent(id)}`);
}

export async function createSecurityGroup(input: CreateSecurityGroupInput): Promise<SecurityGroupItem> {
  return apiFetch<SecurityGroupItem>('/api/ec2/security-groups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export async function deleteSecurityGroup(id: string): Promise<{ deleted: string }> {
  return apiFetch(`/api/ec2/security-groups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function authorizeInboundRules(
  id: string,
  rules: SecurityGroupRuleInput[] | any[]
): Promise<{ groupId: string; authorized: number }> {
  return apiFetch(`/api/ec2/security-groups/${encodeURIComponent(id)}/inbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}

export async function revokeInboundRules(
  id: string,
  rules: SecurityGroupRuleInput[] | any[]
): Promise<{ groupId: string; revoked: number }> {
  return apiFetch(`/api/ec2/security-groups/${encodeURIComponent(id)}/inbound`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}

export async function authorizeOutboundRules(
  id: string,
  rules: SecurityGroupRuleInput[] | any[]
): Promise<{ groupId: string; authorized: number }> {
  return apiFetch(`/api/ec2/security-groups/${encodeURIComponent(id)}/outbound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}

export async function revokeOutboundRules(
  id: string,
  rules: SecurityGroupRuleInput[] | any[]
): Promise<{ groupId: string; revoked: number }> {
  return apiFetch(`/api/ec2/security-groups/${encodeURIComponent(id)}/outbound`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}
