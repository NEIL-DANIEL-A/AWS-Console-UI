/**
 * Data-driven service registry.
 * Adding EC2, IAM or DynamoDB later is just adding a module here and a route.
 */
export interface ServiceModule {
  id: string;
  label: string;
  /** Friendly description shown on the home page. */
  description: string;
  /** Route path (without leading slash handled by router). */
  path: string;
  /** Lazy-loaded page component. */
  component: React.ComponentType;
  icon?: string;
}

export interface ServiceConfig {
  id: string;
  label: string;
  description: string;
  path: string;
}

export const SERVICES: ServiceConfig[] = [
  {
    id: "s3",
    label: "S3",
    description: "Object storage — buckets, objects, versioning.",
    path: "/s3",
  },
  // Future services (add module + route here):
  // { id: "ec2", label: "EC2", description: "Virtual servers.", path: "/ec2" },
  // { id: "iam", label: "IAM", description: "Users, roles, policies.", path: "/iam" },
  // { id: "dynamodb", label: "DynamoDB", description: "NoSQL database.", path: "/dynamodb" },
];

export const REGION = "us-east-1";
export const ACCOUNT_ID = "000000000000";
