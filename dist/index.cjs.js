'use strict';

var fs = require('fs');
var htmlMinifier = require('html-minifier');
var nodeHtmlParser = require('node-html-parser');
var path = require('path');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);
var path__namespace = /*#__PURE__*/_interopNamespace(path);

const addNewLine = (node) => node.appendChild(new nodeHtmlParser.TextNode('\n  ', node));
const getChildElement = (node, tag, append = true) => {
    let child = node.querySelector(tag);
    if (!child) {
        child = new nodeHtmlParser.HTMLElement(tag, {}, '', node);
        if (append) {
            node.appendChild(child);
        }
        else {
            node.childNodes.unshift(child);
        }
    }
    return child;
};
const appendNodeFactory = (context, head, body) => (options = {}, filePath) => {
    // Check if `as` is set
    const asSet = 'as' in options;
    // Try to detect the tag if not set
    if (!options.tag) {
        if (asSet || 'rel' in options) {
            // Seems to be a link
            options.tag = 'link';
        }
        else if (filePath) {
            // Detect from the extension
            options.tag = /.+\.m?js$/.test(filePath) ? 'script' : 'link';
        }
    }
    const isLink = options.tag === 'link';
    if (isLink) {
        if (!asSet && options.rel === 'preload') {
            context.error('One or more entries or externals have the `rel` option \
set to "preload" but no `as` option defined');
        }
    }
    if (filePath) {
        if (isLink) {
            options.href = filePath;
        }
        else {
            options.src = filePath;
        }
    }
    else if (!('src' in options || 'href' in options || 'text' in options)) {
        context.error('One of `src`, `href`, or `text` property must be defined explicitly for `externals`');
    }
    if (isLink && !options.rel && typeof options.href === 'string' && path__namespace.extname(options.href) == '.css') {
        options.rel = 'stylesheet';
    }
    const { tag, text, ...attrs } = options;
    const attrsstr = Object.entries(attrs).reduce((prev, [key, val]) => {
        prev += key;
        if (val !== true) {
            prev += '=';
            prev += JSON.stringify(val);
        }
        prev += ' ';
        return prev;
    }, '');
    const parent = tag === 'script' ? body : head;
    addNewLine(parent);
    const entry = new nodeHtmlParser.HTMLElement(tag, {}, attrsstr, parent);
    parent.appendChild(entry);
    if (text) {
        entry.appendChild(new nodeHtmlParser.TextNode(text, entry));
    }
};
const normalizePrefix = (prefix = '') => {
    if (!prefix.endsWith('/')) {
        prefix += '/';
    }
    return prefix;
};
const isChunk = (item) => item.type === 'chunk';
const html2 = ({ entries = {}, exclude = new Set(), externals, favicon, fileName: htmlFileName, inject = true, meta, minify: minifyOptions, onlinePath, template, title, ...options }) => ({
    name: 'html2',
    buildStart() {
        const deprecated = {
            preload: 'entries',
            modules: 'entries',
            nomodule: 'entries',
        };
        for (const o of Object.keys(options)) {
            if (o in deprecated) {
                this.error(`The \`${o}\` option is deprecated, use \`${deprecated[o]}\` instead.`);
            }
            else {
                this.warn(`Ignoring unknown option \`${o}\``);
            }
        }
        if (externals && Array.isArray(externals)) {
            this.error('`externals` must be an object: `{before: [], after: []}`');
        }
        const templateIsFile = fs__namespace.existsSync(template);
        if (templateIsFile && fs__namespace.lstatSync(template).isFile()) {
            this.addWatchFile(template);
        }
        else if (!htmlFileName) {
            this.error('When `template` is an HTML string the `fileName` option must be defined');
        }
        this.cache.set("templateIsFile" /* templateIsFile */, templateIsFile);
        if (favicon && !(fs__namespace.existsSync(favicon) && fs__namespace.lstatSync(favicon).isFile())) {
            this.error("The provided favicon file does't exist");
        }
        if (typeof inject === 'string') {
            this.warn('Invalid `inject` must be `true`, `false` or `undefined`');
            inject = true;
        }
        if (inject) {
            for (const name of exclude) {
                if (name in entries) {
                    this.warn(`Excluding a configured entry "${name}"`);
                }
            }
        }
        const check = ({ tag, ...others }) => {
            if (tag && tag !== 'link' && tag !== 'script' && tag !== 'style') {
                this.error(`Invalid value for the \`tag\` option: \
must be one of "link", "script" or "style"; received ${JSON.stringify(tag)}`);
            }
            const nmt = typeof others.nomodule;
            if (nmt !== 'boolean' && nmt !== 'undefined') {
                this.error(`Invalid value for the \`nomodule\` option: \
must be one of \`boolean\`, \`undefined\`; received ${JSON.stringify(others.nomodule)}`);
            }
        };
        for (const e of Object.values(entries)) {
            check(e);
            if (e.tag === 'style') {
                this.error('An entry cannot have a `tag` property set to "style"');
            }
        }
        const { before = [], after = [], } = externals || {};
        before.forEach(check);
        after.forEach(check);
    },
    outputOptions({ dir, file: bundleFile, format, }) {
        if (!htmlFileName) {
            let distDir = process.cwd();
            if (dir) {
                distDir = path__namespace.resolve(distDir, dir);
            }
            else if (bundleFile) {
                const bundleDir = path__namespace.dirname(bundleFile);
                distDir = path__namespace.isAbsolute(bundleDir) ? bundleDir : path__namespace.resolve(distDir, bundleDir);
            }
            // Template is always a file path
            htmlFileName = path__namespace.resolve(distDir, path__namespace.basename(template));
            if (htmlFileName === path__namespace.resolve(template)) {
                this.error("Could't write the generated HTML to the source template, \
define one of the options: `file`, `output.file` or `output.dir`");
            }
        }
        const modulesSupport = !!format && /^(esm?|module)$/.test(format);
        const checkModules = (e) => {
            if (e.type == 'module') {
                if (e.tag === 'script' && e.nomodule) {
                    this.error('One or more entries or externals have \
the `nomodule` option enabled and `type` set to "module"');
                }
                if (!modulesSupport) {
                    this.error(`One or more entries or externals have \
the \`type\` option set to "module" but the \`output.format\` \
is ${JSON.stringify(format)}, consider to use another format \
or change the \`type\``);
                }
            }
        };
        Object.values(entries).forEach(checkModules);
        const { before = [], after = [], } = externals || {};
        before.forEach(checkModules);
        after.forEach(checkModules);
        return null;
    },
    generateBundle(output, bundle) {
        const data = this.cache.get("templateIsFile" /* templateIsFile */)
            ? fs__namespace.readFileSync(template).toString()
            : template;
        const doc = nodeHtmlParser.parse(data, {
            comment: true,
        });
        const html = doc.querySelector('html');
        if (!html) {
            this.error("The input template doesn't contain the `html` tag");
        }
        const head = getChildElement(html, 'head', false);
        const body = getChildElement(html, 'body');
        if (meta) {
            const nodes = head.querySelectorAll('meta');
            for (const [name, content] of Object.entries(meta)) {
                const oldMeta = nodes.find(n => n.attributes.name === name);
                const newMeta = new nodeHtmlParser.HTMLElement('meta', {}, `name="${name}" content="${content}"`, head);
                if (oldMeta) {
                    head.exchangeChild(oldMeta, newMeta);
                }
                else {
                    addNewLine(head);
                    head.appendChild(newMeta);
                }
            }
        }
        // Inject favicons from the [rollup-plugin-favicons](https://github.com/mentaljam/rollup-plugin-favicons)
        const { __favicons_output: favicons = [] } = output;
        for (const f of favicons) {
            head.appendChild(new nodeHtmlParser.TextNode(f, head));
            addNewLine(head);
        }
        if (title) {
            let node = head.querySelector('title');
            if (!node) {
                addNewLine(head);
                node = new nodeHtmlParser.HTMLElement('title', {}, '', head);
            }
            node.set_content(title);
        }
        const prefix = normalizePrefix(onlinePath);
        const appendNode = appendNodeFactory(this, head, body);
        const processExternal = (e) => {
            if (!e.tag) {
                this.error('`tag` property must be defined explicitly for `externals`');
            }
            appendNode(e);
        };
        const { before = [], after = [], } = externals || {};
        // Inject externals before
        before.forEach(processExternal);
        // Inject generated files
        if (inject) {
            if (Array.isArray(exclude)) {
                exclude = new Set(exclude);
            }
            for (const file of Object.values(bundle)) {
                const { name, fileName } = file;
                if (!name || !exclude.has(name)) {
                    const filePath = prefix + fileName;
                    const options = name ? entries[name] : undefined;
                    if (options || !isChunk(file) || file.isEntry) {
                        appendNode(options, filePath);
                    }
                }
            }
        }
        if (favicon) {
            const nodes = head.querySelectorAll('link');
            const rel = 'shortcut icon';
            const oldLink = nodes.find(n => n.attributes.rel === rel);
            const fileName = path__namespace.basename(favicon);
            const filePath = prefix + fileName;
            const newLink = new nodeHtmlParser.HTMLElement('link', {}, `rel="${rel}" href="${filePath}"`, head);
            if (oldLink) {
                head.exchangeChild(oldLink, newLink);
            }
            else {
                addNewLine(head);
                head.appendChild(newLink);
            }
            this.emitFile({
                fileName,
                source: fs__namespace.readFileSync(favicon),
                type: 'asset',
            });
        }
        // Inject externals after
        after.forEach(processExternal);
        let source = '<!doctype html>\n' + doc.toString();
        if (minifyOptions) {
            source = htmlMinifier.minify(source, minifyOptions);
        }
        // `file` has been checked in the `outputOptions` hook
        this.emitFile({
            fileName: path__namespace.basename(htmlFileName),
            source,
            type: 'asset',
        });
    },
});

module.exports = html2;
