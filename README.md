# [HFS Exec Launcher](../../releases/) Plugin for Windows
**Launch executable files on the server directly from **HTTP File Server version 3 (HFS 3)** web interface**

---

## Description
This [plugin](../../releases/) allows administrators and trusted users to launch executable files (`.exe`, `.cmd`, `.bat`) on **HTTP File Server version 3 (HFS 3)** directly from its web interface. The solution **works exclusively on Windows** and includes a multi-layered security system for access control.

---

## Key Features
1. **Flexible Access Control**:
   - Restrictions by groups/users.
   - Configurable for HFS administrators only or all users.
2. **Secure Execution**:
   - Filtering by allowed extensions (configurable).
   - Path restrictions for execution in VFS and the physical file system.
   - Protection against injections, symlinks, UNC paths, and path traversal.
3. **Operation Modes**:
   - Detached process launch for interactive consoles.
   - Hidden console mode (terminates with HFS).
   - Execution under the account running HFS.
4. **Monitoring**:
   - Logging user name and **parent process** PID details.
   - Success/error notifications in the web interface.

---

## Settings

![screenshot1](../../blob/main/screenshots/screenshot1.jpg)

---

## Interface
- **"Run on server"** appears in file context menus (if execution is permitted **based on all security criteria**).

![menu](../../blob/main/screenshots/menu.jpg)
- Result: Toast notification with PID and file path.

---

## Security
- **Path Filtering**:
  - Blocks relative paths (`..`), symlinks, UNC paths.
  - Strict binding to `physicalPath`.
- **Command Sanitization**: Removes dangerous symbols (`&`, `|`, `>`, `<`).
- **Checks**:
  - File extension.
  - VFS/physical path validity.
  - User/group permissions.
- **For your awareness**:
  - Acknowledge that most security relies on HFS VFS.
  - Don't allow HFS to be used without HTTPS for accounts with file execution permissions.
  - Change passwords regularly.

## Additional Paranoid Security
- **For public/non-home use**:
  - Restrict Windows account permissions for HFS (including full NTFS control).
  - Avoid non-standard Windows characters (`%`, `"`, etc.) in script paths/names.
  - Implement signature verification for `cmd`, `exe`, and similar files using PowerShell or SignTool.
  - Disable public uploads to VFS/NTFS script folders.
  - Use non-default confidential paths (not `C:\scripts` or `/hfs-scripts`).
  - Set `can_see`/`can_list` only for required groups/users.
  - Use Virtual Folders to isolate/hide sensitive content.
  - Monitor for `cmd.exe` 0-day exploits.

---

## Use Cases for Scripts
- Stopping/restarting services, apps, OS.
- Modifying software/OS configurations.
- Generating one-time tokens/passwords/2FA.
- Creating user accounts.
- Running PowerShell scripts.
- Wake-on-LAN.
- Launching compilations/conversions with I/O in VFS folders.
- Managing Windows Task Scheduler.
- Using as a `cmd` terminal: Send input scripts → execute → capture output via `>>out.txt`.

---

## Technical Details
- **Backend**:
  - Uses `child_process.spawn`.
  - Detailed execution logs in HFS console.
- **Frontend**:
  - Dynamically adds file menu buttons **after full permission verification**.
  - Requests via `customRestCall`.

---

## Limitations
- **Windows only**.
- Requires HFS API **version 12.3+**.

---

## Installation
1. Copy the **hfs-exec-launcher** folder to HFS plugins directory.
2. **Enable** the plugin in the HFS admin panel.
3. Configure settings in **Options**.
4. **Strictly** define access rights using HFS VFS tools.

---
Support:
* BTC: `bc1qeuq7s8w0x7ma59mwd4gtj7e9rjl2g9xqvxdsl6`
* TON: `UQAOQXGtTi_aM1u54aQjb8QiXZkQdaL9MDSky5LHN0F5-yF2`
