const http = require('http');
const fs = require('fs');
const path = require('path');
const connect = require('connect');
const PORT = 3000;
const middlewares = connect();
http.createServer(middlewares).listen(PORT, () => {
    console.log(`simple-vite-dev-server start at localhost: ${PORT}!`);
});
const indexHtmlMiddleware = (req, res, next) => {
    const url = req.url;
    if (url === '/') {
        const htmlPath = path.join(__dirname, '../index.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.statusCode = 200;
        return res.end(htmlContent);
    }
    next();
};
middlewares.use(indexHtmlMiddleware);
