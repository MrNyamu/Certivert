/**
 * Certificate Slice - State Management
 * Handles certificate operations and state
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { 
  CertificateState, 
  CertificateJSON, 
  VerificationResult, 
  IssuanceResult, 
  RevocationResult,
  IssuanceFormData
} from '../../types/index.js';
import { certificateService } from '../../services/certificate.js';

// Initial state
const initialState: CertificateState = {
  certificates: [],
  currentCertificate: null,
  verificationResults: {},
  recentIssuances: [],
  systemStats: null,
  loadingStates: {
    verifying: false,
    issuing: false,
    revoking: false,
    loading: false,
  },
  error: null,
  lastUpdated: null,
};

// Async thunks
export const issueCertificate = createAsyncThunk<
  IssuanceResult,
  { formData: IssuanceFormData; walletAddress: string },
  { rejectValue: string }
>(
  'certificate/issueCertificate',
  async ({ formData, walletAddress }, { rejectWithValue }) => {
    try {
      const result = await certificateService.issue(formData, walletAddress);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to issue certificate'
      );
    }
  }
);

export const verifyCertificate = createAsyncThunk<
  VerificationResult,
  string,
  { rejectValue: string }
>(
  'certificate/verifyCertificate',
  async (certId, { rejectWithValue }) => {
    try {
      const result = await certificateService.verify(certId);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to verify certificate'
      );
    }
  }
);

export const revokeCertificate = createAsyncThunk<
  RevocationResult,
  { certId: string; reason: string; walletAddress: string },
  { rejectValue: string }
>(
  'certificate/revokeCertificate',
  async ({ certId, reason, walletAddress }, { rejectWithValue }) => {
    try {
      const result = await certificateService.revoke(certId, reason, walletAddress);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to revoke certificate'
      );
    }
  }
);

export const downloadCertificatePDF = createAsyncThunk<
  { blob: Blob; fileName: string },
  { ipfsCid: string; fileName?: string },
  { rejectValue: string }
>(
  'certificate/downloadPDF',
  async ({ ipfsCid, fileName }, { rejectWithValue }) => {
    try {
      const result = await certificateService.downloadPDF(ipfsCid, fileName);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to download certificate'
      );
    }
  }
);

export const getFileInfo = createAsyncThunk<
  { cid: string; size: number; type: string; message: string },
  string,
  { rejectValue: string }
>(
  'certificate/getFileInfo',
  async (ipfsCid, { rejectWithValue }) => {
    try {
      const result = await certificateService.getFileInfo(ipfsCid);
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : 'Failed to get file information'
      );
    }
  }
);

// Certificate slice
const certificateSlice = createSlice({
  name: 'certificate',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    
    clearCurrentCertificate: (state) => {
      state.currentCertificate = null;
    },
    
    setCurrentCertificate: (state, action: PayloadAction<CertificateJSON>) => {
      state.currentCertificate = action.payload;
    },
    
    addCertificate: (state, action: PayloadAction<CertificateJSON>) => {
      const existingIndex = state.certificates.findIndex(
        cert => cert.id === action.payload.id
      );
      
      if (existingIndex >= 0) {
        state.certificates[existingIndex] = action.payload;
      } else {
        state.certificates.unshift(action.payload);
      }
      
      state.lastUpdated = new Date().toISOString();
    },
    
    updateCertificate: (state, action: PayloadAction<Partial<CertificateJSON> & { id: string }>) => {
      const index = state.certificates.findIndex(cert => cert.id === action.payload.id);
      if (index >= 0) {
        state.certificates[index] = { ...state.certificates[index], ...action.payload };
      }
      
      if (state.currentCertificate?.id === action.payload.id) {
        state.currentCertificate = { ...state.currentCertificate, ...action.payload };
      }
      
      state.lastUpdated = new Date().toISOString();
    },
    
    removeCertificate: (state, action: PayloadAction<string>) => {
      state.certificates = state.certificates.filter(cert => cert.id !== action.payload);
      
      if (state.currentCertificate?.id === action.payload) {
        state.currentCertificate = null;
      }
      
      state.lastUpdated = new Date().toISOString();
    },
    
    clearVerificationResults: (state) => {
      state.verificationResults = {};
    },
    
    setLoadingState: (state, action: PayloadAction<{
      key: keyof CertificateState['loadingStates'];
      value: boolean;
    }>) => {
      const { key, value } = action.payload;
      state.loadingStates[key] = value;
    },
    
    updateRecentIssuances: (state, action: PayloadAction<any[]>) => {
      state.recentIssuances = action.payload.slice(0, 10); // Keep last 10
      state.lastUpdated = new Date().toISOString();
    },
    
    updateSystemStats: (state, action: PayloadAction<CertificateState['systemStats']>) => {
      state.systemStats = action.payload;
      state.lastUpdated = new Date().toISOString();
    },
  },
  
  extraReducers: (builder) => {
    // Issue Certificate
    builder
      .addCase(issueCertificate.pending, (state) => {
        state.loadingStates.issuing = true;
        state.error = null;
      })
      .addCase(issueCertificate.fulfilled, (state, action) => {
        state.loadingStates.issuing = false;
        
        const result = action.payload;
        if (result.certificate) {
          // Add to recent issuances
          state.recentIssuances.unshift({
            id: result.certificateId,
            timestamp: new Date().toISOString(),
            status: 'success',
            message: 'Certificate issued successfully'
          });
          
          // Keep only last 10 recent issuances
          state.recentIssuances = state.recentIssuances.slice(0, 10);
        }
        
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })
      .addCase(issueCertificate.rejected, (state, action) => {
        state.loadingStates.issuing = false;
        state.error = action.payload || 'Failed to issue certificate';
        
        // Add failed issuance to recent
        state.recentIssuances.unshift({
          timestamp: new Date().toISOString(),
          status: 'failed',
          message: action.payload || 'Certificate issuance failed'
        });
        
        state.recentIssuances = state.recentIssuances.slice(0, 10);
      });
    
    // Verify Certificate
    builder
      .addCase(verifyCertificate.pending, (state, action) => {
        state.loadingStates.verifying = true;
        state.error = null;
        
        // Clear previous verification result for this certificate
        const certId = action.meta.arg;
        if (state.verificationResults[certId]) {
          delete state.verificationResults[certId];
        }
      })
      .addCase(verifyCertificate.fulfilled, (state, action) => {
        state.loadingStates.verifying = false;
        
        const result = action.payload;
        const certId = action.meta.arg;
        
        // Store verification result
        state.verificationResults[certId] = result;
        
        // Update current certificate if it matches
        if (result.certificate && result.certificate.id === certId) {
          state.currentCertificate = result.certificate;
        }
        
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })
      .addCase(verifyCertificate.rejected, (state, action) => {
        state.loadingStates.verifying = false;
        state.error = action.payload || 'Failed to verify certificate';
      });
    
    // Revoke Certificate
    builder
      .addCase(revokeCertificate.pending, (state) => {
        state.loadingStates.revoking = true;
        state.error = null;
      })
      .addCase(revokeCertificate.fulfilled, (state, action) => {
        state.loadingStates.revoking = false;
        
        const result = action.payload;
        const certId = result.certificateId;
        
        // Update certificate status in the list
        const certIndex = state.certificates.findIndex(cert => cert.id === certId);
        if (certIndex >= 0) {
          state.certificates[certIndex].status = 3; // Revoked
        }
        
        // Update current certificate if it matches
        if (state.currentCertificate?.id === certId) {
          state.currentCertificate.status = 3;
        }
        
        // Add to recent activity
        state.recentIssuances.unshift({
          id: certId,
          timestamp: new Date().toISOString(),
          status: 'revoked',
          message: `Certificate revoked: ${result.reason || 'No reason provided'}`
        });
        
        state.recentIssuances = state.recentIssuances.slice(0, 10);
        state.lastUpdated = new Date().toISOString();
        state.error = null;
      })
      .addCase(revokeCertificate.rejected, (state, action) => {
        state.loadingStates.revoking = false;
        state.error = action.payload || 'Failed to revoke certificate';
      });
    
    // Download PDF
    builder
      .addCase(downloadCertificatePDF.pending, (state) => {
        state.loadingStates.loading = true;
        state.error = null;
      })
      .addCase(downloadCertificatePDF.fulfilled, (state, action) => {
        state.loadingStates.loading = false;
        
        // Trigger browser download
        const { blob, fileName } = action.payload;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        state.error = null;
      })
      .addCase(downloadCertificatePDF.rejected, (state, action) => {
        state.loadingStates.loading = false;
        state.error = action.payload || 'Failed to download certificate';
      });
    
    // Get File Info
    builder
      .addCase(getFileInfo.pending, (state) => {
        state.loadingStates.loading = true;
        state.error = null;
      })
      .addCase(getFileInfo.fulfilled, (state) => {
        state.loadingStates.loading = false;
        state.error = null;
      })
      .addCase(getFileInfo.rejected, (state, action) => {
        state.loadingStates.loading = false;
        state.error = action.payload || 'Failed to get file information';
      });
  },
});

// Export actions
export const {
  clearError,
  clearCurrentCertificate,
  setCurrentCertificate,
  addCertificate,
  updateCertificate,
  removeCertificate,
  clearVerificationResults,
  setLoadingState,
  updateRecentIssuances,
  updateSystemStats,
} = certificateSlice.actions;

// Selectors
export const selectCertificates = (state: { certificate: CertificateState }) => 
  state.certificate.certificates;

export const selectCurrentCertificate = (state: { certificate: CertificateState }) => 
  state.certificate.currentCertificate;

export const selectVerificationResults = (state: { certificate: CertificateState }) => 
  state.certificate.verificationResults;

export const selectVerificationResult = (certId: string) => 
  (state: { certificate: CertificateState }) => 
    state.certificate.verificationResults[certId];

export const selectRecentIssuances = (state: { certificate: CertificateState }) => 
  state.certificate.recentIssuances;

export const selectSystemStats = (state: { certificate: CertificateState }) => 
  state.certificate.systemStats;

export const selectCertificateLoadingStates = (state: { certificate: CertificateState }) => 
  state.certificate.loadingStates;

export const selectCertificateError = (state: { certificate: CertificateState }) => 
  state.certificate.error;

export const selectIsLoading = (state: { certificate: CertificateState }) => 
  Object.values(state.certificate.loadingStates).some(loading => loading);

export const selectActiveCertificates = (state: { certificate: CertificateState }) => 
  state.certificate.certificates.filter(cert => cert.status === 1);

export const selectRevokedCertificates = (state: { certificate: CertificateState }) => 
  state.certificate.certificates.filter(cert => cert.status === 3);

export const selectPendingCertificates = (state: { certificate: CertificateState }) => 
  state.certificate.certificates.filter(cert => cert.status === 0 || cert.status === 2);

// Export reducer
export default certificateSlice.reducer;