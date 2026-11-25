import { Router } from 'express';
import {
  authorizeInbound,
  authorizeOutbound,
  createSecurityGroup,
  deleteSecurityGroup,
  getSecurityGroup,
  listSecurityGroups,
  listVpcs,
  revokeInbound,
  revokeOutbound,
} from './ec2.controller.js';

const router = Router();

router.get('/vpcs', listVpcs);

router.get('/security-groups', listSecurityGroups);
router.post('/security-groups', createSecurityGroup);
router.get('/security-groups/:id', getSecurityGroup);
router.delete('/security-groups/:id', deleteSecurityGroup);

router.post('/security-groups/:id/inbound', authorizeInbound);
router.delete('/security-groups/:id/inbound', revokeInbound);

router.post('/security-groups/:id/outbound', authorizeOutbound);
router.delete('/security-groups/:id/outbound', revokeOutbound);

export default router;
