import {
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateSecurityGroupCommand,
  DeleteSecurityGroupCommand,
  DescribeSecurityGroupsCommand,
  DescribeVpcsCommand,
  RevokeSecurityGroupEgressCommand,
  RevokeSecurityGroupIngressCommand,
} from '@aws-sdk/client-ec2';
import { createEC2Client } from '../../config/emulator.js';
import { handleAwsError } from '../../utils/errorHandler.js';

/**
 * Normalize and convert high-level or raw rule objects into EC2 IpPermission structure.
 */
export function formatRuleToIpPermission(rule) {
  if (rule.IpProtocol !== undefined) {
    return rule;
  }

  let protocol = rule.protocol ? String(rule.protocol).toLowerCase() : 'tcp';
  if (protocol === 'all') protocol = '-1';

  let fromPort = undefined;
  let toPort = undefined;

  if (protocol !== '-1') {
    if (rule.portRange !== undefined && rule.portRange !== null && rule.portRange !== '') {
      const portStr = String(rule.portRange).trim();
      if (portStr.toLowerCase() === 'all') {
        fromPort = undefined;
        toPort = undefined;
      } else if (portStr.includes('-')) {
        const [f, t] = portStr.split('-').map((s) => parseInt(s.trim(), 10));
        fromPort = isNaN(f) ? undefined : f;
        toPort = isNaN(t) ? undefined : t;
      } else {
        const p = parseInt(portStr, 10);
        if (!isNaN(p)) {
          fromPort = p;
          toPort = p;
        }
      }
    } else {
      if (rule.fromPort !== undefined && rule.fromPort !== null && rule.fromPort !== '') {
        const fp = parseInt(String(rule.fromPort), 10);
        if (!isNaN(fp)) fromPort = fp;
      }
      if (rule.toPort !== undefined && rule.toPort !== null && rule.toPort !== '') {
        const tp = parseInt(String(rule.toPort), 10);
        if (!isNaN(tp)) toPort = tp;
      }
    }
  }

  const source = rule.source ? String(rule.source).trim() : '0.0.0.0/0';
  const description = rule.description || undefined;

  const ipPermission = {
    IpProtocol: protocol,
  };

  if (fromPort !== undefined) ipPermission.FromPort = fromPort;
  if (toPort !== undefined) ipPermission.ToPort = toPort;

  if (source.startsWith('sg-')) {
    ipPermission.UserIdGroupPairs = [
      {
        GroupId: source,
        ...(description ? { Description: description } : {}),
      },
    ];
  } else if (source.includes(':')) {
    ipPermission.Ipv6Ranges = [
      {
        CidrIpv6: source,
        ...(description ? { Description: description } : {}),
      },
    ];
  } else {
    ipPermission.IpRanges = [
      {
        CidrIp: source,
        ...(description ? { Description: description } : {}),
      },
    ];
  }

  return ipPermission;
}

/**
 * Flatten EC2 IpPermissions into individual rule entries for the UI.
 */
export function flattenRules(ipPermissions, direction = 'inbound') {
  const result = [];
  for (const perm of ipPermissions || []) {
    const protocol = perm.IpProtocol ?? '-1';
    const fromPort = perm.FromPort;
    const toPort = perm.ToPort;

    let portRange = 'All';
    if (protocol === '-1') {
      portRange = 'All';
    } else if (fromPort !== undefined && toPort !== undefined) {
      portRange = fromPort === toPort ? `${fromPort}` : `${fromPort}-${toPort}`;
    }

    // Determine readable rule type name
    let ruleType = 'Custom TCP';
    if (protocol === '-1') ruleType = 'All traffic';
    else if (protocol === 'icmp') ruleType = 'All ICMP - IPv4';
    else if (protocol === 'udp') ruleType = 'Custom UDP';
    else if (protocol === 'tcp') {
      if (fromPort === 22 && toPort === 22) ruleType = 'SSH';
      else if (fromPort === 80 && toPort === 80) ruleType = 'HTTP';
      else if (fromPort === 443 && toPort === 443) ruleType = 'HTTPS';
      else if (fromPort === 3389 && toPort === 3389) ruleType = 'RDP';
      else if (fromPort === 3306 && toPort === 3306) ruleType = 'MySQL/Aurora';
      else if (fromPort === 5432 && toPort === 5432) ruleType = 'PostgreSQL';
    }

    // IPv4 ranges
    for (const r of perm.IpRanges || []) {
      result.push({
        id: `${direction}-${protocol}-${fromPort}-${toPort}-${r.CidrIp}`,
        ruleType,
        protocol,
        fromPort,
        toPort,
        portRange,
        source: r.CidrIp,
        sourceType: 'IPv4 CIDR',
        description: r.Description || '',
        direction,
        raw: {
          IpProtocol: protocol,
          ...(fromPort !== undefined ? { FromPort: fromPort } : {}),
          ...(toPort !== undefined ? { ToPort: toPort } : {}),
          IpRanges: [r],
        },
      });
    }

    // IPv6 ranges
    for (const r of perm.Ipv6Ranges || []) {
      result.push({
        id: `${direction}-${protocol}-${fromPort}-${toPort}-${r.CidrIpv6}`,
        ruleType,
        protocol,
        fromPort,
        toPort,
        portRange,
        source: r.CidrIpv6,
        sourceType: 'IPv6 CIDR',
        description: r.Description || '',
        direction,
        raw: {
          IpProtocol: protocol,
          ...(fromPort !== undefined ? { FromPort: fromPort } : {}),
          ...(toPort !== undefined ? { ToPort: toPort } : {}),
          Ipv6Ranges: [r],
        },
      });
    }

    // Security Group sources
    for (const g of perm.UserIdGroupPairs || []) {
      result.push({
        id: `${direction}-${protocol}-${fromPort}-${toPort}-${g.GroupId}`,
        ruleType,
        protocol,
        fromPort,
        toPort,
        portRange,
        source: g.GroupId,
        sourceType: 'Security Group',
        description: g.Description || '',
        direction,
        raw: {
          IpProtocol: protocol,
          ...(fromPort !== undefined ? { FromPort: fromPort } : {}),
          ...(toPort !== undefined ? { ToPort: toPort } : {}),
          UserIdGroupPairs: [g],
        },
      });
    }

    if (!perm.IpRanges?.length && !perm.Ipv6Ranges?.length && !perm.UserIdGroupPairs?.length) {
      result.push({
        id: `${direction}-${protocol}-${fromPort}-${toPort}-any`,
        ruleType,
        protocol,
        fromPort,
        toPort,
        portRange,
        source: '0.0.0.0/0',
        sourceType: 'IPv4 CIDR',
        description: '',
        direction,
        raw: perm,
      });
    }
  }
  return result;
}

export async function listVpcs(req, res) {
  try {
    const ec2 = createEC2Client(req);
    const data = await ec2.send(new DescribeVpcsCommand({}));
    const vpcs = (data.Vpcs || []).map((v) => ({
      vpcId: v.VpcId,
      cidrBlock: v.CidrBlock,
      isDefault: Boolean(v.IsDefault),
      state: v.State,
      tags: v.Tags || [],
    }));
    res.json({ vpcs });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function listSecurityGroups(req, res) {
  try {
    const ec2 = createEC2Client(req);
    const data = await ec2.send(new DescribeSecurityGroupsCommand({}));
    const securityGroups = (data.SecurityGroups || []).map((sg) => {
      const inboundRules = flattenRules(sg.IpPermissions, 'inbound');
      const outboundRules = flattenRules(sg.IpPermissionsEgress, 'outbound');
      return {
        groupId: sg.GroupId,
        groupName: sg.GroupName,
        description: sg.Description,
        vpcId: sg.VpcId,
        ownerId: sg.OwnerId,
        ipPermissions: sg.IpPermissions || [],
        ipPermissionsEgress: sg.IpPermissionsEgress || [],
        inboundRules,
        outboundRules,
        inboundRulesCount: inboundRules.length,
        outboundRulesCount: outboundRules.length,
      };
    });
    res.json({ securityGroups });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function getSecurityGroup(req, res) {
  try {
    const { id } = req.params;
    const ec2 = createEC2Client(req);
    const data = await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: [id] }));
    const sg = (data.SecurityGroups || [])[0];
    if (!sg) {
      return res.status(404).json({ error: 'NoSuchEntity', message: `Security group ${id} not found` });
    }
    const inboundRules = flattenRules(sg.IpPermissions, 'inbound');
    const outboundRules = flattenRules(sg.IpPermissionsEgress, 'outbound');
    res.json({
      groupId: sg.GroupId,
      groupName: sg.GroupName,
      description: sg.Description,
      vpcId: sg.VpcId,
      ownerId: sg.OwnerId,
      ipPermissions: sg.IpPermissions || [],
      ipPermissionsEgress: sg.IpPermissionsEgress || [],
      inboundRules,
      outboundRules,
      inboundRulesCount: inboundRules.length,
      outboundRulesCount: outboundRules.length,
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function createSecurityGroup(req, res) {
  try {
    const { name, groupName, description, vpcId } = req.body;
    const sgName = name || groupName;
    if (!sgName || typeof sgName !== 'string') {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Group name is required' });
    }
    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'InvalidRequest', message: 'Description is required' });
    }

    const ec2 = createEC2Client(req);
    const commandInput = {
      GroupName: sgName.trim(),
      Description: description.trim(),
    };
    if (vpcId) commandInput.VpcId = vpcId.trim();

    const data = await ec2.send(new CreateSecurityGroupCommand(commandInput));
    res.status(201).json({
      groupId: data.GroupId,
      groupName: sgName.trim(),
      description: description.trim(),
      vpcId: vpcId || undefined,
    });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function deleteSecurityGroup(req, res) {
  try {
    const { id } = req.params;
    const ec2 = createEC2Client(req);
    await ec2.send(new DeleteSecurityGroupCommand({ GroupId: id }));
    res.json({ deleted: id });
  } catch (err) {
    handleAwsError(res, err);
  }
}

function parseRulesFromBody(body) {
  if (Array.isArray(body.ipPermissions)) {
    return body.ipPermissions;
  }
  if (Array.isArray(body.rules)) {
    return body.rules.map(formatRuleToIpPermission);
  }
  if (Array.isArray(body)) {
    return body.map(formatRuleToIpPermission);
  }
  return [formatRuleToIpPermission(body)];
}

export async function authorizeInbound(req, res) {
  try {
    const { id } = req.params;
    const ipPermissions = parseRulesFromBody(req.body);
    const ec2 = createEC2Client(req);
    await ec2.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: id,
        IpPermissions: ipPermissions,
      })
    );
    res.json({ groupId: id, authorized: ipPermissions.length });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function revokeInbound(req, res) {
  try {
    const { id } = req.params;
    const ipPermissions = parseRulesFromBody(req.body);
    const ec2 = createEC2Client(req);
    await ec2.send(
      new RevokeSecurityGroupIngressCommand({
        GroupId: id,
        IpPermissions: ipPermissions,
      })
    );
    res.json({ groupId: id, revoked: ipPermissions.length });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function authorizeOutbound(req, res) {
  try {
    const { id } = req.params;
    const ipPermissions = parseRulesFromBody(req.body);
    const ec2 = createEC2Client(req);
    await ec2.send(
      new AuthorizeSecurityGroupEgressCommand({
        GroupId: id,
        IpPermissions: ipPermissions,
      })
    );
    res.json({ groupId: id, authorized: ipPermissions.length });
  } catch (err) {
    handleAwsError(res, err);
  }
}

export async function revokeOutbound(req, res) {
  try {
    const { id } = req.params;
    const ipPermissions = parseRulesFromBody(req.body);
    const ec2 = createEC2Client(req);
    await ec2.send(
      new RevokeSecurityGroupEgressCommand({
        GroupId: id,
        IpPermissions: ipPermissions,
      })
    );
    res.json({ groupId: id, revoked: ipPermissions.length });
  } catch (err) {
    handleAwsError(res, err);
  }
}
