export interface Flash {
  id: string;
  type: "success" | "error" | "warning" | "info";
  header?: string;
  message: string;
  dismissible?: boolean;
}

export interface S3Bucket {
  name: string;
  creationDate?: string;
}

export interface S3Object {
  key: string;
  type: "object" | "folder";
  size?: number;
  lastModified?: string;
  eTag?: string;
}

export interface VersioningState {
  enabled: boolean;
}
