import fs from 'fs';

const testCases = [
    {
        input: 'Hello, my name is Annan Cai and my social security number is 123-45-678.',
        expectedEntities: ['Annan Cai', '123-45-678'],
        category: 'Personal'
    },
    {
        input: 'Patient Jiaxi Tian has been diagnosed with a common cold.',
        expectedEntities: ['Jiaxi Tian'],
        category: 'Medical'
    },
    {
        input: 'The AWS secret key is AIzaSyA123456789.',
        expectedEntities: ['AIzaSyA123456789'],
        category: 'Security'
    },
    {
        input: 'Contact me at adam.u@university.edu or call 555-0199.',
        expectedEntities: ['adam.u@university.edu', '555-0199'],
        category: 'Contact'
    }
];

async function runTestSuite() {
    let totalTests = testCases.length;
    let passedTests = 0;
    let failedTests = 0;
    let totalEntities = 0;
    let leakedEntities = 0;

    for (const test of testCases) {
        console.log(`\n==================================================`);
        console.log(`[Category: ${test.category}]`);
        console.log(`Raw Input: ${test.input}`);

        try {
            const response = await fetch('http://localhost:3000/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: test.input })
            });

            if (!response.ok) {
                console.error(`Request failed with status ${response.status}`);
                failedTests++;
                continue;
            }

            const data = await response.json();
            const redactedOutput = data.cleansedPrompt;
            
            console.log(`Redacted Output: ${redactedOutput}`);

            let isLeaked = false;
            for (const entity of test.expectedEntities) {
                totalEntities++;
                // Check if the exact entity string still exists in the redacted output
                if (redactedOutput.includes(entity)) {
                    console.log(`❌ LEAK DETECTED: "${entity}" is still visible!`);
                    leakedEntities++;
                    isLeaked = true;
                } else {
                    console.log(`✅ SUCCESS: "${entity}" was successfully redacted.`);
                }
            }

            if (isLeaked) {
                failedTests++;
            } else {
                passedTests++;
            }

        } catch (error) {
            console.error(`Error during test:`, error);
            failedTests++;
        }
    }

    console.log(`\n==================================================`);
    console.log(`--- TEST SUITE SUMMARY ---`);
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${failedTests}`);
    
    const leakPercentage = (leakedEntities / totalEntities) * 100;
    console.log(`Percentage of PII Leaked: ${leakPercentage.toFixed(2)}%`);
}

runTestSuite().catch(console.error);
