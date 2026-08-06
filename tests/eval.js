import fs from 'fs';
import { cleansePrompt } from '../src/pii-filter.js';

async function runEval() {
    console.log('Starting evaluation...');
    const rawData = fs.readFileSync(new URL('./test-prompt.json', import.meta.url), 'utf8');
    const tests = JSON.parse(rawData);

    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const test of tests) {
        console.log(`\nEvaluating: ${test.description}`);
        const result = await cleansePrompt(test.prompt);
        console.log(`Original: ${test.prompt}`);
        console.log(`Expected: ${test.expected_redacted}`);
        console.log(`Actual  : ${result}`);

        // A basic evaluation based on the number of redaction tags
        const tagRegex = /\[(NAME|EMAIL|API_KEY|PHONE_NUMBER|ORG)\]/g;
        
        const expectedTags = test.expected_redacted.match(tagRegex) || [];
        const actualTags = result.match(tagRegex) || [];
        
        let tp = 0;
        let fp = 0;
        let fn = 0;
        
        const expectedCounts = {};
        expectedTags.forEach(t => expectedCounts[t] = (expectedCounts[t] || 0) + 1);
        
        const actualCounts = {};
        actualTags.forEach(t => actualCounts[t] = (actualCounts[t] || 0) + 1);
        
        // Calculate True Positives and False Negatives
        for (const tag in expectedCounts) {
            const exp = expectedCounts[tag];
            const act = actualCounts[tag] || 0;
            tp += Math.min(exp, act);
            if (exp > act) {
                fn += (exp - act);
            }
        }
        
        // Calculate False Positives
        for (const tag in actualCounts) {
            const act = actualCounts[tag];
            const exp = expectedCounts[tag] || 0;
            if (act > exp) {
                fp += (act - exp);
            }
        }

        truePositives += tp;
        falsePositives += fp;
        falseNegatives += fn;
    }

    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;

    console.log(`\n--- Evaluation Results ---`);
    console.log(`True Positives (TP): ${truePositives}`);
    console.log(`False Positives (FP): ${falsePositives}`);
    console.log(`False Negatives (FN): ${falseNegatives}`);
    console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
    console.log(`Recall: ${(recall * 100).toFixed(2)}%`);
}

runEval().catch(console.error);
