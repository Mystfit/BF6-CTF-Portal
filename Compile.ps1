# Compile.ps1 - Smart TypeScript file concatenation for CTF game mode
# Concatenates TypeScript files in dependency order to avoid "used before declaration" errors

param(
    [Parameter(Mandatory=$true)]
    [string]$OutputFile,
    
    [Parameter(Mandatory=$false)]
    [string]$FileOrder
)

$ErrorActionPreference = "Stop"

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourcesDir = Join-Path $ScriptDir "Sources"

Write-Host "CTF TypeScript Compiler" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Load file order from external file
if ([string]::IsNullOrEmpty($FileOrder)) {
    # Default to FileOrder.ps1 in the same directory as this script
    $FileOrder = Join-Path $ScriptDir "FileOrder.ps1"
}

# Resolve the FileOrder path (handle relative paths)
if (-not [System.IO.Path]::IsPathRooted($FileOrder)) {
    $FileOrder = Join-Path $ScriptDir $FileOrder
}

if (-not (Test-Path $FileOrder)) {
    Write-Error "FileOrder file not found: $FileOrder"
    exit 1
}

Write-Host "Loading file order from: $FileOrder" -ForegroundColor Cyan

try {
    # Load the FileOrder hashtable from the external file
    $FileOrderData = & $FileOrder
    
    if ($null -eq $FileOrderData -or $FileOrderData -isnot [hashtable]) {
        Write-Error "FileOrder file must return a hashtable"
        exit 1
    }
    
    Write-Host "Successfully loaded file order configuration" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Error "Failed to load FileOrder file: $_"
    exit 1
}

# Files to exclude from concatenation
$ExcludeFiles = @(
    "globals.d.ts",
    "*.d.ts",
    "README.md",
    "*.test.ts"
)

function Should-ExcludeFile {
    param([string]$FileName)
    
    foreach ($pattern in $ExcludeFiles) {
        if ($FileName -like $pattern) {
            return $true
        }
    }
    return $false
}

function Get-AllSourceFiles {
    param([string]$Path)
    
    $allFiles = Get-ChildItem -Path $Path -Filter "*.ts" -Recurse | 
                Where-Object { -not (Should-ExcludeFile $_.Name) } |
                ForEach-Object { $_.FullName.Replace("$SourcesDir\", "").Replace("\", "/") }
    
    return $allFiles
}

function Write-FileToOutput {
    param(
        [string]$FilePath,
        [System.IO.StreamWriter]$Writer
    )
    
    $fullPath = Join-Path $SourcesDir $FilePath
    
    if (-not (Test-Path $fullPath)) {
        Write-Warning "File not found: $FilePath"
        return $false
    }
    
    Write-Host "  Adding: $FilePath" -ForegroundColor Green
    
    $content = Get-Content -Path $fullPath -Raw
    $Writer.Write($content)
    $Writer.WriteLine()  # Add blank line between files
    $Writer.WriteLine()
    
    return $true
}

# Delete existing output file
$outputPath = Join-Path $ScriptDir $OutputFile
if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
    Write-Host "Deleted existing output file" -ForegroundColor Yellow
    Write-Host ""
}

# Track which files we've added
$addedFiles = @()
$filesAdded = 0

# Create output file and write in dependency order
try {
    $writer = [System.IO.StreamWriter]::new($outputPath, $false, [System.Text.Encoding]::UTF8)
    
    Write-Host "Concatenating files in dependency order..." -ForegroundColor Cyan
    Write-Host ""
    
    # Process each dependency level in order
    $maxLevel = ($FileOrderData.Keys | Measure-Object -Maximum).Maximum
    foreach ($level in 0..$maxLevel) {
        if ($FileOrderData[$level]) {
            Write-Host "Level $level (Dependency Tier $level):" -ForegroundColor Yellow
            
            foreach ($file in $FileOrderData[$level]) {
                if (Write-FileToOutput -FilePath $file -Writer $writer) {
                    $addedFiles += $file
                    $filesAdded++
                }
            }
            Write-Host ""
        }
    }
    
    # Find any files that weren't explicitly ordered
    Write-Host "Checking for unordered files..." -ForegroundColor Cyan
    $allSourceFiles = Get-AllSourceFiles -Path $SourcesDir
    $unorderedFiles = $allSourceFiles | Where-Object { $_ -notin $addedFiles }
    
    if ($unorderedFiles.Count -gt 0) {
        Write-Host ""
        Write-Warning "Found $($unorderedFiles.Count) unordered file(s). Adding at end:"
        Write-Host ""
        Write-Host "Level 8 (Unordered - add these to the FileOrder map!):" -ForegroundColor Yellow
        
        foreach ($file in $unorderedFiles) {
            if (Write-FileToOutput -FilePath $file -Writer $writer) {
                $addedFiles += $file
                $filesAdded++
            }
        }
        Write-Host ""
        Write-Host "⚠️  Please add these files to the correct dependency level in $FileOrder" -ForegroundColor Red
        Write-Host ""
    }
    
    $writer.Close()
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Merged $filesAdded files from ./Sources into $OutputFile" -ForegroundColor Green
    Write-Host "Output: $outputPath" -ForegroundColor Cyan
    Write-Host ""
    
    # Get file size
    $fileInfo = Get-Item $outputPath
    $fileSizeKB = [math]::Round($fileInfo.Length / 1KB, 2)
    Write-Host "Output file size: $fileSizeKB KB" -ForegroundColor Cyan
    
} catch {
    Write-Error "Failed to create output file: $_"
    if ($writer) {
        $writer.Close()
    }
    exit 1
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
