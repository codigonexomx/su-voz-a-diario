/**
 * AvatarGenerator - Sistema de Avatares SVG Generados Determinísticamente y Personalizados
 * Su Voz a Diario - Módulo 1
 */

const palettes = {
    warm: ['#FF6B6B', '#FFE66D', '#FF8E53'],
    cool: ['#4ECDC4', '#45B7D1', '#96CEB4'],
    royal: ['#6C5CE7', '#A29BFE', '#FD79A8'],
    earth: ['#00B894', '#55EFC4', '#81ECEC'],
    sunset: ['#FDCB6E', '#E17055', '#D63031']
};

const patterns = ['circles', 'waves', 'mountains', 'rays', 'leaves'];

function hashString(str) {
    if (!str || typeof str !== 'string') return 12345;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function selectPalette(hash) {
    const keys = Object.keys(palettes);
    const key = keys[hash % keys.length];
    return palettes[key];
}

function selectPattern(hash) {
    return patterns[hash % patterns.length];
}

function renderPatternSVG(pattern, colors) {
    const c = colors[1] || '#ffffff';
    switch (pattern) {
        case 'circles':
            return `
                <circle cx="20%" cy="20%" r="35%" fill="${c}" opacity="0.3" />
                <circle cx="80%" cy="80%" r="25%" fill="${colors[2] || c}" opacity="0.25" />
            `;
        case 'waves':
            return `
                <path d="M0,25 C15,10 35,40 50,25 L50,50 L0,50 Z" fill="${c}" opacity="0.3" />
                <path d="M0,35 C20,20 30,45 50,30 L50,50 L0,50 Z" fill="${colors[2] || c}" opacity="0.2" />
            `;
        case 'mountains':
            return `
                <polygon points="0,50 18,20 36,50" fill="${c}" opacity="0.35" />
                <polygon points="20,50 35,28 50,50" fill="${colors[2] || c}" opacity="0.25" />
            `;
        case 'rays':
            return `
                <path d="M0,0 L25,50 L0,50 Z" fill="${c}" opacity="0.3" />
                <path d="M50,0 L25,50 L50,50 Z" fill="${colors[2] || c}" opacity="0.25" />
            `;
        case 'leaves':
            return `
                <path d="M10,10 Q25,0 40,10 Q50,25 40,40 Q25,50 10,40 Q0,25 10,10 Z" fill="${c}" opacity="0.25" />
            `;
        default:
            return `<circle cx="50%" cy="50%" r="40%" fill="${c}" opacity="0.2" />`;
    }
}

function createIconSVG(palette, pattern, initialOrIcon, hash, customColor) {
    const c1 = customColor || palette[0] || '#4A90D9';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="100%" height="100%"><circle cx="25" cy="25" r="25" fill="${c1}" /><g opacity="0.35">${renderPatternSVG(pattern, palette)}</g><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-family="'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', system-ui, sans-serif" font-size="22" font-weight="800">${initialOrIcon}</text></svg>`.trim();

    const base64 = typeof btoa !== 'undefined'
        ? btoa(unescape(encodeURIComponent(svg)))
        : encodeURIComponent(svg);

    return `data:image/svg+xml;base64,${base64}`;
}

class AvatarGenerator {
    static generate(seed, displayName = 'Anónimo', options = {}) {
        const isAnonymous = !displayName || displayName.trim().toLowerCase() === 'anónimo' || options.isAnonymous === true;
        const effectiveName = isAnonymous ? 'Anónimo' : displayName;

        let val = options.avatarValue || options.avatarIcon;
        const personObj = window.AvatarPicker?.getPerson(val);
        if (personObj) {
            val = personObj.icon;
        }

        const icon = val || (isAnonymous ? 'A' : (effectiveName.trim().charAt(0).toUpperCase() || 'S'));

        const hash = hashString(seed || effectiveName);
        const palette = isAnonymous ? ['#718096', '#4A5568', '#2D3748'] : selectPalette(hash);
        const pattern = selectPattern(hash);

        return createIconSVG(palette, pattern, icon, hash, options.avatarColor);
    }

    static renderHtml(seed, displayName, options = {}) {
        const dataUri = AvatarGenerator.generate(seed, displayName, options);
        const isVerified = options.isVerified === true;
        const isActive = options.isActive === true;
        const isAnonymous = !displayName || displayName.trim().toLowerCase() === 'anónimo' || options.isAnonymous === true;
        
        const classes = [
            'premium-avatar',
            'community-avatar',
            isVerified ? 'verified' : '',
            isAnonymous ? 'is-anonymous' : 'has-name'
        ].filter(Boolean).join(' ');

        return `
            <div class="${classes}" title="${isAnonymous ? 'Anónimo' : (displayName || 'Usuario')}" style="background-image: url('${dataUri}'); background-size: cover; background-position: center; cursor: pointer;" data-action="open-avatar-picker">
                ${isActive ? '<span class="status-indicator" title="Activo"></span>' : ''}
            </div>
        `;
    }
}

class AvatarPicker {
    static BIBLICAL_ICONS = [
        '🕊️', '✝️', '📖', '🐑', '🌿', '🔥', '💧', '🌅', '🌟', '🕯️',
        '🌾', '🍇', '🐟', '🦁', '⚓', '🏔️', '🌊', '🌈', '👑', '🗝️'
    ];

    static PERSON_AVATARS = [
        { id: 'man', label: 'Hombre', icon: '👨🏻' },
        { id: 'woman', label: 'Mujer', icon: '👩🏻' },
        { id: 'manBeard', label: 'Hombre con barba', icon: '👨🏻🦱' },
        { id: 'womanLong', label: 'Mujer cabello largo', icon: '👩🏻🦰' },
        { id: 'grandpa', label: 'Anciano', icon: '👴🏻' },
        { id: 'grandma', label: 'Anciana', icon: '👵🏻' },
        { id: 'boy', label: 'Joven', icon: '👦🏻' },
        { id: 'girl', label: 'Jovencita', icon: '👧🏻' },
        { id: 'manDark', label: 'Hombre moreno', icon: '👨🏽' },
        { id: 'womanDark', label: 'Mujer morena', icon: '👩🏽' },
        { id: 'manElder', label: 'Hombre mayor', icon: '👨🏻🦳' },
        { id: 'womanElder', label: 'Mujer mayor', icon: '👩🏻🦳' }
    ];

    static INSTRUMENTS = ['🎵', '🪕', '🎺', '📯', '🥁'];

    static PRAYER_ICONS = ['🙏', '📿', '💒', '⛪', '🕍', '🛐'];

    static COLORS = [
        '#4A90D9', '#52B788', '#7C6BC4', '#D4A533',
        '#C94C4C', '#E67E22', '#D96C8A', '#2EC4B6',
        '#8B6F5E', '#7D8597', '#2C3E50', '#E8E8E8'
    ];

    static isPerson(val) {
        if (!val) return false;
        return AvatarPicker.PERSON_AVATARS.some(p => p.id === val || p.icon === val);
    }

    static getPerson(val) {
        if (!val) return null;
        return AvatarPicker.PERSON_AVATARS.find(p => p.id === val || p.icon === val) || null;
    }

    static findCategoryForIcon(icon) {
        if (AvatarPicker.isPerson(icon)) return 'Personas Ilustradas';
        if (AvatarPicker.BIBLICAL_ICONS.includes(icon)) return 'Símbolos Bíblicos';
        if (AvatarPicker.INSTRUMENTS.includes(icon)) return 'Instrumentos de Adoración';
        if (AvatarPicker.PRAYER_ICONS.includes(icon)) return 'Elementos de Oración';
        return 'Símbolos Bíblicos';
    }

    static renderModalHtml(options = {}) {
        const selectedType = options.selectedType || (options.selectedValue && AvatarPicker.isPerson(options.selectedValue) ? 'person' : 'icon');
        const selectedValue = options.selectedValue || options.selectedIcon || '🕊️';
        const selectedColor = options.selectedColor || '#4A90D9';

        const previewUri = AvatarGenerator.generate('preview', 'Usuario', {
            avatarType: selectedType,
            avatarValue: selectedValue,
            avatarIcon: selectedValue,
            avatarColor: selectedColor
        });

        return `
            <div class="avatar-picker-overlay" id="avatarPickerModal" role="dialog" aria-modal="true" aria-labelledby="avatarPickerTitle">
                <div class="avatar-picker-modal">
                    <button type="button" class="avatar-picker-close" data-action="close-avatar-picker" aria-label="Cerrar">×</button>
                    <h3 id="avatarPickerTitle">Elige tu avatar</h3>

                    <!-- Vista previa en tiempo real -->
                    <div class="avatar-picker-preview-container">
                        <div class="avatar-picker-preview-img" id="avatarPickerPreview" style="background-image: url('${previewUri}');"></div>
                        <span class="avatar-picker-preview-label">Vista previa</span>
                    </div>

                    <div class="avatar-picker-body">
                        <!-- Selector de Colores (12 colores) -->
                        <div class="avatar-picker-section">
                            <label class="avatar-picker-label">Color de fondo</label>
                            <div class="avatar-color-grid">
                                ${AvatarPicker.COLORS.map(c => `
                                    <button type="button" class="avatar-color-btn ${c === selectedColor ? 'is-selected' : ''}" data-color="${c}" style="background-color: ${c};">
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Categoría 1: Símbolos Bíblicos (20) -->
                        <div class="avatar-picker-section">
                            <label class="avatar-picker-label">Símbolos Bíblicos</label>
                            <div class="avatar-icon-grid">
                                ${AvatarPicker.BIBLICAL_ICONS.map(icon => `
                                    <button type="button" class="avatar-icon-btn ${selectedType === 'icon' && icon === selectedValue ? 'is-selected' : ''}" data-icon="${icon}" title="Símbolo">
                                        ${icon}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Categoría 2: Personas Ilustradas (12) -->
                        <div class="avatar-picker-section">
                            <label class="avatar-picker-label">Personas Ilustradas</label>
                            <div class="avatar-icon-grid">
                                ${AvatarPicker.PERSON_AVATARS.map(p => `
                                    <button type="button" class="avatar-icon-btn ${selectedType === 'person' && (selectedValue === p.id || selectedValue === p.icon) ? 'is-selected' : ''}" data-type="person" data-id="${p.id}" data-icon="${p.icon}" title="${p.label}">
                                        ${p.icon}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Categoría 3: Instrumentos de Adoración (5) -->
                        <div class="avatar-picker-section">
                            <label class="avatar-picker-label">Instrumentos de Adoración</label>
                            <div class="avatar-icon-grid">
                                ${AvatarPicker.INSTRUMENTS.map(icon => `
                                    <button type="button" class="avatar-icon-btn ${selectedType === 'icon' && icon === selectedValue ? 'is-selected' : ''}" data-icon="${icon}" title="Instrumento">
                                        ${icon}
                                    </button>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Categoría 4: Elementos de Oración (6) -->
                        <div class="avatar-picker-section">
                            <label class="avatar-picker-label">Elementos de Oración</label>
                            <div class="avatar-icon-grid">
                                ${AvatarPicker.PRAYER_ICONS.map(icon => `
                                    <button type="button" class="avatar-icon-btn ${selectedType === 'icon' && icon === selectedValue ? 'is-selected' : ''}" data-icon="${icon}" title="Oración">
                                        ${icon}
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <div class="avatar-picker-actions">
                        <button type="button" class="btn-secondary" data-action="close-avatar-picker">Cancelar</button>
                        <button type="button" class="btn-primary" id="saveAvatarBtn" data-action="save-avatar-selection">Guardar</button>
                    </div>
                </div>
            </div>
        `;
    }

    static async saveToFirestore(userId, profileData) {
        if (!userId) throw new Error('Usuario no autenticado');

        const db = window.firebaseDb;
        const fns = window.firebaseFns;
        if (!db || !fns?.doc || !fns?.setDoc) {
            throw new Error('Firestore no está disponible');
        }

        const profileRef = fns.doc(db, 'userProfiles', userId);
        const val = typeof profileData === 'object' ? (profileData.avatarValue || profileData.avatarIcon) : profileData;
        const color = typeof profileData === 'object' ? profileData.avatarColor : arguments[2];
        const isPerson = (typeof profileData === 'object' && profileData.avatarType === 'person') || AvatarPicker.isPerson(val);
        const personObj = isPerson ? AvatarPicker.getPerson(val) : null;
        const effectiveIcon = personObj ? personObj.icon : val;

        const dataToSave = {
            userId: userId,
            avatarType: isPerson ? 'person' : 'icon',
            avatarValue: effectiveIcon || '🕊️',
            avatarColor: color || '#4A90D9',
            avatarLabel: isPerson ? (personObj?.label || 'Persona') : 'Símbolo',
            avatarIcon: effectiveIcon || '🕊️',
            avatarCategory: isPerson ? 'Personas Ilustradas' : AvatarPicker.findCategoryForIcon(val),
            updatedAt: fns.serverTimestamp ? fns.serverTimestamp() : new Date()
        };

        await fns.setDoc(profileRef, dataToSave, { merge: true });
    }
}

if (typeof window !== 'undefined') {
    window.AvatarGenerator = AvatarGenerator;
    window.AvatarPicker = AvatarPicker;
    window.generateAvatar = AvatarGenerator.generate;
}
