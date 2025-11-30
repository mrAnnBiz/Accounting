# Cambridge Past Papers Renaming Utility

This utility helps you batch rename Cambridge accounting past papers to follow a standardized naming convention.

## File Naming Convention

**Format:** `{syllabus}-{session}{year}-{type}-{component}.pdf`

### Examples:
- `9706-s25-qp-32.pdf` (A-Level May/June 2025 Question Paper Component 32)
- `0452-f25-qp-12.pdf` (IGCSE Feb/Mar 2025 Question Paper Component 12)
- `9706-w24-ms-42.pdf` (A-Level Oct/Nov 2024 Mark Scheme Component 42)

### Codes:
- **Syllabus:** `0452` (IGCSE) or `9706` (A-Level)
- **Session:** `s` (May/June), `w` (Oct/Nov), `f` (Feb/Mar)
- **Year:** Last 2 digits (e.g., `25`, `24`)
- **Type:** `qp` (Question Paper), `ms` (Mark Scheme), `in` (Insert), `gt` (Grade Threshold)
- **Component:** `12`, `22`, `32`, `42` (varies by syllabus)

## Usage

### Option 1: PowerShell Script (Recommended for Windows)

#### 1. Preview Changes (Dry Run)
```powershell
cd d:\Apps\PythonDocs\Accounting\acc
.\scripts\renamePapers.ps1
```

This will show you all the changes WITHOUT making any actual modifications.

#### 2. Execute Rename (with backup)
```powershell
.\scripts\renamePapers.ps1 -Execute
```

This will:
- Create a backup of the original directory
- Copy all files with new names to `past-papers-flat/`
- Show you the progress

#### 3. Execute WITHOUT Backup
```powershell
.\scripts\renamePapers.ps1 -Execute -NoBackup
```

### Option 2: Node.js Script (Cross-platform)

#### Prerequisites
```bash
npm install ts-node typescript -D
```

#### Run Script
```bash
npm run rename-papers
```

## Current Folder Structure

```
past-papers/
├── A Level/
│   ├── 2016/
│   ├── 2017/
│   ├── ...
│   └── 2025/
│       ├── Feb-March/
│       ├── May-June/
│       └── Oct-Nov/
└── IGCSE/
    ├── 2016/
    ├── 2017/
    ├── ...
    └── 2025/
        ├── 2025 Feb-March/
        ├── 2025 May-June/
        └── 2025 Oct-Nov/
```

## Output Structure

After running the rename script, all files will be flattened into:

```
past-papers-flat/
├── 9706-s25-qp-32.pdf
├── 9706-s25-gt.pdf
├── 0452-f25-qp-12.pdf
├── 9706-w24-ms-42.pdf
└── ... (all files with standardized names)
```

## What Gets Renamed

The script will rename files following the pattern:
- `9706_s25_qp_32.pdf` → `9706-s25-qp-32.pdf`
- `9706_w18_ms_11.pdf` → `9706-w18-ms-11.pdf`
- `9706_w18_gt.pdf` → `9706-w18-gt.pdf` (no component)
- `9706_m25_qp_32.pdf` → `9706-s25-qp-32.pdf` (note: `m` is interpreted as `s` for May/June)

## Backup & Safety

- **Dry Run:** The PowerShell script runs in dry-run mode by default, showing what WILL happen without changing anything
- **Automatic Backup:** When executing with `-Execute`, it creates a backup at `past-papers-backup/`
- **Original Preserved:** Files are COPIED (not moved), so originals remain in place

## Troubleshooting

### "Could not parse" Warning
If you see warnings about files that couldn't be parsed, it means:
- The filename doesn't follow the expected pattern
- These files will be skipped

### No Files Found
- Check that the source directory path is correct
- Ensure PDF files are actually in the directories

### PowerShell Execution Policy
If you get an execution policy error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Next Steps

After renaming:
1. Verify the `past-papers-flat/` directory contains all expected files
2. Update your website code to reference the new directory
3. Delete the old `past-papers/` directory once you confirm everything works

## Files Modified/Created

- `scripts/renamePapers.ps1` - PowerShell script
- `scripts/renamePapers.ts` - Node.js/TypeScript script
- `package.json` - Added npm script

## Support

For issues or questions, check the script output for specific error messages.
