# AWS Emulator local setup

Local-only setup of the official AWS Emulator (AWS) running in a Docker container
on Windows. Serves HTTPS on `127.0.0.1:9297`. No UI. No real AWS credentials are
used or stored anywhere.

## Prerequisites

- **Docker Desktop** installed and running (verified: Docker 29.9.2, Linux containers).
- **AWS CLI v2** installed and on PATH (verified: `aws-cli/2.42.2`).
  - Install: `winget install Amazon.AWSCLI` or the MSI from
    https://awscli.amazonaws.com/AWSCLIV2.msi
- Windows PowerShell 5.1+ (this machine: PowerShell 5.1.26100.9818, Windows 11).

> Note: PowerShell 5.1's `Invoke-WebRequest` cannot complete the emulator's TLS
> handshake, so `start-emulator.ps1` polls the health endpoint with `curl.exe -sk`
> (already present on Windows 11), matching the docs' own curl example.

## Files in this folder

| File | Purpose |
|------|---------|
| `Dockerfile` | Official Dockerfile from the AWS Emulator docs (builds the emulator image from the Amazon Linux 2023 RPM). |
| `start-emulator.ps1` | Builds the image if missing, starts the container bound to `127.0.0.1:9297` only, waits for `/__admin/health`, prints endpoint + generated file paths. |
| `stop-emulator.ps1` | Stops and removes the container. |
| `env.ps1` | Dot-source to point the AWS CLI/SDK at the emulator and unset real credentials. |

## How to start

```powershell
# From the aws-emulator-setup folder
.\start-emulator.ps1
```

This:
1. Builds `aws-emulator` image from the official Dockerfile (first run only; downloads the emulator package).
2. Starts container `aws-emulator`, publishing `127.0.0.1:9297->9297/tcp` only (never `0.0.0.0`).
3. Mounts `$env:USERPROFILE\.aws\emulator` into the container so the generated
   credentials, `config`, and `ca.pem` are available on the host at
   `$env:USERPROFILE\.aws\emulator\9297\` (regenerated every start).
4. Waits for `https://127.0.0.1:9297/__admin/health` to return HTTP 200 `ok`.
5. Prints the endpoint and file paths.

Expected output:

```
AWS Emulator is running.
  Endpoint        : https://127.0.0.1:9297
  Container       : aws-emulator
  Credentials file: C:\Users\<you>\.aws\emulator\9297\emulator_credentials
  Config file     : C:\Users\<you>\.aws\emulator\9297\config
  CA bundle       : C:\Users\<you>\.aws\emulator\9297\ca.pem
```

## How to load the emulator environment

In the shell where you run the AWS CLI/SDK:

```powershell
. .\env.ps1
```

This sets:
- `AWS_ENDPOINT_URL = https://127.0.0.1:9297`
- `AWS_DEFAULT_REGION = us-east-1`
- `AWS_REGION = us-east-1`
- `AWS_SHARED_CREDENTIALS_FILE = ...\emulator\9297\emulator_credentials`
- `AWS_CONFIG_FILE = ...\emulator\9297\config`
- `AWS_CA_BUNDLE = ...\emulator\9297\ca.pem`
- `AWS_EC2_METADATA_DISABLED = true`
- `AWS_DISABLE_HOST_PREFIX_INJECTION = true`

And unsets (removes) any real AWS credentials so nothing can reach a real AWS
account:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_PROFILE`

> `aws.exe` lives at `C:\Program Files\Amazon\AWSCLIV2\aws.exe`. If it's not on
> PATH in your shell, add it: `$env:PATH += ";C:\Program Files\Amazon\AWSCLIV2"`

Verify you're hitting the emulator (should show Account `000000000000`):

```powershell
aws sts get-caller-identity
```

## How to stop

```powershell
.\stop-emulator.ps1
```

Stops and removes the `aws-emulator` container. The emulator keeps state in
memory, so stopping it loses the emulated resources (the mounted credential files
remain on the host until you delete `~/.aws/emulator`).

## Exact commands that were run and worked

```powershell
# 1. Start emulator
.\start-emulator.ps1

# 2. Load emulator env (add AWS CLI to PATH if needed)
$env:PATH += ";C:\Program Files\Amazon\AWSCLIV2"
. .\env.ps1

# 3. Confirm reaching the emulator
aws sts get-caller-identity
# -> Account: 000000000000, Arn: arn:aws:iam::000000000000:user/emulator

# 4. S3: create bucket, upload, list, delete object, delete bucket
"hello emulator" > setup-test.txt
aws s3 mb s3://setup-test
aws s3 cp setup-test.txt s3://setup-test/
aws s3 ls s3://setup-test
aws s3 rm s3://setup-test/setup-test.txt
aws s3 rb s3://setup-test
Remove-Item setup-test.txt

# 5. Stop emulator
.\stop-emulator.ps1
```

## Probe results

Each probe ran against the emulator with `AWS_ENDPOINT_URL` set and real
credentials unset. All four succeeded; **none returned HTTP 501 Not Implemented**.

| # | Probe | Command | Result |
|---|-------|---------|--------|
| 1 | S3 put-bucket-versioning (Status=Enabled) | `aws s3 mb s3://probe-versioning-bucket` then `aws s3api put-bucket-versioning --bucket probe-versioning-bucket --versioning-configuration Status=Enabled` | Success: `{"Status": "Enabled"}` |
| 2 | EC2 create-security-group + authorize-security-group-ingress (tcp 22) | `aws ec2 create-security-group --group-name probe-sg ...` then `aws ec2 authorize-security-group-ingress --group-name probe-sg --protocol tcp --port 22 --cidr 10.0.0.0/8` | Success: group `sg-000000000000000a7`, rule `tcp 22` from `10.0.0.0/8`, `"Return": true` |
| 3 | IAM create-user | `aws iam create-user --user-name probe-user` | Success: user `probe-user` created, `Arn: arn:aws:iam::000000000000:user/probe-user` |
| 4 | DynamoDB create-table (PAY_PER_REQUEST) | `aws dynamodb create-table --table-name probe-table --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --billing-mode PAY_PER_REQUEST` | Success: table `probe-table`, `BillingMode: PAY_PER_REQUEST`, status `ACTIVE` |

All test resources were deleted afterwards (bucket, security group, IAM user,
DynamoDB table).

## Source

Official AWS Emulator docs (Docker path):
https://docs.aws.amazon.com/emulator/latest/userguide/getting-started-docker.html
