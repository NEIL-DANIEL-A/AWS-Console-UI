<#
.SYNOPSIS
    Builds (if missing) and starts the AWS Emulator container bound to
    127.0.0.1:9297 only (never 0.0.0.0), waits for
    https://127.0.0.1:9297/__admin/health, then prints the endpoint and
    the generated credential/config/certificate file paths.

    Requires: Docker Desktop running. Runs on Windows PowerShell 5.1+.
#>
$port        = 9297
$container   = "aws-emulator"
$image       = "aws-emulator"
$scriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$hostEmulatorDir = "$env:USERPROFILE\.aws\emulator"
$endpoint    = "https://127.0.0.1:${port}"
$healthUrl   = "$endpoint/__admin/health"

# The emulator writes generated files into <hostEmulatorDir>/9297/ inside the container,
# which is mounted from this host directory. Make sure it exists.
New-Item -ItemType Directory -Force -Path $hostEmulatorDir | Out-Null

# Build the image from the official Dockerfile if it is not already present.
if (-not (docker image inspect $image > $null 2>&1)) {
    Write-Host "Building Docker image '$image' (this downloads the emulator package)..."
    docker build -t $image $scriptDir
    if ($LASTEXITCODE -ne 0) {
        Write-Error "docker build failed."
        exit 1
    }
}

# Remove any leftover container with the same name so we start clean.
docker stop  $container > $null 2>&1
docker rm    $container > $null 2>&1

Write-Host "Starting AWS Emulator container on 127.0.0.1:$port ..."
docker run -d --name $container `
    --memory=2g --memory-swap=2g `
    -p "127.0.0.1:${port}:${port}" `
    -v "${hostEmulatorDir}:/home/emulator/.aws/emulator" `
    $image -p $port > $null 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Error "docker run failed. See 'docker logs $container'."
    exit 1
}

# Wait for the health endpoint to respond (self-signed cert => curl -k).
# curl.exe is used because Windows PowerShell 5.1 cannot complete the TLS
# renegotiation the emulator's schannel stack requires.
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    $output = curl.exe -sk --max-time 2 "$healthUrl" 2>$null
    if ($LASTEXITCODE -eq 0 -and $output -eq "ok") {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Error "Emulator did not become healthy at $healthUrl. See 'docker logs $container'."
    exit 1
}

$credDir = "$env:USERPROFILE\.aws\emulator\$port"
Write-Host ""
Write-Host "AWS Emulator is running."
Write-Host "  Endpoint        : $endpoint"
Write-Host "  Container       : $container"
Write-Host "  Credentials file: $credDir\emulator_credentials"
Write-Host "  Config file     : $credDir\config"
Write-Host "  CA bundle       : $credDir\ca.pem"
Write-Host ""
Write-Host "To use it in this shell:  . .\env.ps1"
Write-Host "To stop it:               .\stop-emulator.ps1"
