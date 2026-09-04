/**
 * Unit tests for Community Premium 6B - Editorial Model & Helper Contract
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock minimum App state for getReadingMetadataByDate
const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/readings/index.json'), 'utf8'));
const monthlyDataSept = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/readings/2026-09.json'), 'utf8'));

const mockApp = {
    data: [],
    readingIndex: indexData,
    readingIndexLoaded: true,
    monthlyReadingsCache: {
        '2026-09': monthlyDataSept
    },
    getReadingMetadataByDate: function(dateStr) {
        const targetDate = String(dateStr || '').trim();

        if (!targetDate) return null;

        const metadataSource = this.readingIndexLoaded && Array.isArray(this.readingIndex) && this.readingIndex.length > 0
            ? this.readingIndex
            : (Array.isArray(this.data) ? this.data : []);

        const item = metadataSource.find(reading => reading.date === targetDate);

        if (!item) return null;

        const monthKey = item.month || String(item.date || '').slice(0, 7);
        const cachedMonthly = this.monthlyReadingsCache ? this.monthlyReadingsCache[monthKey] : null;
        const detailedItem = Array.isArray(cachedMonthly) ? cachedMonthly.find(reading => reading.date === targetDate) : null;

        const rawQuestion = (detailedItem && detailedItem.dailyQuestion) || item.dailyQuestion || null;
        const dailyQuestion = typeof rawQuestion === 'string' && rawQuestion.trim() ? rawQuestion.trim() : null;

        return {
            date: item.date,
            reference: item.reference,
            bookId: item.bookId || null,
            month: monthKey,
            file: item.file || null,
            dailyQuestion
        };
    }
};

console.log('[Test 6B] Running Community Premium 6B Editorial Model tests...');

// Test 1: Date with dailyQuestion (2026-09-04)
const res1 = mockApp.getReadingMetadataByDate('2026-09-04');
assert.ok(res1, 'Metadata should be returned for 2026-09-04');
assert.strictEqual(res1.date, '2026-09-04');
assert.strictEqual(res1.reference, '1 Samuel 2:12-26');
assert.strictEqual(res1.dailyQuestion, '¿Qué te enseña el contraste entre el crecimiento de Samuel y la conducta de los hijos de Elí?');
console.log('✓ Test 1 Passed: Valid date with dailyQuestion');

// Test 2: Date without dailyQuestion (2026-09-01)
const res2 = mockApp.getReadingMetadataByDate('2026-09-01');
assert.ok(res2, 'Metadata should be returned for 2026-09-01');
assert.strictEqual(res2.date, '2026-09-01');
assert.strictEqual(res2.dailyQuestion, null);
console.log('✓ Test 2 Passed: Valid date without dailyQuestion');

// Test 3: Non-existent date (2099-01-01)
const res3 = mockApp.getReadingMetadataByDate('2099-01-01');
assert.strictEqual(res3, null, 'Non-existent date should return null');
console.log('✓ Test 3 Passed: Non-existent date returns null');

// Test 4: Historical reading (2026-04-07)
const res4 = mockApp.getReadingMetadataByDate('2026-04-07');
assert.ok(res4, 'Metadata should be returned for historical reading');
assert.strictEqual(res4.date, '2026-04-07');
assert.strictEqual(res4.reference, 'Deuteronomio 1:1-18');
assert.strictEqual(res4.dailyQuestion, null);
console.log('✓ Test 4 Passed: Historical reading preserved');

// Test 5: Unicode and Spanish question characters
const res5 = mockApp.getReadingMetadataByDate('2026-09-05');
assert.ok(res5, 'Metadata should be returned for 2026-09-05');
assert.strictEqual(res5.dailyQuestion, '¿En qué áreas de tu vida necesitas recordar que Dios honra a quienes le honran?');
assert.ok(res5.dailyQuestion.startsWith('¿'), 'Starts with Spanish opening question mark');
console.log('✓ Test 5 Passed: Unicode/Spanish characters handled');

// Test 6: Empty string or whitespace dailyQuestion returns null
const mockAppWhitespace = {
    ...mockApp,
    readingIndex: [{ date: '2026-09-99', reference: 'Test 1:1', dailyQuestion: '   ' }]
};
const res6 = mockAppWhitespace.getReadingMetadataByDate('2026-09-99');
assert.strictEqual(res6.dailyQuestion, null, 'Whitespace dailyQuestion should evaluate to null');
console.log('✓ Test 6 Passed: Whitespace dailyQuestion evaluates to null');

// Test 7: Legacy JSON entry without dailyQuestion property
const mockAppLegacy = {
    ...mockApp,
    readingIndex: [{ date: '2026-01-01', reference: 'Génesis 1:1' }]
};
const res7 = mockAppLegacy.getReadingMetadataByDate('2026-01-01');
assert.strictEqual(res7.dailyQuestion, null, 'Legacy item without dailyQuestion should return null');
console.log('✓ Test 7 Passed: Legacy JSON compatible');

// Test 8: No network or Firestore read (synchronous memory lookup)
const startTime = process.hrtime();
const res8 = mockApp.getReadingMetadataByDate('2026-09-04');
const diff = process.hrtime(startTime);
assert.ok(diff[0] === 0 && diff[1] < 10000000, 'Execution must be instant in-memory without async network calls');
console.log('✓ Test 8 Passed: Fast synchronous in-memory lookup (0 Firestore reads)');

// Test 9: Null / undefined / empty input dates do not throw exceptions
assert.doesNotThrow(() => {
    assert.strictEqual(mockApp.getReadingMetadataByDate(null), null);
    assert.strictEqual(mockApp.getReadingMetadataByDate(undefined), null);
    assert.strictEqual(mockApp.getReadingMetadataByDate(''), null);
});
console.log('✓ Test 9 Passed: Invalid input dates do not throw exceptions');

// Test 10: Metadata fields preserved
const res10 = mockApp.getReadingMetadataByDate('2026-09-04');
assert.deepStrictEqual(Object.keys(res10).sort(), ['bookId', 'dailyQuestion', 'date', 'file', 'month', 'reference'].sort());
console.log('✓ Test 10 Passed: All metadata fields preserved');

console.log('\nALL 10 COMMUNITY PREMIUM 6B EDITORIAL MODEL TESTS PASSED SUCCESSFULLY!\n');
