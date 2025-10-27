# Compile.ps1 - Smart TypeScript file concatenation for CTF game mode
# Concatenates TypeScript files in dependency order to avoid "used before declaration" errors

param(
    [Parameter(Mandatory=$true)]
    [string]$OutputFile
)

$ErrorActionPreference = "Stop"

# Get the script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourcesDir = Join-Path $ScriptDir "Sources"

Write-Host "CTF TypeScript Compiler" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Define file order by dependency level
# Files are concatenated in this exact order to ensure declarations come before usage
$FileOrder = @{
    # Level 0: Constants, enums, and basic type definitions (no dependencies)
    0 = @(
        # Main constants file should be first
        "imports.ts"
        "CTF.ts"
    )
    
    # Level 1: Utility classes and namespaces (minimal dependencies)
    1 = @(
        "Utility/Colour.ts",
        "Utility/Math.ts"
    )
    
    # Level 2: Core infrastructure (uses Level 0-1)
    2 = @(
        "Utility/Raycasts.ts",
        "Utility/Animation.ts"
    )
    
    # Level 3: Game data classes (uses Level 0-2)
    3 = @(
        "Game/JSPlayer.ts"
    )
    
    # Level 4: Entity classes (uses Level 0-3)
    4 = @(
        "Entities/Flag.ts",
        "Entities/CaptureZone.ts"
    )
    
    # Level 5: Configuration (uses Level 0-4)
    5 = @(
        "Game/GameModeConfig.ts",
        "Game/Configs/ClassicCTF.ts",
        "Game/Configs/FourTeamCTF.ts"
    )
    
    # Level 6: UI classes (uses most other classes)
    6 = @(
        "UI/ScoreHUD.ts",
        "UI/Scoreboard.ts",
        "UI/FlagIcon.ts"
    )
    
    # Level 7: Game logic (uses everything)
    7 = @(
        "Game/TeamBalance.ts"
    )
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
    foreach ($level in 0..7) {
        if ($FileOrder[$level]) {
            Write-Host "Level $level (Dependency Tier $level):" -ForegroundColor Yellow
            
            foreach ($file in $FileOrder[$level]) {
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
        Write-Host "⚠️  Please add these files to the correct dependency level in Compile.ps1" -ForegroundColor Red
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
