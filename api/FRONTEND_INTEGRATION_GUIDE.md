# Frontend Integration Guide - Stacks Wallet Authentication

## **Quick Start Prompt for Frontend Developer**

Hey Frontend Team! Here's everything you need to integrate wallet authentication with our Certivert API:

## **🎯 What You Need to Implement**

### **1. Wallet Connection (Stacks Connect)**

Install dependencies:
```bash
npm install @stacks/connect @stacks/auth @stacks/network
```

Set up wallet connection:
```javascript
import { 
  showConnect, 
  UserSession, 
  AppConfig,
  authenticate 
} from '@stacks/connect';

// Initialize user session
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Connect wallet function
export const connectWallet = () => {
  showConnect({
    appDetails: {
      name: 'Certivert',
      icon: '/logo.png',
    },
    redirectTo: '/',
    onFinish: () => {
      window.location.reload(); // Or handle state update
    },
    userSession,
  });
};

// Check if user is signed in
export const isUserSignedIn = () => {
  return userSession.isUserSignedIn();
};

// Get wallet address
export const getWalletAddress = () => {
  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    return userData.profile.stxAddress.testnet; // Use .mainnet for production
  }
  return null;
};

// Disconnect wallet
export const disconnectWallet = () => {
  userSession.signUserOut();
  window.location.reload();
};
```

## **🔐 Authentication - What Backend Expects**

### **API Request Format**

The backend expects **ONLY the wallet address** in requests. Here's what to send:

#### **Certificate Issuance** (multipart/form-data):
```javascript
const issueCertificate = async (certificateData, pdfFile) => {
  const walletAddress = getWalletAddress();
  
  if (!walletAddress) {
    throw new Error('Please connect your wallet first');
  }

  const formData = new FormData();
  
  // Required: Wallet address
  formData.append('walletAddress', walletAddress);
  
  // Certificate data
  formData.append('studentName', certificateData.studentName);
  formData.append('admissionNo', certificateData.admissionNo);
  formData.append('programme', certificateData.programme);
  formData.append('year', certificateData.year.toString());
  formData.append('grade', certificateData.grade);
  
  // PDF file
  formData.append('pdf', pdfFile);

  const response = await fetch('/api/issue', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to issue certificate');
  }

  return response.json();
};
```

#### **Certificate Revocation** (JSON):
```javascript
const revokeCertificate = async (certId, reason) => {
  const walletAddress = getWalletAddress();

  if (!walletAddress) {
    throw new Error('Please connect your wallet first');
  }

  const response = await fetch('/api/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletAddress,
      certId,
      reason
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to revoke certificate');
  }

  return response.json();
};
```

#### **Certificate Verification** (Public - No wallet needed):
```javascript
const verifyCertificate = async (certId) => {
  const response = await fetch(`/api/verify/${certId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Certificate not found');
  }

  return response.json();
};
```

## **⚠️ Error Handling You Need**

### **Role-Based Error Messages**
```javascript
const handleApiError = (error) => {
  const message = error.message;
  
  if (message.includes('WALLET_ADDRESS_MISSING')) {
    return 'Please connect your wallet to continue.';
  }
  
  if (message.includes('INSUFFICIENT_ROLE')) {
    if (message.includes('university')) {
      return 'You need to connect with a university wallet to issue certificates.';
    }
    if (message.includes('university, knqa')) {
      return 'You need to connect with a university or KNQA wallet to revoke certificates.';
    }
    return 'Your wallet does not have permission for this action.';
  }
  
  if (message.includes('Transaction rejected: NotEnoughFunds')) {
    return 'Insufficient funds in wallet to pay transaction fees. Please add STX tokens.';
  }
  
  return message; // Default error
};
```

## **🎨 UI Components You Should Build**

### **Wallet Connection Component**
```javascript
import React, { useState, useEffect } from 'react';
import { connectWallet, isUserSignedIn, getWalletAddress, disconnectWallet } from '../utils/wallet';

const WalletConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);

  useEffect(() => {
    const connected = isUserSignedIn();
    setIsConnected(connected);
    if (connected) {
      setWalletAddress(getWalletAddress());
    }
  }, []);

  const handleConnect = () => {
    connectWallet();
  };

  const handleDisconnect = () => {
    disconnectWallet();
  };

  if (isConnected) {
    return (
      <div className="wallet-connected">
        <span>🔗 Connected: {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-4)}</span>
        <button onClick={handleDisconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <button onClick={handleConnect} className="connect-wallet-btn">
      Connect Wallet
    </button>
  );
};

export default WalletConnection;
```

### **Role-Based UI Component**
```javascript
import React, { useState, useEffect } from 'react';
import { getWalletAddress } from '../utils/wallet';

const RoleBasedActions = () => {
  const [userRole, setUserRole] = useState('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      const walletAddress = getWalletAddress();
      if (!walletAddress) {
        setUserRole('none');
        setLoading(false);
        return;
      }

      try {
        // You could create an endpoint to fetch user role
        // OR handle role checks through API responses
        setUserRole('unknown'); // Will be determined by API responses
      } catch (error) {
        console.error('Error fetching user role:', error);
        setUserRole('none');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  if (loading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div className="role-based-actions">
      {/* Show different UI based on successful/failed API responses */}
      <button 
        onClick={() => {
          // Try to issue certificate
          // Handle role errors in catch block
        }}
        className="issue-cert-btn"
      >
        Issue Certificate
      </button>
      
      <button 
        onClick={() => {
          // Try to revoke certificate
          // Handle role errors in catch block
        }}
        className="revoke-cert-btn"
      >
        Revoke Certificate
      </button>
    </div>
  );
};
```

## **🔍 Testing Your Implementation**

### **Test Wallet Addresses**
You'll need to get these from your backend team after they run the role setup script:

```javascript
// For testing - get actual addresses from backend team
const TEST_WALLETS = {
  university: 'ST1UNIVERSITY_ADDRESS_HERE',
  knqa: 'ST1KNQA_ADDRESS_HERE', 
  student: 'ST1STUDENT_ADDRESS_HERE',
  none: 'ST1UNASSIGNED_ADDRESS_HERE'
};
```

### **Test Scenarios**
1. **Connect University Wallet** → Should be able to issue certificates
2. **Connect Student Wallet** → Should get 403 error when trying to issue
3. **Connect KNQA Wallet** → Should be able to revoke certificates
4. **No Wallet Connected** → Should get 401 error

## **🚨 Important Notes**

### **DO NOT Send Role in Requests**
```javascript
// ❌ WRONG - Don't do this
{
  "walletAddress": "ST1...",
  "role": "university",  // ← Backend ignores this
  "studentName": "John"
}

// ✅ CORRECT - Only send wallet address
{
  "walletAddress": "ST1...",
  "studentName": "John"
}
```

### **Backend Handles All Role Logic**
- Backend fetches roles from blockchain contract
- You can't fake or spoof roles
- Role checking happens server-side
- You just need to handle the error responses

### **Network Configuration**
```javascript
// Make sure to use the correct network
const NETWORK_CONFIG = {
  testnet: 'https://stacks-node-api.testnet.stacks.co',
  devnet: 'http://localhost:3999',
  mainnet: 'https://stacks-node-api.mainnet.stacks.co'
};

// Use testnet for development
const userData = userSession.loadUserData();
const address = userData.profile.stxAddress.testnet; // ← Use this
```

## **📝 Complete Example - Certificate Issuance Form**

```javascript
import React, { useState } from 'react';
import { getWalletAddress } from '../utils/wallet';
import { handleApiError } from '../utils/errors';

const IssueCertificateForm = () => {
  const [formData, setFormData] = useState({
    studentName: '',
    admissionNo: '',
    programme: '',
    year: new Date().getFullYear(),
    grade: ''
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const walletAddress = getWalletAddress();
      
      if (!walletAddress) {
        throw new Error('Please connect your wallet first');
      }

      if (!pdfFile) {
        throw new Error('Please select a PDF file');
      }

      const data = new FormData();
      data.append('walletAddress', walletAddress);
      data.append('studentName', formData.studentName);
      data.append('admissionNo', formData.admissionNo);
      data.append('programme', formData.programme);
      data.append('year', formData.year.toString());
      data.append('grade', formData.grade);
      data.append('pdf', pdfFile);

      const response = await fetch('/api/issue', {
        method: 'POST',
        body: data
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to issue certificate');
      }

      const result = await response.json();
      setResult(result);
      
      // Reset form on success
      setFormData({
        studentName: '',
        admissionNo: '',
        programme: '',
        year: new Date().getFullYear(),
        grade: ''
      });
      setPdfFile(null);

    } catch (error) {
      setError(handleApiError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <input 
        type="text"
        placeholder="Student Name"
        value={formData.studentName}
        onChange={(e) => setFormData({...formData, studentName: e.target.value})}
        required
      />
      
      {/* File input */}
      <input 
        type="file"
        accept=".pdf"
        onChange={(e) => setPdfFile(e.target.files[0])}
        required
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Issuing Certificate...' : 'Issue Certificate'}
      </button>
      
      {error && <div className="error">{error}</div>}
      {result && <div className="success">Certificate issued! ID: {result.certId}</div>}
    </form>
  );
};

export default IssueCertificateForm;
```

## **🚀 Ready to Start?**

1. **Install Stacks Connect**: `npm install @stacks/connect`
2. **Implement wallet connection** using the code above
3. **Test with Postman collection** first to understand API responses
4. **Build your UI components** with proper error handling
5. **Test with different wallet roles** provided by backend team

Need help? The backend automatically handles all role verification - you just need to catch and display the error messages properly!