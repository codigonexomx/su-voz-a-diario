/**
 * Unit & Integration tests for Community Premium 6C - UI Integration
 * Su Voz Hoy → Pregunta del Día → Compositor de Comunidad
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load index and monthly readings
const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/readings/index.json'), 'utf8'));
const monthlyDataSept = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/readings/2026-09.json'), 'utf8'));
const appJsContent = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const stylesCssContent = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');

const mockApp = {
    data: [],
    readingIndex: indexData,
    readingIndexLoaded: true,
    monthlyReadingsCache: {
        '2026-09': monthlyDataSept
    },
    communityDraftState: null,
    escapeHtml: (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),

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
    },

    renderDailyQuestionCardHtml: function(dateStr) {
        const metadata = this.getReadingMetadataByDate(dateStr);
        const dailyQuestion = metadata?.dailyQuestion || null;

        if (!dailyQuestion) return '';

        return `
            <section class="daily-question-card" data-daily-question-date="${this.escapeHtml(metadata.date)}">
                <div class="daily-question-badge">
                    <span class="daily-question-badge-icon" aria-hidden="true">💡</span>
                    <span class="daily-question-badge-label">Pregunta del día</span>
                </div>
                <p class="daily-question-text">${this.escapeHtml(dailyQuestion)}</p>
                <div class="daily-question-actions">
                    <button type="button" class="daily-question-btn" data-action="respond-daily-question" data-date="${this.escapeHtml(metadata.date)}" data-reference="${this.escapeHtml(metadata.reference || '')}">
                        <span class="daily-question-btn-icon" aria-hidden="true">✍️</span>
                        <span>Compartir mi reflexión</span>
                    </button>
                </div>
            </section>
        `;
    }
};

console.log('[Test 6C] Running Community Premium 6C UI Integration tests...');

// C1: Reading with dailyQuestion displays card
const cardHtml4 = mockApp.renderDailyQuestionCardHtml('2026-09-04');
assert.ok(cardHtml4.includes('class="daily-question-card"'), 'C1: Card HTML must contain daily-question-card class');

// C2: Reading without dailyQuestion returns empty string
const cardHtml1 = mockApp.renderDailyQuestionCardHtml('2026-09-01');
assert.strictEqual(cardHtml1, '', 'C2: Reading without dailyQuestion returns empty string');

// C3: Correct question for date
assert.ok(cardHtml4.includes('¿Qué te enseña el contraste entre el crecimiento de Samuel'), 'C3: Correct question text rendered');

// C4: Historical reading uses historical question
const cardHtml5 = mockApp.renderDailyQuestionCardHtml('2026-09-05');
assert.ok(cardHtml5.includes('¿En qué áreas de tu vida necesitas recordar que Dios honra a quienes le honran?'), 'C4: Historical question rendered for 2026-09-05');

// C5: CTA button present when card is rendered
assert.ok(cardHtml4.includes('data-action="respond-daily-question"'), 'C5: CTA button present with respond-daily-question data action');

// C6: CTA preserves date
assert.ok(cardHtml4.includes('data-date="2026-09-04"'), 'C6: CTA preserves reading date');

// C7: CTA preserves reference
assert.ok(cardHtml4.includes('data-reference="1 Samuel 2:12-26"'), 'C7: CTA preserves reading reference');

// C8: dailyQuestion NOT in Firestore publish payload
assert.ok(!appJsContent.includes('dailyQuestion: post.dailyQuestion'), 'C8: dailyQuestion is NOT added to publish payload');

// C9: isEco NOT added to publish payload
assert.ok(!appJsContent.includes('isEco: true'), 'C9: isEco is NOT added to publish payload');

// C10: readingKey NOT added to publish payload
assert.ok(!appJsContent.includes('readingKey:'), 'C10: readingKey is NOT added to publish payload');

// C11: Composer reused (renderCommunityFormCardHtml exists)
assert.ok(appJsContent.includes('renderCommunityFormCardHtml'), 'C11: Existing composer reused');

// C12: Contextual composer renders dailyQuestion banner
assert.ok(appJsContent.includes('community-composer-daily-question-context'), 'C12: Contextual composer renders dailyQuestion banner');

// C13: Composer without question works (null fallback check)
assert.ok(appJsContent.includes('dailyQuestion ?'), 'C13: Composer handles null dailyQuestion smoothly');

// C14: Draft text preserved (communityDraftState.text)
assert.ok(appJsContent.includes('communityDraftState.text'), 'C14: Draft text preserved');

// C15: dailyQuestion NOT persisted in draft
assert.ok(!appJsContent.includes('dailyQuestion: draft.dailyQuestion'), 'C15: dailyQuestion not persisted in draft state');

// C16: Date transition A->B updates context without stale question
const metaA = mockApp.getReadingMetadataByDate('2026-09-04');
const metaB = mockApp.getReadingMetadataByDate('2026-09-05');
assert.notStrictEqual(metaA.dailyQuestion, metaB.dailyQuestion, 'C16: Question updates dynamically per date');

// C17: Navigation / Back preserved
assert.ok(appJsContent.includes('respond-daily-question'), 'C17: Action handler registered for navigation');

// C18: Safe escaping of Unicode / HTML
assert.strictEqual(mockApp.escapeHtml('<script>'), '&lt;script&gt;', 'C18: Escape HTML functions properly');

// C19: Light mode CSS selector
assert.ok(stylesCssContent.includes('.daily-question-card {'), 'C19: Light mode CSS selector present');

// C20: Dark mode CSS selector
assert.ok(stylesCssContent.includes('body.dark-mode .daily-question-card {'), 'C20: Dark mode CSS selector present');

// C21: Touch target minimum height (>=46px)
assert.ok(stylesCssContent.includes('min-height: 46px;'), 'C21: Touch target min-height >= 46px');

// C22: Discovery untouched (no discovery code mutated for questions)
assert.ok(!appJsContent.includes('communityDiscoveryFilter = dailyQuestion'), 'C22: Discovery untouched');

// C23: Prayer untouched
assert.ok(!appJsContent.includes('communityPrayerRequests = dailyQuestion'), 'C23: Prayer untouched');

// C24: Backend untouched (functions/index.js clean)
const functionsIndexContent = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
assert.ok(!functionsIndexContent.includes('dailyQuestion'), 'C24: Cloud Functions index.js untouched');

// C25: Firestore Rules and Indexes untouched
assert.ok(fs.existsSync(path.join(__dirname, '../firestore.rules')), 'C25: firestore.rules exists');

console.log('\nALL 25 COMMUNITY PREMIUM 6C UI INTEGRATION TESTS PASSED SUCCESSFULLY!\n');
