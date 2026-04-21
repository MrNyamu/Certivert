# 🔐 Self-Service Role Setup Guide

## Overview

This guide explains how users can set up roles for wallet addresses in the Certivert system. There are three ways to assign roles:

1. **🖥️ Web Interface** (Recommended for admins)
2. **⌨️ Command Line Tool** (For developers/power users)  
3. **🔧 Manual Script** (For custom integrations)

## Prerequisites

- ✅ Backend and blockchain contracts deployed
- ✅ Devnet/testnet running with sufficient STX tokens
- ✅ Admin/deployer wallet with contract permissions

---

## Method 1: Web Interface (Easiest)

### Step 1: Access the Admin Panel

1. **Connect with KNQA wallet** to `/connect`
   ```
   KNQA Address: ST2Y2SFNVZBT8SSZ00XXKH930MCN0RFREB2GQG7CJ
   ```

2. **Navigate to Role Management** 
   - Add `/admin/roles` to your URL
   - Or access through the admin dashboard

### Step 2: Add Role Assignments

1. **Enter wallet address** (starts with ST)
2. **Select role**:
   - `Student` - View own certificates
   - `University` - Issue/revoke certificates
   - `KNQA` - Admin access to everything
   - `None` - Remove permissions

3. **Add to queue** and **execute all** assignments

### Step 3: Verify Assignment

- Check the "Current Role Assignments" table
- Test wallet connection with the assigned address
- Verify permissions work correctly

---

## Method 2: Command Line Tool (Developer Friendly)

### Installation

```bash
cd api/
npm install @inquirer/prompts chalk
```

### Interactive Mode (Recommended)

```bash
cd api/
node scripts/assign-role-cli.js
```

This launches an interactive wizard:
```
🛠️  Certivert Role Assignment CLI

📋 Current Configuration:
   Network: devnet
   Contract Address: ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM
   ...

? Enter wallet address to assign role: ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50
? Select role to assign: University - Can issue and revoke certificates

📝 Assignment Summary:
   Address: ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50
   Role: university
   Network: devnet

? Proceed with role assignment? Yes

🔄 Assigning role "university" to ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50...
📡 Broadcasting transaction...
✅ Role "university" assigned successfully!
   Transaction ID: 0x1234abcd...
```

### Single Assignment Mode

```bash
# Syntax: node assign-role-cli.js <address> <role>
node scripts/assign-role-cli.js ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50 university
node scripts/assign-role-cli.js STPJ2HPED2TMR1HAFBFA5VQF986CRD4ZWHH36F6X student  
node scripts/assign-role-cli.js ST2Y2SFNVZBT8SSZ00XXKH930MCN0RFREB2GQG7CJ knqa
```

### Batch Assignment Mode

```bash
# Assign same role to multiple addresses
node scripts/assign-role-cli.js --batch student \
  STPJ2HPED2TMR1HAFBFA5VQF986CRD4ZWHH36F6X \
  ST1ANOTHERADDRESS123456789ABCDEFGHIJK \
  ST1THIRDADDRESS123456789ABCDEFGHIJK
```

### Help

```bash
node scripts/assign-role-cli.js --help
```

---

## Method 3: Manual Setup Script

### Using the Existing Setup Script

```bash
cd api/
node scripts/setup-roles.js
```

This assigns roles to the pre-configured addresses:
- University: `ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50`
- KNQA: `ST2Y2SFNVZBT8SSZ00XXKH930MCN0RFREB2GQG7CJ`  
- Student: `STPJ2HPED2TMR1HAFBFA5VQF986CRD4ZWHH36F6X`

### Custom Script for Your Addresses

Create a custom script:

```javascript
// custom-role-setup.js
import { config } from './src/config.js';
// ... (import statements from setup-roles.js)

async function customSetup() {
  const deployerPrivateKey = config.DEPLOYER_PRIVATE_KEY;
  
  // Your custom addresses
  const assignments = [
    { address: 'YOUR_UNIVERSITY_ADDRESS_HERE', role: 'university' },
    { address: 'YOUR_STUDENT_ADDRESS_HERE', role: 'student' },
    { address: 'YOUR_KNQA_ADDRESS_HERE', role: 'knqa' }
  ];

  for (const { address, role } of assignments) {
    await assignRole(address, role, deployerPrivateKey);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

customSetup();
```

---

## Roles and Permissions

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Student** | • View own certificates<br>• Download certificates<br>• Verify any certificate | End users receiving certificates |
| **University** | • Issue new certificates<br>• Revoke certificates<br>• View issued certificates<br>• All student permissions | Educational institutions |
| **KNQA** | • All university permissions<br>• Approve certificates<br>• Manage user roles<br>• System administration | Government oversight body |
| **None** | • Verify certificates only<br>• Public access | Unregistered users |

---

## Wallet Address Examples

### Your Current Configured Addresses

```bash
# University Role
ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50

# KNQA Role (Admin)
ST2Y2SFNVZBT8SSZ00XXKH930MCN0RFREB2GQG7CJ

# Student Role  
STPJ2HPED2TMR1HAFBFA5VQF986CRD4ZWHH36F6X
```

### Adding New Addresses

To add your own wallet address:

1. **Get your address** from Xverse wallet
2. **Use any of the three methods above** to assign a role
3. **Test the connection** at `/connect`

---

## Troubleshooting

### ❌ "Transaction failed: NotAuthorized"
**Solution**: Make sure you're using the deployer private key and the contract is deployed correctly.

### ❌ "Invalid address format"  
**Solution**: Ensure address starts with `ST` (testnet) or `SP` (mainnet) and is 41 characters long.

### ❌ "Insufficient funds"
**Solution**: The deployer address needs STX tokens for transaction fees.

### ❌ "Contract not found"
**Solution**: Verify the contract is deployed and `CONTRACT_ADDRESS` is correct in config.

### ❌ "Role assignment not working in UI"
**Solution**: Wait for blockchain confirmation (can take 1-2 minutes), then refresh the page.

---

## Testing Your Setup

### Quick Test Script

```bash
# 1. Assign role to your address
node scripts/assign-role-cli.js YOUR_ADDRESS university

# 2. Test the API endpoint
curl "http://localhost:4000/api/role/YOUR_ADDRESS"

# 3. Connect wallet in UI and verify role appears
```

### Expected API Response

```json
{
  "success": true,
  "role": "university",
  "address": "ST2ST2H80NP5C9SPR4ENJ1Z9CDM9PKAJVPYWPQZ50",
  "permissions": ["issue_certificates", "revoke_certificates", "view_certificates"]
}
```

---

## Security Notes

### 🔒 Production Considerations

1. **Private Keys**: Never commit private keys to version control
2. **Network**: Use testnet for development, mainnet for production
3. **Access Control**: Only KNQA role should manage other roles
4. **Validation**: Always validate addresses client and server-side
5. **Rate Limiting**: Implement rate limiting for role assignment endpoints

### 🛡️ Best Practices

- Use environment variables for sensitive configuration
- Implement multi-signature for critical role changes
- Log all role assignments for audit trail
- Regular backup of role assignments
- Test thoroughly on testnet before mainnet deployment

---

## Support

If you encounter issues:

1. **Check the logs** in the API server console
2. **Verify blockchain connection** is working
3. **Confirm contract deployment** is successful
4. **Test with the CLI tool first** before using UI
5. **Check transaction status** on Stacks explorer

### Debug Commands

```bash
# Check if contracts are deployed
curl http://localhost:3999/v2/contracts/interface/ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM/role-registry

# Test API health  
curl http://localhost:4000/health

# Check specific role
curl http://localhost:4000/api/role/YOUR_ADDRESS
```

---

## Summary

Now you have **three flexible ways** to assign roles:

1. **🖥️ Web UI** - Point-and-click for admins
2. **⌨️ CLI Tool** - Interactive or batch for power users  
3. **🔧 Scripts** - Automated for development workflows

Choose the method that best fits your workflow and technical comfort level!