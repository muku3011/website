// -------------------------------------------------------------
// THEME & PROFILE NAVIGATION MANAGER
// -------------------------------------------------------------

// Local Dev Helper
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        let val = decodeURIComponent(parts.pop().split(';').shift());
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
        }
        return val;
    }
    return null;
}

// Global UI Setup on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {

    // Set User Role from Cookie (for nav visibility)
    let userGroupsVal = '';
    if (isLocal) {
        window.userRole = 'admin';
    } else {
        userGroupsVal = getCookie('hutta_groups') || 'users';
        const isAdmin = userGroupsVal.split(',').map(g => g.trim()).includes('admins');
        window.userRole = isAdmin ? 'admin' : 'viewer';
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
    initIpCidrCalculator();
    initCharEncoding();
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

    // Toggle passphrase visibility
    const togglePassBtn = document.getElementById('btn-toggle-passphrase');
    if (togglePassBtn && cryptoPassphrase) {
        togglePassBtn.addEventListener('click', () => {
            const isPass = cryptoPassphrase.type === 'password';
            cryptoPassphrase.type = isPass ? 'text' : 'password';
            togglePassBtn.style.color = isPass ? 'var(--primary-glow)' : 'var(--text-muted)';
        });
    }

    // Upload PEM key file
    const uploadPemBtn = document.getElementById('btn-upload-pem');
    const filePemUploader = document.getElementById('file-pem-uploader');
    if (uploadPemBtn && filePemUploader) {
        uploadPemBtn.addEventListener('click', () => filePemUploader.click());
        filePemUploader.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (cryptoKeyImport) {
                    cryptoKeyImport.value = evt.target.result;
                    showCryptoSuccess(`Successfully uploaded key file: ${file.name}`);
                }
            };
            reader.readAsText(file);
        });
    }

    // Load generated key from Keygen tab
    const loadGenKeyBtn = document.getElementById('btn-load-generated-key');
    if (loadGenKeyBtn) {
        loadGenKeyBtn.addEventListener('click', () => {
            const keys = window.currentGeneratedKeys;
            if (!keys) {
                showCryptoError('No keys have been generated yet in the Key & Keypair Generator tab.');
                return;
            }
            
            const op = cryptoOpType.value;
            if (keys.type === 'symmetric') {
                if (cryptoPassphrase) {
                    cryptoPassphrase.value = keys.key;
                    showCryptoSuccess('Loaded generated symmetric key into Passphrase field.');
                }
            } else {
                // Asymmetric keys
                if (op.includes('encrypt') || op === 'verify') {
                    if (cryptoKeyImport) {
                        cryptoKeyImport.value = keys.pub;
                        showCryptoSuccess('Loaded generated Public Key.');
                    }
                } else {
                    if (cryptoKeyImport) {
                        cryptoKeyImport.value = keys.priv;
                        showCryptoSuccess('Loaded generated Private Key.');
                    }
                }
            }
        });
    }

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
    window.currentGeneratedKeys = null;
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
        window.currentGeneratedKeys = null;

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
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">Symmetric AES Key (${size}-bit)</span>
                                <div class="action-buttons-group">
                                    <button class="btn btn-secondary btn-small btn-keygen-copy-individual" data-target="output-sym-key">Copy</button>
                                    <button class="btn btn-secondary btn-small btn-keygen-download-individual" data-key-type="symmetric" data-filename="aes_key.txt">Download</button>
                                </div>
                            </div>
                            <pre class="code-viewer-container" style="height:100px; margin:0;"><code class="code-viewer" id="output-sym-key">${escapeHtml(str)}</code></pre>
                        </div>
                    `;
                }
                window.currentGeneratedKeys = { type: 'symmetric', key: str, filename: 'aes_key.txt' };
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
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">HMAC Secret Key (SHA-256)</span>
                                <div class="action-buttons-group">
                                    <button class="btn btn-secondary btn-small btn-keygen-copy-individual" data-target="output-sym-key">Copy</button>
                                    <button class="btn btn-secondary btn-small btn-keygen-download-individual" data-key-type="symmetric" data-filename="hmac_key.txt">Download</button>
                                </div>
                            </div>
                            <pre class="code-viewer-container" style="height:100px; margin:0;"><code class="code-viewer" id="output-sym-key">${escapeHtml(str)}</code></pre>
                        </div>
                    `;
                }
                window.currentGeneratedKeys = { type: 'symmetric', key: str, filename: 'hmac_key.txt' };
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

                const exportedPub = await window.crypto.subtle.exportKey('spki', keypair.publicKey);
                const exportedPriv = await window.crypto.subtle.exportKey('pkcs8', keypair.privateKey);

                const pubStr = formatAsymmetricKey(exportedPub, format, 'PUBLIC KEY');
                const privStr = formatAsymmetricKey(exportedPriv, format, 'PRIVATE KEY');

                if (keygenOutputWrapper) {
                    keygenOutputWrapper.innerHTML = `
                        <div style="display:flex; flex-direction:column; gap:0.8rem;">
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">Public Key</span>
                                    <div class="action-buttons-group">
                                        <button class="btn btn-secondary btn-small btn-keygen-copy-individual" data-target="output-pub-key">Copy</button>
                                        <button class="btn btn-secondary btn-small btn-keygen-download-individual" data-key-type="public" data-filename="public_key.pem">Download</button>
                                    </div>
                                </div>
                                <pre class="code-viewer-container" style="height:150px; margin:0;"><code class="code-viewer" id="output-pub-key">${escapeHtml(pubStr)}</code></pre>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.8rem; font-weight:600; color:var(--warning-glow)">Private Key</span>
                                    <div class="action-buttons-group">
                                        <button class="btn btn-secondary btn-small btn-keygen-copy-individual" data-target="output-priv-key">Copy</button>
                                        <button class="btn btn-secondary btn-small btn-keygen-download-individual" data-key-type="private" data-filename="private_key.pem">Download</button>
                                    </div>
                                </div>
                                <pre class="code-viewer-container" style="height:150px; margin:0;"><code class="code-viewer" id="output-priv-key">${escapeHtml(privStr)}</code></pre>
                            </div>
                        </div>
                    `;
                }
                window.currentGeneratedKeys = { type: 'asymmetric', pub: pubStr, priv: privStr };
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
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.8rem; font-weight:600; color:var(--primary-glow)">Public Key (${curve})</span>
                                    <div class="action-buttons-group">
                                        <button class="btn btn-secondary btn-small btn-keygen-copy-individual" data-target="output-pub-key">Copy</button>
                                        <button class="btn btn-secondary btn-small btn-keygen-download-individual" data-key-type="public" data-filename="public_key.pem">Download</button>
                                    </div>
                                </div>
                                <pre class="code-viewer-container" style="height:120px; margin:0;"><code class="code-viewer" id="output-pub-key">${escapeHtml(pubStr)}</code></pre>
                            </div>
                            <div style="display:flex; flex-direction:column; gap:0.3rem;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="font-size:0.8rem; font-weight:600; color:var(--warning-glow)">Private Key (${curve})</span>
                                    <div class="action-buttons-group">
                                        <button class="btn btn-secondary btn-small btn-keygen-copy-individual" data-target="output-priv-key">Copy</button>
                                        <button class="btn btn-secondary btn-small btn-keygen-download-individual" data-key-type="private" data-filename="private_key.pem">Download</button>
                                    </div>
                                </div>
                                <pre class="code-viewer-container" style="height:120px; margin:0;"><code class="code-viewer" id="output-priv-key">${escapeHtml(privStr)}</code></pre>
                            </div>
                        </div>
                    `;
                }
                window.currentGeneratedKeys = { type: 'asymmetric', pub: pubStr, priv: privStr };
            }

        } catch (err) {
            if (keygenOutputWrapper) {
                keygenOutputWrapper.innerHTML = `<span class="text-muted" style="color:var(--warning-glow) !important">Generation Error: ${err.message}</span>`;
            }
        }
    });

    if (keygenOutputWrapper) {
        keygenOutputWrapper.addEventListener('click', (e) => {
            const copyBtn = e.target.closest('.btn-keygen-copy-individual');
            if (copyBtn) {
                const targetId = copyBtn.getAttribute('data-target');
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    copyToClipboard(targetEl.textContent, copyBtn);
                }
            }

            const downloadBtn = e.target.closest('.btn-keygen-download-individual');
            if (downloadBtn) {
                const keyType = downloadBtn.getAttribute('data-key-type');
                const filename = downloadBtn.getAttribute('data-filename');
                if (keyType === 'symmetric') {
                    if (window.currentGeneratedKeys && window.currentGeneratedKeys.type === 'symmetric') {
                        downloadFile(window.currentGeneratedKeys.key, filename, 'text/plain');
                    }
                } else if (keyType === 'public') {
                    if (window.currentGeneratedKeys && window.currentGeneratedKeys.type === 'asymmetric') {
                        downloadFile(window.currentGeneratedKeys.pub, filename, 'application/x-pem-file');
                    }
                } else if (keyType === 'private') {
                    if (window.currentGeneratedKeys && window.currentGeneratedKeys.type === 'asymmetric') {
                        downloadFile(window.currentGeneratedKeys.priv, filename, 'application/x-pem-file');
                    }
                }
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
function initOpenApiTools() {
    const inputArea    = document.getElementById('openapi-input');
    const outputArea   = document.getElementById('openapi-output');
    const rawContainer = document.getElementById('openapi-raw-container');
    const redocWrapper = document.getElementById('openapi-redoc-wrapper');
    const redocEl      = document.getElementById('openapi-redoc-container');
    const errorLog     = document.getElementById('openapi-error-log');

    if (!inputArea) return;

    let currentSpecObj = null;

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
        if (redocWrapper)   redocWrapper.style.display = 'none';
        if (redocEl)        redocEl.innerHTML = '';
        if (rawContainer)   rawContainer.style.display = 'flex';
        if (outputArea)     outputArea.value = content;
        currentSpecObj = null;
    }

    function showRedocPane() {
        if (rawContainer)   rawContainer.style.display = 'none';
        if (redocWrapper)   redocWrapper.style.display = 'flex';
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
        if (redocWrapper) redocWrapper.style.display = 'none';
        if (redocEl)      redocEl.innerHTML = '';
        if (rawContainer) rawContainer.style.display = 'flex';
        hideError();
        currentSpecObj = null;
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

        let specObj;
        try {
            specObj = parseAny(input);
        } catch (e) {
            return showError('Input must be valid JSON or YAML: ' + e.message);
        }

        if (!specObj || typeof specObj !== 'object' || !looksLikeSpec(specObj)) {
            return showError('Not a valid OpenAPI/Swagger spec.');
        }

        if (typeof Redoc === 'undefined') {
            return showError('Redoc library failed to load. Check that libs/redoc.standalone.js is accessible.');
        }

        currentSpecObj = specObj;
        showRedocPane();

        const isDark = !document.body.classList.contains('light-theme');
        const themeOpts = {
            scrollYOffset: 0,
            hideDownloadButton: false,
            disableSearch: false,
            nativeScrollbars: true,
            theme: {
                colors: {
                    primary: { main: isDark ? 'hsl(var(--hue-primary), 100%, 65%)' : 'hsl(var(--hue-primary), 90%, 50%)' },
                    text: {
                        primary: isDark ? 'hsl(210, 40%, 98%)' : 'hsl(222, 24%, 12%)',
                        secondary: isDark ? 'hsl(210, 20%, 75%)' : 'hsl(222, 15%, 35%)'
                    },
                    border: {
                        dark: isDark ? 'hsla(222, 20%, 25%, 0.4)' : 'hsla(210, 30%, 80%, 0.4)',
                        light: isDark ? 'hsla(222, 20%, 25%, 0.2)' : 'hsla(210, 30%, 80%, 0.2)'
                    }
                },
                sidebar: {
                    backgroundColor: isDark ? 'hsl(222, 24%, 6%)' : 'hsl(210, 30%, 90%)',
                    textColor: isDark ? 'hsl(210, 20%, 75%)' : 'hsl(222, 15%, 35%)',
                    activeTextColor: isDark ? 'hsl(var(--hue-primary), 100%, 60%)' : 'hsl(var(--hue-primary), 90%, 50%)'
                },
                rightPanel: {
                    backgroundColor: isDark ? 'hsl(222, 24%, 10%)' : 'hsl(210, 30%, 95%)',
                    textColor: isDark ? 'hsl(210, 40%, 98%)' : 'hsl(222, 24%, 12%)'
                },
                typography: {
                    fontFamily: "'Inter', sans-serif",
                    headings: {
                        fontFamily: "'Outfit', sans-serif"
                    }
                }
            }
        };

        try {
            redocEl.innerHTML = '';
            Redoc.init(specObj, themeOpts, redocEl);
        } catch (e) {
            showError('Failed to initialize ReDoc: ' + e.message);
        }
    });

    // ── Open Fullscreen ──────────────────────────────────────
    safeAddListener('btn-openapi-fullscreen', 'click', () => {
        if (!currentSpecObj) return;

        const redocSrc = window.location.origin + '/libs/redoc.standalone.js';
        const apiTitle = (currentSpecObj.info && currentSpecObj.info.title) ? currentSpecObj.info.title : 'API Documentation';

        let specJson;
        try {
            specJson = JSON.stringify(currentSpecObj);
        } catch (e) {
            return showError('Failed to serialise spec: ' + e.message);
        }

        const docWin = window.open('', '_blank');
        if (!docWin) return showError('Pop-up was blocked.');

        docWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(apiTitle)}</title>
  <style>body { margin: 0; padding: 0; font-family: sans-serif; }</style>
</head>
<body>
  <div id="redoc-container"></div>
  <script src="${redocSrc}"><\/script>
  <script>
    Redoc.init(${specJson}, {}, document.getElementById('redoc-container'));
  <\/script>
</body>
</html>`);
        docWin.document.close();
    });
}

// -------------------------------------------------------------
// IP CIDR CALCULATOR & SUBNET PLANNER
// -------------------------------------------------------------
function initIpCidrCalculator() {
    const ipInput = document.getElementById('cidr-ip');
    const ipError = document.getElementById('cidr-ip-error');
    const rangeSlider = document.getElementById('cidr-range');
    const prefixLabel = document.getElementById('cidr-prefix-label');
    const maskSelect = document.getElementById('cidr-mask');

    // Outputs
    const outCidrNotation = document.getElementById('out-cidr-notation');
    const outNetAddress = document.getElementById('out-net-address');
    const outIpRange = document.getElementById('out-ip-range');
    const outBroadAddress = document.getElementById('out-broad-address');
    const outTotalHosts = document.getElementById('out-total-hosts');
    const outWildcardMask = document.getElementById('out-wildcard-mask');
    const outIpClass = document.getElementById('out-ip-class');

    // Binaries
    const binIpAddress = document.getElementById('bin-ip-address');
    const binSubnetMask = document.getElementById('bin-subnet-mask');
    const binNetAddress = document.getElementById('bin-net-address');
    const binBroadAddress = document.getElementById('bin-broad-address');

    if (!ipInput || !rangeSlider || !maskSelect) return;

    // Helper: Prefix to Subnet Mask IP String
    function prefixToMaskString(prefix) {
        let mask = 0;
        if (prefix > 0) {
            mask = (0xFFFFFFFF << (32 - prefix)) >>> 0;
        }
        return [
            (mask >>> 24) & 255,
            (mask >>> 16) & 255,
            (mask >>> 8) & 255,
            mask & 255
        ].join('.');
    }

    // Populate dropdown selector options
    maskSelect.innerHTML = '';
    for (let p = 32; p >= 0; p--) {
        const maskStr = prefixToMaskString(p);
        const option = document.createElement('option');
        option.value = p;
        option.textContent = `${maskStr} (/${p})`;
        if (p === 24) option.selected = true;
        maskSelect.appendChild(option);
    }

    // Helper: Format bits into HTML with network/host color codes
    function getBinarySpanString(val, prefix) {
        const binaryStr = val.toString(2).padStart(32, '0');
        let html = '';
        for (let i = 0; i < 32; i++) {
            const bit = binaryStr.charAt(i);
            const isNetwork = i < prefix;
            const colorClass = isNetwork ? 'var(--success-glow)' : 'var(--warning-glow)';
            html += `<span style="color: ${colorClass}; font-weight: 500;">${bit}</span>`;
            if (i === 7 || i === 15 || i === 23) {
                html += `<span style="color: var(--text-muted); opacity: 0.5; margin: 0 4px;">.</span>`;
            }
        }
        return html;
    }

    // Helper: Integer IP to dotted decimal string
    function intToIpString(val) {
        return [
            (val >>> 24) & 255,
            (val >>> 16) & 255,
            (val >>> 8) & 255,
            val & 255
        ].join('.');
    }

    function calculateSubnet() {
        const ipStr = ipInput.value.trim();
        const prefix = parseInt(rangeSlider.value);
        
        // Synchronize UI Labels
        if (prefixLabel) prefixLabel.textContent = `/${prefix}`;
        
        // Validate IPv4 format
        const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
        const match = ipStr.match(ipPattern);
        
        let isValid = false;
        let octets = [];
        
        if (match) {
            octets = match.slice(1).map(Number);
            isValid = octets.every(o => o >= 0 && o <= 255);
        }

        if (!isValid) {
            ipInput.classList.add('invalid');
            if (ipError) {
                ipError.textContent = "Invalid IPv4 address format. Address must contain 4 octets between 0 and 255.";
                ipError.style.display = 'block';
            }
            // Clear outputs
            if (outCidrNotation) outCidrNotation.textContent = '--';
            if (outNetAddress) outNetAddress.textContent = '--';
            if (outIpRange) outIpRange.textContent = '--';
            if (outBroadAddress) outBroadAddress.textContent = '--';
            if (outTotalHosts) outTotalHosts.textContent = '--';
            if (outWildcardMask) outWildcardMask.textContent = '--';
            if (outIpClass) outIpClass.textContent = '--';
            
            if (binIpAddress) binIpAddress.textContent = '--';
            if (binSubnetMask) binSubnetMask.textContent = '--';
            if (binNetAddress) binNetAddress.textContent = '--';
            if (binBroadAddress) binBroadAddress.textContent = '--';
            return;
        }

        ipInput.classList.remove('invalid');
        if (ipError) ipError.style.display = 'none';

        // 32-bit unsigned integers represent IP space
        const ipVal = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
        const maskVal = prefix > 0 ? (0xFFFFFFFF << (32 - prefix)) >>> 0 : 0;
        
        const netVal = (ipVal & maskVal) >>> 0;
        const broadVal = (netVal | ~maskVal) >>> 0;
        const wildcardVal = (~maskVal) >>> 0;

        // Legacy Classes
        let ipClass = 'Unknown';
        const firstOctet = octets[0];
        if (firstOctet >= 240) ipClass = 'Class E (Experimental)';
        else if (firstOctet >= 224) ipClass = 'Class D (Multicast)';
        else if (firstOctet >= 192) ipClass = 'Class C';
        else if (firstOctet >= 128) ipClass = 'Class B';
        else if (firstOctet >= 1) {
            if (firstOctet === 127) ipClass = 'Class A (Loopback)';
            else ipClass = 'Class A';
        }

        // Host count and usable ranges
        let totalUsableHosts = 0;
        let usableRange = '';

        if (prefix === 32) {
            totalUsableHosts = 1;
            usableRange = `${intToIpString(ipVal)} (Single Host)`;
        } else if (prefix === 31) {
            totalUsableHosts = 2;
            usableRange = `${intToIpString(netVal)} - ${intToIpString(broadVal)}`;
        } else {
            totalUsableHosts = (broadVal - netVal - 1);
            const firstUsable = intToIpString(netVal + 1);
            const lastUsable = intToIpString(broadVal - 1);
            usableRange = `${firstUsable} - ${lastUsable}`;
        }

        // Populate outputs
        if (outCidrNotation) outCidrNotation.textContent = `${intToIpString(ipVal)}/${prefix}`;
        if (outNetAddress) outNetAddress.textContent = intToIpString(netVal);
        if (outIpRange) outIpRange.textContent = usableRange;
        if (outBroadAddress) outBroadAddress.textContent = intToIpString(broadVal);
        if (outTotalHosts) outTotalHosts.textContent = totalUsableHosts.toLocaleString();
        if (outWildcardMask) outWildcardMask.textContent = intToIpString(wildcardVal);
        if (outIpClass) outIpClass.textContent = ipClass;

        // Populate binary diagrams
        if (binIpAddress) binIpAddress.innerHTML = getBinarySpanString(ipVal, prefix);
        if (binSubnetMask) binSubnetMask.innerHTML = getBinarySpanString(maskVal, prefix);
        if (binNetAddress) binNetAddress.innerHTML = getBinarySpanString(netVal, prefix);
        if (binBroadAddress) binBroadAddress.innerHTML = getBinarySpanString(broadVal, prefix);
    }

    // Attach Event Listeners
    ipInput.addEventListener('input', calculateSubnet);
    
    rangeSlider.addEventListener('input', () => {
        maskSelect.value = rangeSlider.value;
        calculateSubnet();
    });
    
    maskSelect.addEventListener('change', () => {
        rangeSlider.value = maskSelect.value;
        calculateSubnet();
    });

    // Run initial calculation on load
    calculateSubnet();
}

// -------------------------------------------------------------
// CHARACTER ENCODINGS & GSM 03.38 TRANSLATOR
// -------------------------------------------------------------
function initCharEncoding() {
    const textInput = document.getElementById('enc-text-input');
    const bytesOutput = document.getElementById('enc-bytes-output');
    const formatSelect = document.getElementById('encoding-format');
    const warningDiv = document.getElementById('enc-validation-warning');
    const btnClear = document.getElementById('btn-enc-clear');

    // Metrics
    const charCountLabel = document.getElementById('enc-char-count');
    const byteSizeLabel = document.getElementById('enc-byte-size');
    const compressionLabel = document.getElementById('enc-compression');
    const binBitstream = document.getElementById('enc-bin-bitstream');

    if (!textInput || !bytesOutput || !formatSelect) return;

    // GSM 03.38 Basic Character Set Mapping String (0 to 127)
    // 0x1B is ESC
    const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1BÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
    
    // GSM 03.38 Extension Table (Preceded by ESC 0x1B)
    const GSM_EXTENSION_ENC = {
        '\f': 0x0A, '^': 0x14, '{': 0x28, '}': 0x29, '\\': 0x2F,
        '[': 0x3C, '~': 0x3D, ']': 0x3E, '|': 0x40, '€': 0x65
    };
    const GSM_EXTENSION_DEC = {
        0x0A: '\f', 0x14: '^', 0x28: '{', 0x29: '}', 0x2F: '\\',
        0x3C: '[', 0x3D: '~', 0x3E: ']', 0x40: '|', 0x65: '€'
    };

    // Helper: Pack 7-bit septets into 8-bit octets (SMS packing)
    function packSeptets(septets) {
        const octets = [];
        let buffer = 0;
        let bufferSize = 0;
        for (let i = 0; i < septets.length; i++) {
            const septet = septets[i] & 0x7F;
            buffer |= (septet << bufferSize);
            bufferSize += 7;
            while (bufferSize >= 8) {
                octets.push(buffer & 0xFF);
                buffer >>>= 8;
                bufferSize -= 8;
            }
        }
        if (bufferSize > 0) {
            octets.push(buffer & 0xFF);
        }
        return octets;
    }

    // Helper: Unpack 8-bit octets into 7-bit septets
    function unpackOctets(octets) {
        const septets = [];
        let buffer = 0;
        let bufferSize = 0;
        for (let i = 0; i < octets.length; i++) {
            buffer |= (octets[i] << bufferSize);
            bufferSize += 8;
            while (bufferSize >= 7) {
                septets.push(buffer & 0x7F);
                buffer >>>= 7;
                bufferSize -= 7;
            }
        }
        return septets;
    }

    // Encode text to bytes based on format
    function encodeText(text, format) {
        let bytes = [];
        let unrepresentable = [];

        if (format === 'utf8') {
            bytes = Array.from(new TextEncoder().encode(text));
        } else if (format === 'utf16') {
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                bytes.push((code >>> 8) & 0xFF);
                bytes.push(code & 0xFF);
            }
        } else if (format === 'ascii') {
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (code <= 127) {
                    bytes.push(code);
                } else {
                    bytes.push(0x3F); // '?'
                    unrepresentable.push(text.charAt(i));
                }
            }
        } else if (format === 'gsm7' || format === 'gsm7packed') {
            const septets = [];
            for (let i = 0; i < text.length; i++) {
                const char = text.charAt(i);
                if (GSM_EXTENSION_ENC[char] !== undefined) {
                    septets.push(0x1B);
                    septets.push(GSM_EXTENSION_ENC[char]);
                } else {
                    const idx = GSM_BASIC.indexOf(char);
                    if (idx >= 0 && idx !== 0x1B) {
                        septets.push(idx);
                    } else {
                        septets.push(63); // '?'
                        unrepresentable.push(char);
                    }
                }
            }
            if (format === 'gsm7') {
                bytes = septets;
            } else {
                bytes = packSeptets(septets);
            }
        } else if (format === 'gsm8') {
            for (let i = 0; i < text.length; i++) {
                const char = text.charAt(i);
                // GSM 8-bit generally maps ISO-8859-1 or maps GSM-7 basic directly
                // We map characters <= 255. Non-mappable gets '?'
                const code = text.charCodeAt(i);
                if (code <= 255) {
                    bytes.push(code);
                } else {
                    bytes.push(0x3F); // '?'
                    unrepresentable.push(char);
                }
            }
        }

        return { bytes, unrepresentable };
    }

    // Decode bytes to text based on format
    function decodeBytes(bytes, format) {
        let text = '';
        let errStr = null;

        try {
            if (format === 'utf8') {
                text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
            } else if (format === 'utf16') {
                for (let i = 0; i < bytes.length; i += 2) {
                    if (i + 1 < bytes.length) {
                        const code = (bytes[i] << 8) | bytes[i + 1];
                        text += String.fromCharCode(code);
                    }
                }
            } else if (format === 'ascii') {
                text = bytes.map(b => b <= 127 ? String.fromCharCode(b) : '?').join('');
            } else if (format === 'gsm7' || format === 'gsm7packed') {
                let septets = bytes;
                if (format === 'gsm7packed') {
                    septets = unpackOctets(bytes);
                }
                
                for (let i = 0; i < septets.length; i++) {
                    const septet = septets[i];
                    if (septet === 0x1B) {
                        if (i + 1 < septets.length) {
                            const nextSeptet = septets[++i];
                            text += GSM_EXTENSION_DEC[nextSeptet] || '';
                        }
                    } else {
                        text += GSM_BASIC.charAt(septet) || '';
                    }
                }
                // Strip trailing null padding if it was added during packing
                if (format === 'gsm7packed') {
                    text = text.replace(/\0+$/, '');
                }
            } else if (format === 'gsm8') {
                text = bytes.map(b => String.fromCharCode(b)).join('');
            }
        } catch (e) {
            errStr = e.message;
        }

        return { text, error: errStr };
    }

    // Helper: Parse Hex String input to integer byte array
    function parseHex(hexStr) {
        const cleaned = hexStr.replace(/[^0-9a-fA-F]/g, '');
        const bytes = [];
        for (let i = 0; i < cleaned.length; i += 2) {
            bytes.push(parseInt(cleaned.substr(i, 2), 16));
        }
        return bytes;
    }

    // Helper: Format byte array into clean Hex String
    function formatHex(bytes) {
        return bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    }

    // Update bitstream visual display
    function updateBitstream(bytes, format) {
        if (!binBitstream) return;
        if (bytes.length === 0) {
            binBitstream.textContent = '--';
            return;
        }

        // Show 7-bit blocks for unpacked GSM-7, and 8-bit blocks for all others
        const bitLen = format === 'gsm7' ? 7 : 8;
        binBitstream.innerHTML = bytes.map(b => {
            const binary = b.toString(2).padStart(bitLen, '0');
            return `<span style="margin-right: 8px; color: var(--primary-glow);">${binary}</span>`;
        }).join('');
    }

    // Dual-directional synchronization logic
    let syncActive = false;

    function handleTextInput() {
        if (syncActive) return;
        syncActive = true;

        const text = textInput.value;
        const format = formatSelect.value;
        
        const { bytes, unrepresentable } = encodeText(text, format);
        bytesOutput.value = formatHex(bytes);
        
        // Update stats
        if (charCountLabel) charCountLabel.textContent = text.length;
        if (byteSizeLabel) byteSizeLabel.textContent = `${bytes.length} byte${bytes.length !== 1 ? 's' : ''}`;
        
        // Calculate packing compression ratio for GSM 7 packed compared to unpacked
        if (compressionLabel) {
            if (format === 'gsm7packed' && text.length > 0) {
                const unpackedSize = text.length; // 1 septet per char
                const ratio = ((1 - (bytes.length / unpackedSize)) * 100).toFixed(1);
                compressionLabel.textContent = `${ratio}% (8 septets in 7 octets)`;
                compressionLabel.style.color = ratio > 0 ? 'var(--success-glow)' : 'var(--text-primary)';
            } else {
                compressionLabel.textContent = '0%';
                compressionLabel.style.color = 'var(--text-primary)';
            }
        }

        // Warn about unrepresentable characters
        if (warningDiv) {
            if (unrepresentable.length > 0) {
                const unique = Array.from(new Set(unrepresentable));
                warningDiv.innerHTML = `<strong>Warning:</strong> Selected encoding does not support characters: <code>${unique.join(' ')}</code>. They will map to <code>?</code> (0x3F).`;
                warningDiv.style.display = 'block';
            } else {
                warningDiv.style.display = 'none';
            }
        }

        updateBitstream(bytes, format);
        syncActive = false;
    }

    function handleBytesInput() {
        if (syncActive) return;
        syncActive = true;

        const hexStr = bytesOutput.value;
        const format = formatSelect.value;
        const bytes = parseHex(hexStr);
        
        const { text, error } = decodeBytes(bytes, format);

        if (error) {
            if (warningDiv) {
                warningDiv.innerHTML = `<strong>Error decoding bytes:</strong> ${error}`;
                warningDiv.style.display = 'block';
            }
        } else {
            textInput.value = text;
            if (warningDiv) warningDiv.style.display = 'none';
        }

        // Update stats
        if (charCountLabel) charCountLabel.textContent = text.length;
        if (byteSizeLabel) byteSizeLabel.textContent = `${bytes.length} byte${bytes.length !== 1 ? 's' : ''}`;
        
        if (compressionLabel) {
            if (format === 'gsm7packed' && text.length > 0) {
                const unpackedSize = text.length;
                const ratio = ((1 - (bytes.length / unpackedSize)) * 100).toFixed(1);
                compressionLabel.textContent = `${ratio}%`;
            } else {
                compressionLabel.textContent = '0%';
            }
        }

        updateBitstream(bytes, format);
        syncActive = false;
    }

    // Attach listeners
    textInput.addEventListener('input', handleTextInput);
    bytesOutput.addEventListener('input', handleBytesInput);
    formatSelect.addEventListener('change', handleTextInput);

    if (btnClear) {
        btnClear.addEventListener('click', () => {
            textInput.value = '';
            bytesOutput.value = '';
            if (charCountLabel) charCountLabel.textContent = '0';
            if (byteSizeLabel) byteSizeLabel.textContent = '0 bytes';
            if (compressionLabel) compressionLabel.textContent = '0%';
            if (binBitstream) binBitstream.textContent = '--';
            if (warningDiv) warningDiv.style.display = 'none';
        });
    }

    // Initial calculation on load
    handleTextInput();
}
