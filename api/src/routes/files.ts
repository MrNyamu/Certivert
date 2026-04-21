/**
 * File Operations Route Handler
 * POST /api/files/upload - Uploads file to IPFS  
 * GET /api/files/:cid - Downloads file from IPFS
 * GET /api/files/:cid/info - Gets file information
 */

import express from 'express';
// @ts-ignore - JS imports in mixed project
import { fetchFromIPFS, uploadToIPFS, pinCID } from '../services/ipfs.js';
// @ts-ignore - JS imports in mixed project
import upload, { handleUploadError } from '../middleware/upload.js';

// Type imports
import type { Request, Response } from 'express';
import type { ApiResponse, RouteHandler, RequestWithFile } from '../types/api.js';

const router = express.Router();

/**
 * Type definition for file upload response
 */
interface FileUploadResponse extends ApiResponse {
  cid: string;
  size: number;
  message: string;
}

/**
 * Type definition for file info response
 */
interface FileInfoResponse extends ApiResponse {
  cid: string;
  size: number;
  type: string;
  message: string;
}

/**
 * Type definition for file error response
 */
interface FileErrorResponse extends ApiResponse {
  error: string;
  code: string;
}

/**
 * Type guard to validate CID format
 */
const isValidCID = (cid: string): boolean => {
  // Basic CID validation - check if it's a non-empty string
  // In production, you might want more sophisticated CID validation
  return typeof cid === 'string' && cid.length > 0 && /^[a-zA-Z0-9]+$/.test(cid);
};

/**
 * Upload file to IPFS
 * POST /api/files/upload
 * 
 * @param req - Express request with file attachment
 * @param res - Express response with IPFS CID
 * @returns Promise<void>
 */
const uploadFile = async (req: RequestWithFile, res: Response): Promise<void> => {
  try {
    // Validate file upload
    if (!req.file) {
      const errorResponse: FileErrorResponse = {
        error: 'No file provided',
        code: 'MISSING_FILE'
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    // Validate file type
    if (req.file.mimetype !== 'application/pdf') {
      const errorResponse: FileErrorResponse = {
        error: 'Only PDF files are allowed',
        code: 'INVALID_FILE_TYPE'
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    // Validate file size (max 10MB)
    if (req.file.size > 10 * 1024 * 1024) {
      const errorResponse: FileErrorResponse = {
        error: 'File too large. Maximum size is 10MB.',
        code: 'FILE_TOO_LARGE'
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    console.log(`📤 Uploading file to IPFS: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Upload to IPFS
    const uploadResult = await uploadToIPFS(req.file.buffer);
    const cid = uploadResult.cid;
    
    console.log(`✅ File uploaded to IPFS: ${cid}`);
    
    // Pin the content
    try {
      await pinCID(cid);
      console.log(`✅ Content pinned: ${cid}`);
    } catch (pinError: any) {
      console.error('IPFS pinning error:', pinError);
      // Don't fail the request for pinning errors, just warn
      console.warn('⚠️ Failed to pin content, but upload succeeded');
    }
    
    const response: FileUploadResponse = {
      cid,
      size: req.file.size,
      message: 'File uploaded to IPFS successfully'
    };
    
    res.status(201).json(response);
    
  } catch (error) {
    console.error('❌ IPFS upload error:', error);
    
    const errorResponse: FileErrorResponse = {
      error: 'Failed to upload file to IPFS',
      code: 'UPLOAD_FAILED'
    };
    
    res.status(503).json(errorResponse);
  }
};

/**
 * Download file from IPFS
 * GET /api/files/:cid
 * 
 * @param req - Express request with CID parameter
 * @param res - Express response with file buffer
 * @returns Promise<void>
 */
const downloadFile: RouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cid } = req.params;
    
    // Ensure cid is a string (Express params can be string | string[])
    const cidParam = Array.isArray(cid) ? cid[0] : cid;
    
    // Validate CID format
    if (!cidParam || !isValidCID(cidParam)) {
      const errorResponse: FileErrorResponse = {
        error: 'Invalid CID format',
        code: 'INVALID_CID'
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    console.log(`Downloading file: ${cid}`);
    
    // Download and decrypt file
    const fileBuffer: Buffer = await fetchFromIPFS(cidParam);
    
    // Validate that we received a valid buffer
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error('Invalid file data received from IPFS');
    }
    
    // Set appropriate headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cidParam}.pdf"`);
    res.setHeader('Content-Length', fileBuffer.length.toString());
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    
    // Send the file buffer
    res.send(fileBuffer);
    
    console.log(`File downloaded successfully: ${cidParam} (${fileBuffer.length} bytes)`);
    
  } catch (error) {
    // In test environment, use console.log to avoid red error output and exclude stack trace
    const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
    const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR] File download:' : 'Error downloading file:';
    
    if (process.env.NODE_ENV === 'test') {
      logMethod(logPrefix, (error as Error).message);
    } else {
      logMethod(logPrefix, error);
    }
    
    const errorResponse: FileErrorResponse = {
      error: 'File not found or could not be downloaded',
      code: 'FILE_NOT_FOUND'
    };
    
    res.status(404).json(errorResponse);
  }
};

/**
 * Get file info
 * GET /api/files/:cid/info
 * 
 * @param req - Express request with CID parameter
 * @param res - Express response with file information
 * @returns Promise<void>
 */
const getFileInfo: RouteHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { cid } = req.params;
    
    // Ensure cid is a string (Express params can be string | string[])
    const cidParam = Array.isArray(cid) ? cid[0] : cid;
    
    // Validate CID format
    if (!cidParam || !isValidCID(cidParam)) {
      const errorResponse: FileErrorResponse = {
        error: 'Invalid CID format',
        code: 'INVALID_CID'
      };
      res.status(400).json(errorResponse);
      return;
    }
    
    console.log(`Getting file info: ${cidParam}`);
    
    // Download file to get its metadata
    const fileBuffer: Buffer = await fetchFromIPFS(cidParam);
    
    // Validate that we received a valid buffer
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
      throw new Error('Invalid file data received from IPFS');
    }
    
    const response: FileInfoResponse = {
      cid: cidParam,
      size: fileBuffer.length,
      type: 'application/pdf',
      message: 'File found and accessible'
    };
    
    console.log(`File info retrieved: ${cidParam} (${fileBuffer.length} bytes)`);
    
    res.json(response);
    
  } catch (error) {
    // In test environment, use console.log to avoid red error output and exclude stack trace
    const logMethod = process.env.NODE_ENV === 'test' ? console.log : console.error;
    const logPrefix = process.env.NODE_ENV === 'test' ? '[TEST ERROR] File info:' : 'Error getting file info:';
    
    if (process.env.NODE_ENV === 'test') {
      logMethod(logPrefix, (error as Error).message);
    } else {
      logMethod(logPrefix, error);
    }
    
    const errorResponse: FileErrorResponse = {
      error: 'File not found',
      code: 'FILE_NOT_FOUND'
    };
    
    res.status(404).json(errorResponse);
  }
};

// Register route handlers
router.post('/upload', upload.single('file'), handleUploadError, uploadFile);
router.get('/:cid', downloadFile);
router.get('/:cid/info', getFileInfo);

export default router;