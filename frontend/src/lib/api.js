import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 10000,
});

// Certificate verification
export const verifyCertificate = async (certId) => {
  const response = await api.get(`/api/verify/${certId}`);
  return response.data;
};

// Issue certificate
export const issueCertificate = async (certificateData) => {
  const response = await api.post('/api/issue', certificateData);
  return response.data;
};

// Get user role
export const getUserRole = async (address) => {
  const response = await api.get(`/api/role/${address}`);
  return response.data;
};

// Revoke certificate
export const revokeCertificate = async (certId, revokerAddress) => {
  const response = await api.post('/api/revoke', {
    certId,
    revokerAddress
  });
  return response.data;
};

// Get user certificates
export const getUserCertificates = async (address) => {
  const response = await api.get(`/api/certificates/${address}`);
  return response.data;
};

// Get recent issuances
export const getRecentIssuances = async (issuerAddress) => {
  const response = await api.get(`/api/recent/${issuerAddress}`);
  return response.data;
};

// Get system stats for KNQA
export const getSystemStats = async () => {
  const response = await api.get('/api/stats');
  return response.data;
};

// Get Bitcoin block height
export const getBitcoinBlockHeight = async () => {
  try {
    const stacksApiUrl = import.meta.env.VITE_STACKS_API_URL || 'http://localhost:3999';
    const response = await axios.get(`${stacksApiUrl}/v2/info`);
    return response.data.burn_block_height || 0;
  } catch (error) {
    console.error('Error fetching Bitcoin block height:', error);
    return 0;
  }
};

export default api;