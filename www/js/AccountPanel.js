import { AccountRecoveryService, accountErrorMessage } from './services/AccountRecoveryService.js';
import { escapeHtml } from './utils/dom.js';

export function renderAccountPanel(app, root) {
    if (!root) return;
    const user = app.currentUser;
    const linked = user?.isAnonymous === false && Boolean(user.email);
    root.innerHTML = `<h3>Cuenta y recuperación</h3><p>${linked ? `${escapeHtml(user.email)} · ${user.emailVerified ? 'Correo verificado' : 'Verificación pendiente'}` : 'Sin correo vinculado'}</p><div class="account-actions">${linked ? '<button type="button" data-account="refresh">Actualizar verificación</button><button type="button" data-account="verify">Reenviar verificación</button>' : '<button type="button" data-account="link">Vincular correo</button>'}<button type="button" data-account="recover">Recuperar cuenta</button><button type="button" data-account="reset">Restablecer contraseña</button><button type="button" data-account="deletion">Solicitar eliminación</button></div><p data-account-result role="status"></p>`;
    const changed = (next, previousUid) => {
        app.setCurrentAuthUser(next, previousUid);
    };
    const service = () => new AccountRecoveryService({ auth: window.firebaseAuth, sdk: window.firebaseFns, onChanged: changed,
        beforeRecover: () => app.prepareAccountRecovery(), afterRecover: () => app.finishAccountRecovery(),
        callable: async (name, data) => (await (await app.getCommunityIdentityCallable(name))(data)).data });
    const message = text => { if (root.isConnected) root.querySelector('[data-account-result]').textContent = text; };
    let opening = false;
    root.onclick = async event => {
        const button = event.target.closest('[data-account]');
        if (!button || opening) return;
        opening = true;
        button.disabled = true;
        try {
            await app.initAuth();
            if (!app.currentUser?.uid || !app.moderation) throw new Error('Account unavailable');
            const action = button.dataset.account;
            const account = service();
            if (action === 'refresh') {
                await account.refresh(); renderAccountPanel(app, root); return;
            }
            if (action === 'verify') {
                await account.sendVerification(); message('Correo de verificación enviado.'); return;
            }
            const titles = { link: 'Vincular correo', recover: 'Recuperar cuenta', reset: 'Restablecer contraseña', deletion: 'Solicitar eliminación' };
            const email = action !== 'deletion' ? '<label>Correo electrónico<input name="email" type="email" autocomplete="email" required maxlength="254"></label>' : '';
            const needsPassword = action !== 'reset' && (action !== 'deletion' || app.currentUser.isAnonymous === false);
            const password = needsPassword ? `<label>Contraseña<input name="password" type="password" autocomplete="${action === 'link' ? 'new-password' : 'current-password'}" required ${action === 'link' ? 'minlength="8"' : ''}></label>` : '';
            const consent = action === 'link' ? '<label class="report-reason-option"><input name="confirmed" type="checkbox" required>Acepto la <a href="privacy.html" target="_blank" rel="noopener noreferrer">Política de Privacidad</a> para vincular mi cuenta.</label>' : action === 'recover' ? '<p>La identidad de Comunidad cambiará a la cuenta recuperada. Las notas locales permanecen; los contenidos de identidades distintas no se fusionan.</p><label class="report-reason-option"><input name="confirmed" type="checkbox" required>Confirmo el cambio de identidad.</label>' : action === 'deletion' ? '<p>Solicitas eliminar tu cuenta y los datos remotos asociados. La solicitud será revisada para comprobar su alcance; no borra de inmediato tus notas locales.</p><label class="report-reason-option"><input name="confirmed" type="checkbox" required>Confirmo la solicitud de eliminación.</label>' : '';
            const { overlay, close } = app.moderation.openDialog(titles[action], `<form class="account-form">${email}${password}${consent}<p role="alert" data-account-error></p><div class="report-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">${escapeHtml(titles[action])}</button></div></form>`);
            const form = overlay.querySelector('form');
            overlay.addEventListener('moderation-dialog-closed', () => form.reset());
            overlay.addEventListener('keydown', event => {
                if (account.busy && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); }
            }, true);
            overlay.querySelector('[data-cancel]').addEventListener('click', close);
            form.addEventListener('submit', async submit => {
                submit.preventDefault();
                if (account.busy) return;
                const controls = [...overlay.querySelectorAll('button, input')];
                const values = new FormData(form);
                controls.forEach(control => { control.disabled = true; });
                let notice;
                try {
                    if (action === 'link') {
                        const result = await account.link(values.get('email'), values.get('password'));
                        notice = result.verificationSent ? 'Correo vinculado. Revisa tu correo para verificarlo.' : 'Correo vinculado; no se pudo enviar la verificación. Puedes reenviarla.';
                    } else if (action === 'recover') {
                        await account.recover(values.get('email'), values.get('password'), values.get('confirmed') === 'on');
                        notice = 'Cuenta recuperada. Las notas de este dispositivo permanecen.';
                    } else if (action === 'reset') {
                        await account.resetPassword(values.get('email'));
                        notice = 'Si el correo tiene una cuenta, recibirás instrucciones para restablecerla.';
                    } else {
                        await account.requestDeletion(values.get('password'), values.get('confirmed') === 'on');
                        notice = 'Solicitud de eliminación recibida. Contacto: ricardogz777@gmail.com.';
                    }
                    form.reset(); close(); renderAccountPanel(app, root); message(notice);
                } catch (error) {
                    form.querySelector('[data-account-error]').textContent = accountErrorMessage(error);
                    controls.forEach(control => { control.disabled = false; });
                }
            });
        } catch (error) { message(accountErrorMessage(error)); }
        finally { opening = false; button.disabled = false; }
    };
}
