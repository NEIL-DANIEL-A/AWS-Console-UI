export interface ServiceConfig {
  id: string;
  name: string;
  shortName: string;
  description: string;
  path: string;
  category: string;
  enabled: boolean;
}

export const SERVICES: ServiceConfig[] = [
  {
    id: 's3',
    name: 'Simple Storage Service (S3)',
    shortName: 'S3',
    description: 'Scalable object storage in the cloud. Manage buckets, objects, and versioning.',
    path: '/s3',
    category: 'Storage',
    enabled: true,
  },
  {
    id: 'ec2',
    name: 'Elastic Compute Cloud (EC2)',
    shortName: 'EC2',
    description: 'Virtual servers and network security in the cloud. Manage Security Groups and firewalls.',
    path: '/ec2/security-groups',
    category: 'Compute',
    enabled: true,
  },
];
