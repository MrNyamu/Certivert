# Role Authentication Flow - Explained

## **Answer to Your Question**

**You DO NOT need to manually map or send roles with the transaction.** Here's how it actually works:

## **The Correct Flow**

### 1. **Role Assignment (One-time Setup)**
Roles are assigned **once** using contract calls by an admin/deployer:

```clarity
;; This happens ONCE during setup, not with every user request
(contract-call? .role-registry assign-role 'ST1UNIVERSITY_ADDRESS "university")
(contract-call? .role-registry assign-role 'ST1KNQA_ADDRESS "knqa") 
(contract-call? .role-registry assign-role 'ST1STUDENT_ADDRESS "student")
```

### 2. **User Authentication Flow**
When a user makes an API request:

```mermaid
graph TD
    A[User connects wallet via Stacks Connect] --> B[Frontend gets wallet address]
    B --> C[Frontend sends API request with walletAddress]
    C --> D[Backend: authenticateWallet middleware]
    D --> E[Backend calls contract: get-role(walletAddress)]
    E --> F[Contract returns: 'university' / 'knqa' / 'student' / 'none']
    F --> G[Backend checks if role matches endpoint requirements]
    G --> H{Role Check}
    H -->|✅ Match| I[Allow request]
    H -->|❌ No Match| J[Return 403 Forbidden]
```

### 3. **What the User Sends**
The user **ONLY** sends their wallet address. They don't specify what role they want to be:

```javascript
// ✅ Correct - User only sends wallet address
{
  "walletAddress": "ST1UNIVERSITY_ADDRESS_HERE",
  "studentName": "John Doe",
  "certId": "abc123..."
}

// ❌ Wrong - User does NOT send role
{
  "walletAddress": "ST1UNIVERSITY_ADDRESS_HERE", 
  "role": "university", // ← NOT NEEDED!
  "studentName": "John Doe"
}
```

## **Role System Details**

### **Role Storage in Contract**
```clarity
;; In role-registry contract
(define-map user-roles 
  principal 
  (string-ascii 20))

;; Roles stored as strings:
;; "none" = no permissions
;; "student" = can view own certificates  
;; "university" = can issue/revoke certificates
;; "knqa" = can revoke certificates + oversight
```

### **Role Assignment Script** 
You run this **once** after deploying contracts:

```bash
# Setup roles for your test addresses
node scripts/setup-roles.js
```

This script calls:
```clarity
(contract-call? .role-registry assign-role 'ST1UNIVERSITY... "university")
(contract-call? .role-registry assign-role 'ST1KNQA... "knqa")
```

### **Backend Role Verification**
```typescript
// 1. User sends request with walletAddress
const { walletAddress } = req.body;

// 2. Backend fetches role from contract  
const roleString = await getUserRole(walletAddress); // Returns: "university" | "knqa" | "student" | "none"

// 3. Backend checks permissions
if (roleString === "university") {
  // Allow certificate issuance
} else {
  // Return 403 Forbidden
}
```

## **Frontend Implementation**

### **1. Wallet Connection (One Time)**
```javascript
import { showConnect, UserSession } from '@stacks/connect';

const connectWallet = () => {
  showConnect({
    appDetails: {
      name: 'Certivert',
      icon: '/logo.png',
    },
    onFinish: () => {
      // User is now connected
      const address = userSession.loadUserData().profile.stxAddress.testnet;
      console.log('Connected wallet:', address);
    },
  });
};
```

### **2. Making API Calls**
```javascript
// Get connected wallet address
const getWalletAddress = () => {
  if (userSession.isUserSignedIn()) {
    return userSession.loadUserData().profile.stxAddress.testnet;
  }
  return null;
};

// Issue certificate (only works if wallet has 'university' role)
const issueCertificate = async (certData, pdfFile) => {
  const walletAddress = getWalletAddress();
  
  if (!walletAddress) {
    throw new Error('Please connect your wallet first');
  }

  const formData = new FormData();
  formData.append('walletAddress', walletAddress); // ← Only thing needed!
  formData.append('studentName', certData.studentName);
  formData.append('admissionNo', certData.admissionNo);
  // ... other fields
  formData.append('pdf', pdfFile);

  const response = await fetch('/api/issue', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    if (error.code === 'INSUFFICIENT_ROLE') {
      throw new Error('Your wallet does not have university permissions. Please connect with a university wallet.');
    }
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
};
```

### **3. Error Handling**
```javascript
const handleRoleError = (error) => {
  if (error.message.includes('INSUFFICIENT_ROLE')) {
    // Show user-friendly message
    alert('You need to connect with a university wallet to issue certificates. Please switch wallets and try again.');
  }
};
```

## **Key Points**

✅ **Roles are pre-assigned** to wallet addresses via contract calls  
✅ **Users only provide their wallet address** in API requests  
✅ **Backend automatically fetches the role** from the blockchain  
✅ **No role spoofing possible** - roles come from immutable contract storage  
✅ **Frontend handles role-based UI** - hide/show features based on user's actual role  

❌ **Users do NOT specify roles** in requests  
❌ **Users do NOT "authenticate as" a specific role**  
❌ **No role mapping in requests** - mapping happens on the backend via contract calls  

## **Security Benefits**

1. **Immutable Roles**: Roles are stored on blockchain, can't be faked
2. **Single Source of Truth**: Contract is the authority for roles
3. **Transparent**: Anyone can verify a wallet's role by reading the contract
4. **Decentralized**: No central auth server to compromise

This is much more secure than traditional systems where roles could be manipulated in request headers or JWT tokens!