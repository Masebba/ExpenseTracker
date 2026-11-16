$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot ".env"
if (-not (Test-Path $envFile)) {
  throw "The .env file was not found. Create it from .env.example first."
}

$projectLine = Get-Content $envFile | Where-Object { $_ -match '^\s*EXPO_PUBLIC_FIREBASE_PROJECT_ID\s*=' } | Select-Object -First 1
if (-not $projectLine) {
  throw "EXPO_PUBLIC_FIREBASE_PROJECT_ID is missing from .env. Set it to the Firebase project that this app uses."
}
$projectId = ($projectLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
if (-not $projectId) {
  throw "EXPO_PUBLIC_FIREBASE_PROJECT_ID is empty. Set it in .env and retry."
}

Push-Location $projectRoot
try {
  Write-Host "Deploying Firestore indexes to Firebase project: $projectId"
  Write-Host "This requires Firebase CLI authentication and access to the selected project."
  npx --yes firebase-tools@latest deploy --only firestore:indexes --project $projectId
  if ($LASTEXITCODE -ne 0) { throw "Firebase index deployment failed with exit code $LASTEXITCODE." }
  Write-Host "Index configuration submitted. Firestore may take several minutes to finish building the collection-group indexes before member listing works."
}
finally {
  Pop-Location
}
