import express from 'express';
import { ipfsService } from '../services/ipfs.js';

const router = express.Router();

/**
 * Download file from IPFS
 * GET /api/files/:cid
 */
router.get('/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    
    console.log(`Downloading file: ${cid}`);
    
    // Download and decrypt file
    const fileBuffer = await ipfsService.downloadFile(cid);
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cid}.pdf"`);
    
    res.send(fileBuffer);
    
  } catch (error) {
    // In test environment, use console.log to avoid red error output and exclude stack trace
    const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
    const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR] File download:' : 'Error downloading file:';
    
    if (process.env.NODE_ENV === 'test') {
      logMethod(logPrefix, error.message);
    } else {
      logMethod(logPrefix, error);
    }
    res.status(404).json({
      error: 'File not found or could not be downloaded',
      code: 'FILE_NOT_FOUND'
    });
  }
});

/**
 * Get file info
 * GET /api/files/:cid/info
 */
router.get('/:cid/info', async (req, res) => {
  try {
    const { cid } = req.params;
    
    const fileBuffer = await ipfsService.downloadFile(cid);
    
    res.json({
      cid,
      size: fileBuffer.length,
      type: 'application/pdf',
      message: 'File found and accessible'
    });
    
  } catch (error) {
    res.status(404).json({
      error: 'File not found',
      code: 'FILE_NOT_FOUND'
    });
  }
});

export default router;