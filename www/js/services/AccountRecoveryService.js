export function accountErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. No se ha cambiado tu identidad actual.',
        'auth/credential-already-in-use': 'Ese correo ya tiene una cuenta. No se ha cambiado tu identidad actual.',
        'auth/operation-not-allowed': 'El acceso con correo no está disponible todavía.',
        'auth/invalid-credential': 'No se pudo acceder. Revisa el correo y la contraseña.',
        'auth/invalid-email': 'Revisa el correo electrónico.',
        'auth/weak-password': 'La contraseña no cumple los requisitos de seguridad.',
        'auth/password-does-not-meet-requirements': 'La contraseña no cumple los requisitos de seguridad.',
        'auth/too-many-requests': 'Espera unos minutos antes de volver a intentarlo.',
        'auth/network-request-failed': 'Revisa tu conexión y vuelve a intentarlo.',
        'account/switch-confirmation-required': 'Confirma el cambio de identidad antes de recuperar la cuenta.',
    };
    return messages[error?.code] || 'No se pudo completar la operación. Tu respaldo local no se ha borrado.';
}

function failure(code) { const error = new Error(code); error.code = code; return error; }

export class AccountRecoveryService {
    constructor({ auth, sdk, onChanged = () => {}, beforeRecover = async () => {}, afterRecover = async () => {}, callable }) {
        Object.assign(this, { auth, sdk, onChanged, beforeRecover, afterRecover, callable, busy: false });
    }

    async run(action) {
        if (this.busy) throw failure('account/busy');
        this.busy = true;
        try { return await action(); } finally { this.busy = false; }
    }

    user() {
        if (!this.auth?.currentUser?.uid) throw failure('auth/unauthenticated');
        return this.auth.currentUser;
    }

    async link(email, password) {
        return this.run(async () => {
            const previous = this.user();
            if (!previous.isAnonymous) throw failure('account/already-linked');
            if (typeof password !== 'string' || password.length < 8) throw failure('auth/weak-password');
            const credential = this.sdk.EmailAuthProvider.credential(String(email).trim(), password);
            const result = await this.sdk.linkWithCredential(previous, credential);
            if (result.user.uid !== previous.uid) throw failure('account/identity-changed');
            this.onChanged(result.user, previous.uid);
            let verificationSent = true;
            try { await this.sdk.sendEmailVerification(result.user); } catch { verificationSent = false; }
            return { user: result.user, verificationSent };
        });
    }

    async recover(email, password, confirmed = false) {
        return this.run(async () => {
            if (!confirmed) throw failure('account/switch-confirmation-required');
            const previousUid = this.user().uid;
            await this.beforeRecover();
            try {
                const result = await this.sdk.signInWithEmailAndPassword(this.auth, String(email).trim(), password);
                this.onChanged(result.user, previousUid);
                return result.user;
            } finally {
                await this.afterRecover();
            }
        });
    }

    async refresh() {
        return this.run(async () => {
            const user = this.user();
            await this.sdk.reload(user);
            await this.sdk.getIdToken(user, true);
            this.onChanged(user, user.uid);
            return user;
        });
    }

    async sendVerification() {
        return this.run(() => this.sdk.sendEmailVerification(this.user()));
    }

    async resetPassword(email) {
        return this.run(async () => {
            try { await this.sdk.sendPasswordResetEmail(this.auth, String(email).trim()); }
            catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        });
    }

    async requestDeletion(password, confirmed) {
        return this.run(async () => {
            if (confirmed !== true) throw failure('account/deletion-confirmation-required');
            const user = this.user();
            if (!user.isAnonymous) {
                const credential = this.sdk.EmailAuthProvider.credential(user.email, password);
                await this.sdk.reauthenticateWithCredential(user, credential);
            }
            return this.callable('requestAccountDeletion', { confirmed: true });
        });
    }
}
