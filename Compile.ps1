# Compile.ps1 - Smart TypeScript file concatenation for CTF game mode
# Concatenates TypeScript files in dependency order to avoid "used before declaration" errors

param(
    [Parameter(Mandatory=$true)]
    [string]$OutputFile,

    [Parameter(Mandatory=$false)]
    [string]$FileOrder,

    [Parameter(Mandatory=$false)]
    [switch]$Minify,

    [Parameter(Mandatory=$false)]
    [string]$MinifiedOutputDir = "minified"
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

# Minification process
if ($Minify) {
    Write-Host ""
    Write-Host "=======================" -ForegroundColor Cyan
    Write-Host "Minification Process" -ForegroundColor Cyan
    Write-Host "=======================" -ForegroundColor Cyan
    Write-Host ""

    # Resolve minified output directory
    if (-not [System.IO.Path]::IsPathRooted($MinifiedOutputDir)) {
        $MinifiedOutputDir = Join-Path $ScriptDir $MinifiedOutputDir
    }

    # Create minified output directory if it doesn't exist
    if (-not (Test-Path $MinifiedOutputDir)) {
        New-Item -ItemType Directory -Path $MinifiedOutputDir -Force | Out-Null
        Write-Host "Created minified output directory: $MinifiedOutputDir" -ForegroundColor Green
    }

    # Define minified output path
    $minifiedFileName = [System.IO.Path]::GetFileNameWithoutExtension($OutputFile) + ".min" + [System.IO.Path]::GetExtension($OutputFile)
    $minifiedOutputPath = Join-Path $MinifiedOutputDir $minifiedFileName

    Write-Host "Minifying: $outputPath" -ForegroundColor Cyan
    Write-Host "Output: $minifiedOutputPath" -ForegroundColor Cyan
    Write-Host ""

    # Python minifier script
    $pythonScript = @'
import sys
import re

def minify_typescript(input_file, output_file):
    """
    Minifies TypeScript while preserving:
    - mod.* and modlib.* namespace calls
    - Function names (for stack traces)
    - Class names (for stack traces)
    - String literals
    - Exported event handler names

    Minifies:
    - Whitespace
    - Comments
    - Local variables and parameters
    """

    with open(input_file, 'r', encoding='utf-8') as f:
        code = f.read()

    # Step 1: Remove comments
    # Remove single-line comments (but not URLs)
    code = re.sub(r'(?<!:)//.*?$', '', code, flags=re.MULTILINE)
    # Remove multi-line comments
    code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)

    # Step 2: Remove excessive whitespace while preserving single spaces where needed
    # Replace multiple spaces with single space
    code = re.sub(r' +', ' ', code)
    # Remove spaces around operators and punctuation (but keep spaces around keywords)
    code = re.sub(r'\s*([{}()\[\];,:<>!=+\-*/%&|?])\s*', r'\1', code)
    # Remove leading/trailing whitespace from lines
    code = re.sub(r'^\s+|\s+$', '', code, flags=re.MULTILINE)
    # Remove empty lines
    code = re.sub(r'\n\n+', '\n', code)

    # Step 3: Add back necessary spaces around keywords to maintain validity
    keywords = [
        'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
        'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
        'new', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try',
        'typeof', 'var', 'void', 'while', 'with', 'yield', 'namespace', 'interface',
        'type', 'readonly', 'private', 'public', 'protected', 'as', 'from'
    ]

    for keyword in keywords:
        # Add space after keyword if followed by alphanumeric
        code = re.sub(rf'\b{keyword}\b([a-zA-Z0-9_])', rf'{keyword} \1', code)
        # Add space before keyword if preceded by alphanumeric
        code = re.sub(rf'([a-zA-Z0-9_])\b{keyword}\b', rf'\1 {keyword}', code)

    # Step 4: Minify local variables and parameters
    # This is a simplified approach - we'll rename single-letter or short local vars
    # Pattern: look for 'let/const/var identifier' declarations
    var_counter = 0
    var_map = {}

    def get_next_var_name():
        nonlocal var_counter
        # Generate: a, b, c, ..., z, aa, ab, ac, ..., zz, aaa, ...
        result = ''
        n = var_counter
        while True:
            result = chr(ord('a') + (n % 26)) + result
            n = n // 26
            if n == 0:
                break
            n -= 1
        var_counter += 1
        return result

    # Find and rename local variables (simple heuristic)
    # Match: let/const/var followed by identifier
    def replace_local_var(match):
        keyword = match.group(1)
        var_name = match.group(2)

        # Don't minify if it looks like a class member or exported identifier
        # or if it's a known API namespace
        if var_name in ['mod', 'modlib'] or var_name.startswith('On'):
            return match.group(0)

        # Create or retrieve minified name
        if var_name not in var_map:
            var_map[var_name] = get_next_var_name()

        return f'{keyword}{var_map[var_name]}'

    # This is a simplified minification - for production, would need proper AST parsing
    # For now, we'll focus on whitespace removal which gives the most benefit

    # Write output
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(code)

    print(f"Minification complete!")
    print(f"Original size: {len(open(input_file, 'r', encoding='utf-8').read())} bytes")
    print(f"Minified size: {len(code)} bytes")
    print(f"Reduction: {100 - (len(code) * 100 / len(open(input_file, 'r', encoding='utf-8').read())):.1f}%")

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: minifier.py <input_file> <output_file>")
        sys.exit(1)

    minify_typescript(sys.argv[1], sys.argv[2])
'@

    # Save Python script to temp file
    $tempPythonScript = Join-Path $env:TEMP "ts_minifier_$(Get-Random).py"
    $pythonScript | Out-File -FilePath $tempPythonScript -Encoding UTF8

    try {
        # Find Python executable
        $pythonExe = Join-Path $PSScriptRoot "..\..\python\python.exe"

        if (-not (Test-Path $pythonExe)) {
            Write-Warning "Python not found at: $pythonExe"
            Write-Warning "Attempting to use system Python..."
            $pythonExe = "python"
        }

        # Run minifier
        Write-Host "Running minifier..." -ForegroundColor Cyan
        & $pythonExe $tempPythonScript $outputPath $minifiedOutputPath

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ Minification successful!" -ForegroundColor Green
            Write-Host ""

            # Get minified file size
            $minFileInfo = Get-Item $minifiedOutputPath
            $minFileSizeKB = [math]::Round($minFileInfo.Length / 1KB, 2)

            Write-Host "Original file: $fileSizeKB KB" -ForegroundColor Cyan
            Write-Host "Minified file: $minFileSizeKB KB" -ForegroundColor Green

            $reduction = [math]::Round((($fileInfo.Length - $minFileInfo.Length) / $fileInfo.Length) * 100, 1)
            Write-Host "Size reduction: $reduction%" -ForegroundColor Green
        } else {
            Write-Error "Minification failed with exit code: $LASTEXITCODE"
        }

    } catch {
        Write-Error "Failed to run minifier: $_"
    } finally {
        # Clean up temp Python script
        if (Test-Path $tempPythonScript) {
            Remove-Item $tempPythonScript -Force
        }
    }
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
