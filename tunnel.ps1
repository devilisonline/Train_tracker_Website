$i = 1
while ($true) {
    Write-Host "Starting tunnel on ttapp$i..."
    npx localtunnel --port 8080 --subdomain "ttapp$i"
    Write-Host "Tunnel crashed! Waiting 3 seconds before switching to ttapp$($i+1)..."
    $i++
    Start-Sleep -Seconds 3
}
