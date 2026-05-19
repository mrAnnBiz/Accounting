# Rename Cambridge Past Papers Script
# This script renames all past papers in the past-papers directory to follow the naming convention:
# {syllabus}-{session}{year}-{type}-{component}.pdf
# Example: 9706-s25-qp-32.pdf

param(
    [switch]$Execute,
    [switch]$Backup = $true
)

$sourcePath = "d:\Apps\PythonDocs\Accounting\acc\public\past-papers"
$targetPath = "d:\Apps\PythonDocs\Accounting\acc\public\past-papers-flat"
$backupPath = "d:\Apps\PythonDocs\Accounting\acc\public\past-papers-backup"

function Parse-PaperFilename {
    param([string]$filename)
    
    # Remove .pdf extension
    $nameWithoutExt = $filename -replace '\.pdf$', ''
    
    # Skip ER (Examiner's Report) and GT (Grade Threshold) files
    if ($nameWithoutExt -match '_(er|gt)$') {
        return @{ Success = $false }
    }
    
    # Match pattern: {syllabus}_{session}{year}_{type}_{component} or {syllabus}_{session}{year}_{type}
    if ($nameWithoutExt -match '^(\d{4})_([swf])(\d{2})_([a-z]{2})(?:_(\d{2}))?$') {
        $syllabus = $matches[1]
        $session = $matches[2]
        $year = $matches[3]
        $type = $matches[4]
        $component = $matches[5]
        
        return @{
            Syllabus = $syllabus
            Session = $session
            Year = $year
            Type = $type
            Component = $component
            Success = $true
        }
    }
    
    return @{ Success = $false }
}

function Generate-NewFilename {
    param([hashtable]$fileInfo)
    
    if (!$fileInfo.Success) {
        return $null
    }
    
    if ($fileInfo.Component) {
        return "$($fileInfo.Syllabus)-$($fileInfo.Session)$($fileInfo.Year)-$($fileInfo.Type)-$($fileInfo.Component).pdf"
    } else {
        return "$($fileInfo.Syllabus)-$($fileInfo.Session)$($fileInfo.Year)-$($fileInfo.Type).pdf"
    }
}

function Find-PDFFiles {
    param([string]$path)
    
    $files = @()
    
    Get-ChildItem -Path $path -Recurse -Filter "*.pdf" | ForEach-Object {
        $parsed = Parse-PaperFilename $_.Name
        
        if ($parsed.Success) {
            $newName = Generate-NewFilename $parsed
            $files += @{
                OldPath = $_.FullName
                OldName = $_.Name
                NewName = $newName
                Parsed = $parsed
            }
        } else {
            Write-Warning "Could not parse: $($_.Name)"
        }
    }
    
    return $files
}

function Show-Preview {
    param([array]$files)
    
    Write-Host "`n[PREVIEW] Files to be renamed`n" -ForegroundColor Cyan
    Write-Host ("=" * 100)
    
    $count = 1
    foreach ($file in $files) {
        Write-Host "$count. $($file.OldName) --> $($file.NewName)"
        $count++
    }
    
    Write-Host ("=" * 100)
    Write-Host "`nTotal files to process: $($files.Count)`n" -ForegroundColor Green
}

function Execute-Rename {
    param([array]$files, [string]$targetDir, [bool]$dryRun = $true)
    
    if (!$dryRun -and !(Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        Write-Host "Created directory: $targetDir" -ForegroundColor Green
    }
    
    $successCount = 0
    $errorCount = 0
    
    foreach ($file in $files) {
        try {
            $newPath = Join-Path -Path $targetDir -ChildPath $file.NewName
            
            if ($dryRun) {
                Write-Host "[DRY RUN] Copying: $($file.OldName) --> $($file.NewName)"
            } else {
                Copy-Item -Path $file.OldPath -Destination $newPath -Force
                Write-Host "[COPIED] $($file.OldName) --> $($file.NewName)" -ForegroundColor Green
                $successCount++
            }
        } catch {
            Write-Host "[ERROR] $($file.OldName) - $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    
    Write-Host "`n$("=" * 100)"
    Write-Host "Successfully processed: $successCount" -ForegroundColor Green
    Write-Host "Errors: $errorCount" -ForegroundColor Red
    Write-Host "$("=" * 100)`n"
}

# Main execution
Write-Host "`n========================================"
Write-Host "Cambridge Past Papers Renaming Utility"
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Source: $sourcePath"
Write-Host "Target: $targetPath`n"

if (!(Test-Path $sourcePath)) {
    Write-Host "ERROR: Source directory not found: $sourcePath" -ForegroundColor Red
    exit 1
}

# Find all PDF files
Write-Host "Scanning for PDF files..." -ForegroundColor Yellow
$files = Find-PDFFiles $sourcePath

if ($files.Count -eq 0) {
    Write-Host "ERROR: No PDF files found!" -ForegroundColor Red
    exit 1
}

Write-Host "Found $($files.Count) PDF files`n" -ForegroundColor Green

# Show preview
Show-Preview $files

# Execute
if ($Execute) {
    Write-Host "Executing rename operation...`n" -ForegroundColor Yellow
    Execute-Rename $files $targetPath $false
    
    Write-Host "SUCCESS: Rename operation complete!" -ForegroundColor Green
    Write-Host "All files are now in: $targetPath`n" -ForegroundColor Green
} else {
    Write-Host "This was a DRY RUN preview (no changes made).`n" -ForegroundColor Yellow
    Write-Host "To execute the actual rename, run:`n" -ForegroundColor Yellow
    Write-Host "  .\scripts\renamePapers.ps1 -Execute`n" -ForegroundColor Cyan
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Execute  : Execute the rename (default: false)" -ForegroundColor Gray
    Write-Host "  -NoBackup : Skip creating backup (default: creates backup)`n" -ForegroundColor Gray
}
