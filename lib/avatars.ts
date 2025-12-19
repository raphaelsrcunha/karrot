// Avatar emoticons pool
export const AVATARS = [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
    '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
    '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
    '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
    '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐',
    '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋',
    '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘',
    '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🦬', '🐃'
];

/**
 * Get a random avatar from the pool
 */
export function getRandomAvatar(): string {
    return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

/**
 * Get a specific avatar by index (useful for deterministic assignment)
 */
export function getAvatarByIndex(index: number): string {
    return AVATARS[index % AVATARS.length];
}
