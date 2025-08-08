'use strict';

console.log('ExecLauncher: Frontend script loaded');

HFS.onEvent('fileMenu', ({ entry, menu }) => {
    HFS.customRestCall('checkFile', { file: entry.uri })
        .then(result => {
            if (result?.allowed) {
                menu.push({
                    label: 'Run on server',
                    icon: 'play',
                    onClick: async () => {
                        try {
                            const res = await HFS.customRestCall('run', { file: entry.uri });
                            
                            if (res?.success) {
                                const message = `File executed! PID ${res.pid}. ${res.vfsPath}`;
                                HFS.toast(message, 'success');
                            } else {
                                const error = res?.error || 'Unknown error';
                                HFS.toast(`Error: ${error}`, 'error');
                            }
                        } catch (e) {
                            HFS.toast(`Error: ${e.message}`, 'error');
                        }
                        return false;
                    }
                });
            }
        })
        .catch(e => console.error('ExecLauncher check error:', e));
});