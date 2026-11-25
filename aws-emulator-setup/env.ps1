<#
.SYNOPSIS
    Points the AWS CLI / SDK at the local AWS Emulator.

    Dot-source this script so the variables apply to your current shell:

        . .\env.ps1

    It unsets any real AWS credentials so nothing can reach a real AWS account.
#>
$port = 9297
$base = "$env:USERPROFILE\.aws\emulator\$port"

$env:AWS_ENDPOINT_URL                  = "https://127.0.0.1:${port}"
$env:AWS_SHARED_CREDENTIALS_FILE       = "$base\emulator_credentials"
$env:AWS_CONFIG_FILE                   = "$base\config"
$env:AWS_CA_BUNDLE                     = "$base\ca.pem"
$env:AWS_EC2_METADATA_DISABLED         = "true"
$env:AWS_DISABLE_HOST_PREFIX_INJECTION = "true"
$env:AWS_REGION                        = "us-east-1"
$env:AWS_DEFAULT_REGION                = "us-east-1"

# Unset anything that could supply real AWS credentials (env vars take precedence
# over the credentials file, so leaving them set would sign requests with real keys).
Remove-Item Env:AWS_ACCESS_KEY_ID, Env:AWS_SECRET_ACCESS_KEY, Env:AWS_SESSION_TOKEN, Env:AWS_PROFILE -ErrorAction SilentlyContinue

Write-Host "Emulator environment loaded:"
Write-Host "  AWS_ENDPOINT_URL             = $($env:AWS_ENDPOINT_URL)"
Write-Host "  AWS_DEFAULT_REGION           = $($env:AWS_DEFAULT_REGION)"
Write-Host "  AWS_SHARED_CREDENTIALS_FILE  = $($env:AWS_SHARED_CREDENTIALS_FILE)"
Write-Host "  AWS_CA_BUNDLE                = $($env:AWS_CA_BUNDLE)"
Write-Host "  Real AWS credentials unset   = true"
