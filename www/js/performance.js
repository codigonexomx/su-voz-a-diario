/**
 * PerformanceOptimizer - Lazy Loading, CacheManager y optimizaciones de carga
 * Su Voz a Diario - Módulo 9
 */

class LazyLoader {
    constructor(options = {}) {
        this.rootMargin = options.rootMargin || '100px';
        this.threshold = options.threshold || 0.1;
        this.observer = null;
        this.init();
    }

    init() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                this.handleIntersection.bind(this),
                { rootMargin: this.rootMargin, threshold: this.threshold }
            );
        }
    }

    observe(element) {
        if (this.observer && element) {
            this.observer.observe(element);
        } else if (element) {
            this.loadElement(element);
        }
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                this.loadElement(entry.target);
                if (this.observer) {
                    this.observer.unobserve(entry.target);
                }
            }
        });
    }

    loadElement(element) {
        if (element.dataset.src) {
            element.src = element.dataset.src;
            element.removeAttribute('data-src');
        }
        if (element.dataset.bg) {
            element.style.backgroundImage = `url('${element.dataset.bg}')`;
            element.removeAttribute('data-bg');
        }
        element.classList.add('is-loaded');
    }
}

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos por defecto en memoria
    }

    set(key, value, customExpiry) {
        const expiry = customExpiry || this.cacheExpiry;
        this.memoryCache.set(key, {
            value,
            timestamp: Date.now(),
            expiry
        });

        try {
            const payload = {
                value,
                timestamp: Date.now(),
                expiry: 60 * 60 * 1000 // 1 hora en localStorage
            };
            localStorage.setItem(`cache_${key}`, JSON.stringify(payload));
        } catch (e) {
            console.warn('[CacheManager] Espacio de localStorage lleno:', e);
        }
    }

    get(key) {
        const cached = this.memoryCache.get(key);
        if (cached && (Date.now() - cached.timestamp < cached.expiry)) {
            return cached.value;
        }

        try {
            const localRaw = localStorage.getItem(`cache_${key}`);
            if (localRaw) {
                const parsed = JSON.parse(localRaw);
                if (Date.now() - parsed.timestamp < parsed.expiry) {
                    // Restaurar en memoria RAM
                    this.memoryCache.set(key, parsed);
                    return parsed.value;
                } else {
                    localStorage.removeItem(`cache_${key}`);
                }
            }
        } catch (e) {
            console.warn('[CacheManager] Error leyendo de localStorage:', e);
        }

        return null;
    }

    invalidate(key) {
        this.memoryCache.delete(key);
        try {
            localStorage.removeItem(`cache_${key}`);
        } catch (e) {}
    }

    clearExpiredCache() {
        const now = Date.now();
        this.memoryCache.forEach((val, k) => {
            if (now - val.timestamp >= val.expiry) {
                this.memoryCache.delete(k);
            }
        });
    }

    clearAll() {
        this.memoryCache.clear();
    }
}

class PerformanceOptimizer {
    constructor() {
        this.lazyLoader = new LazyLoader();
        this.cacheManager = new CacheManager();
    }

    getSkeletonHtml(count = 3) {
        const skeletonCard = `
            <div class="community-card skeleton-card">
                <div class="community-post-header">
                    <div class="skeleton skeleton-avatar"></div>
                    <div style="flex: 1;">
                        <div class="skeleton skeleton-text" style="width: 40%;"></div>
                        <div class="skeleton skeleton-text" style="width: 25%;"></div>
                    </div>
                </div>
                <div class="skeleton skeleton-text" style="width: 90%; margin-top: 14px;"></div>
                <div class="skeleton skeleton-text" style="width: 75%;"></div>
                <div class="skeleton skeleton-text" style="width: 50%;"></div>
            </div>
        `;
        return Array(count).fill(skeletonCard).join('');
    }
}

if (typeof window !== 'undefined') {
    window.LazyLoader = LazyLoader;
    window.CacheManager = CacheManager;
    window.PerformanceOptimizer = PerformanceOptimizer;
}
