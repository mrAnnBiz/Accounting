import * as fs from 'fs';
import * as path from 'path';

interface FileInfo {
  oldPath: string;
  oldName: string;
  newName: string;
  syllabus: string;
  component: string;
  type: string;
  session: string;
  year: string;
}

/**
 * Map session folder names to session codes
 */
function extractSessionFromPath(folderName: string): string {
  const folderUpper = folderName.toUpperCase();
  
  if (folderUpper.includes('MAY') || folderUpper.includes('JUNE') || folderUpper.includes('M/J')) {
    return 's';
  } else if (folderUpper.includes('OCT') || folderUpper.includes('NOV') || folderUpper.includes('O/N')) {
    return 'w';
  } else if (folderUpper.includes('FEB') || folderUpper.includes('MARCH') || folderUpper.includes('MAR') || folderUpper.includes('F/M')) {
    return 'f';
  }
  return 's'; // Default to summer
}

/**
 * Parse filename like "9706_s25_qp_32.pdf" or "9706_w18_ms_11.pdf"
 */
function parseFilename(filename: string): Partial<FileInfo> | null {
  // Remove .pdf extension
  const nameWithoutExt = filename.replace(/\.pdf$/i, '');
  
  // Match pattern: {syllabus}_{session}{year}_{type}_{component}.pdf or {syllabus}_{session}{year}_{type}.pdf (for GT without component)
  const match = nameWithoutExt.match(/^(\d{4})_([swf])(\d{2})_([a-z]{2})(?:_(\d{2}))?$/i);
  
  if (!match) {
    console.warn(`⚠️  Could not parse filename: ${filename}`);
    return null;
  }

  const [, syllabus, session, year, type, component] = match;
  
  return {
    syllabus,
    session: session.toLowerCase(),
    year,
    type: type.toLowerCase(),
    component: component || '',
  };
}

/**
 * Generate new filename according to convention
 */
function generateNewFilename(fileInfo: Partial<FileInfo>): string {
  const { syllabus, session, year, type, component } = fileInfo;
  
  if (!syllabus || !session || !year || !type) {
    throw new Error('Missing required fields for filename generation');
  }

  if (component) {
    return `${syllabus}-${session}${year}-${type}-${component}.pdf`;
  } else {
    // For Grade Threshold files without component
    return `${syllabus}-${session}${year}-${type}.pdf`;
  }
}

/**
 * Recursively find all PDF files in directory
 */
function findPDFFiles(dir: string, fileList: FileInfo[] = []): FileInfo[] {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      findPDFFiles(filePath, fileList);
    } else if (file.toLowerCase().endsWith('.pdf')) {
      const parsed = parseFilename(file);
      
      if (parsed) {
        const newName = generateNewFilename(parsed);
        
        // Check for duplicates
        const isDuplicate = fileList.some(f => f.newName === newName);
        
        if (isDuplicate) {
          console.warn(`⚠️  Duplicate file will be created: ${newName}`);
        }

        fileList.push({
          oldPath: filePath,
          oldName: file,
          newName,
          syllabus: parsed.syllabus || '',
          component: parsed.component || '',
          type: parsed.type || '',
          session: parsed.session || '',
          year: parsed.year || '',
        });
      }
    }
  });

  return fileList;
}

/**
 * Preview all changes before executing
 */
function previewChanges(files: FileInfo[]): void {
  console.log('\n📋 PREVIEW: Files to be renamed and moved\n');
  console.log('='.repeat(100));

  let count = 1;
  files.forEach((file) => {
    console.log(`${count}. ${file.oldName} → ${file.newName}`);
    console.log(`   From: ${file.oldPath}`);
    count++;
  });

  console.log('='.repeat(100));
  console.log(`\n✅ Total files to rename: ${files.length}\n`);
}

/**
 * Execute the rename and move operation
 */
function executeRename(files: FileInfo[], targetDir: string, dryRun: boolean = false): void {
  // Create target directory if it doesn't exist
  if (!dryRun && !fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`📁 Created directory: ${targetDir}`);
  }

  let successCount = 0;
  let errorCount = 0;

  files.forEach((file, index) => {
    try {
      const newPath = path.join(targetDir, file.newName);

      if (dryRun) {
        console.log(`[DRY RUN] ${index + 1}/${files.length} - ${file.oldName} → ${file.newName}`);
      } else {
        // Copy file to new location with new name
        fs.copyFileSync(file.oldPath, newPath);
        console.log(`✅ ${index + 1}/${files.length} - ${file.oldName} → ${file.newName}`);
        successCount++;
      }
    } catch (error) {
      console.error(`❌ Error processing ${file.oldName}: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }
  });

  console.log(`\n${'='.repeat(100)}`);
  console.log(`✅ Successfully processed: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`${'='.repeat(100)}\n`);
}

/**
 * Main execution
 */
async function main() {
  const sourcePath = 'd:\\Apps\\PythonDocs\\Accounting\\acc\\public\\past-papers';
  const targetPath = 'd:\\Apps\\PythonDocs\\Accounting\\acc\\public\\past-papers-renamed';

  console.log('🚀 Starting Cambridge Paper Renaming Utility\n');
  console.log(`📂 Source: ${sourcePath}`);
  console.log(`📂 Target: ${targetPath}\n`);

  try {
    // Find all PDF files
    console.log('🔍 Scanning for PDF files...');
    const files = findPDFFiles(sourcePath);

    if (files.length === 0) {
      console.log('❌ No PDF files found!');
      return;
    }

    console.log(`✅ Found ${files.length} PDF files\n`);

    // Preview changes
    previewChanges(files);

    // Ask for confirmation (in a real CLI, would use prompt)
    console.log('📝 To execute the rename:');
    console.log('   1. Review the preview above');
    console.log('   2. Change dryRun to false in the code');
    console.log('   3. Run the script again\n');

    // Execute with dry run first
    const dryRun = true;
    executeRename(files, targetPath, dryRun);

    if (!dryRun) {
      console.log('✨ Rename operation complete!');
      console.log(`📂 All files are now in: ${targetPath}`);
    } else {
      console.log('💡 This was a DRY RUN. Set dryRun = false to execute actual renaming.\n');
    }
  } catch (error) {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch(console.error);
