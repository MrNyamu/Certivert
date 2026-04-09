# **Frontend Testing Strategy - React + Vite**

## **Recommended Testing Framework: Vitest + React Testing Library**

### **Why Vitest for React/Vite Projects:**
- **Native Vite Integration:** Built specifically for Vite projects
- **Jest Compatibility:** Same API as Jest but faster and more modern
- **ES Modules Support:** Works seamlessly with React 19+ and modern JavaScript
- **Hot Module Replacement:** Fast test execution during development
- **TypeScript Support:** Built-in TypeScript support without additional configuration

## **Recommended Package Dependencies**

Add to `frontend/package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  },
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/user-event": "^14.0.0",
    "jsdom": "^23.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "@vitest/ui": "^1.0.0"
  }
}
```

## **Configuration Files**

### **vitest.config.js**
```javascript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    css: true,
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.js',
      ]
    }
  },
})
```

### **src/test-setup.js**
```javascript
import '@testing-library/jest-dom'

// Mock Stacks Connect wallet
global.StacksProvider = {
  transactionSigning: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn()
}

// Mock environment variables
process.env.VITE_API_URL = 'http://localhost:3001'
```

## **Component Testing Categories**

### **1. Certificate Upload Component Tests**
```javascript
// __tests__/components/CertificateUpload.test.jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CertificateUpload from '../components/CertificateUpload'

describe('CertificateUpload Component', () => {
  test('should render upload form with all required fields', () => {
    render(<CertificateUpload />)
    
    expect(screen.getByLabelText(/student name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/admission number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/programme/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/graduation year/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/grade/i)).toBeInTheDocument()
    expect(screen.getByText(/upload pdf/i)).toBeInTheDocument()
  })

  test('should validate required fields before submission', async () => {
    const user = userEvent.setup()
    render(<CertificateUpload />)
    
    const submitButton = screen.getByRole('button', { name: /issue certificate/i })
    await user.click(submitButton)
    
    expect(screen.getByText(/student name is required/i)).toBeInTheDocument()
  })

  test('should handle file upload validation', async () => {
    const user = userEvent.setup()
    render(<CertificateUpload />)
    
    const fileInput = screen.getByLabelText(/upload pdf/i)
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    
    await user.upload(fileInput, invalidFile)
    
    expect(screen.getByText(/only pdf files are allowed/i)).toBeInTheDocument()
  })
})
```

### **2. Certificate Verification Component Tests**
```javascript
// __tests__/components/CertificateVerify.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CertificateVerify from '../components/CertificateVerify'

// Mock API calls
jest.mock('../services/api', () => ({
  verifyCertificate: jest.fn()
}))

import { verifyCertificate } from '../services/api'

describe('CertificateVerify Component', () => {
  test('should display certificate details for valid certificate', async () => {
    const mockCertificate = {
      status: 'VALID',
      certificate: {
        studentName: 'John Doe',
        programme: 'Computer Science',
        year: 2023,
        grade: 'First Class'
      }
    }
    
    verifyCertificate.mockResolvedValue(mockCertificate)
    
    const user = userEvent.setup()
    render(<CertificateVerify />)
    
    const certIdInput = screen.getByLabelText(/certificate id/i)
    const verifyButton = screen.getByRole('button', { name: /verify/i })
    
    await user.type(certIdInput, 'valid-cert-id-123')
    await user.click(verifyButton)
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Computer Science')).toBeInTheDocument()
      expect(screen.getByText('VALID')).toBeInTheDocument()
    })
  })

  test('should display error for non-existent certificate', async () => {
    verifyCertificate.mockResolvedValue({ status: 'NOT_FOUND' })
    
    const user = userEvent.setup()
    render(<CertificateVerify />)
    
    const certIdInput = screen.getByLabelText(/certificate id/i)
    const verifyButton = screen.getByRole('button', { name: /verify/i })
    
    await user.type(certIdInput, 'invalid-cert-id')
    await user.click(verifyButton)
    
    await waitFor(() => {
      expect(screen.getByText(/certificate not found/i)).toBeInTheDocument()
    })
  })
})
```

### **3. Wallet Integration Tests**
```javascript
// __tests__/components/WalletConnect.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WalletConnect from '../components/WalletConnect'

// Mock Stacks Connect
jest.mock('@stacks/connect', () => ({
  showConnect: jest.fn(),
  disconnect: jest.fn()
}))

import { showConnect, disconnect } from '@stacks/connect'

describe('WalletConnect Component', () => {
  test('should show connect button when wallet not connected', () => {
    render(<WalletConnect isConnected={false} />)
    
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  test('should show disconnect option when wallet connected', () => {
    render(<WalletConnect isConnected={true} userAddress="ST1234..." />)
    
    expect(screen.getByText(/ST1234/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })

  test('should call showConnect when connect button clicked', async () => {
    const user = userEvent.setup()
    render(<WalletConnect isConnected={false} />)
    
    const connectButton = screen.getByRole('button', { name: /connect wallet/i })
    await user.click(connectButton)
    
    expect(showConnect).toHaveBeenCalled()
  })
})
```

### **4. QR Code Scanner Tests**
```javascript
// __tests__/components/QRScanner.test.jsx
import { render, screen } from '@testing-library/react'
import QRScanner from '../components/QRScanner'

// Mock html5-qrcode
jest.mock('html5-qrcode', () => ({
  Html5Qrcode: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    clear: jest.fn()
  }))
}))

describe('QRScanner Component', () => {
  test('should render scanner interface', () => {
    render(<QRScanner />)
    
    expect(screen.getByText(/scan certificate qr code/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /start scanner/i })).toBeInTheDocument()
  })

  test('should handle scan result callback', async () => {
    const mockOnScan = jest.fn()
    render(<QRScanner onScan={mockOnScan} />)
    
    // Simulate QR code scan result
    const testCertId = 'scanned-cert-id-123'
    // Test implementation would trigger the onScan callback
    
    // This would be tested with actual QR code scanning simulation
    expect(mockOnScan).toHaveBeenCalledWith(testCertId)
  })
})
```

## **Integration Testing Approach**

### **5. API Integration Tests**
```javascript
// __tests__/integration/certificate-flow.test.jsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'

// Mock fetch for API calls
global.fetch = jest.fn()

describe('Certificate Flow Integration', () => {
  test('should complete full certificate issuance flow', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        certId: 'new-cert-123',
        status: 'issued',
        message: 'Certificate issued successfully'
      })
    })
    
    const user = userEvent.setup()
    render(<App />)
    
    // Navigate to issue page
    await user.click(screen.getByText(/issue certificate/i))
    
    // Fill form
    await user.type(screen.getByLabelText(/student name/i), 'Test Student')
    await user.type(screen.getByLabelText(/admission number/i), 'ADM123')
    await user.selectOptions(screen.getByLabelText(/programme/i), 'Computer Science')
    await user.type(screen.getByLabelText(/graduation year/i), '2023')
    await user.selectOptions(screen.getByLabelText(/grade/i), 'First Class')
    
    // Upload file
    const file = new File(['pdf content'], 'certificate.pdf', { type: 'application/pdf' })
    await user.upload(screen.getByLabelText(/upload pdf/i), file)
    
    // Submit
    await user.click(screen.getByRole('button', { name: /issue certificate/i }))
    
    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/certificate issued successfully/i)).toBeInTheDocument()
    })
  })
})
```

## **Performance Testing**

### **6. Component Performance Tests**
```javascript
// __tests__/performance/component-performance.test.jsx
import { render } from '@testing-library/react'
import { performance } from 'perf_hooks'
import LargeCertificateList from '../components/LargeCertificateList'

describe('Component Performance', () => {
  test('should render large certificate list within performance budget', () => {
    const largeCertList = Array(1000).fill(null).map((_, i) => ({
      id: `cert-${i}`,
      studentName: `Student ${i}`,
      programme: `Programme ${i}`,
      status: 'VALID'
    }))
    
    const startTime = performance.now()
    render(<LargeCertificateList certificates={largeCertList} />)
    const endTime = performance.now()
    
    const renderTime = endTime - startTime
    expect(renderTime).toBeLessThan(100) // Should render within 100ms
  })
})
```

## **Testing Commands**

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test -- --watch

# Run specific test file
npm run test -- CertificateUpload.test.jsx

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## **Advantages of Vitest over Jest for React/Vite:**

1. **Faster Execution:** Native ESM support and Vite's bundling
2. **Better Developer Experience:** Hot reload for tests
3. **Modern JavaScript:** Full support for latest JS features
4. **Vite Ecosystem:** Seamless integration with existing Vite config
5. **TypeScript:** Zero-config TypeScript support
6. **Coverage:** Built-in code coverage with V8