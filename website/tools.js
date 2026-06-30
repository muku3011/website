// -------------------------------------------------------------
// THEME & PROFILE NAVIGATION MANAGER
// -------------------------------------------------------------

// Local Dev Helper
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    return null;
}

// Theme Handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
}

function setTheme(theme) {
    const body = document.body;
    if (theme === 'dark') {
        body.classList.remove('light-theme');
        body.classList.add('dark-theme');
    } else {
        body.classList.remove('dark-theme');
        body.classList.add('light-theme');
    }
    localStorage.setItem('theme', theme);
}

// Global UI Setup on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.body.classList.contains('light-theme') ? 'light' : 'dark';
            setTheme(currentTheme === 'light' ? 'dark' : 'light');
        });
    }

    // Set User Role from Cookie (for nav visibility)
    let userGroupsVal = '';
    if (isLocal) {
        window.userRole = 'admin';
    } else {
        userGroupsVal = getCookie('hutta_groups') || 'users';
        const isAdmin = userGroupsVal.split(',').includes('users');
        window.userRole = isAdmin ? 'admin' : 'viewer';
    }

    const adminNav = document.getElementById('nav-admin');
    if (adminNav && window.userRole !== 'admin') {
        adminNav.style.display = 'none';
    }

    // Initialize all tools
    initTabController();
    initJsonFormatter();
    initRegexTester();
    initUrlEncoder();
    initBase64Converter();
    initHashGenerator();
    initJwtDecoder();
    initCryptoOperations();
    initKeyGenerator();
    initOpenApiTools();
});

function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

// Helper for Safe Event Binding
function safeAddListener(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
    }
}

// -------------------------------------------------------------
// TAB CONTROLLER
// -------------------------------------------------------------
function initTabController() {
    const menuItems = document.querySelectorAll('.tools-menu-item');
    const panels = document.querySelectorAll('.tool-panel');

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetPanelId = item.getAttribute('data-target');
            
            menuItems.forEach(mi => mi.classList.remove('active'));
            panels.forEach(p => p.classList.remove('active'));

            item.classList.add('active');
            const activePanel = document.getElementById(targetPanelId);
            if (activePanel) {
                activePanel.classList.add('active');
            }
        });
    });
}

// -------------------------------------------------------------
// JSON FORMATTER & MINIFIER
// -------------------------------------------------------------
function initJsonFormatter() {
    const jsonInput = document.getElementById('json-input');
    const jsonOutput = document.getElementById('json-output');
    const jsonErrorLog = document.getElementById('json-error-log');

    if (!jsonInput || !jsonOutput) return;

    safeAddListener('btn-json-format', 'click', () => {
        try {
            if (jsonErrorLog) jsonErrorLog.style.display = 'none';
            const parsed = JSON.parse(jsonInput.value);
            jsonOutput.textContent = JSON.stringify(parsed, null, 2);
            jsonOutput.classList.remove('text-muted');
        } catch (err) {
            if (jsonErrorLog) {
                jsonErrorLog.textContent = `Invalid JSON: ${err.message}`;
                jsonErrorLog.style.display = 'block';
            }
        }
    });

    safeAddListener('btn-json-minify', 'click', () => {
        try {
            if (jsonErrorLog) jsonErrorLog.style.display = 'none';
            const parsed = JSON.parse(jsonInput.value);
            jsonOutput.textContent = JSON.stringify(parsed);
            jsonOutput.classList.remove('text-muted');
        } catch (err) {
            if (jsonErrorLog) {
                jsonErrorLog.textContent = `Invalid JSON: ${err.message}`;
                jsonErrorLog.style.display = 'block';
            }
        }
    });

    safeAddListener('btn-json-clear', 'click', () => {
        jsonInput.value = '';
        jsonOutput.textContent = 'Output will appear here...';
        jsonOutput.classList.add('text-muted');
        if (jsonErrorLog) jsonErrorLog.style.display = 'none';
    });

    safeAddListener('btn-json-copy', 'click', () => {
        if (jsonOutput.classList.contains('text-muted')) return;
        copyToClipboard(jsonOutput.textContent, 'btn-json-copy');
    });

    safeAddListener('btn-json-download', 'click', () => {
        if (jsonOutput.classList.contains('text-muted')) return;
        downloadFile(jsonOutput.textContent, 'formatted.json', 'application/json');
    });
}

// -------------------------------------------------------------
// REGEX TESTER
// -------------------------------------------------------------
function initRegexTester() {
    const regexPattern = document.getElementById('regex-pattern');
    const flagG = document.getElementById('flag-g');
    const flagI = document.getElementById('flag-i');
    const flagM = document.getElementById('flag-m');
    const regexInput = document.getElementById('regex-input');
    const regexMatchStatus = document.getElementById('regex-match-status');
    const regexMatchHighlights = document.getElementById('regex-match-highlights');
    const regexGroupsList = document.getElementById('regex-groups-list');
    const btnExplain = document.getElementById('btn-explain-regex');
    const regexExplanationPanel = document.getElementById('regex-explanation-panel');

    if (!regexPattern || !regexInput) return;

    if (btnExplain) {
        btnExplain.addEventListener('click', () => {
            const pattern = regexPattern.value;
            if (!pattern) {
                if (regexExplanationPanel) {
                    regexExplanationPanel.style.display = 'block';
                    regexExplanationPanel.innerHTML = '<strong style="color:var(--warning-glow);">Error:</strong> Please provide a regex pattern to explain.';
                }
                return;
            }
            
            const exp = [];
            if (pattern.startsWith('^')) exp.push('- <code class="code-text-mono">^</code> : Matches the start of the string.');
            if (pattern.endsWith('$')) exp.push('- <code class="code-text-mono">$</code> : Matches the end of the string.');
            if (pattern.includes('\\b')) exp.push('- <code class="code-text-mono">\\b</code> : Matches a word boundary.');
            if (pattern.includes('\\d')) exp.push('- <code class="code-text-mono">\\d</code> : Matches any digit (0-9).');
            if (pattern.includes('\\w')) exp.push('- <code class="code-text-mono">\\w</code> : Matches any word character (alphanumeric & underscore).');
            if (pattern.includes('\\s')) exp.push('- <code class="code-text-mono">\\s</code> : Matches any whitespace character.');
            if (pattern.includes('.*')) exp.push('- <code class="code-text-mono">.*</code> : Matches any character (except newline) zero or more times.');
            if (pattern.includes('.+')) exp.push('- <code class="code-text-mono">.+</code> : Matches any character (except newline) one or more times.');
            if (pattern.includes('[')) exp.push('- <code class="code-text-mono">[...]</code> : Matches any single character in the specified list/range.');
            if (pattern.includes('(')) exp.push('- <code class="code-text-mono">(...)</code> : Captures the matched sub-expression as a group.');
            if (pattern.includes('?')) exp.push('- <code class="code-text-mono">?</code> : Makes the preceding token optional (0 or 1 time) or makes a quantifier lazy.');
            if (pattern.includes('|')) exp.push('- <code class="code-text-mono">|</code> : Acts like a boolean OR (matches the expression before or after the pipe).');
            
            let html = '<strong style="color:var(--primary-glow); margin-bottom: 0.5rem; display: inline-block;">Pattern Explanation (Basic Breakdown)</strong><br>';
            if (exp.length > 0) {
                html += exp.join('<br>');
                html += '<br><br><span style="font-size: 0.8rem; opacity: 0.8;">Note: This is a simplified breakdown of recognized tokens.</span>';
            } else {
                html += 'No basic tokens recognized for automated explanation. It looks like literal characters or a complex pattern.';
            }
            
            if (regexExplanationPanel) {
                if (regexExplanationPanel.style.display === 'block' && regexExplanationPanel.dataset.pattern === pattern) {
                    regexExplanationPanel.style.display = 'none';
                    regexExplanationPanel.dataset.pattern = '';
                } else {
                    regexExplanationPanel.style.display = 'block';
                    regexExplanationPanel.innerHTML = html;
                    regexExplanationPanel.dataset.pattern = pattern;
                }
            }
        });
    }

    function runRegexTest() {
        const pattern = regexPattern.value;
        const text = regexInput.value;

        if (!pattern) {
            if (regexMatchStatus) {
                regexMatchStatus.textContent = 'No pattern specified';
                regexMatchStatus.className = 'validation-msg error';
            }
            if (regexMatchHighlights) regexMatchHighlights.innerHTML = '';
            if (regexGroupsList) regexGroupsList.innerHTML = '';
            return;
        }

        try {
            let flags = '';
            if (flagG && flagG.checked) flags += 'g';
            if (flagI && flagI.checked) flags += 'i';
            if (flagM && flagM.checked) flags += 'm';

            const regex = new RegExp(pattern, flags);
            let highlighted = '';
            let matchCount = 0;
            let lastIndex = 0;
            let groupsHtml = '';

            if (flags.includes('g')) {
                let match;
                while ((match = regex.exec(text)) !== null) {
                    if (match.index === regex.lastIndex) {
                        regex.lastIndex++;
                    }
                    matchCount++;
                    highlighted += escapeHtml(text.slice(lastIndex, match.index));
                    highlighted += `<span class="regex-match-hl">${escapeHtml(match[0])}</span>`;
                    lastIndex = regex.lastIndex;

                    if (match.length > 1 && regexGroupsList) {
                        groupsHtml += `<div style="margin-top:0.4rem; padding:0.25rem 0.5rem; background:rgba(255,255,255,0.03); border-radius:4px;">`;
                        groupsHtml += `<strong style="color:var(--primary-glow)">Match ${matchCount} groups:</strong><br>`;
                        for (let g = 1; g < match.length; g++) {
                            groupsHtml += `<span class="regex-group-badge">Group ${g}</span>: "${escapeHtml(match[g] || 'undefined')}"<br>`;
                        }
                        groupsHtml += `</div>`;
                    }
                }
                highlighted += escapeHtml(text.slice(lastIndex));
            } else {
                const match = text.match(regex);
                if (match) {
                    matchCount = 1;
                    const index = match.index;
                    highlighted += escapeHtml(text.slice(0, index));
                    highlighted += `<span class="regex-match-hl">${escapeHtml(match[0])}</span>`;
                    highlighted += escapeHtml(text.slice(index + match[0].length));

                    if (match.length > 1 && regexGroupsList) {
                        groupsHtml += `<div style="margin-top:0.4rem; padding:0.25rem 0.5rem; background:rgba(255,255,255,0.03); border-radius:4px;">`;
                        groupsHtml += `<strong style="color:var(--primary-glow)">Match groups:</strong><br>`;
                        for (let g = 1; g < match.length; g++) {
                            groupsHtml += `<span class="regex-group-badge">Group ${g}</span>: "${escapeHtml(match[g] || 'undefined')}"<br>`;
                        }
                        groupsHtml += `</div>`;
                    }
                } else {
                    highlighted = escapeHtml(text);
                }
            }

            if (regexMatchStatus) {
                if (matchCount > 0) {
                    regexMatchStatus.textContent = `Found ${matchCount} match(es)`;
                    regexMatchStatus.className = 'validation-msg success';
                } else {
                    regexMatchStatus.textContent = 'No matches found';
                    regexMatchStatus.className = 'validation-msg error';
                }
            }
            if (regexMatchHighlights) regexMatchHighlights.innerHTML = highlighted;
            if (regexGroupsList) regexGroupsList.innerHTML = groupsHtml;

        } catch (err) {
            if (regexMatchStatus) {
                regexMatchStatus.textContent = `Regex Error: ${err.message}`;
                regexMatchStatus.className = 'validation-msg error';
            }
            if (regexMatchHighlights) regexMatchHighlights.innerHTML = escapeHtml(text);
            if (regexGroupsList) regexGroupsList.innerHTML = '';
        }
    }

    [regexPattern, regexInput, flagG, flagI, flagM].forEach(el => {
        if (el) el.addEventListener('input', runRegexTest);
        if (el && el.type === 'checkbox') el.addEventListener('change', runRegexTest);
    });
}

// -------------------------------------------------------------
// URL ENCODER / DECODER
// -------------------------------------------------------------
function initUrlEncoder() {
    const urlInput = document.getElementById('url-input');
    const urlOutput = document.getElementById('url-output');

    if (!urlInput || !urlOutput) return;

    safeAddListener('btn-url-encode', 'click', () => {
        try {
            urlOutput.value = encodeURIComponent(urlInput.value);
        } catch (err) {
            urlOutput.value = `Encoding Error: ${err.message}`;
        }
    });

    safeAddListener('btn-url-decode', 'click', () => {
        try {
            urlOutput.value = decodeURIComponent(urlInput.value);
        } catch (err) {
            urlOutput.value = `Decoding Error: ${err.message}`;
        }
    });

    safeAddListener('btn-url-clear', 'click', () => {
        urlInput.value = '';
        urlOutput.value = '';
    });

    safeAddListener('btn-url-copy', 'click', () => {
        if (!urlOutput.value) return;
        copyToClipboard(urlOutput.value, 'btn-url-copy');
    });
}

// -------------------------------------------------------------
// BASE64 CONVERTER
// -------------------------------------------------------------
function initBase64Converter() {
    const b64Input = document.getElementById('b64-input');
    const b64Output = document.getElementById('b64-output');
    const b64FileInput = document.getElementById('b64-file-input');

    if (!b64Input || !b64Output) return;

    safeAddListener('btn-b64-encode', 'click', () => {
        try {
            const bytes = new TextEncoder().encode(b64Input.value);
            let binString = '';
            bytes.forEach((b) => binString += String.fromCharCode(b));
            b64Output.value = btoa(binString);
        } catch (err) {
            b64Output.value = `Base64 Encode Error: ${err.message}`;
        }
    });

    safeAddListener('btn-b64-decode', 'click', () => {
        try {
            const binString = atob(b64Input.value);
            const bytes = new Uint8Array(binString.length);
            for (let i = 0; i < binString.length; i++) {
                bytes[i] = binString.charCodeAt(i);
            }
            b64Output.value = new TextDecoder().decode(bytes);
        } catch (err) {
            b64Output.value = `Base64 Decode Error: ${err.message}`;
        }
    });

    const b64Dropzone = document.getElementById('b64-dropzone');
    if (b64Dropzone && b64FileInput) {
        b64Dropzone.addEventListener('click', () => b64FileInput.click());

        b64Dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            b64Dropzone.classList.add('dragover');
        });

        b64Dropzone.addEventListener('dragleave', () => {
            b64Dropzone.classList.remove('dragover');
        });

        b64Dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            b64Dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                b64FileInput.files = e.dataTransfer.files;
                b64FileInput.dispatchEvent(new Event('change'));
            }
        });
    }

    safeAddListener('btn-b64-clear', 'click', () => {
        b64Input.value = '';
        b64Output.value = '';
        if (b64FileInput) b64FileInput.value = '';
        if (b64Dropzone) {
            const subtext = b64Dropzone.querySelector('.dropzone-text');
            if (subtext) {
                subtext.textContent = 'Drag & drop file here or click to browse';
            }
        }
    });

    safeAddListener('btn-b64-copy', 'click', () => {
        if (!b64Output.value) return;
        copyToClipboard(b64Output.value, 'btn-b64-copy');
    });

    if (b64FileInput) {
        b64FileInput.addEventListener('change', () => {
            const file = b64FileInput.files[0];
            if (!file) return;

            if (b64Dropzone) {
                const subtext = b64Dropzone.querySelector('.dropzone-text');
                if (subtext) {
                    subtext.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
                }
            }

            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                const base64Content = dataUrl.split(',')[1];
                b64Output.value = base64Content;
            };
            reader.onerror = () => {
                b64Output.value = 'Failed to read file.';
            };
            reader.readAsDataURL(file);
        });
    }
}

// -------------------------------------------------------------
// HASH / DIGEST GENERATOR
// -------------------------------------------------------------
function initHashGenerator() {
    const hashInput = document.getElementById('hash-input');
    if (!hashInput) return;

    const hashSha256 = document.getElementById('hash-sha256');
    const hashSha512 = document.getElementById('hash-sha512');
    const hashSha384 = document.getElementById('hash-sha384');
    const hashSha1 = document.getElementById('hash-sha1');

    async function runHashGenerator() {
        const text = hashInput.value;
        if (!text) {
            if (hashSha256) hashSha256.value = '';
            if (hashSha512) hashSha512.value = '';
            if (hashSha384) hashSha384.value = '';
            if (hashSha1) hashSha1.value = '';
            return;
        }
        
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        
        if (hashSha256) hashSha256.value = await calculateHash(data, 'SHA-256');
        if (hashSha512) hashSha512.value = await calculateHash(data, 'SHA-512');
        if (hashSha384) hashSha384.value = await calculateHash(data, 'SHA-384');
        if (hashSha1) hashSha1.value = await calculateHash(data, 'SHA-1');
    }

    hashInput.addEventListener('input', runHashGenerator);

    ['sha256', 'sha512', 'sha384', 'sha1'].forEach(algo => {
        const btn = document.getElementById(`btn-copy-${algo}`);
        const input = document.getElementById(`hash-${algo}`);
        if (btn && input) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (!input.value || input.value.startsWith('Error:')) return;
                copyToClipboard(input.value, `btn-copy-${algo}`);
            });
        }
    });
}

async function calculateHash(dataBuffer, algorithm) {
    try {
        const hashBuffer = await window.crypto.subtle.digest(algorithm, dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
        return `Error: ${err.message}`;
    }
}

// -------------------------------------------------------------
// JWT DECODER
// -------------------------------------------------------------
function initJwtDecoder() {
    const jwtInput = document.getElementById('jwt-input');
    const jwtHeaderOutput = document.getElementById('jwt-header-output');
    const jwtPayloadOutput = document.getElementById('jwt-payload-output');
    const jwtErrorLog = document.getElementById('jwt-error-log');

    if (!jwtInput) return;

    function decodeJWT() {
        const token = jwtInput.value.trim();
        if (jwtErrorLog) jwtErrorLog.style.display = 'none';

        if (!token) {
            if (jwtHeaderOutput) jwtHeaderOutput.textContent = 'JWT Header JSON';
            if (jwtPayloadOutput) jwtPayloadOutput.textContent = 'JWT Payload JSON';
            return;
        }

        const segments = token.split('.');
        if (segments.length !== 3) {
            if (jwtErrorLog) {
                jwtErrorLog.textContent = 'Invalid JWT format: Token must contain 3 dot-separated segments.';
                jwtErrorLog.style.display = 'block';
            }
            return;
        }

        try {
            const header = JSON.parse(base64UrlDecode(segments[0]));
            const payload = JSON.parse(base64UrlDecode(segments[1]));

            if (jwtHeaderOutput) jwtHeaderOutput.textContent = JSON.stringify(header, null, 2);
            
            let expirationHint = '';
            if (payload.exp) {
                const expDate = new Date(payload.exp * 1000);
                const now = new Date();
                const timeDiff = expDate.getTime() - now.getTime();
                
                if (timeDiff > 0) {
                    const mins = Math.round(timeDiff / 60000);
                    expirationHint = `\n\n// Token Expires: ${expDate.toLocaleString()} (In ~${mins} minutes)`;
                } else {
                    expirationHint = `\n\n// Token EXPIRED on: ${expDate.toLocaleString()}`;
                }
            }

            if (jwtPayloadOutput) jwtPayloadOutput.textContent = JSON.stringify(payload, null, 2) + expirationHint;
        } catch (err) {
            if (jwtErrorLog) {
                jwtErrorLog.textContent = `Parsing Error: Could not decode base64url segments. ${err.message}`;
                jwtErrorLog.style.display = 'block';
            }
        }
    }

    jwtInput.addEventListener('input', decodeJWT);

    safeAddListener('btn-jwt-clear', 'click', () => {
        jwtInput.value = '';
        if (jwtHeaderOutput) jwtHeaderOutput.textContent = 'JWT Header JSON';
        if (jwtPayloadOutput) jwtPayloadOutput.textContent = 'JWT Payload JSON';
        if (jwtErrorLog) jwtErrorLog.style.display = 'none';
    });
}

function base64UrlDecode(str) {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    const binString = atob(base64);
    const bytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        bytes[i] = binString.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

// -------------------------------------------------------------
// CRYPTO OPERATIONS (symmetric/asymmetric encryption & signing)
// -------------------------------------------------------------
function initCryptoOperations() {
    const CRYPTO_ALGS = {
        'encrypt-sym': [
            { value: 'aes-gcm-256', text: 'AES-GCM (256-bit Key, Authenticated)' },
            { value: 'aes-gcm-128', text: 'AES-GCM (128-bit Key, Authenticated)' },
            { value: 'aes-cbc-256', text: 'AES-CBC (256-bit Key, Legacy)' }
        ],
        'decrypt-sym': [
            { value: 'aes-gcm-256', text: 'AES-GCM (256-bit Key, Authenticated)' },
            { value: 'aes-gcm-128', text: 'AES-GCM (128-bit Key, Authenticated)' },
            { value: 'aes-cbc-256', text: 'AES-CBC (256-bit Key, Legacy)' }
        ],
        'encrypt-asym': [
            { value: 'rsa-oaep-256', text: 'RSA-OAEP (SHA-256 Digest)' }
        ],
        'decrypt-asym': [
            { value: 'rsa-oaep-256', text: 'RSA-OAEP (SHA-256 Digest)' }
        ],
        'sign': [
            { value: 'hmac-256', text: 'HMAC (SHA-256, Symmetric)' },
            { value: 'hmac-512', text: 'HMAC (SHA-512, Symmetric)' },
            { value: 'rsa-pss', text: 'RSA-PSS Signature (Asymmetric)' },
            { value: 'rsa-pkcs1', text: 'RSA-PKCS1-v1_5 Signature (Asymmetric)' },
            { value: 'ecdsa-p256', text: 'ECDSA Signature (Curve P-256)' }
        ],
        'verify': [
            { value: 'hmac-256', text: 'HMAC (SHA-256, Symmetric)' },
            { value: 'hmac-512', text: 'HMAC (SHA-512, Symmetric)' },
            { value: 'rsa-pss', text: 'RSA-PSS Signature (Asymmetric)' },
            { value: 'rsa-pkcs1', text: 'RSA-PKCS1-v1_5 Signature (Asymmetric)' },
            { value: 'ecdsa-p256', text: 'ECDSA Signature (Curve P-256)' }
        ]
    };

    const cryptoPayload = document.getElementById('crypto-payload');
    const cryptoOpType = document.getElementById('crypto-op-type');
    const cryptoAlgorithm = document.getElementById('crypto-algorithm');
    const cryptoPassphraseGroup = document.getElementById('crypto-passphrase-group');
    const cryptoPassphrase = document.getElementById('crypto-passphrase');
    const cryptoKeyImportGroup = document.getElementById('crypto-key-import-group');
    const cryptoKeyImport = document.getElementById('crypto-key-import');
    const cryptoSignatureGroup = document.getElementById('crypto-signature-group');
    const cryptoSignatureInput = document.getElementById('crypto-signature-input');
    const cryptoOutput = document.getElementById('crypto-output');
    const cryptoStatusIndicator = document.getElementById('crypto-status-indicator');

    if (!cryptoOpType || !cryptoAlgorithm) return;

    function updateCryptoAlgOptions() {
        const op = cryptoOpType.value;
        const options = CRYPTO_ALGS[op] || [];
        cryptoAlgorithm.innerHTML = options.map(opt => `<option value="${opt.value}">${opt.text}</option>`).join('');

        const isHmac = cryptoAlgorithm.value.includes('hmac');
        if (op.includes('sym') || isHmac) {
            if (cryptoPassphraseGroup) cryptoPassphraseGroup.style.display = 'block';
            if (cryptoKeyImportGroup) cryptoKeyImportGroup.style.display = 'none';
        } else {
            if (cryptoPassphraseGroup) cryptoPassphraseGroup.style.display = 'none';
            if (cryptoKeyImportGroup) cryptoKeyImportGroup.style.display = 'block';
        }

        if (op === 'verify') {
            if (cryptoSignatureGroup) cryptoSignatureGroup.style.display = 'block';
        } else {
            if (cryptoSignatureGroup) cryptoSignatureGroup.style.display = 'none';
        }
    }

    cryptoOpType.addEventListener('change', updateCryptoAlgOptions);
    cryptoAlgorithm.addEventListener('change', () => {
        const op = cryptoOpType.value;
        const algo = cryptoAlgorithm.value;
        if (op === 'sign' || op === 'verify') {
            if (algo.includes('hmac')) {
                if (cryptoPassphraseGroup) cryptoPassphraseGroup.style.display = 'block';
                if (cryptoKeyImportGroup) cryptoKeyImportGroup.style.display = 'none';
            } else {
                if (cryptoPassphraseGroup) cryptoPassphraseGroup.style.display = 'none';
                if (cryptoKeyImportGroup) cryptoKeyImportGroup.style.display = 'block';
            }
        }
    });

    updateCryptoAlgOptions();

    safeAddListener('btn-crypto-execute', 'click', async () => {
        if (cryptoStatusIndicator) cryptoStatusIndicator.style.display = 'none';
        cryptoOutput.textContent = 'Processing...';
        cryptoOutput.classList.remove('text-muted');

        const op = cryptoOpType.value;
        const algo = cryptoAlgorithm.value;
        const payload = cryptoPayload.value;

        if (!payload) {
            showCryptoError('Input payload is empty.');
            return;
        }

        try {
            if (op === 'encrypt-sym') {
                const pass = cryptoPassphrase.value;
                if (!pass) throw new Error('Secret passphrase is required for symmetric encryption.');
                const result = await aesEncrypt(payload, pass, algo);
                cryptoOutput.textContent = result;
                showCryptoSuccess('Symmetric Encryption successful.');
            } 
            else if (op === 'decrypt-sym') {
                const pass = cryptoPassphrase.value;
                if (!pass) throw new Error('Secret passphrase is required for symmetric decryption.');
                const result = await aesDecrypt(payload, pass, algo);
                cryptoOutput.textContent = result;
                showCryptoSuccess('Symmetric Decryption successful.');
            }
            else if (op === 'encrypt-asym') {
                const keyPem = cryptoKeyImport.value;
                if (!keyPem) throw new Error('Public key block is required for asymmetric encryption.');
                const result = await rsaEncrypt(payload, keyPem);
                cryptoOutput.textContent = result;
                showCryptoSuccess('Asymmetric Encryption successful.');
            }
            else if (op === 'decrypt-asym') {
                const keyPem = cryptoKeyImport.value;
                if (!keyPem) throw new Error('Private key block is required for asymmetric decryption.');
                const result = await rsaDecrypt(payload, keyPem);
                cryptoOutput.textContent = result;
                showCryptoSuccess('Asymmetric Decryption successful.');
            }
            else if (op === 'sign') {
                let signature;
                if (algo.includes('hmac')) {
                    const pass = cryptoPassphrase.value;
                    if (!pass) throw new Error('Secret key is required for HMAC signature.');
                    signature = await hmacSign(payload, pass, algo);
                } else {
                    const keyPem = cryptoKeyImport.value;
                    if (!keyPem) throw new Error('Private key block is required for signing.');
                    signature = await asymmetricSign(payload, keyPem, algo);
                }
                cryptoOutput.textContent = signature;
                showCryptoSuccess('Signature generated successfully.');
            }
            else if (op === 'verify') {
                const signature = cryptoSignatureInput.value;
                if (!signature) throw new Error('Signature is required for verification.');
                
                let verified = false;
                if (algo.includes('hmac')) {
                    const pass = cryptoPassphrase.value;
                    if (!pass) throw new Error('Secret key is required for HMAC verification.');
                    verified = await hmacVerify(payload, signature, pass, algo);
                } else {
                    const keyPem = cryptoKeyImport.value;
                    if (!keyPem) throw new Error('Public key block is required for signature verification.');
                    verified = await asymmetricVerify(payload, signature, keyPem, algo);
                }

                if (verified) {
                    cryptoOutput.textContent = 'SIGNATURE VALID';
                    showCryptoSuccess('Signature Verification SUCCESSFUL: The integrity of this payload matches.');
                } else {
                    cryptoOutput.textContent = 'SIGNATURE INVALID';
                    throw new Error('Verification failed: The signature does not match the payload or key.');
                }
            }
        } catch (err) {
            showCryptoError(err.message);
        }
    });

    safeAddListener('btn-crypto-copy', 'click', () => {
        if (cryptoOutput.textContent === 'Result will appear here...' || cryptoOutput.textContent === 'Processing...') return;
        copyToClipboard(cryptoOutput.textContent, 'btn-crypto-copy');
    });

    function showCryptoError(msg) {
        cryptoOutput.textContent = 'Error executing operation.';
        if (cryptoStatusIndicator) {
            cryptoStatusIndicator.textContent = msg;
            cryptoStatusIndicator.className = 'validation-msg error';
            cryptoStatusIndicator.style.display = 'block';
        }
    }

    function showCryptoSuccess(msg) {
        if (cryptoStatusIndicator) {
            cryptoStatusIndicator.textContent = msg;
            cryptoStatusIndicator.className = 'validation-msg success';
            cryptoStatusIndicator.style.display = 'block';
        }
    }
}

// -------------------------------------------------------------
// KEY & KEYPAIR GENERATOR
// -------------------------------------------------------------
function initKeyGenerator() {
    let currentGeneratedKeys = null;
    const keygenAlgorithm = document.getElementById('keygen-algorithm');
    const keygenRsaSizeGroup = document.getElementById('keygen-rsa-size-group');
    const keygenFormat = document.getElementById('keygen-format');
    const keygenOutputWrapper = document.getElementById('keygen-output-wrapper');
    const keygenCopyBtn = document.getElementById('btn-keygen-copy');
    const keygenDownloadBtn = document.getElementById('btn-keygen-download');

    if (!keygenAlgorithm) return;

    keygenAlgorithm.addEventListener('change', () => {
        const isRsa = keygenAlgorithm.value.startsWith('rsa');
        if (keygenRsaSizeGroup) keygenRsaSizeGroup.style.display = isRsa ? 'block' : 'none';
        
        if (isRsa || keygenAlgorithm.value.startsWith('ecdsa')) {
            if (keygenFormat && keygenFormat.value === 'hex') {
                keygenFormat.value = 'pem';
            }
            if (keygenFormat) keygenFormat.querySelector('option[value="hex"]').disabled = true;
        } else {
            if (keygenFormat) keygenFormat.querySelector('option[value="hex"]').disabled = false;
        }
    });

    safeAddListener('btn-keygen-generate', 'click', async () => {
        if (keygenOutputWrapper) keygenOutputWrapper.innerHTML = '<span class="text-muted">Generating secure keys...</span>';
        if (keygenCopyBtn) keygenCopyBtn.style.display = 'none';
        if (keygenDownloadBtn) keygenDownloadBtn.style.display = 'none';
        currentGeneratedKeys = null;

        const algoVal = keygenAlgorithm.value;
        const format = keygenFormat.value;

        try {
            if (algoVal.startsWith('aes')) {
                const size = algoVal.includes('256') ? 256 : 128;
                const key = await window.crypto.subtle.generateKey(
                    { name: "AES-GCM", length: size },
                    true,
                    ["encrypt", "decrypt"]
                );
                const raw = await window.crypto.subtle.exportKey("raw", key);
                const str = formatSymmetricKey(raw, format, 'AES KEY');
                
                if (keygenOutputWrapper) {
                    keygenOutputWrapper.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:0.4rem;">
                            <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">Symmetric AES Key (${size}-bit)</span>
                            <pre class="code-viewer-container" style="height:100px; margin:0;"><code class="code-viewer" id="output-sym-key">${escapeHtml(str)}</code></pre>
                        </div>
                    `;
                }
                currentGeneratedKeys = { type: 'symmetric', key: str, filename: 'aes_key.txt' };
            }
            else if (algoVal.startsWith('hmac')) {
                const key = await window.crypto.subtle.generateKey(
                    { name: "HMAC", hash: "SHA-256" },
                    true,
                    ["sign", "verify"]
                );
                const raw = await window.crypto.subtle.exportKey("raw", key);
                const str = formatSymmetricKey(raw, format, 'HMAC SECRET KEY');
                
                if (keygenOutputWrapper) {
                    keygenOutputWrapper.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:0.4rem;">
                            <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">HMAC Secret Key (SHA-256)</span>
                            <pre class="code-viewer-container" style="height:100px; margin:0;"><code class="code-viewer" id="output-sym-key">${escapeHtml(str)}</code></pre>
                        </div>
                    `;
                }
                currentGeneratedKeys = { type: 'symmetric', key: str, filename: 'hmac_key.txt' };
            }
            else if (algoVal.startsWith('rsa')) {
                const rsaSize = parseInt(document.querySelector('input[name="keygen-rsa-size"]:checked').value);
                const name = algoVal === 'rsa-oaep' ? 'RSA-OAEP' : 'RSA-PSS';
                const hash = 'SHA-256';
                const usages = algoVal === 'rsa-oaep' ? ["encrypt", "decrypt"] : ["sign", "verify"];

                const keypair = await window.crypto.subtle.generateKey(
                    {
                        name: name,
                        modulusLength: rsaSize,
                        publicExponent: new Uint8Array([1, 0, 1]),
                        hash: hash
                    },
                    true,
                    usages
                );

                const exportedPub = await window.crypto.subtle.exportKey(algoVal === 'rsa-oaep' ? 'spki' : 'spki', keypair.publicKey);
                const exportedPriv = await window.crypto.subtle.exportKey('pkcs8', keypair.privateKey);

                const pubStr = formatAsymmetricKey(exportedPub, format, 'PUBLIC KEY');
                const privStr = formatAsymmetricKey(exportedPriv, format, 'PRIVATE KEY');

                if (keygenOutputWrapper) {
                    keygenOutputWrapper.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:0.8rem;">
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">Public Key</span>
                                <pre class="code-viewer-container" style="height:150px; margin:0;"><code class="code-viewer" id="output-pub-key">${escapeHtml(pubStr)}</code></pre>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--warning-glow)">Private Key</span>
                                <pre class="code-viewer-container" style="height:150px; margin:0;"><code class="code-viewer" id="output-priv-key">${escapeHtml(privStr)}</code></pre>
                            </div>
                        </div>
                    `;
                }
                currentGeneratedKeys = { type: 'asymmetric', pub: pubStr, priv: privStr };
            }
            else if (algoVal.startsWith('ecdsa')) {
                const curve = algoVal.includes('p384') ? 'P-384' : 'P-256';
                
                const keypair = await window.crypto.subtle.generateKey(
                    {
                        name: "ECDSA",
                        namedCurve: curve
                    },
                    true,
                    ["sign", "verify"]
                );

                const exportedPub = await window.crypto.subtle.exportKey('spki', keypair.publicKey);
                const exportedPriv = await window.crypto.subtle.exportKey('pkcs8', keypair.privateKey);

                const pubStr = formatAsymmetricKey(exportedPub, format, 'PUBLIC KEY');
                const privStr = formatAsymmetricKey(exportedPriv, format, 'PRIVATE KEY');

                if (keygenOutputWrapper) {
                    keygenOutputWrapper.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:0.8rem;">
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">Public Key (${curve})</span>
                                <pre class="code-viewer-container" style="height:120px; margin:0;"><code class="code-viewer" id="output-pub-key">${escapeHtml(pubStr)}</code></pre>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--warning-glow)">Private Key (${curve})</span>
                                <pre class="code-viewer-container" style="height:120px; margin:0;"><code class="code-viewer" id="output-priv-key">${escapeHtml(privStr)}</code></pre>
                            </div>
                        </div>
                    `;
                }
                currentGeneratedKeys = { type: 'asymmetric', pub: pubStr, priv: privStr };
            }

            if (keygenCopyBtn) keygenCopyBtn.style.display = 'inline-flex';
            if (keygenDownloadBtn) keygenDownloadBtn.style.display = 'inline-flex';

        } catch (err) {
            if (keygenOutputWrapper) {
                keygenOutputWrapper.innerHTML = `<span class="text-muted" style="color:var(--warning-glow) !important">Generation Error: ${err.message}</span>`;
            }
        }
    });

    if (keygenCopyBtn) {
        keygenCopyBtn.addEventListener('click', () => {
            if (!currentGeneratedKeys) return;
            let content = '';
            if (currentGeneratedKeys.type === 'symmetric') {
                content = currentGeneratedKeys.key;
            } else {
                content = `Public Key:\n${currentGeneratedKeys.pub}\n\nPrivate Key:\n${currentGeneratedKeys.priv}`;
            }
            copyToClipboard(content, 'btn-keygen-copy');
        });
    }

    if (keygenDownloadBtn) {
        keygenDownloadBtn.addEventListener('click', () => {
            if (!currentGeneratedKeys) return;
            if (currentGeneratedKeys.type === 'symmetric') {
                downloadFile(currentGeneratedKeys.key, currentGeneratedKeys.filename, 'text/plain');
            } else {
                downloadFile(currentGeneratedKeys.pub, 'public_key.pem', 'application/x-pem-file');
                setTimeout(() => {
                    downloadFile(currentGeneratedKeys.priv, 'private_key.pem', 'application/x-pem-file');
                }, 100);
            }
        });
    }
}

// -------------------------------------------------------------
// INTERNAL CRYPTO API ACTIONS
// -------------------------------------------------------------
async function getDeriveKey(passphrase, salt, algorithmName, keyLength) {
    const passwordKey = await window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        { name: algorithmName, length: keyLength },
        false,
        ["encrypt", "decrypt"]
    );
}

async function aesEncrypt(plaintext, passphrase, algoType) {
    const isGCM = algoType.includes('gcm');
    const keyLength = algoType.includes('256') ? 256 : 128;
    const algorithmName = isGCM ? 'AES-GCM' : 'AES-CBC';
    
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(isGCM ? 12 : 16));

    const key = await getDeriveKey(passphrase, salt, algorithmName, keyLength);
    const encBuffer = await window.crypto.subtle.encrypt(
        {
            name: algorithmName,
            iv: iv
        },
        key,
        new TextEncoder().encode(plaintext)
    );

    const encryptedBytes = new Uint8Array(encBuffer);
    const resultBytes = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
    resultBytes.set(salt, 0);
    resultBytes.set(iv, salt.length);
    resultBytes.set(encryptedBytes, salt.length + iv.length);

    let binString = '';
    resultBytes.forEach(b => binString += String.fromCharCode(b));
    return btoa(binString);
}

async function aesDecrypt(ciphertextB64, passphrase, algoType) {
    const isGCM = algoType.includes('gcm');
    const keyLength = algoType.includes('256') ? 256 : 128;
    const algorithmName = isGCM ? 'AES-GCM' : 'AES-CBC';
    const ivLength = isGCM ? 12 : 16;

    const binString = atob(ciphertextB64);
    const rawBytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        rawBytes[i] = binString.charCodeAt(i);
    }

    if (rawBytes.length < 16 + ivLength) {
        throw new Error('Ciphertext payload is truncated.');
    }

    const salt = rawBytes.slice(0, 16);
    const iv = rawBytes.slice(16, 16 + ivLength);
    const encryptedData = rawBytes.slice(16 + ivLength);

    const key = await getDeriveKey(passphrase, salt, algorithmName, keyLength);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
            name: algorithmName,
            iv: iv
        },
        key,
        encryptedData
    );

    return new TextDecoder().decode(decryptedBuffer);
}

async function rsaEncrypt(plaintext, keyPem) {
    const keyBuffer = pemToArrayBuffer(keyPem);
    const publicKey = await window.crypto.subtle.importKey(
        "spki",
        keyBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["encrypt"]
    );

    const encBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        new TextEncoder().encode(plaintext)
    );

    let binString = '';
    new Uint8Array(encBuffer).forEach(b => binString += String.fromCharCode(b));
    return btoa(binString);
}

async function rsaDecrypt(ciphertextB64, keyPem) {
    const keyBuffer = pemToArrayBuffer(keyPem);
    const privateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        {
            name: "RSA-OAEP",
            hash: "SHA-256"
        },
        false,
        ["decrypt"]
    );

    const binString = atob(ciphertextB64);
    const cipherBytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        cipherBytes[i] = binString.charCodeAt(i);
    }

    const decBuffer = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        cipherBytes
    );

    return new TextDecoder().decode(decBuffer);
}

async function hmacSign(plaintext, passphrase, algo) {
    const key = await getHmacKey(passphrase, algo);
    const sigBuffer = await window.crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(plaintext)
    );

    let binString = '';
    new Uint8Array(sigBuffer).forEach(b => binString += String.fromCharCode(b));
    return btoa(binString);
}

async function hmacVerify(plaintext, signatureB64, passphrase, algo) {
    const key = await getHmacKey(passphrase, algo);
    const binString = atob(signatureB64);
    const sigBytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        sigBytes[i] = binString.charCodeAt(i);
    }

    return window.crypto.subtle.verify(
        "HMAC",
        key,
        sigBytes,
        new TextEncoder().encode(plaintext)
    );
}

async function asymmetricSign(plaintext, keyPem, algoType) {
    const keyBuffer = pemToArrayBuffer(keyPem);
    const params = getAsymmetricAlgorithmParams(algoType);
    
    const privateKey = await window.crypto.subtle.importKey(
        "pkcs8",
        keyBuffer,
        params.importParams,
        false,
        ["sign"]
    );

    const sigBuffer = await window.crypto.subtle.sign(
        params.signParams,
        privateKey,
        new TextEncoder().encode(plaintext)
    );

    let binString = '';
    new Uint8Array(sigBuffer).forEach(b => binString += String.fromCharCode(b));
    return btoa(binString);
}

async function asymmetricVerify(plaintext, signatureB64, keyPem, algoType) {
    const keyBuffer = pemToArrayBuffer(keyPem);
    const params = getAsymmetricAlgorithmParams(algoType);

    const publicKey = await window.crypto.subtle.importKey(
        "spki",
        keyBuffer,
        params.importParams,
        false,
        ["verify"]
    );

    const binString = atob(signatureB64);
    const sigBytes = new Uint8Array(binString.length);
    for (let i = 0; i < binString.length; i++) {
        sigBytes[i] = binString.charCodeAt(i);
    }

    return window.crypto.subtle.verify(
        params.signParams,
        publicKey,
        sigBytes,
        new TextEncoder().encode(plaintext)
    );
}

// Helper: Convert PEM block to ArrayBuffer
function pemToArrayBuffer(pem) {
    const cleanPem = pem
        .replace(/-----BEGIN [^-]+-----/, '')
        .replace(/-----END [^-]+-----/, '')
        .replace(/\s/g, '');
    
    const binary = atob(cleanPem);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }
    return buffer.buffer;
}

// HMAC Symmetric Signatures Helper
async function getHmacKey(passphrase, algorithm) {
    const hash = algorithm.includes('512') ? 'SHA-512' : 'SHA-256';
    return window.crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(passphrase),
        { name: "HMAC", hash: hash },
        false,
        ["sign", "verify"]
    );
}

// Asymmetric Signing Params Helper (RSA/ECDSA)
function getAsymmetricAlgorithmParams(algo) {
    if (algo === 'rsa-pss') {
        return {
            importParams: { name: "RSA-PSS", hash: "SHA-256" },
            signParams: { name: "RSA-PSS", saltLength: 32 }
        };
    } else if (algo === 'rsa-pkcs1') {
        return {
            importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            signParams: { name: "RSASSA-PKCS1-v1_5" }
        };
    } else if (algo === 'ecdsa-p256') {
        return {
            importParams: { name: "ECDSA", namedCurve: "P-256" },
            signParams: { name: "ECDSA", hash: "SHA-256" }
        };
    }
    throw new Error('Unsupported signature algorithm.');
}

// Key Formatting Helpers
function formatSymmetricKey(rawBuffer, format, label) {
    const bytes = new Uint8Array(rawBuffer);
    if (format === 'hex') {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (format === 'jwk') {
        let bin = '';
        bytes.forEach(b => bin += String.fromCharCode(b));
        const k = btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        return JSON.stringify({ kty: "oct", k: k, alg: "A256GCM", ext: true }, null, 2);
    } else {
        let bin = '';
        bytes.forEach(b => bin += String.fromCharCode(b));
        const b64 = btoa(bin);
        return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----`;
    }
}

function formatAsymmetricKey(spkiOrPkcs8Buffer, format, label) {
    if (format === 'jwk') {
        return arrayBufferToPem(spkiOrPkcs8Buffer, label);
    } else {
        return arrayBufferToPem(spkiOrPkcs8Buffer, label);
    }
}

function arrayBufferToPem(buffer, label) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    const formatted = b64.match(/.{1,64}/g).join('\n');
    return `-----BEGIN ${label}-----\n${formatted}\n-----END ${label}-----`;
}

// -------------------------------------------------------------
// GENERIC HELPERS (Copy, Download, HTML Escape)
// -------------------------------------------------------------
function copyToClipboard(text, elementId) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById(elementId);
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            btn.style.borderColor = 'var(--success-glow)';
            btn.style.color = 'var(--success-glow)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.borderColor = '';
                btn.style.color = '';
            }, 1500);
        }
    }).catch(err => {
        console.error('Copy failed', err);
    });
}

function downloadFile(content, filename, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// OpenAPI & YAML Tools
// -------------------------------------------------------------
function initOpenApiTools() {
    const inputArea    = document.getElementById('openapi-input');
    const outputArea   = document.getElementById('openapi-output');
    const rawContainer = document.getElementById('openapi-raw-container');
    const redocEl      = document.getElementById('openapi-redoc-container');
    const errorLog     = document.getElementById('openapi-error-log');

    if (!inputArea) return;

    // ── Helpers ──────────────────────────────────────────────
    function showError(msg) {
        if (!errorLog) return;
        errorLog.textContent = msg;
        errorLog.style.display = 'block';
    }

    function hideError() {
        if (!errorLog) return;
        errorLog.style.display = 'none';
        errorLog.textContent = '';
    }

    function showRawOutput(content) {
        if (redocEl)      { redocEl.style.display = 'none'; redocEl.innerHTML = ''; }
        if (rawContainer)   rawContainer.style.display = 'flex';
        if (outputArea)     outputArea.value = content;
    }

    function showRedocPane() {
        if (rawContainer) rawContainer.style.display = 'none';
        if (redocEl)      redocEl.style.display = 'block';
    }

    /** Try JSON first, then YAML. Returns parsed object or throws. */
    function parseAny(text) {
        try {
            return JSON.parse(text);
        } catch (_) {
            // fall through to YAML
        }
        return jsyaml.load(text);  // may throw YAMLException
    }

    /** Very basic check that the object looks like an OpenAPI/Swagger spec */
    function looksLikeSpec(obj) {
        return obj && typeof obj === 'object' &&
            (obj.openapi || obj.swagger);
    }

    // ── Clear ────────────────────────────────────────────────
    safeAddListener('btn-openapi-clear', 'click', () => {
        inputArea.value = '';
        if (outputArea)   outputArea.value = '';
        if (redocEl)    { redocEl.innerHTML = ''; redocEl.style.display = 'none'; }
        if (rawContainer) rawContainer.style.display = 'flex';
        hideError();
    });

    // ── Convert to YAML ──────────────────────────────────────
    safeAddListener('btn-to-yaml', 'click', () => {
        hideError();
        const input = inputArea.value.trim();
        if (!input) return showError('Input is empty. Paste valid JSON to convert to YAML.');

        let obj;
        try {
            obj = JSON.parse(input);
        } catch (e) {
            return showError('Invalid JSON: ' + e.message);
        }

        try {
            const yaml = jsyaml.dump(obj, { indent: 2, lineWidth: -1 });
            showRawOutput(yaml);
        } catch (e) {
            showError('YAML serialisation error: ' + e.message);
        }
    });

    // ── Convert to JSON ──────────────────────────────────────
    safeAddListener('btn-to-json', 'click', () => {
        hideError();
        const input = inputArea.value.trim();
        if (!input) return showError('Input is empty. Paste valid YAML to convert to JSON.');

        let obj;
        try {
            obj = jsyaml.load(input);
        } catch (e) {
            return showError('Invalid YAML: ' + e.message);
        }

        if (obj === null || obj === undefined) {
            return showError('YAML parsed to null/empty. Please provide a non-empty YAML document.');
        }

        try {
            showRawOutput(JSON.stringify(obj, null, 2));
        } catch (e) {
            showError('JSON serialisation error: ' + e.message);
        }
    });

    // ── Render Docs ──────────────────────────────────────────
    safeAddListener('btn-render-docs', 'click', () => {
        hideError();
        const input = inputArea.value.trim();
        if (!input) return showError('Input is empty. Paste an OpenAPI YAML or JSON spec to render docs.');

        // Auto-detect format
        let specObj;
        try {
            specObj = parseAny(input);
        } catch (e) {
            return showError('Input must be valid JSON or YAML: ' + e.message);
        }

        if (!specObj || typeof specObj !== 'object') {
            return showError('Parsed input is not an object. Please provide a valid OpenAPI spec.');
        }

        if (!looksLikeSpec(specObj)) {
            return showError(
                'Not a valid OpenAPI/Swagger spec — missing required "openapi" or "swagger" field at the root.'
            );
        }

        if (typeof Redoc === 'undefined') {
            return showError('Redoc library failed to load. Check that libs/redoc.standalone.js is accessible.');
        }

        showRedocPane();
        if (redocEl) {
            redocEl.innerHTML = '';
            try {
                Redoc.init(
                    specObj,
                    {
                        scrollYOffset: 60,
                        hideDownloadButton: false,
                        theme: {
                            colors: {
                                primary: { main: '#6d28d9' },
                            },
                            typography: {
                                fontFamily: '"Inter", "Segoe UI", sans-serif',
                                headings: {
                                    fontFamily: '"Outfit", "Inter", sans-serif',
                                },
                                code: {
                                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                },
                            },
                            sidebar: {
                                backgroundColor: '#0f172a',
                                textColor: '#94a3b8',
                            },
                        },
                    },
                    redocEl
                );
            } catch (e) {
                showError('Redoc render failed: ' + e.message);
                showRawOutput('');
            }
        }
    });
}
