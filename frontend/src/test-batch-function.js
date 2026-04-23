/**
 * Quick test for the batch function 
 * Run this in browser console to test
 */

// Test the batch function with multiple certificate IDs
async function testBatchFunction() {
  console.log('🧪 Testing batch function...');
  
  try {
    // Import wallet service
    const { walletService } = await import('./src/services/wallet.js');
    
    // Test certificate IDs
    const testCertIds = [
      'V2VzbGV5IE4tMTIy',   // Wesley N-122
      'V2VzbGV5IERvZUJJU',  // Wesley Doe BIT
      'SkogamFtZXNvbi0y',   // JJ Jameson - should return data
      'QUJDREVGQklU',       // Should be none
      'MTIzNDU2Nzg5MA'      // Should be none
    ];
    
    console.log('🔍 Testing batch call with IDs:', testCertIds);
    
    const result = await walletService.getPendingIssuancesBatch(testCertIds);
    
    console.log('📋 Batch result:', result);
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Found ${result.data.length} certificates:`);
    
    result.data.forEach((cert, index) => {
      console.log(`  ${index + 1}. ${cert.studentName} - ${cert.programme} (${cert.certId})`);
    });
    
    return result;
  } catch (error) {
    console.error('❌ Batch test failed:', error);
    return null;
  }
}

// Test individual vs batch performance
async function performanceTest() {
  console.log('🚀 Performance test: Individual vs Batch calls');
  
  const testCertIds = ['SkogamFtZXNvbi0y', 'V2VzbGV5IE4tMTIy', 'QUJDREVGQklU'];
  
  try {
    const { walletService } = await import('./src/services/wallet.js');
    
    // Test individual calls
    console.log('🔍 Testing individual calls...');
    const startIndividual = performance.now();
    const individualResults = [];
    
    for (const certId of testCertIds) {
      const result = await walletService.getPendingCertificateData(certId);
      if (result.success) individualResults.push(result.data);
    }
    
    const endIndividual = performance.now();
    const individualTime = endIndividual - startIndividual;
    
    // Test batch call
    console.log('🔍 Testing batch call...');
    const startBatch = performance.now();
    const batchResult = await walletService.getPendingIssuancesBatch(testCertIds);
    const endBatch = performance.now();
    const batchTime = endBatch - startBatch;
    
    console.log('📊 Performance Results:');
    console.log(`  Individual calls: ${individualTime.toFixed(2)}ms (${individualResults.length} found)`);
    console.log(`  Batch call: ${batchTime.toFixed(2)}ms (${batchResult.data.length} found)`);
    console.log(`  Speedup: ${(individualTime / batchTime).toFixed(2)}x faster`);
    
    return {
      individualTime,
      batchTime,
      speedup: individualTime / batchTime,
      individualCount: individualResults.length,
      batchCount: batchResult.data.length
    };
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    return null;
  }
}

// Add to window for easy browser console access
if (typeof window !== 'undefined') {
  window.testBatchFunction = testBatchFunction;
  window.performanceTest = performanceTest;
}

export { testBatchFunction, performanceTest };