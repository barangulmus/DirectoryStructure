document.addEventListener('DOMContentLoaded', () => {
    const controlsPanel = document.getElementById('controls-panel');
    const selectFolderBtn = document.getElementById('select-folder-btn');
    const controlsContent = document.getElementById('controls-content');
    const treeControls = document.getElementById('tree-controls');
    const excludeInput = document.getElementById('exclude-input');
    const outputPre = document.getElementById('output');
    const copyBtn = document.getElementById('copy-btn');

    // Quick Action Buttons
    const btnCollapseAll = document.getElementById('btn-collapse-all');
    const btnExpandAll = document.getElementById('btn-expand-all');
    const btnDeselectAll = document.getElementById('btn-deselect-all');
    const btnSelectAll = document.getElementById('btn-select-all');
    const btnFoldersOnly = document.getElementById('btn-folders-only');

    let rootDirHandle = null;
    let rootStructure = [];

    const ICONS = {
        folder: `<svg class="icon folder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        file: `<svg class="icon file" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>`
    };

    // --- Main Initializer ---
    if (!window.showDirectoryPicker) {
        selectFolderBtn.disabled = true;
        selectFolderBtn.querySelector('span').textContent = 'Browser Not Supported';
    }

    // --- Event Listeners ---
    selectFolderBtn.addEventListener('click', async () => {
        try {
            const dirHandle = await window.showDirectoryPicker();
            await processAndRender(dirHandle);
        } catch (err) {
            handleError(err);
        }
    });

    // Drag and Drop Listeners
    controlsPanel.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        controlsPanel.classList.add('drag-over');
    });

    controlsPanel.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        controlsPanel.classList.remove('drag-over');
    });

    controlsPanel.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        controlsPanel.classList.remove('drag-over');

        const items = e.dataTransfer.items;
        if (items && items.length > 0 && items[0].kind === 'file') {
            const entry = await items[0].getAsFileSystemHandle();
            if (entry.kind === 'directory') {
                await processAndRender(entry);
            }
        }
    });

    excludeInput.addEventListener('input', updateOutput);
    treeControls.addEventListener('change', updateOutput); // For checkboxes
    treeControls.addEventListener('click', (e) => { // For toggling folders
        const label = e.target.closest('label');
        if (label && label.classList.contains('folder-toggle')) {
            const childrenUl = label.closest('li').querySelector('ul');
            if (childrenUl) {
                childrenUl.classList.toggle('collapsed');
            }
        }
    });

    copyBtn.addEventListener('click', () => {
        if (navigator.clipboard && outputPre.textContent) {
            navigator.clipboard.writeText(outputPre.textContent)
                .then(() => {
                    const originalText = copyBtn.querySelector('span').textContent;
                    copyBtn.querySelector('span').textContent = 'Copied!';
                    setTimeout(() => { copyBtn.querySelector('span').textContent = originalText; }, 2000);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        }
    });

    // Quick Action Button Listeners
    btnCollapseAll.addEventListener('click', () => toggleAllFolders(rootStructure, true));
    btnExpandAll.addEventListener('click', () => toggleAllFolders(rootStructure, false));
    btnDeselectAll.addEventListener('click', () => toggleAllCheckboxes(rootStructure, false));
    btnSelectAll.addEventListener('click', () => toggleAllCheckboxes(rootStructure, true));
    btnFoldersOnly.addEventListener('click', () => toggleFoldersOnly(rootStructure));

    // --- Core Functions ---
    async function processAndRender(dirHandle) {
        rootDirHandle = dirHandle;
        rootStructure = await processDirectory(rootDirHandle);
        renderControls();
        updateOutput();
        controlsContent.classList.remove('hidden');
    }
    
    function handleError(err) {
        if (err.name !== 'AbortError') {
            console.error("Error processing directory:", err);
            alert(`Could not process directory. Error: ${err.message}`);
        }
    }

    async function processDirectory(dirHandle) {
        const entries = [];
        for await (const entry of dirHandle.values()) {
            const item = { 
                name: entry.name, 
                type: entry.kind, 
                checked: true 
            };
            if (entry.kind === 'directory') {
                item.children = await processDirectory(entry);
            }
            entries.push(item);
        }
        return entries.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'directory' ? -1 : 1;
        });
    }

    function renderControls() {
        treeControls.innerHTML = '';
        const rootUl = buildControlTree(rootStructure);
        treeControls.appendChild(rootUl);
    }

    function buildControlTree(structure) {
        const ul = document.createElement('ul');
        structure.forEach(entry => {
            const li = document.createElement('li');
            const id = `item-${Math.random().toString(36).substr(2, 9)}`;
            const isDirectory = entry.type === 'directory';
            
            li.innerHTML = `
                <div class="tree-item">
                    <input type="checkbox" id="${id}" ${entry.checked ? 'checked' : ''}>
                    <label for="${id}" class="${isDirectory ? 'folder-toggle' : ''}">
                        ${isDirectory ? ICONS.folder : ICONS.file}
                        <span>${entry.name}</span>
                    </label>
                </div>
            `;
            
            const checkbox = li.querySelector('input[type="checkbox"]');
            checkbox.addEventListener('change', (e) => {
                entry.checked = e.target.checked;
                if (isDirectory) {
                    toggleChildren(entry.children, entry.checked);
                    renderControls(); // Re-render to reflect changes
                }
                updateOutput();
            });

            if (isDirectory && entry.children && entry.children.length > 0) {
                li.appendChild(buildControlTree(entry.children));
            }
            ul.appendChild(li);
        });
        return ul;
    }
    
    function toggleChildren(children, isChecked) {
        children.forEach(child => {
            child.checked = isChecked;
            if (child.children) {
                toggleChildren(child.children, isChecked);
            }
        });
    }

    function toggleAllFolders(structure, collapse) {
        const uls = treeControls.querySelectorAll('ul');
        uls.forEach(ul => {
            if (ul !== treeControls.querySelector('ul')) { // Don't collapse the root ul
                if (collapse) {
                    ul.classList.add('collapsed');
                } else {
                    ul.classList.remove('collapsed');
                }
            }
        });
    }

    function toggleAllCheckboxes(structure, check) {
        structure.forEach(entry => {
            entry.checked = check;
            if (entry.children) {
                toggleAllCheckboxes(entry.children, check);
            }
        });
        renderControls();
        updateOutput();
    }

    function toggleFoldersOnly(structure) {
        structure.forEach(entry => {
            if (entry.type === 'file') {
                entry.checked = false;
            } else if (entry.type === 'directory' && entry.children) {
                toggleFoldersOnly(entry.children);
            }
        });
        renderControls();
        updateOutput();
    }

    function updateOutput() {
        if (!rootDirHandle) return;

        const excludePatterns = excludeInput.value.split(',').map(p => p.trim()).filter(p => p);
        const filteredStructure = filterStructure(JSON.parse(JSON.stringify(rootStructure)), excludePatterns);
        const treeString = `${rootDirHandle.name}/
${buildTreeString(filteredStructure)}`;
        outputPre.textContent = treeString;
    }

    function filterStructure(structure, patterns) {
        return structure.filter(entry => {
            const isExcluded = !entry.checked || patterns.some(p => {
                try {
                    // Escape special regex characters in the pattern, then replace * with .*
                    const escapedPattern = p.replace(/[.*+?^${}()[\]\\]/g, '\\$&').replace(/\*/g, '.*');
                    return new RegExp(escapedPattern).test(entry.name);
                } catch (e) {
                    console.warn(`Invalid regex pattern: ${p}`);
                    return false;
                }
            });

            if (isExcluded) return false;

            if (entry.children) {
                entry.children = filterStructure(entry.children, patterns);
            }
            return true;
        });
    }

    function buildTreeString(structure, prefix = '') {
        let result = '';
        structure.forEach((entry, index) => {
            const isLast = index === structure.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const displayName = entry.type === 'directory' ? `${entry.name}/` : entry.name;
            result += `${prefix}${connector}${displayName}\n`;

            if (entry.type === 'directory' && entry.children && entry.children.length > 0) {
                const newPrefix = prefix + (isLast ? '    ' : '│   ');
                result += buildTreeString(entry.children, newPrefix);
            }
        });
        return result;
    }
});