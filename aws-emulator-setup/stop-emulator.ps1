<#
.SYNOPSIS
    Stops and removes the AWS Emulator container.
#>
$container = "aws-emulator"

$running = docker ps --filter "name=^/${container}$" --format "{{.Names}}"
if ($running) {
    Write-Host "Stopping and removing container '$container' ..."
    docker stop  $container
    docker rm    $container
    Write-Host "Done."
} else {
    Write-Host "No running container named '$container'."
}
