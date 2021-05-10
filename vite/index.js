const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const connect = require('connect');
const esbuild = require('esbuild');
const middlewares = connect();
const cacheDir = path.join(__dirname, '../', 'node_modules/.vite');
const compileSFC = require('@vue/compiler-sfc');
const compileDom = require('@vue/compiler-dom');
const optimizeDeps = async () => {
    if (fs.existsSync(cacheDir)) return false;
    fs.mkdirSync(cacheDir, { recursive: true });
    const deps = Object.keys(require('../package.json').dependencies);
    const result = await esbuild.build({
        entryPoints: deps,
        bundle: true,
        format: 'esm',
        logLevel: 'error',
        splitting: true,
        sourcemap: true,
        outdir: cacheDir,
        treeShaking: 'ignore-annotations',
        metafile: true,
        define: {'process.env.NODE_ENV': "\"development\""}
      });
    const outputs = Object.keys(result.metafile.outputs);
    const data = {};
    deps.forEach((dep) => {
        data[dep] = outputs.find(output => output.endsWith(`${dep}.js`));
    });
    const dataPath = path.join(cacheDir, '_metadata.json');
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};
const createServer = async ()=> {
    await optimizeDeps();
    http.createServer(middlewares).listen(3000, () => {
        console.log('simple-vite-dev-server start at localhost: 3000!');
    });
};
const indexHtmlMiddleware = (req, res, next) => {
    if (req.url === '/') {
        const htmlPath = path.join(__dirname, '../index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        return res.end(htmlContent);
    }
    next();
};
const rewriteImportOfJs = (jsContent) => {
    const fromReg = / from ['"](.*)['"]/g;
    return jsContent.replace(fromReg, (s1, s2) => {
        if(s2.startsWith('/') || s2.startsWith('./') || s2.startsWith('../')) {
            return s1;
        } else {
            const data = require(path.join(cacheDir, '_metadata.json'));
            return ` from '/${data[s2]}'`;
        }
    });

};
const transformMiddleware = (req, res, next) => {
    if (req.url.endsWith('.js') || req.url.endsWith('.map')) {
        const jsPath = path.join(__dirname, '../', req.url);
        const jsContent = fs.readFileSync(jsPath, 'utf-8');
        res.setHeader('Content-Type', 'application/javascript');
        res.statusCode = 200;
        const rewriteContent = req.url.endsWith('.map') ? jsContent : rewriteImportOfJs(jsContent);
        return res.end(rewriteContent);
    }
    if (req.url.indexOf('.vue')!==-1) {
        const query = url.parse(req.url).query;
        const vuePath = path.join(__dirname, '../', req.url.split('?')[0]);
        const vueContent =  fs.readFileSync(vuePath, 'utf-8');
        const vueParseContet = compileSFC.parse(vueContent);
        let jsContent = '';
        if (query && query === 'type=template') {
            const tpl = vueParseContet.descriptor.template.content;
            jsContent = compileDom.compile(tpl, { mode: 'module' }).code;
        } else {
            const scriptContent = vueParseContet.descriptor.script.content;
            const replaceScript = scriptContent.replace('export default ', 'const __script = ');
            jsContent = `
                    ${rewriteImportOfJs(replaceScript)}
                    import { render as __render } from '${req.url}?type=template'
                    __script.render = __render;
                    export default __script;
            `;
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.statusCode = 200;
        return res.end(rewriteImportOfJs(jsContent));
    }
    next();
};
middlewares.use(indexHtmlMiddleware);
middlewares.use(transformMiddleware);
createServer();