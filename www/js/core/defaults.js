export const DEFAULT_SETTINGS = {
    reminderTime: '08:00',
    notificationsEnabled: false,
    autoSaveNotes: true,
    fontSize: 1.08,
    readingFont: 'merriweather'
};

export const READING_FONTS = Object.freeze([
    Object.freeze({ id: 'merriweather', label: 'Merriweather', family: "'Merriweather', Georgia, serif", scale: 1, weight: 400 }),
    Object.freeze({ id: 'cormorant', label: 'Cormorant Garamond', family: "'Cormorant Garamond', Georgia, serif", scale: 1.18, weight: 500 }),
    Object.freeze({ id: 'inter', label: 'Inter', family: "'Inter', system-ui, sans-serif", scale: 1, weight: 400 })
]);

export const DEFAULT_STREAK = {
    current: 0,
    longest: 0,
    lastReadDate: null
};
