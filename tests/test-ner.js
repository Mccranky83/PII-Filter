import { pipeline } from '@xenova/transformers';

async function testNER() {
    const ner = await pipeline('token-classification', 'Xenova/bert-base-NER');
    const text = 'My name is John Doe and I work at Google in New York.';
    const results = await ner(text);
    
    let currentEntity = null;
    let currentWord = '';
    const wordsToReplace = [];

    for (const result of results) {
        if (result.entity.startsWith('B-')) {
            if (currentEntity) {
                wordsToReplace.push({ entity: currentEntity, word: currentWord });
            }
            currentEntity = result.entity.substring(2); // 'PER', 'ORG'
            currentWord = result.word;
        } else if (result.entity.startsWith('I-')) {
            if (result.word.startsWith('##')) {
                currentWord += result.word.substring(2);
            } else {
                currentWord += ' ' + result.word;
            }
        }
    }
    if (currentEntity) {
        wordsToReplace.push({ entity: currentEntity, word: currentWord });
    }

    let cleansed = text;
    for (const item of wordsToReplace) {
        if (item.entity === 'PER') {
            cleansed = cleansed.replace(item.word, '[NAME]');
        } else if (item.entity === 'ORG') {
            cleansed = cleansed.replace(item.word, '[ORG]');
        }
    }
    console.log(cleansed);
}

testNER().catch(console.error);
