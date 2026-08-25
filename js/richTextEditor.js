/**
 * RichTextEditor - Editor Enriquecido con Formato y Selector de Versículos
 * Su Voz a Diario - Módulo 3
 */

class RichTextEditor {
    constructor(containerElement, options = {}) {
        this.container = containerElement;
        this.options = options;
        this.maxLength = options.maxLength || 1200;
        this.currentMode = 'edit'; // 'edit' | 'preview'
        this.onChangeCallback = options.onChange || null;
        
        if (this.container) {
            this.init();
        }
    }

    init() {
        this.render();
        this.bindEvents();
    }

    render() {
        const initialValue = this.options.initialValue || '';
        this.container.innerHTML = `
            <div class="rich-text-editor-wrap">
                <div class="rich-editor-toolbar" role="toolbar" aria-label="Herramientas de formato">
                    <button type="button" class="rich-toolbar-btn" data-format="bold" aria-label="Negrita" title="Negrita (<b>)"><b>B</b></button>
                    <button type="button" class="rich-toolbar-btn" data-format="italic" aria-label="Cursiva" title="Cursiva (<i>)"><i>I</i></button>
                    <button type="button" class="rich-toolbar-btn" data-format="underline" aria-label="Subrayado" title="Subrayado (<u>)"><u>U</u></button>
                    <button type="button" class="rich-toolbar-btn" data-format="blockquote" aria-label="Cita" title="Cita biblica">❝</button>
                    <button type="button" class="rich-toolbar-btn" data-format="verse" aria-label="Referencia bíblica" title="Insertar versículo del día">📖</button>
                    
                    <div class="editor-preview-toggle">
                        <button type="button" class="editor-mode-btn active" data-mode="edit">Editar</button>
                        <button type="button" class="editor-mode-btn" data-mode="preview">Vista previa</button>
                    </div>
                </div>

                <div class="editor-input-container">
                    <textarea 
                        class="community-textarea rich-editor-input" 
                        id="community-reflection" 
                        placeholder="Escribe con sencillez lo que Dios te mostró en esta lectura..." 
                        maxlength="${this.maxLength}"
                    >${this.escapeHtml(initialValue)}</textarea>
                    
                    <div class="editor-preview-content" style="display: none;" aria-label="Vista previa del texto"></div>
                </div>

                <div class="editor-footer">
                    <div class="community-char-counter" id="community-char-counter">0 / ${this.maxLength}</div>
                </div>
            </div>
        `;

        this.updateCharCounter();
    }

    bindEvents() {
        const textarea = this.container.querySelector('.rich-editor-input');
        const previewContent = this.container.querySelector('.editor-preview-content');

        if (textarea) {
            textarea.addEventListener('input', () => {
                this.updateCharCounter();
                if (typeof this.onChangeCallback === 'function') {
                    this.onChangeCallback(this.getValue());
                }
            });
        }

        // Toolbar buttons
        const toolbar = this.container.querySelector('.rich-editor-toolbar');
        if (toolbar) {
            toolbar.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-format]');
                if (btn) {
                    const format = btn.getAttribute('data-format');
                    this.applyFormat(format);
                }

                const modeBtn = e.target.closest('[data-mode]');
                if (modeBtn) {
                    const mode = modeBtn.getAttribute('data-mode');
                    this.switchMode(mode);
                }
            });
        }
    }

    applyFormat(format) {
        const textarea = this.container.querySelector('.rich-editor-input');
        if (!textarea || this.currentMode === 'preview') return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);
        let replacement = '';

        switch (format) {
            case 'bold':
                replacement = `<b>${selectedText || 'texto en negrita'}</b>`;
                break;
            case 'italic':
                replacement = `<i>${selectedText || 'texto en cursiva'}</i>`;
                break;
            case 'underline':
                replacement = `<u>${selectedText || 'texto subrayado'}</u>`;
                break;
            case 'blockquote':
                replacement = `\n<blockquote>${selectedText || 'Cita de la palabra...'}</blockquote>\n`;
                break;
            case 'verse':
                this.openVersePickerModal(textarea);
                return;
            default:
                return;
        }

        const newValue = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
        if (newValue.length <= this.maxLength) {
            textarea.value = newValue;
            textarea.focus();
            textarea.setSelectionRange(start + replacement.length, start + replacement.length);
            this.updateCharCounter();
        }
    }

    openVersePickerModal(textarea) {
        const modal = document.createElement('div');
        modal.className = 'verse-picker-overlay modal open';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        const todayReference = window.app?.getCommunityTodayContext?.().reference || 'Lectura de hoy';
        
        modal.innerHTML = `
            <div class="verse-picker-dialog">
                <div class="verse-picker-header">
                    <h3>📖 Insertar Referencia Bíblica</h3>
                    <button type="button" class="close-verse-picker" aria-label="Cerrar modal">✕</button>
                </div>
                <div class="verse-picker-body">
                    <p>Referencia del pasaje actual:</p>
                    <div class="verse-picker-reference-badge">${this.escapeHtml(todayReference)}</div>
                    
                    <div class="verse-picker-input-group">
                        <label for="customVerseInput">Escribe o busca el versículo:</label>
                        <input type="text" id="customVerseInput" placeholder="Ej. Juan 3:16 o v. 4" value="${this.escapeHtml(todayReference)}" />
                    </div>
                </div>
                <div class="verse-picker-footer">
                    <button type="button" class="btn-secondary cancel-verse-picker">Cancelar</button>
                    <button type="button" class="btn-primary insert-verse-btn">Insertar versículo</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeBtn = modal.querySelector('.close-verse-picker');
        const cancelBtn = modal.querySelector('.cancel-verse-picker');
        const insertBtn = modal.querySelector('.insert-verse-btn');
        const input = modal.querySelector('#customVerseInput');

        const closeModal = () => modal.remove();
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        insertBtn.addEventListener('click', () => {
            const verseRef = input.value.trim() || todayReference;
            const verseTag = `<span class="verse-reference" data-verse="${this.escapeHtml(verseRef)}">[Versículo: ${verseRef}]</span>`;
            
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newValue = textarea.value.substring(0, start) + verseTag + textarea.value.substring(end);
            
            if (newValue.length <= this.maxLength) {
                textarea.value = newValue;
                textarea.focus();
                this.updateCharCounter();
            }
            closeModal();
        });
    }

    switchMode(mode) {
        if (this.currentMode === mode) return;
        this.currentMode = mode;

        const textarea = this.container.querySelector('.rich-editor-input');
        const previewContent = this.container.querySelector('.editor-preview-content');
        const editBtn = this.container.querySelector('[data-mode="edit"]');
        const previewBtn = this.container.querySelector('[data-mode="preview"]');

        if (mode === 'preview') {
            const rawText = textarea.value;
            const sanitizedHtml = this.sanitizeHTML(rawText);
            previewContent.innerHTML = sanitizedHtml || '<em style="color: var(--text-muted);">Sin contenido para previsualizar.</em>';
            
            textarea.style.display = 'none';
            previewContent.style.display = 'block';
            editBtn.classList.remove('active');
            previewBtn.classList.add('active');
        } else {
            textarea.style.display = 'block';
            previewContent.style.display = 'none';
            editBtn.classList.add('active');
            previewBtn.classList.remove('active');
            textarea.focus();
        }
    }

    sanitizeHTML(rawHtml) {
        if (typeof window.DOMPurify !== 'undefined') {
            const config = {
                ALLOWED_TAGS: ['b', 'i', 'u', 'blockquote', 'span', 'p', 'br'],
                ALLOWED_ATTR: ['class', 'data-verse']
            };
            return window.DOMPurify.sanitize(rawHtml, config);
        }
        
        // Basic fallback regex sanitization
        if (!rawHtml) return '';
        let clean = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        clean = clean.replace(/on\w+="[^"]*"/gi, '');
        return clean;
    }

    updateCharCounter() {
        const textarea = this.container.querySelector('.rich-editor-input');
        const counter = this.container.querySelector('#community-char-counter');
        if (textarea && counter) {
            const len = textarea.value.length;
            counter.textContent = `${len} / ${this.maxLength}`;
            if (len >= this.maxLength) {
                counter.classList.add('is-limit');
            } else {
                counter.classList.remove('is-limit');
            }
        }
    }

    getValue() {
        const textarea = this.container.querySelector('.rich-editor-input');
        const rawText = textarea ? textarea.value.trim() : '';
        const sanitizedText = this.sanitizeHTML(rawText);
        const plainText = rawText.replace(/<[^>]*>/g, '');

        return {
            text: sanitizedText,
            plainText: plainText
        };
    }

    setValue(val) {
        const textarea = this.container.querySelector('.rich-editor-input');
        if (textarea) {
            textarea.value = val || '';
            this.updateCharCounter();
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

if (typeof window !== 'undefined') {
    window.RichTextEditor = RichTextEditor;
}
