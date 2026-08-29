(function () {
    const INVISIBLE_OR_CONTROL_PATTERN = /[\p{C}\u200B-\u200F\u202A-\u202E\u2060-\u206F]/gu;
    const COMBINING_MARKS_PATTERN = /[\u0300-\u036f]/g;
    const ALLOWED_NAME_PATTERN = /^[\p{L}\p{N} -]+$/u;
    const EMOJI_PATTERN = /[\p{Extended_Pictographic}]/u;

    const RESERVED_NAMES = new Set([
        'admin',
        'administrator',
        'administrador',
        'administradora',
        'moderador',
        'moderadora',
        'moderator',
        'soporte',
        'support',
        'sistema',
        'system',
        'anonimo',
        'anonymous',
        'su voz',
        'su voz a diario',
        'suvoz',
        'suvoz a diario',
        'su voz diario',
        'suvoz diario'
    ]);

    function foldAccents(value) {
        const nTildeLower = '__SUVOZ_NTILDE_LOWER__';
        const nTildeUpper = '__SUVOZ_NTILDE_UPPER__';

        return String(value || '')
            .replace(/ñ/g, nTildeLower)
            .replace(/Ñ/g, nTildeUpper)
            .normalize('NFD')
            .replace(COMBINING_MARKS_PATTERN, '')
            .replace(new RegExp(nTildeLower, 'g'), 'ñ')
            .replace(new RegExp(nTildeUpper, 'g'), 'Ñ');
    }

    function normalizeCommunityDisplayName(value) {
        return String(value || '')
            .normalize('NFKC')
            .replace(INVISIBLE_OR_CONTROL_PATTERN, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeCommunityName(value) {
        const displayName = normalizeCommunityDisplayName(value);
        const folded = foldAccents(displayName);

        return folded
            .toLocaleLowerCase('es-MX')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function validateCommunityDisplayName(value) {
        const displayName = normalizeCommunityDisplayName(value);
        const normalizedName = normalizeCommunityName(displayName);
        const visibleLength = Array.from(displayName).length;

        if (!displayName) {
            return {
                valid: false,
                code: 'NAME_REQUIRED',
                message: 'Escribe un nombre para tu distintivo',
                displayName,
                normalizedName
            };
        }

        if (visibleLength < 3) {
            return {
                valid: false,
                code: 'NAME_TOO_SHORT',
                message: 'El nombre debe tener al menos 3 caracteres',
                displayName,
                normalizedName
            };
        }

        if (visibleLength > 24) {
            return {
                valid: false,
                code: 'NAME_TOO_LONG',
                message: 'El nombre debe tener máximo 24 caracteres',
                displayName,
                normalizedName
            };
        }

        if (EMOJI_PATTERN.test(displayName) || !ALLOWED_NAME_PATTERN.test(displayName)) {
            return {
                valid: false,
                code: 'NAME_INVALID_CHARS',
                message: 'Usa solo letras, números, espacios y guion',
                displayName,
                normalizedName
            };
        }

        if (displayName.startsWith('-') || displayName.endsWith('-') || displayName.includes('--')) {
            return {
                valid: false,
                code: 'NAME_INVALID_HYPHEN',
                message: 'El guion no puede ir al inicio, al final ni repetirse',
                displayName,
                normalizedName
            };
        }

        if (RESERVED_NAMES.has(normalizedName)) {
            return {
                valid: false,
                code: 'NAME_RESERVED',
                message: 'Este nombre no está permitido',
                displayName,
                normalizedName
            };
        }

        return {
            valid: true,
            code: 'OK',
            message: 'Nombre válido',
            displayName,
            normalizedName
        };
    }

    const CommunityIdentity = {
        RESERVED_NAMES,
        normalizeDisplayName: normalizeCommunityDisplayName,
        normalizeName: normalizeCommunityName,
        validateDisplayName: validateCommunityDisplayName
    };

    if (typeof window !== 'undefined') {
        window.CommunityIdentity = CommunityIdentity;
    }
})();
