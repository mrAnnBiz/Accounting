/**
 * Converts a paper filename to its public URL and fetches the image data
 * Papers are stored at /public/past-papers/
 */
export async function getPaperImageUrl(filename: string): Promise<string> {
  return `/past-papers/${filename.replace('.pdf', '.png')}`;
}

/**
 * Lists all available past papers from the public directory
 * Used for the papers list view
 */
export async function listAvailablePapers(): Promise<string[]> {
  try {
    // This will be implemented with actual PDF-to-image conversion
    // For MVP, we're loading PDFs directly in the viewer
    return [];
  } catch {
    return [];
  }
}
