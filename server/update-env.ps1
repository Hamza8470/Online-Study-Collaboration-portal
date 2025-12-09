# PowerShell script to update .env file with MongoDB URI
# Usage: .\update-env.ps1 "your-mongodb-connection-string"

param(
    [Parameter(Mandatory=$true)]
    [string]$MongoUri
)

$envFile = ".env"

if (Test-Path $envFile) {
    $content = Get-Content $envFile
    
    # Update MONGO_URI
    $updatedContent = $content | ForEach-Object {
        if ($_ -match "^MONGO_URI=") {
            "MONGO_URI=$MongoUri"
        } else {
            $_
        }
    }
    
    $updatedContent | Set-Content $envFile -Encoding UTF8
    Write-Host "✅ Updated MONGO_URI in .env file" -ForegroundColor Green
    Write-Host "`nUpdated .env file:" -ForegroundColor Cyan
    Get-Content $envFile | Select-String "MONGO_URI"
} else {
    Write-Host "❌ .env file not found!" -ForegroundColor Red
}

