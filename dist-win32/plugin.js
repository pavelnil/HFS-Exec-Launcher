'use strict';

exports.apiRequired = 12.3
exports.version = 3.5
exports.description = "Launch executable files on HFS server from web interface (Windows)"
exports.repo = "pavelnil/HFS-Exec-Launcher"
exports.preview = ["https://github.com/pavelnil/HFS-Exec-Launcher/blob/main/screenshots/screenshot1.jpg?raw=true","https://github.com/pavelnil/HFS-Exec-Launcher/blob/main/screenshots/menu.jpg?raw=true"]

exports.config = {
    allowAllUsers: {
        type: 'boolean',
        defaultValue: false,
        label: 'Allow execution for all users',
        helperText: 'If disabled - only HFS administrators (Admin-panel access)'
    },
    allowedGroups: {
        type: 'string',
        defaultValue: '',
        label: 'Allowed groups or users (separated by "|")',
        helperText: 'Example: admins|power_users|hfsuser'
    },
    allowedExtensions: {
        type: 'string',
        defaultValue: 'exe|cmd|bat',
        label: 'Allowed extensions (separated by "|")',
        helperText: 'Example: exe|cmd|bat'
    },
    allowedVfsPaths: {
        type: 'string',
        defaultValue: '',
        label: 'Allowed VFS paths (separated by "|")',
        helperText: 'Example: /scripts|/admin/tools (Files can only be executed from this VFS path including subfolders)'
    },
    physicalPath: {
        type: 'real_path',
        defaultValue: '',
        label: 'Physical execution path (Files can only be executed from this physical path including subfolders)',
        helperText: 'Example: C:\\scripts',
        folders: true,
        files: false
    },
    runDetached: {
        type: 'boolean',
        defaultValue: true,
        label: 'Run console windows in interactive mode in separate process (detached)',
        helperText: 'If enabled - console windows (cmd) run interactively independently from HFS. If disabled - console windows are hidden and will terminate when HFS stops.'
    }
};

exports.init = api => {
    const { spawn } = api.require('child_process');
    const path = api.require('path');
    const fs = api.require('fs');
    
    const { log, getConfig, getCurrentUsername, ctxBelongsTo } = api;
    const PLUGIN_NAME = 'Exec-Launcher';

    log(`[${PLUGIN_NAME}] Plugin initialized`, { info: true });

    if (process.platform !== 'win32') {
        log(`[${PLUGIN_NAME}] Error: Plugin works only on Windows`, { error: true });
        return;
    }

    const checkFile = (fileUri, ctx) => {
        const config = getConfig();
        const decodedFile = decodeURIComponent(fileUri);
        const fileVfsPath = decodedFile.toLowerCase().replace(/\\/g, '/');
        
        const ext = path.extname(decodedFile).toLowerCase().replace('.', '');
        const allowedExts = (config.allowedExtensions || 'exe|cmd|bat')
            .toLowerCase().split('|').filter(e => e.trim());
        
        if (!allowedExts.includes(ext)) {
            return { allowed: false, reason: `Invalid extension: ${ext}` };
        }
        
        const allowedVfsPaths = config.allowedVfsPaths
            .split('|').filter(p => p.trim())
            .map(p => p.trim().toLowerCase().replace(/\\/g, '/').replace(/\/$/, ''));
        
        if (allowedVfsPaths.length > 0) {
            const isAllowed = allowedVfsPaths.some(p => 
                fileVfsPath.startsWith(p + '/') || fileVfsPath === p
            );
            
            if (!isAllowed) {
                return { allowed: false, reason: `VFS path not allowed: ${fileVfsPath}` };
            }
        }
        
        const username = getCurrentUsername(ctx);
        if (!username) return { allowed: false, reason: 'Authorization required' };
        
        if (!config.allowAllUsers) {
            const account = ctx.state.account;
            if (!account || !account.admin) {
                return { allowed: false, reason: 'Administrators only' };
            }
        }
        
        if (config.allowedGroups && config.allowedGroups.trim()) {
            const groups = config.allowedGroups.toLowerCase()
                .split('|').filter(g => g.trim());
                
            if (groups.length > 0 && !ctxBelongsTo(ctx, groups)) {
                return { allowed: false, reason: 'Access denied for your group' };
            }
        }
        
        return { 
            allowed: true, 
            file: decodedFile,
            username
        };
    };

    exports.customRest = {
        checkFile: ({ file }, ctx) => {
            return checkFile(file, ctx);
        },
        
        run: async ({ file }, ctx) => {
            const check = checkFile(file, ctx);
            if (!check.allowed) {
                return { error: check.reason || 'Execution denied' };
            }
            
            const { file: decodedFile, username } = check;
            const config = getConfig();
            
            try {
                let relativePath = decodedFile;
                if (config.allowedVfsPaths) {
                    const allowedVfsPaths = config.allowedVfsPaths
                        .split('|').filter(p => p.trim())
                        .map(p => p.trim().toLowerCase().replace(/\\/g, '/').replace(/\/$/, ''));
                    
                    const fileVfsPath = decodedFile.toLowerCase().replace(/\\/g, '/');
                    const vfsRoot = allowedVfsPaths.find(p => 
                        fileVfsPath.startsWith(p + '/') || fileVfsPath === p
                    );
                    
                    if (vfsRoot) {
                        relativePath = fileVfsPath.slice(vfsRoot.length + 1);
                    }
                }
                
                const fullPath = path.join(config.physicalPath, relativePath);
                
                const normalizedFull = path.normalize(fullPath);
                const normalizedBase = path.normalize(config.physicalPath);
                
                const baseNormalized = normalizedBase.toLowerCase();
                const fullNormalized = normalizedFull.toLowerCase();
                
                if (!fullNormalized.startsWith(baseNormalized + path.sep)) {
                    return { error: 'Execution denied: file is outside allowed directory' };
                }
                
                if (relativePath.includes('..') || relativePath.includes('../')) {
                    return { error: 'Path traversal attempt detected' };
                }
                
                if (normalizedFull.startsWith('\\\\')) {
                    return { error: 'Execution of files via network paths is forbidden' };
                }
                
                try {
                    const realPath = fs.realpathSync.native(normalizedFull);
                    if (realPath !== normalizedFull) {
                        return { error: 'Symbolic links are forbidden' };
                    }
                } catch (e) {}
                
                if (!fs.existsSync(normalizedFull)) {
                    return { error: 'File not found' };
                }
                
                const safeEscape = (path) => {
                    return `"${path.replace(/[&|><^%]/g, '')}"`;
                };
                
                const escapedPath = safeEscape(normalizedFull);
                let command, args = [];
                
                const ext = path.extname(normalizedFull).toLowerCase().replace('.', '');
                if (['cmd', 'bat'].includes(ext)) {
                    command = 'cmd.exe';
                    args = ['/c', escapedPath];
                    log(`[${PLUGIN_NAME}] Running via CMD: ${command} ${args.join(' ')}`, { 
                        info: true,
                        username
                    });
                } else {
                    command = escapedPath;
                }
                
                const runDetached = config.runDetached !== false;
                
                const child = spawn(command, args, {
                    detached: runDetached,
                    stdio: 'ignore',
                    windowsHide: false,
                    shell: true
                });
                
                if (runDetached) {
                    child.unref();
                }
                
                const shortFileName = path.basename(decodedFile);
                
                log(`[${PLUGIN_NAME}] File executed: ${normalizedFull}`, { 
                    username,
                    pid: child.pid,
                    detached: runDetached
                });
                
                return { 
                    success: true, 
                    pid: child.pid,
                    file: shortFileName,
                    vfsPath: decodedFile
                };
                
            } catch (e) {
                log(`[${PLUGIN_NAME}] Execution error: ${e.message}`, { 
                    error: true, 
                    stack: e.stack,
                    username
                });
                return { error: `Execution error: ${e.message}` };
            }
        }
    };
    
    return {
        frontend_js: 'main.js?v=' + Date.now()
    };
};
